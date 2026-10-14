"""One door for every AI call. Only two AIs: Gemini (API key) and Claude (Claude Code CLI).

How it works, in plain words:
  APPLICATION PACKS  -> generate_pack()
     1. Claude (config.yaml -> claude_pack_model, e.g. sonnet) through `claude -p`.
     2. If Claude fails: Gemini tailoring_model, then gemini_backup_model.
  JOB SCORING        -> generate_score()
     1. Gemini model, then gemini_backup_model, one job at a time.
     2. If both fail, it raises GeminiExhausted. run.py then sends those jobs to Claude in
        batches of 10 (score_batch_with_claude), up to claude_scoring_daily_cap jobs a day.
        Jobs nobody could score stay unscored and are tried again on the next run.

Every model gets ai_tries_per_model tries (config.yaml), with ai_timeout_seconds per answer.
QUOTA MEMORY: when Gemini says a model's DAILY limit is used up (error 429), that model is written
in data/gemini_quota.json and skipped until tomorrow - no waiting, no retrying.
"""

import json
import subprocess
import tempfile
import time
from datetime import date
from pathlib import Path

import yaml
from google import genai
from google.genai import types
from pydantic import TypeAdapter

CONFIG = Path("config.yaml")
ENV_FILE = Path(".env")
QUOTA_FILE = Path("data/gemini_quota.json")          # Gemini models out of daily quota today
CLAUDE_USAGE_FILE = Path("data/claude_usage.json")   # how many jobs Claude scored today

MAX_OUTPUT_TOKENS = 16384  # room for a full CV + letter + prep sheet (a cut-off answer = broken JSON)

# Errors that will repeat on every try (wrong key, no access): stop at once, don't try again.
FATAL_GEMINI_ERRORS = ("API_KEY_INVALID", "PERMISSION_DENIED")

# Set when the Claude CLI failed (limit reached, not logged in...): we skip it for the rest of this run.
CLAUDE_FAILED = False
# Gemini "busy" (503 UNAVAILABLE) answers in a row. At gemini_busy_limit (config.yaml) Gemini is
# skipped for the rest of this run and everything goes straight to Claude.
_GEMINI_BUSY_IN_A_ROW = 0
GEMINI_OFF_THIS_RUN = False
_CLAUDE_SCORED_THIS_RUN = 0


class AllProvidersFailed(Exception):
    """Every AI that may be used for this answer failed. The message says why."""


class GeminiExhausted(Exception):
    """Job scoring: no Gemini model could answer. run.py collects these jobs for Claude."""


def settings() -> dict:
    """All AI settings from config.yaml, with safe defaults if a line is missing."""
    config = yaml.safe_load(CONFIG.read_text(encoding="utf-8")) or {}
    return {
        "timeout": int(config.get("ai_timeout_seconds", 45)),
        "claude_timeout": int(config.get("claude_timeout_seconds", 180)),
        "tries": max(1, int(config.get("ai_tries_per_model", 2))),
        "busy_limit": int(config.get("gemini_busy_limit", 3)),
        "wait": int(config.get("ai_retry_wait_seconds", 5)),
        "use_claude": bool(config.get("use_claude", True)),
        "claude_pack_model": str(config.get("claude_pack_model") or "sonnet"),
        "claude_scoring_model": str(config.get("claude_scoring_model") or "haiku"),
        "claude_cap": int(config.get("claude_scoring_daily_cap", 150)),
        "gemini_backup": config.get("gemini_backup_model") or "",
    }


def _read_env_key(name: str) -> str:
    """Read one value from the .env file (a tiny reader, so no new package is needed)."""
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _extract_json(text: str) -> str:
    """Models sometimes wrap JSON in ```json fences or add a sentence. Keep only the {...} part."""
    start, end = (text or "").find("{"), (text or "").rfind("}")
    return text[start:end + 1] if start != -1 and end > start else text


# ---------- Gemini quota memory (data/gemini_quota.json) ----------

def _models_out_today() -> list[str]:
    """Gemini models that hit their DAILY limit today. A new day = an empty list again."""
    try:
        data = json.loads(QUOTA_FILE.read_text())
    except Exception:
        return []
    return data.get("models", []) if data.get("date") == date.today().isoformat() else []


def _mark_out_today(model: str) -> None:
    models = _models_out_today()
    if model not in models:
        models.append(model)
    QUOTA_FILE.parent.mkdir(exist_ok=True)
    QUOTA_FILE.write_text(json.dumps({"date": date.today().isoformat(), "models": models}))


def is_quota_error(message: str) -> bool:
    return "RESOURCE_EXHAUSTED" in message or "429" in message[:60]


def is_daily_limit(message: str) -> bool:
    """Gemini names the limit that was hit, e.g. 'GenerateRequestsPerDayPerProjectPerModel'.
    A per-MINUTE limit is not daily: then we only move on to the next model for this answer."""
    lowered = message.lower()
    return "perday" in lowered or "per day" in lowered or "daily" in lowered


# ---------- Gemini ----------

def _ask_gemini(prompt: str, schema, api_key: str, model: str, temperature: float, timeout: int):
    # http_options timeout is in milliseconds
    client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=timeout * 1000))
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
            max_output_tokens=MAX_OUTPUT_TOKENS,
        ),
    )
    if response.parsed is not None:
        return response.parsed
    return schema.model_validate_json(response.text)  # raises if the JSON is broken


def _try_gemini(prompt: str, schema, api_key: str, models: list[str], temperature: float):
    """Try each Gemini model in order, ai_tries_per_model times each.
    Returns (answer, "gemini/model"), or raises GeminiExhausted with the reasons."""
    global _GEMINI_BUSY_IN_A_ROW, GEMINI_OFF_THIS_RUN
    s = settings()
    if GEMINI_OFF_THIS_RUN:
        raise GeminiExhausted("Gemini was busy too often - skipped for the rest of this run")
    problems = []
    for model in dict.fromkeys(m for m in models if m):  # no empty names, no repeats
        if model in _models_out_today():
            problems.append(f"{model}: daily limit already used up today")
            continue
        for attempt in range(1, s["tries"] + 1):
            try:
                answer = _ask_gemini(prompt, schema, api_key, model, temperature, s["timeout"])
                _GEMINI_BUSY_IN_A_ROW = 0
                return answer, f"gemini/{model}"
            except Exception as error:
                message = str(error)
                if "503" in message[:60] or "UNAVAILABLE" in message:
                    _GEMINI_BUSY_IN_A_ROW += 1
                    if _GEMINI_BUSY_IN_A_ROW >= s["busy_limit"]:
                        GEMINI_OFF_THIS_RUN = True
                        print(f"    Gemini answered 'busy' {_GEMINI_BUSY_IN_A_ROW} times in a row - "
                              f"skipping Gemini for the rest of this run (going to Claude)", flush=True)
                        raise GeminiExhausted("Gemini busy (503) too often")
                else:
                    _GEMINI_BUSY_IN_A_ROW = 0
                if any(code in message for code in FATAL_GEMINI_ERRORS):
                    raise  # wrong key / no access: trying again cannot help
                if is_quota_error(message):
                    if is_daily_limit(message):
                        _mark_out_today(model)
                        print(f"    Gemini {model}: daily limit used up - skipping it until tomorrow", flush=True)
                    else:
                        print(f"    Gemini {model}: per-minute limit hit - trying the next model", flush=True)
                    problems.append(f"{model}: limit reached")
                    break  # never wait and retry on a quota error
                if "NOT_FOUND" in message:
                    print(f"    Gemini {model}: model name not found - check config.yaml", flush=True)
                    problems.append(f"{model}: model name not found")
                    break
                problems.append(f"{model}: {message[:80]}")
                print(f"    Gemini {model} try {attempt}/{s['tries']} failed: {message[:80]}", flush=True)
                if attempt < s["tries"]:
                    time.sleep(s["wait"])
    raise GeminiExhausted(" | ".join(problems) or "no Gemini model set in config.yaml")


# ---------- Claude (through the Claude Code CLI) ----------

def _run_claude(prompt: str, instructions: str, model: str) -> str:
    """Run `claude -p` once and return its text answer. The prompt goes in on stdin.
    Nothing else is allowed: no tools, no skills, no MCP servers, no project files (we run it
    in an empty temp folder, so it cannot even see this project's CLAUDE.md)."""
    command = ["claude", "-p", "--model", model, "--max-turns", "1", "--output-format", "json",
               "--tools", "", "--disable-slash-commands", "--strict-mcp-config",
               "--no-session-persistence", "--system-prompt", instructions]
    with tempfile.TemporaryDirectory() as empty_folder:
        done = subprocess.run(command, input=prompt, capture_output=True, text=True,
                              timeout=settings()["claude_timeout"], cwd=empty_folder)
    if done.returncode != 0:
        raise RuntimeError(f"claude exited with {done.returncode}: {(done.stderr or done.stdout)[:150]}")
    reply = json.loads(done.stdout)
    if reply.get("is_error"):
        raise RuntimeError(str(reply.get("result"))[:150])
    return reply.get("result", "")


def _try_claude_pack(prompt: str, schema):
    """Claude for application packs, ai_tries_per_model tries. Returns (answer, "claude/model").
    A broken JSON answer (ValueError) is worth another try; anything else (usage limit reached,
    not logged in, too slow) switches Claude off for the rest of this run."""
    global CLAUDE_FAILED
    s = settings()
    model = s["claude_pack_model"]
    instructions = ("Answer with ONE JSON object only (no text around it, no code fences) that "
                    "follows this JSON schema exactly:\n" + json.dumps(schema.model_json_schema()))
    for attempt in range(1, s["tries"] + 1):
        try:
            text = _run_claude(prompt, instructions, model)
            return schema.model_validate_json(_extract_json(text)), f"claude/{model}"
        except ValueError as error:  # broken JSON (pydantic's error is a ValueError too)
            print(f"    Claude {model} try {attempt}/{s['tries']}: broken answer ({str(error)[:80]})", flush=True)
        except Exception as error:
            CLAUDE_FAILED = True
            print(f"    Claude {model} failed: {str(error)[:100]} - not using Claude again in this run", flush=True)
            return None
    return None


# ---------- the two functions everything uses ----------

def generate_pack(prompt: str, schema, gemini_key: str, gemini_model: str, temperature: float):
    """Application packs: Claude first, then Gemini (gemini_model, then gemini_backup_model).
    Returns (answer, "provider/model"). Raises AllProvidersFailed if nothing could answer."""
    s = settings()
    if s["use_claude"] and not CLAUDE_FAILED:
        result = _try_claude_pack(prompt, schema)
        if result:
            return result
        print("    trying Gemini", flush=True)
    try:
        return _try_gemini(prompt, schema, gemini_key, [gemini_model, s["gemini_backup"]], temperature)
    except GeminiExhausted as error:
        raise AllProvidersFailed(f"Claude and Gemini both failed. Gemini: {error}")


def generate_score(prompt: str, schema, gemini_key: str, gemini_model: str, temperature: float):
    """Job scoring, one job: Gemini only (gemini_model, then gemini_backup_model).
    Raises GeminiExhausted if neither can answer (run.py then tries Claude in batches)."""
    return _try_gemini(prompt, schema, gemini_key, [gemini_model, settings()["gemini_backup"]], temperature)


# ---------- job scoring with Claude: batches + a daily cap ----------

def _claude_usage() -> dict:
    """{"date": today, "scored": n}. A new day starts again at 0."""
    today = date.today().isoformat()
    try:
        data = json.loads(CLAUDE_USAGE_FILE.read_text())
    except Exception:
        data = {}
    if data.get("date") != today:
        data = {"date": today, "scored": 0}
    return data


def claude_scoring_left_today() -> int:
    """How many more jobs Claude may score today (0 if Claude is off, has failed, or the cap is reached)."""
    s = settings()
    if not s["use_claude"] or CLAUDE_FAILED:
        return 0
    return max(0, s["claude_cap"] - _claude_usage()["scored"])


def usage_status() -> dict:
    """Today's AI usage for the report's meter: Claude scorings used / cap, and which
    Gemini models are out of their daily quota (they come back tomorrow)."""
    config = yaml.safe_load(CONFIG.read_text(encoding="utf-8")) or {}
    s = settings()
    out_today = _models_out_today()
    gemini = []
    for role, key in (("Scoring", "model"), ("Packs", "tailoring_model"), ("Backup", "gemini_backup_model")):
        model = config.get(key)
        if model:
            gemini.append({"role": role, "model": model, "out": model in out_today})
    return {"claude_on": s["use_claude"], "claude_used": _claude_usage()["scored"],
            "claude_cap": s["claude_cap"], "gemini": gemini}


def claude_scoring_summary() -> str:
    """One line for the end of a run."""
    return (f"Claude scored {_CLAUDE_SCORED_THIS_RUN} jobs in this run "
            f"({_claude_usage()['scored']} of {settings()['claude_cap']} allowed today).")


def score_batch_with_claude(prompt: str, item_schema) -> list:
    """Send ONE request with several jobs; Claude answers with ONE JSON list.
    Returns the items that came back valid (each has an `id`; the caller matches them to jobs).
    Raises if Claude cannot be reached or the list is unreadable."""
    global CLAUDE_FAILED, _CLAUDE_SCORED_THIS_RUN
    instructions = ("Answer with ONE JSON list only (no text around it, no code fences): one object "
                    "per job, each following this JSON schema exactly:\n"
                    + json.dumps(item_schema.model_json_schema()))
    try:
        text = _run_claude(prompt, instructions, settings()["claude_scoring_model"])
    except Exception:
        CLAUDE_FAILED = True  # limit reached, not logged in, timeout...: skip Claude for the rest of the run
        raise
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end <= start:
        raise ValueError("Claude did not send a JSON list")
    items = []
    for raw in json.loads(text[start:end + 1]):
        try:
            items.append(TypeAdapter(item_schema).validate_python(raw))
        except Exception:
            pass  # one broken item: that job stays unscored and is tried again next run
    # remember the count (the file keeps today's total, the variable counts this run)
    usage = _claude_usage()
    usage["scored"] += len(items)
    _CLAUDE_SCORED_THIS_RUN += len(items)
    CLAUDE_USAGE_FILE.parent.mkdir(exist_ok=True)
    CLAUDE_USAGE_FILE.write_text(json.dumps(usage))
    return items
