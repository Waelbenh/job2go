"""tailor.py - makes an application pack for ONE job: CV, motivation letter, prep sheet.

Usage:  python tailor.py 146               (146 = the job number shown on its card in the report)
        python tailor.py 146 --suffix v2   (a NEW version next to the old files: ..._CV_v2.pdf)
"Remake pack" in the web app runs it with --suffix remake and, optionally, the environment
variable JOB2GO_PACK_NOTE = what you want done better. That note is passed to the writing step.

What happens (the AI is Claude first - "claude_pack_model" in config.yaml - then Gemini
"tailoring_model" and "gemini_backup_model" as backups; see llm.py):
  1. ANALYSIS: the AI reads the posting: the real role type, the 4-6 main duties, must-haves,
     key words and one company hook. It also makes a MATCH MAP: for each duty, your strongest
     real evidence from profile.yaml.
  2. WRITING: the AI writes the CV, letter and prep sheet from that match map, choosing bullet
     "angles" from profile.yaml. Code fixes small slips itself and CHECKS the rules; a real
     content problem means one more try with a list of what to fix.
  3. RECRUITER REVIEW: the AI acts as a strict hiring manager: scores the draft 1-10, lists the
     top 3 weaknesses and writes an improved version. Code checks the improved version, the
     manager scores it too, and the better one is kept. The score is the pack's "Quality".
  4. render_pack.py turns the text into .docx and .pdf files (CV must fit on one page).
  5. The tracker gets the status "pack ready" (your other statuses and notes stay) and the Quality.

Everything goes into data/applications/<company>_<number>/. The analysis, match map and review
are at the top of prep.md.
"""

import difflib
import json
import os
import time
import re
import sys
from datetime import date
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

import llm
import render_pack
from agent import excel, home, report, store
from agent.pack_prompts import ANALYSIS_PROMPT, REVIEW_PROMPT, RULES, SCORE_PROMPT, WRITE_PROMPT

CONFIG = Path("config.yaml")
PROFILE = Path("profile.yaml")
SECRETS = Path("secrets.yaml")
APPLICATIONS = Path("data/applications")
DEFAULT_MODEL = "gemini-3.8-flash"
MAX_TRIES = 3  # first try + up to 2 fixes

# Exit codes (serve.py reads these to show a clear message on the card)
EXIT_OK, EXIT_ERROR, EXIT_LIMIT = 0, 1, 3

# Words that must never appear (English from render_pack's list, plus Spanish / French twins)
BANNED_WORDS = [
    "spearheaded", "leveraged", "passionate", "dynamic", "results-driven", "synergy",
    "go-getter", "rockstar", "guru", "thrilled",
    "apasionado", "apasionada", "dinámico", "dinámica", "orientado a resultados",
    "orientada a resultados", "sinergia", "emocionado", "emocionada",
    "passionné", "passionnée", "dynamique", "orienté résultats", "orientée résultats",
    "synergie", "ravi de", "enthousiaste",
]

# Extra phrases that are banned in LETTERS only (English, Spanish, French).
LETTER_BANNED = {
    "a skill you are still learning": [
        "still learning", "currently learning", "i am learning", "i'm learning", "basic knowledge",
        "basic python", "python (basic", "aprendiendo", "conocimientos básicos", "nivel básico",
        "j'apprends", "en cours d'apprentissage", "notions de", "niveau débutant"],
    "hedging": [
        "close to", "i believe i could", "i think i could", "although i lack", "while i lack",
        "although i don't have", "while i don't have", "i may not have", "even though i lack",
        "aunque no tengo", "aunque me falta", "aunque carezco", "creo que podría",
        "bien que je n'aie", "même si je n'ai pas", "je pense pouvoir", "je crois pouvoir"],
    "generic filler": [
        "team player", "fast-paced environment", "fast-paced", "hit the ground running",
        "think outside the box", "entorno dinámico", "ritmo rápido", "trabajador en equipo",
        "environnement dynamique", "esprit d'équipe", "rythme soutenu"],
}
# A letter must not open like this (the first body paragraph must start with the company)
GENERIC_OPENING = re.compile(
    r"^\s*(i am|i'm) (applying|writing|excited|pleased|delighted)|^\s*i would like to apply"
    r"|^\s*please accept|^\s*with (this|the present) letter|^\s*me dirijo|^\s*les escribo"
    r"|^\s*le escribo|^\s*por medio de|^\s*mediante la presente|^\s*je vous (écris|adresse)"
    r"|^\s*je souhaite (postuler|vous)|^\s*je me permets|^\s*par la présente", re.IGNORECASE)
LOCATION_WORDS = home.CITY_WORDS  # words that name your city (config.yaml -> home)
CONVERSATION_WORDS = re.compile(
    r"conversation|interview|call|chat|discuss|talk|meet|conversaci[oó]n|conversar|entrevista"
    r"|hablar|reuni[oó]n|llamada|[ée]changer|entretien|discuter|rencontrer", re.IGNORECASE)
# Added by code when the letter's last paragraph does not give location + ask for a conversation
CLOSING_SENTENCE = {
    "en": f"I am based in {home.CITY_LOCAL['en']} and available for an interview at your convenience; I would "
          "welcome a conversation about the role.",
    "es": f"Resido en {home.CITY_LOCAL['es']} y estoy disponible para una entrevista cuando les convenga; me "
          "gustaría conversar con ustedes sobre el puesto.",
    "fr": f"Je suis basé à {home.CITY_LOCAL['fr']} et disponible pour un entretien à votre convenance ; je serais "
          "heureux d'échanger avec vous sur ce poste.",
}

# Your university, always written the same way (config.yaml -> home -> university; "" = no rule)
UNIVERSITY = home.UNIVERSITY
UNIVERSITY_VARIANTS = home.UNIVERSITY_VARIANTS

# Small word lists so the CODE (not the AI) writes the date, the tools row and the languages.
MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December"],
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
           "septiembre", "octubre", "noviembre", "diciembre"],
    "fr": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
           "septembre", "octobre", "novembre", "décembre"],
}
CITY = home.CITY_FULL  # e.g. {"en": "Valencia, Spain", "es": "Valencia, España", ...}
TOOLS_LABEL = {"en": "Tools", "es": "Herramientas", "fr": "Outils"}
LANGUAGES_TITLE = {"en": "Languages", "es": "Idiomas", "fr": "Langues"}
LANGUAGE_WORDS = {  # profile.yaml `languages` is in English; these translate the words in it
    "es": {"English": "Inglés", "French": "Francés", "Arabic": "Árabe", "Spanish": "Español",
           "native": "nativo"},
    "fr": {"English": "Anglais", "French": "Français", "Arabic": "Arabe", "Spanish": "Espagnol",
           "native": "langue maternelle"},
}
CORE_TOOLS = ["Microsoft Excel", "Power BI", "Claude"]  # always shown (if in tools_inventory)
MAX_TOOLS = 10
AGENT_PROJECT = "AI Job-Search Agent"  # preferred project for tech / AI / startup roles
TECH_TITLE_WORDS = re.compile(
    r"\b(ai|ia|tech|technology|tecnolog|technolog|software|saas|startup|start-up|innovation"
    r"|innovaci[oó]n|automation|automatizaci[oó]n|automatisation)", re.IGNORECASE)
MONTH_NUMBER = {m[:3].lower(): i for i, m in enumerate(MONTHS["en"], start=1)}


# ---------- what the AI must send back ----------
# "Literal" = only these values are allowed.

class Match(BaseModel):
    duty: str
    evidence_id: str       # e.g. "exp3" or "proj1" (see evidence_ids)
    angle: str             # angle name from profile.yaml, or "highlights"
    evidence: str
    strength: Literal["strong", "medium", "weak"]


class Analysis(BaseModel):
    lang: Literal["en", "es", "fr"]
    company_name: str
    real_role_type: str
    role_note: str
    main_duties: list[str]
    must_haves: list[str]
    keywords: list[str]
    company_hook: str
    tech_role: bool
    match_map: list[Match]
    project_order: list[str]
    design: Literal["harvard", "european"]
    design_reason: str


class Skill(BaseModel):
    label: str
    items: list[str]


class Entry(BaseModel):
    source_id: str         # evidence id of this entry, e.g. "exp1"
    title: str
    org: str
    dates: str
    bullets: list[str]


class Section(BaseModel):
    title: str
    entries: list[Entry]   # empty list for a skills section
    skills: list[Skill]    # empty list for an experience/education section


class CV(BaseModel):
    headline: str
    summary_title: str
    summary: str
    sections: list[Section]


class Link(BaseModel):
    duty: str
    evidence_id: str


class Letter(BaseModel):
    recipient: list[str]   # e.g. ["Hiring team", "Company"]
    subject: str
    paragraphs: list[str]  # first = greeting, last = closing paragraph
    closing: str           # e.g. "Kind regards,"
    links: list[Link]      # the 3+ duty -> evidence links the letter makes


class Pack(BaseModel):
    cv: CV
    letter: Letter
    tools_shown: list[str]     # tools from tools_inventory to show (not the core ones)
    tool_to_learn: list[str]   # tools the posting asks for that are NOT in tools_inventory
    prep_md: str               # the prep sheet, in Markdown, in English


class Scores(BaseModel):
    relevance: int
    evidence: int
    specificity: int
    clarity: int


class ScoreOnly(BaseModel):
    unsupported_claims: list[str]  # phrases the profile does not support (the reviewer quotes them)
    cv_scores: Scores
    letter_scores: Scores
    weaknesses: list[str]


class Review(ScoreOnly):
    improved_cv: CV
    improved_letter: Letter


# Only the profile parts a CV needs go to the AI (no contact, goals or deal-breakers).
PROFILE_PARTS = ["headline", "summary", "languages", "education", "projects",
                 "experience", "skills", "tools_inventory"]


# ---------- helpers ----------

def slug(text: str) -> str:
    """'Foo Bär, Inc.' -> 'foo_bar_inc' (safe for folder names)."""
    import unicodedata
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", plain.lower()).strip("_")[:30] or "job"


def log(message: str) -> None:
    print(message, flush=True)


STEP_TIMES: list[tuple[str, float]] = []   # (step name, seconds) - printed at the end


def step_done(name: str, started: float) -> None:
    """Remember and print how long one step took."""
    seconds = time.time() - started
    STEP_TIMES.append((name, seconds))
    log(f"  done: {name} ({seconds:.1f}s)")


def fail(message: str, code: int = EXIT_ERROR):
    """Print the result as one JSON line (serve.py reads it) and stop."""
    print("RESULT: " + json.dumps({"ok": False, "code": code, "message": message}), flush=True)
    sys.exit(code)


def get_api_key() -> str:
    # secrets.yaml holds the key. We only read the one value we need and never print it.
    key = (yaml.safe_load(SECRETS.read_text()) or {}).get("gemini_api_key", "") if SECRETS.exists() else ""
    if not key:
        fail("No Gemini API key found. Run `python run.py` once to save it.")
    return key


def number_set(text: str) -> set[str]:
    """All numbers in a text, written one standard way (4.500 and 4,500 both -> 4500, 8,1 -> 8.1)."""
    found = set()
    for raw in re.findall(r"\d+(?:[.,]\d+)*", text):
        if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", raw):
            raw = re.sub(r"[.,]", "", raw)         # thousands separator
        else:
            raw = raw.replace(",", ".")            # decimal comma
        found.add(raw)
    return found


def cv_text(cv: CV) -> str:
    parts = [cv.headline, cv.summary_title, cv.summary]
    for section in cv.sections:
        parts.append(section.title)
        for entry in section.entries:
            parts += [entry.title, entry.org, entry.dates, *entry.bullets]
        for skill in section.skills:
            parts += [skill.label, *skill.items]
    return "\n".join(parts)


def cv_and_letter_text(pack: Pack) -> str:
    """All text that the AI wrote for the CV and the letter (the date and name are added by code)."""
    letter = pack.letter
    return "\n".join([cv_text(pack.cv), *letter.recipient, letter.subject, *letter.paragraphs, letter.closing])


def inventory_tools(profile: dict) -> dict[str, str]:
    """{'hubspot': 'HubSpot', ...} - every tool in tools_inventory, to match names safely."""
    return {tool.lower(): tool for group in profile["tools_inventory"].values() for tool in group}


def evidence_ids(profile: dict) -> dict[str, str]:
    """A short id for every role, project and degree, e.g. {'exp1': 'Property Manager - ...'}.
    The AI uses these ids in the match map, so code can find the real profile entry."""
    ids = {}
    for i, job in enumerate(profile.get("experience", []), start=1):
        ids[f"exp{i}"] = f"{job['role']} - {job['company']} ({job['dates']})"
    for i, project in enumerate(profile.get("projects", []), start=1):
        ids[f"proj{i}"] = f"{project['name']} ({project['type']})"
    for i, degree in enumerate(profile.get("education", []), start=1):
        ids[f"edu{i}"] = f"{degree['degree']} - {degree['school']} ({degree['year']})"
    return ids


def end_date(dates: str) -> tuple[int, int]:
    """'Jul 2022 - Aug 2024' -> (2024, 8). Used to sort jobs newest first."""
    if re.search(r"present|now|actual", dates, re.IGNORECASE):
        return (9999, 12)
    found = re.findall(r"([A-Za-z]{3})[a-z]*\.? (\d{4})", dates)
    if found:
        month, year = found[-1]
        return (int(year), MONTH_NUMBER.get(month.lower(), 12))
    years = re.findall(r"\d{4}", dates)
    return (int(years[-1]), 12) if years else (0, 0)


def latest_job_id(profile: dict) -> str:
    """Evidence id of the most recent job in profile.yaml."""
    jobs = list(enumerate(profile.get("experience", []), start=1))
    return f"exp{max(jobs, key=lambda j: end_date(j[1]['dates']))[0]}" if jobs else ""


def find_keywords(text: str, keywords: list[str]) -> list[str]:
    """Which job key words appear in a text. A key word of several words also counts when all
    its longer words (4+ letters) are there, e.g. 'corporate partners' in 'partners in corporates'."""
    lowered = text.lower()
    hits = []
    for keyword in keywords:
        k = keyword.lower().strip()
        long_words = [w for w in re.findall(r"\w+", k) if len(w) >= 4]
        if k and (k in lowered or (long_words and all(w in lowered for w in long_words))):
            hits.append(keyword)
    return hits


def body_paragraphs(letter: Letter) -> list[str]:
    """The letter's paragraphs without the short greeting line ('Dear hiring team,')."""
    paragraphs = letter.paragraphs
    if paragraphs and len(paragraphs[0].split()) <= 8:
        return paragraphs[1:]
    return paragraphs


def company_core(name: str) -> str:
    """'Acme Labs, Inc. (Spain)' -> 'acme labs' (to check the letter names the company)."""
    core = re.split(r"[(,]", name)[0].lower()
    core = re.sub(r"\b(inc|ltd|llc|s\.?l\.?u?|s\.?a\.?|sarl|gmbh|group|grupo)\b\.?", "", core)
    return re.sub(r"\s+", " ", core).strip()


# ---------- small fixes done by CODE (no new AI call) ----------

def fix_university(pack: Pack) -> None:
    """Make sure the university is always written the same, correct way."""
    for section in pack.cv.sections:
        for entry in section.entries:
            entry.org = UNIVERSITY_VARIANTS.sub(UNIVERSITY, entry.org)
            entry.title = UNIVERSITY_VARIANTS.sub(UNIVERSITY, entry.title)
            entry.bullets = [UNIVERSITY_VARIANTS.sub(UNIVERSITY, b) for b in entry.bullets]
    pack.cv.summary = UNIVERSITY_VARIANTS.sub(UNIVERSITY, pack.cv.summary)
    pack.letter.paragraphs = [UNIVERSITY_VARIANTS.sub(UNIVERSITY, p) for p in pack.letter.paragraphs]


def fix_letter_ending(pack: Pack, name: str, lang: str) -> None:
    """The AI sometimes puts the sign-off ('Sincerely,') in the paragraphs or the name in 'closing'.
    Fix both so the letter always ends: closing paragraph, sign-off, name (name added by code)."""
    letter = pack.letter
    last = letter.paragraphs[-1].strip() if letter.paragraphs else ""
    if letter.closing.strip().lower() == name.lower() and last and len(last.split()) <= 4:
        letter.closing = last
        letter.paragraphs = letter.paragraphs[:-1]
    elif len(last.split()) <= 3 and last.endswith(","):  # sign-off left inside the paragraphs
        letter.paragraphs = letter.paragraphs[:-1]
        if not letter.closing.strip() or letter.closing.strip().lower() == name.lower():
            letter.closing = last
    if letter.closing.strip().lower() == name.lower():
        letter.closing = ""
    letter.closing = letter.closing.strip() or {"en": "Kind regards,", "es": "Atentamente,",
                                                "fr": "Cordialement,"}.get(lang, "Kind regards,")


def fix_letter_closing(pack: Pack, lang: str) -> None:
    """The last paragraph must give the location/availability AND ask for a conversation.
    If it does not, code adds one fixed, true sentence."""
    paragraphs = pack.letter.paragraphs
    if not paragraphs:
        return
    last = paragraphs[-1]
    if not (LOCATION_WORDS.search(last) and CONVERSATION_WORDS.search(last)):
        paragraphs[-1] = f"{last.rstrip()} {CLOSING_SENTENCE[lang]}".strip()
        log("  Fixed in code: added location, availability and a request for a conversation "
            "to the letter's last paragraph")


# Unknown tool -> closest tool we DO know (same category). Used only by fix_tools.
SIMILAR_TOOL = {"pipedrive": "HubSpot", "zoho crm": "HubSpot", "freshsales": "HubSpot",
                "freshdesk": "Zendesk", "helpscout": "Zendesk", "help scout": "Zendesk",
                "clickup": "Asana", "basecamp": "Asana", "wrike": "Asana", "airtable": "Notion",
                "looker": "Power BI", "looker studio": "Power BI", "qlik": "Power BI",
                "metabase": "Power BI", "mixpanel": "Amplitude", "google docs": "Google Workspace",
                "gmail": "Google Workspace", "g suite": "Google Workspace",
                "microsoft outlook": "Outlook", "ms teams": "Microsoft Teams",
                "gitlab": "GitHub", "aws": "Microsoft Azure", "google cloud": "Microsoft Azure"}

# Skills-row labels (profile.yaml group name -> label per language) for fix_skills
SKILL_LABELS = {
    "product_and_business": {"en": "Product & Business", "es": "Producto y negocio", "fr": "Produit et métier"},
    "data_and_analytics": {"en": "Data & Analytics", "es": "Datos y análisis", "fr": "Données et analyse"},
    "ai_and_automation": {"en": "AI & Automation", "es": "IA y automatización", "fr": "IA et automatisation"},
    "business_tools": {"en": "Business Tools", "es": "Herramientas de negocio", "fr": "Outils métier"},
}


def fix_tools(pack: Pack, profile: dict) -> None:
    """Small tool mistakes are fixed here, not by asking the AI again: an unknown tool becomes the
    closest inventory tool (or is dropped) and goes to tool_to_learn."""
    inventory = inventory_tools(profile)
    shown = []
    for tool in pack.tools_shown:
        real = inventory.get(tool.lower())
        if not real:
            close = difflib.get_close_matches(tool.lower(), list(inventory), n=1, cutoff=0.8)
            real = inventory[close[0]] if close else SIMILAR_TOOL.get(tool.lower())
            if real and real.lower() not in inventory:
                real = None
            if not close and tool not in pack.tool_to_learn:
                pack.tool_to_learn.append(tool)  # a truly unknown tool: note it as 'to learn'
            log(f"  Fixed in code: tool '{tool}' is not in tools_inventory -> "
                f"{real or 'dropped'}")
        if real and real not in shown:
            shown.append(real)
    pack.tools_shown = shown
    pack.tool_to_learn = [t for t in pack.tool_to_learn if t.lower() not in inventory]


def fix_skills(pack: Pack, profile: dict, lang: str, keywords: list[str]) -> None:
    """Skills section: drop a languages row (code adds a Languages section), add rows from
    profile.yaml if there are fewer than 3, then put the rows and items that match the job's
    key words first."""
    if len(pack.cv.sections) != 4 or pack.cv.sections[3].entries:
        return
    section = pack.cv.sections[3]
    language_labels = {"languages", "idiomas", "langues", "lenguas"}
    section.skills = [s for s in section.skills if s.label.strip().lower() not in language_labels]
    for group, items in profile.get("skills", {}).items():
        if len(section.skills) >= 3:
            break
        label = SKILL_LABELS.get(group, {}).get(lang) or group.replace("_", " ").title()
        if any(s.label.lower() == label.lower() for s in section.skills):
            continue
        section.skills.append(Skill(label=label, items=list(items)[:5]))
        log(f"  Fixed in code: added skills row '{label}' from profile.yaml")
    # Job-relevant first: inside each row, then the rows themselves (stable sort keeps the AI's order otherwise)
    for skill in section.skills:
        skill.items.sort(key=lambda item: not find_keywords(item, keywords))
    section.skills.sort(key=lambda s: -len(find_keywords(" ".join([s.label, *s.items]), keywords)))


def fix_source_ids(pack: Pack, profile: dict) -> None:
    """If the AI wrote a wrong id on an entry ('exp 1', 'Property Manager'), find the right one."""
    ids = evidence_ids(profile)
    for section in pack.cv.sections:
        for entry in section.entries:
            if entry.source_id in ids:
                continue
            guess = re.sub(r"\s+", "", entry.source_id.lower())
            if guess in ids:
                entry.source_id = guess
                continue
            names = {key: value.lower() for key, value in ids.items()}
            text = f"{entry.title} {entry.org}".lower()
            entry.source_id = max(names, key=lambda k: difflib.SequenceMatcher(None, text, names[k]).ratio())


def fix_order(pack: Pack, profile: dict, analysis: Analysis, job_title: str) -> None:
    """Jobs newest first; projects in the analysis's relevance order, with the AI Job-Search Agent
    first for tech / AI / startup / innovation / automation roles."""
    if len(pack.cv.sections) != 4:
        return
    jobs = {f"exp{i}": job for i, job in enumerate(profile.get("experience", []), start=1)}
    experience = pack.cv.sections[0].entries
    before = [e.source_id for e in experience]
    experience.sort(key=lambda e: end_date(jobs[e.source_id]["dates"]) if e.source_id in jobs else (0, 0),
                    reverse=True)
    if [e.source_id for e in experience] != before:
        log("  Fixed in code: experience sorted newest first")

    projects = pack.cv.sections[1].entries
    order = {pid: i for i, pid in enumerate(analysis.project_order)}
    agent_id = next((f"proj{i}" for i, p in enumerate(profile.get("projects", []), start=1)
                     if p["name"] == AGENT_PROJECT), "")
    tech = analysis.tech_role or bool(TECH_TITLE_WORDS.search(job_title))
    before = [p.source_id for p in projects]
    projects.sort(key=lambda p: (not (tech and p.source_id == agent_id), order.get(p.source_id, 99)))
    if [p.source_id for p in projects] != before:
        log("  Fixed in code: projects ranked by relevance"
            + (f" ({AGENT_PROJECT} first: tech/AI role)" if tech else ""))


def fix_bullet_count(pack: Pack, profile: dict, most: int = 12) -> None:
    """More than 12 bullets: drop the last (least relevant) bullet of the longest entry until 12 are
    left. The most recent job keeps at least 2 bullets, every other entry at least 1."""
    latest = latest_job_id(profile)
    entries = [e for s in pack.cv.sections for e in s.entries]
    while sum(len(e.bullets) for e in entries) > most:
        can_cut = [e for e in entries if len(e.bullets) > (2 if e.source_id == latest else 1)]
        if not can_cut:
            return
        removed = max(can_cut, key=lambda e: len(e.bullets)).bullets.pop()
        log(f"  Fixed in code: too many bullets - removed: {removed[:60]}...")


def apply_code_fixes(pack: Pack, profile: dict, analysis: Analysis, job_title: str) -> None:
    """Every slip that code can fix by itself, without asking the AI again."""
    fix_university(pack)
    fix_letter_ending(pack, profile["name"], analysis.lang)
    fix_letter_closing(pack, analysis.lang)
    fix_tools(pack, profile)
    fix_skills(pack, profile, analysis.lang, analysis.keywords)
    fix_source_ids(pack, profile)
    fix_order(pack, profile, analysis, job_title)
    fix_bullet_count(pack, profile)


def fix_analysis(analysis: Analysis, profile: dict) -> None:
    """Keep the analysis tidy: max 6 duties, valid evidence ids, every project ranked once."""
    ids = evidence_ids(profile)
    analysis.main_duties = analysis.main_duties[:6]
    analysis.match_map = [m for m in analysis.match_map if m.evidence_id in ids][:6]
    projects = [k for k in ids if k.startswith("proj")]
    order = [p for p in analysis.project_order if p in projects]
    analysis.project_order = list(dict.fromkeys(order + projects))  # add any it forgot, at the end
    if len(analysis.main_duties) < 4 or len(analysis.keywords) < 4:
        log(f"  Note: the analysis found only {len(analysis.main_duties)} duties and "
            f"{len(analysis.keywords)} key words (short posting?).")


# ---------- checks (a problem here = ask the AI again) ----------

def check(pack: Pack, profile: dict, profile_text: str, analysis: Analysis) -> list[str]:
    """Returns a list of problems (empty = all rules passed)."""
    problems = []
    text = cv_and_letter_text(pack)
    lowered = text.lower()

    found = [w for w in BANNED_WORDS if w in lowered]
    if found:
        problems.append(f"Banned words used: {found}. Rewrite without them.")

    # Every number must exist in profile.yaml
    unknown = sorted(number_set(text) - number_set(profile_text))
    if unknown:
        problems.append(f"These numbers are not in the profile: {unknown}. Remove or rewrite them.")
    if re.search(r"\b35\b", text):
        problems.append('Do not use the "35 to 8 minutes" claim (or the number 35).')

    # Tools: unknown tools in tools_shown were already swapped or dropped in code (fix_tools)
    hidden = [t for t in pack.tool_to_learn if t.lower() in lowered]
    if hidden:
        problems.append(f"Tools to learn must not appear in the CV or letter: {hidden}.")

    # Headline + summary: written for THIS job, not the default profile text
    cv = pack.cv
    for part, default in (("headline", profile.get("headline", "")), ("summary", profile.get("summary", ""))):
        mine = getattr(cv, part)
        if default and difflib.SequenceMatcher(None, mine.lower(), " ".join(default.split()).lower()).ratio() > 0.75:
            problems.append(f"The CV {part} is (almost) the profile's default text. Write it for this job.")
    used = find_keywords(f"{cv.headline} {cv.summary}", analysis.keywords)
    if len(used) < 2:
        problems.append(f"Headline + summary use {len(used)} of the job's key words; use at least 2 of: "
                        f"{analysis.keywords}.")

    bullets = sum(len(e.bullets) for s in cv.sections for e in s.entries)
    if bullets > 12:
        problems.append(f"The CV has {bullets} bullets; the maximum is 12.")
    if bullets < 8:
        problems.append(f"The CV has only {bullets} bullets; it needs 8 to 12.")
    # Depth: 2-3 projects, all jobs, both degrees, 3+ skills rows
    sections = cv.sections
    if len(sections) != 4:
        problems.append(f"The CV has {len(sections)} sections; it needs 4: experience, projects, "
                        "education, skills.")
    else:
        n_jobs, n_projects, n_edu = (len(sections[i].entries) for i in range(3))
        if n_projects < 2 or n_projects > 3:
            problems.append(f"The projects section has {n_projects} project(s); it needs 2 or 3.")
        if n_jobs < len(profile.get("experience", [])):
            problems.append(f"The experience section has {n_jobs} entries; include all "
                            f"{len(profile['experience'])} jobs from the profile.")
        if n_edu < 2:
            problems.append("The education section needs both the master's and the BA.")
        if any(not e.bullets for e in sections[1].entries):
            problems.append("Every project needs at least 1 bullet.")
        latest = latest_job_id(profile)
        recent = next((e for e in sections[0].entries if e.source_id == latest), None)
        if recent and len(recent.bullets) < 2:
            problems.append(f"The most recent job ({latest}: {recent.title}) needs at least 2 bullets; "
                            "use 2 different angles from the profile.")
        agent = next((f"proj{i}" for i, p in enumerate(profile.get("projects", []), start=1)
                      if p["name"] == AGENT_PROJECT), "")
        if analysis.tech_role and agent and agent not in [p.source_id for p in sections[1].entries]:
            problems.append(f"This is a tech/AI role: include the {AGENT_PROJECT} project ({agent}).")

    # Letter
    letter = pack.letter
    body = body_paragraphs(letter)
    words = sum(len(p.split()) for p in body)
    if not 250 <= words <= 350:
        problems.append(f"The letter body has {words} words; it must be 250-350 (aim for 260-330).")
    if body:
        if GENERIC_OPENING.search(body[0]):
            problems.append("The letter opens with a generic line. Open with something specific about "
                            f"{analysis.company_name} (hook: {analysis.company_hook}).")
        elif company_core(analysis.company_name) not in body[0].lower():
            problems.append(f"The first paragraph of the letter must name {analysis.company_name} and "
                            "open with the company hook.")
    ids = evidence_ids(profile)
    links = {link.duty.strip().lower() for link in letter.links if link.evidence_id in ids}
    if len(links) < 3:
        problems.append(f"The letter makes {len(links)} clear duty-to-evidence links; it needs at least 3 "
                        "(list them in 'links' with real evidence ids).")
    letter_text = " ".join(letter.paragraphs).lower()
    for reason, phrases in LETTER_BANNED.items():
        hits = [p for p in phrases if p in letter_text]
        if hits:
            problems.append(f"The letter contains {reason}: {hits}. Remove it.")
    if UNIVERSITY and home.UNIVERSITY_SHORT and home.UNIVERSITY_SHORT in text and UNIVERSITY.lower() not in lowered:
        problems.append(f'Write the university as "{UNIVERSITY}".')
    if not pack.prep_md.strip().startswith("#"):
        problems.append("prep_md must start with a '# Prep sheet' heading.")
    return problems


# ---------- the AI ----------

def ask_ai(model: str, prompt: str, schema, required: bool = True, temperature: float = 0.3):
    """Asks the AI (Claude first, then Gemini - see llm.generate_pack). Returns (answer, which AI wrote it).
    llm.py already gives every model its tries (config.yaml: ai_tries_per_model), so no retry loop here.
    required=False: if no AI is available, return (None, "") instead of stopping."""
    try:
        return llm.generate_pack(prompt, schema, get_api_key(), model, temperature=temperature)
    except llm.AllProvidersFailed as error:
        if not required:
            log(f"  (No AI available for this step: {str(error)[:120]})")
            return None, ""
        fail(f"No AI was available (Claude failed and Gemini's limit was reached or it did not answer): "
             f"{str(error)[:200]}. Wait a bit (or until tomorrow), then try again.", EXIT_LIMIT)
    except Exception as error:  # e.g. a wrong Gemini key: trying again cannot help
        fail(f"Gemini refused the request ({str(error)[:150]}). Check the key and the models in config.yaml.")


def overall(score: ScoreOnly) -> float:
    """Average of the 8 scores (CV + letter, 4 each), each kept between 1 and 10."""
    values = [*score.cv_scores.model_dump().values(), *score.letter_scores.model_dump().values()]
    return round(sum(min(10, max(1, v)) for v in values) / len(values), 1)


def analysis_text(analysis: Analysis, profile: dict) -> str:
    """The analysis + match map as plain text for the next prompts."""
    ids = evidence_ids(profile)
    lines = [f"Company: {analysis.company_name}",
             f"Real role type: {analysis.real_role_type} ({analysis.role_note})",
             f"Company hook: {analysis.company_hook}",
             "Main duties: " + " | ".join(analysis.main_duties),
             "Must-haves: " + " | ".join(analysis.must_haves),
             "Key words to mirror: " + ", ".join(analysis.keywords),
             "Match map:"]
    for m in analysis.match_map:
        lines.append(f"  - {m.duty} -> {m.evidence_id} ({ids.get(m.evidence_id, '?')}), angle "
                     f"'{m.angle}': {m.evidence} [{m.strength}]")
    lines.append("Project order (most relevant first): " + ", ".join(analysis.project_order))
    return "\n".join(lines)


def draft_json(pack: Pack) -> str:
    return json.dumps({"cv": pack.cv.model_dump(), "letter": pack.letter.model_dump()},
                      ensure_ascii=False, indent=1)


def review(pack: Pack, model: str, fill: dict, profile: dict, profile_text: str, analysis: Analysis,
           job_title: str) -> tuple[Pack, dict]:
    """Step 3: the strict hiring manager. Returns the pack to keep and notes for prep.md."""
    notes = {"draft": None, "improved": None, "kept": "draft", "weaknesses": [], "why": "", "claims": []}
    answer, made_by = ask_ai(model, REVIEW_PROMPT.format(draft=draft_json(pack), **fill), Review,
                             required=False, temperature=0.4)
    if answer is None:
        notes["why"] = "The review step could not run (no AI available), so the draft was kept."
        return pack, notes
    notes["draft"] = (overall(answer), answer.cv_scores, answer.letter_scores)
    notes["weaknesses"] = answer.weaknesses[:3]
    notes["claims"] = answer.unsupported_claims
    log(f"  Draft quality: {notes['draft'][0]}/10, unsupported claims: {len(answer.unsupported_claims)} "
        f"(by {made_by})")

    improved = pack.model_copy(deep=True)
    improved.cv, improved.letter = answer.improved_cv, answer.improved_letter
    apply_code_fixes(improved, profile, analysis, job_title)
    problems = check(improved, profile, profile_text, analysis)
    if problems:
        notes["why"] = "The improved version broke these rules, so the draft was kept: " + "; ".join(problems)
        log(f"  Improved version broke {len(problems)} rule(s) - keeping the draft")
        return pack, notes

    rescore, _ = ask_ai(model, SCORE_PROMPT.format(draft=draft_json(improved), **fill), ScoreOnly,
                        required=False, temperature=0.2)
    if rescore is None:
        notes["why"] = "The improved version could not be scored, so the draft was kept."
        return pack, notes
    notes["improved"] = (overall(rescore), rescore.cv_scores, rescore.letter_scores)
    log(f"  Improved quality: {notes['improved'][0]}/10, unsupported claims: {len(rescore.unsupported_claims)}")
    # Truth first: fewer unsupported claims wins; only if equal, the higher score wins
    draft_key = (-len(answer.unsupported_claims), notes["draft"][0])
    improved_key = (-len(rescore.unsupported_claims), notes["improved"][0])
    if improved_key > draft_key:
        notes["kept"], notes["claims"] = "improved", rescore.unsupported_claims
        notes["why"] = "The improved version was kept (fewer unsupported claims, or the same and a higher score)."
        return improved, notes
    notes["why"] = "The draft was kept (the improved version had more unsupported claims or no higher score)."
    return pack, notes


# ---------- building the files ----------

def pack_rules(lang: str, company_name: str, latest: str) -> str:
    """The writing rules for the AI, with your city and university (config.yaml -> home) filled in."""
    university_rule = (f' - Write the master\'s school exactly as "{UNIVERSITY} ({home.UNIVERSITY_SHORT})".\n'
                       if UNIVERSITY else "")
    return RULES.format(lang=lang, university_rule=university_rule, city=home.CITY_LOCAL["en"],
                        company_name=company_name, latest=latest)


def contact_line(profile: dict, lang: str) -> tuple[str, list[str]]:
    """'City, Country | phone | email | LinkedIn | Linktree' and the parts that are missing."""
    contact = profile.get("contact", {})
    parts, missing = [CITY[lang]], []
    for key in ("phone", "email", "linkedin", "portfolio"):
        if contact.get(key):
            parts.append(str(contact[key]))
        else:
            missing.append(key)
    return "  |  ".join(parts), missing


def languages_row(profile: dict, lang: str) -> str:
    """'English (C2), French (C1), ...' from profile.yaml, translated for es/fr CVs."""
    words = LANGUAGE_WORDS.get(lang, {})
    out = []
    for language in profile.get("languages", []):
        for english, translated in words.items():
            language = language.replace(english, translated)
        out.append(language)
    return ", ".join(out)


def build_content(pack: Pack, profile: dict, prefix: str, analysis: Analysis) -> dict:
    """Join the AI's text with the parts the CODE writes (name, contact, date, tools, languages)."""
    lang = analysis.lang
    inventory = inventory_tools(profile)
    today = date.today()

    # Tools row: the tools the job names first, then the core ones, no repeats, short list
    tools = []
    for name in pack.tools_shown + CORE_TOOLS:
        real = inventory.get(name.lower())
        if real and real not in tools:
            tools.append(real)
    tools = tools[:MAX_TOOLS]

    cv = pack.cv.model_dump()
    sections = cv["sections"]
    skills_section = next((s for s in sections if s["skills"]), None)
    if skills_section is None:
        skills_section = {"title": "Skills", "entries": [], "skills": []}
        sections.append(skills_section)
    skills_section["skills"].insert(0, {"label": TOOLS_LABEL[lang], "items": tools})
    # Languages: always its own section, always the same true levels from profile.yaml
    sections.append({"title": LANGUAGES_TITLE[lang], "entries": [],
                     "skills": [{"label": "", "items": [languages_row(profile, lang)]}]})

    cv["name"] = profile["name"]
    cv["contact"], _ = contact_line(profile, lang)

    letter = pack.letter.model_dump()
    letter.pop("links", None)  # only for the checks, not printed
    day, month = today.day, MONTHS[lang][today.month - 1]
    letter["date"] = {
        "en": f"{home.CITY_LOCAL['en']}, {day} {month} {today.year}",
        "es": f"{home.CITY_LOCAL['es']}, {day} de {month} de {today.year}",
        "fr": f"{home.CITY_LOCAL['fr']}, le {day} {month} {today.year}",
    }[lang]
    letter["signature"] = profile["name"]

    return {"design": analysis.design, "lang": lang, "file_prefix": prefix, "cv": cv, "letter": letter}


def one_page_cv(content: dict, d: dict, cv_docx: Path) -> None:
    """Make the CV; if the PDF is longer than one page, drop the least relevant bullet and retry.
    The most recent job (first entry) always keeps at least 2 bullets, every other entry at least 1."""
    for _ in range(8):
        render_pack.build_cv(content, d, cv_docx)
        pdf = render_pack.to_pdf(cv_docx)
        if pdf is None:
            log("  Could not make the CV PDF (is LibreOffice installed?). The .docx is saved.")
            return
        pages = render_pack.count_pages(pdf)
        log(f"  CV: {pages} page(s)")
        if pages <= 1:
            return
        # Bullets are ordered most-relevant-first, so cut the LAST bullet of the longest list.
        entries = [e for s in content["cv"]["sections"] for e in s.get("entries", [])]
        minimum = {id(entries[0]): 2} if entries else {}
        entries = [e for e in entries if len(e["bullets"]) > minimum.get(id(e), 1)]
        if not entries:
            log("  WARNING: the CV is longer than one page and cannot be shortened further.")
            return
        longest = max(entries, key=lambda e: len(e["bullets"]))
        removed = longest["bullets"].pop()
        log(f"  Too long - removed a bullet: {removed[:60]}...")


def review_md(analysis: Analysis, profile: dict, notes: dict, missing_contact: list[str]) -> str:
    """The analysis, match map and recruiter review as Markdown, for the top of prep.md."""
    ids = evidence_ids(profile)
    cell = lambda text: str(text).replace("|", "/").replace("\n", " ")
    out = ["## A. Job analysis",
           f"- **Real role:** {analysis.real_role_type}. {analysis.role_note}",
           f"- **Company hook:** {analysis.company_hook}",
           "- **Main duties:**", *[f"  {i}. {d}" for i, d in enumerate(analysis.main_duties, start=1)],
           "- **Must-haves:**", *[f"  - {m}" for m in analysis.must_haves],
           f"- **Key words to mirror:** {', '.join(analysis.keywords)}",
           "", "## B. Match map", "",
           "| Duty | Your best evidence | Angle | Strength |", "| --- | --- | --- | --- |"]
    for m in analysis.match_map:
        out.append(f"| {cell(m.duty)} | {cell(ids.get(m.evidence_id, m.evidence_id))}: {cell(m.evidence)} "
                   f"| {cell(m.angle)} | {m.strength} |")
    out += ["", "## C. Recruiter review (Quality)"]

    def score_line(label: str, result) -> str:
        total, cv, letter = result
        fmt = lambda s: f"relevance {s.relevance}, evidence {s.evidence}, specificity {s.specificity}, clarity {s.clarity}"
        return f"- **{label}: {total}/10** - CV: {fmt(cv)}. Letter: {fmt(letter)}."

    if notes["draft"]:
        kept = notes[notes["kept"]] or notes["draft"]
        out.append(f"- **Quality of the version used: {kept[0]}/10** ({notes['kept']} version)")
        out.append(score_line("Draft", notes["draft"]))
        if notes["improved"]:
            out.append(score_line("Improved version", notes["improved"]))
        out.append(f"- {notes['why']}")
        out.append("- **Top 3 weaknesses the hiring manager found in the draft:**")
        out += [f"  {i}. {w}" for i, w in enumerate(notes["weaknesses"], start=1)]
        if notes["claims"]:
            out.append("- **Check yourself - claims the reviewer says your profile does not support "
                       "(edit them out before sending):**")
            out += [f"  - \"{c}\"" for c in notes["claims"]]
        else:
            out.append("- The reviewer found no unsupported claims in the version used.")
    else:
        out.append(f"- {notes['why']}")
    if missing_contact:
        out += ["", f"**Check yourself:** profile.yaml `contact` has no {' or '.join(missing_contact)}, "
                    "so the CV contact line is missing it."]
    return "\n".join(out) + "\n"


def full_prep(prep_md: str, extra: str) -> str:
    """Put the analysis/review sections right before the AI's first '## ' section."""
    lines = prep_md.strip().splitlines()
    first = next((i for i, line in enumerate(lines) if line.startswith("## ")), len(lines))
    return "\n".join(lines[:first] + [extra] + lines[first:]) + "\n"


def markdown_to_html(md: str, title: str) -> str:
    """A tiny Markdown -> HTML converter (headings, bullets, tables, **bold**, links)."""
    import html

    def inline(text: str) -> str:
        text = html.escape(text)
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
        return re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank">\1</a>', text)

    out, lines, i, in_list = [], md.splitlines(), 0, False
    while i < len(lines):
        line = lines[i]
        if in_list and not re.match(r"\s*[-*] ", line):
            out.append("</ul>")
            in_list = False
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(set(c) <= set("-: ") for c in cells):
                    rows.append(cells)
                i += 1
            out.append("<table>" + "".join(
                "<tr>" + "".join(f"<{'th' if r == 0 else 'td'}>{inline(c)}</{'th' if r == 0 else 'td'}>"
                                 for c in row) + "</tr>" for r, row in enumerate(rows)) + "</table>")
            continue
        heading = re.match(r"(#{1,3}) (.*)", line)
        if heading:
            level = len(heading.group(1))
            out.append(f"<h{level}>{inline(heading.group(2))}</h{level}>")
        elif re.match(r"\s*[-*] ", line):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(re.sub(r'^\s*[-*] ', '', line))}</li>")
        elif line.strip():
            out.append(f"<p>{inline(line.strip())}</p>")
        i += 1
    if in_list:
        out.append("</ul>")
    style = ("body{font:15px/1.5 -apple-system,Segoe UI,sans-serif;max-width:780px;margin:24px auto;"
             "padding:0 16px;color:#1d1d1f} h1{font-size:22px} h2{font-size:17px;margin-top:26px;"
             "color:#1d4e6b} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;"
             "padding:6px 8px;vertical-align:top;text-align:left} a{color:#1d4e6b}")
    return (f'<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title>'
            f'<style>{style}</style></head><body>{"".join(out)}</body></html>')


def update_tracker(number: int, folder: Path, tools_to_learn: list[str], min_score: int,
                   made_by: str = "", quality: str = "") -> None:
    """Status -> 'pack ready' (only if the job is still new/interested), save the pack folder and
    its Quality, then rebuild Excel and the report so everything shows the same."""
    tracker = store.load()
    tracker = excel.read_edits(tracker)  # keep anything you typed in Excel first
    status = tracker.at[number, "status"]
    if status in ("", "new", "interested", "pack ready", "pack incomplete"):
        # "pack ready" only when BOTH PDFs exist; otherwise "pack incomplete"
        both = len(list(folder.glob("*_CV*.pdf"))) > 0 and len(list(folder.glob("*_Letter*.pdf"))) > 0
        tracker.at[number, "status"] = "pack ready" if both else "pack incomplete"
    tracker.at[number, "pack"] = folder.as_posix()
    tracker.at[number, "pack_model"] = made_by
    tracker.at[number, "quality"] = quality
    if tools_to_learn:
        old = [t.strip() for t in tracker.at[number, "tool_to_learn"].split(",") if t.strip()]
        merged = old + [t for t in tools_to_learn if t not in old]
        tracker.at[number, "tool_to_learn"] = ", ".join(merged)
    store.save(tracker)
    try:
        excel.write(tracker, min_score)
    except Exception as error:  # e.g. the file is locked - not a reason to lose the pack
        log(f"  (Could not rebuild the Excel file: {error})")
    report.build(tracker, min_score)


# ---------- main ----------

def read_arguments() -> tuple[int, str]:
    """'443' or '443 --suffix v2' -> (443, 'v2')."""
    args = sys.argv[1:]
    suffix = ""
    if "--suffix" in args:
        at = args.index("--suffix")
        suffix = re.sub(r"[^A-Za-z0-9]", "", args[at + 1]) if at + 1 < len(args) else ""
        args = args[:at] + args[at + 2:]
    if len(args) != 1 or not args[0].isdigit():
        sys.exit("Usage: python tailor.py <job number> [--suffix v2]   (the number is on the job's card)")
    return int(args[0]), suffix


def main() -> None:
    number, suffix = read_arguments()
    started = time.time()  # for the total time at the end
    end = f"_{suffix}" if suffix else ""   # e.g. "_v2" at the end of every file name

    config = yaml.safe_load(CONFIG.read_text())
    model = config.get("tailoring_model", DEFAULT_MODEL)
    profile_text = PROFILE.read_text(encoding="utf-8")
    profile = yaml.safe_load(profile_text)
    # Only the parts a CV needs go to the AI (the checks still use the whole file)
    profile_for_ai = yaml.safe_dump({k: profile[k] for k in PROFILE_PARTS if k in profile},
                                    allow_unicode=True, sort_keys=False)
    evidence = "\n".join(f"{key} = {text}" for key, text in evidence_ids(profile).items())

    tracker = store.load()
    if number >= len(tracker):
        fail(f"There is no job number {number} (the tracker has {len(tracker)} jobs).")
    job = tracker.loc[number]
    description = str(job["description"]).strip()[:8000]
    if len(description) < 150:
        fail("This job has no saved description, so I cannot tailor a pack for it.")
    log(f"Job {number}: {job['title']} - {job['company']}")

    # Same folder when remaking a pack; otherwise a new one
    folder = Path(job["pack"]) if job["pack"] else APPLICATIONS / f"{slug(job['company'])}_{number}"
    # file names start with your name from profile.yaml, e.g. "Ana_Lopez_Acme_CV.pdf"
    prefix = f"{str(profile.get('name', 'Candidate')).strip().replace(' ', '_')}_{slug(job['company']).title().replace('_', '')}"

    # Step 1: analysis + match map
    log(f"Step 1: analysing the job and building the match map ({model}) ...")
    t0 = time.time()
    analysis, made_by = ask_ai(model, ANALYSIS_PROMPT.format(
        profile=profile_for_ai, evidence=evidence, title=job["title"], company=job["company"],
        location=job["location"], description=description), Analysis, temperature=0.2)
    fix_analysis(analysis, profile)
    step_done(f"analysis (by {made_by}): {analysis.real_role_type}", t0)

    fill = dict(  # the values every later prompt uses
        profile=profile_for_ai, evidence=evidence, title=job["title"], company_name=analysis.company_name,
        description=description, analysis=analysis_text(analysis, profile),
        rules=pack_rules(analysis.lang, analysis.company_name, latest_job_id(profile)))

    # Step 2: write the pack, fix small slips in code, re-ask only for real content problems
    fixes = ""
    # "Remake pack" in the web app can add what you want done better (empty for normal packs)
    note = os.environ.get("JOB2GO_PACK_NOTE", "").strip()[:1000]
    if note:
        log(f"  Your note for this remake: {note}")
        fixes = ("\n\n=== THE CANDIDATE'S WISHES FOR THIS VERSION (follow them, but only with facts from the "
                 "profile; never invent anything) ===\n" + note)
    for attempt in range(1, MAX_TRIES + 1):
        log(f"Step 2: writing CV, letter and prep sheet - try {attempt} of {MAX_TRIES} ...")
        t0 = time.time()
        prompt = WRITE_PROMPT.format(
            location=job["location"], url=job["job_url"], score=job["score"], summary=job["summary"],
            gaps=job["to_learn"] or job["gaps"], red_flags=job["red_flags"], trust=job["trust"],
            trust_reason=job["trust_reason"], fixes=fixes, **fill)
        pack, made_by = ask_ai(model, prompt, Pack)
        step_done(f"AI writing, try {attempt} (by {made_by})", t0)
        t0 = time.time()
        apply_code_fixes(pack, profile, analysis, job["title"])
        problems = check(pack, profile, profile_text, analysis)
        step_done(f"code fixes + checks, try {attempt}", t0)
        if not problems:
            break
        for problem in problems:
            log(f"  Rule broken: {problem}")
        fixes = (f"\n\n=== THE CANDIDATE'S WISHES FOR THIS VERSION ===\n{note}" if note else "") + \
                "\n\n=== FIX THESE PROBLEMS FROM YOUR LAST ANSWER, KEEP EVERYTHING ELSE ===\n- " + \
                "\n- ".join(problems)
    else:
        fail(f"The AI could not follow all the content rules after {MAX_TRIES} tries, so no pack was made "
             "(nothing was saved). Try again, or check the messages above.")

    # Step 3: recruiter review - keep the better version
    log("Step 3: recruiter review (strict hiring manager) ...")
    t0 = time.time()
    pack, notes = review(pack, model, fill, profile, profile_text, analysis, job["title"])
    kept = notes[notes["kept"]] or notes["draft"]
    quality = f"{kept[0]:.1f}" if kept else ""
    step_done(f"review - kept the {notes['kept']} version" + (f", quality {quality}/10" if quality else ""), t0)

    log("Step 4: saving the prep sheet ...")
    t0 = time.time()
    folder.mkdir(parents=True, exist_ok=True)
    content = build_content(pack, profile, prefix, analysis)
    _, missing_contact = contact_line(profile, analysis.lang)
    if missing_contact:
        log(f"  WARNING: profile.yaml `contact` has no {', '.join(missing_contact)} - "
            "the CV contact line is missing it.")
    prep = full_prep(pack.prep_md, review_md(analysis, profile, notes, missing_contact))
    (folder / f"content{end}.json").write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / f"prep{end}.md").write_text(prep, encoding="utf-8")
    (folder / f"prep{end}.html").write_text(markdown_to_html(prep, f"Prep sheet - {job['company']}"),
                                            encoding="utf-8")
    step_done("prep sheet files", t0)

    d = render_pack.DESIGNS[analysis.design]
    log(f"Design: {analysis.design} ({analysis.design_reason})")
    log("Step 5: making the CV (PDF, fitted to one page) ...")
    t0 = time.time()
    one_page_cv(content, d, folder / f"{prefix}_CV{end}.docx")
    step_done("CV (Word + PDF rendering)", t0)
    (folder / f"content{end}.json").write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
    log("Step 6: making the letter (Word + PDF) ...")
    t0 = time.time()
    render_pack.build_letter(content, d, folder / f"{prefix}_Letter{end}.docx")
    render_pack.to_pdf(folder / f"{prefix}_Letter{end}.docx")
    step_done("letter (Word + PDF rendering)", t0)

    update_tracker(number, folder, pack.tool_to_learn, config.get("min_score", 6), made_by, quality)
    files = report.pack_files(folder.as_posix())
    log(f"Done. Pack saved in {folder}/" + (f"  Quality: {quality}/10" if quality else ""))
    log("Time per step:")
    for name, seconds in STEP_TIMES:
        log(f"  {seconds:6.1f}s  {name}")
    log(f"TOTAL TIME: {time.time() - started:.1f}s")
    if pack.tool_to_learn:
        log(f"Tools to learn (not on your CV): {', '.join(pack.tool_to_learn)}")
    print("RESULT: " + json.dumps({"ok": True, "message": "Pack ready", "files": files,
                                   "tool_to_learn": pack.tool_to_learn}), flush=True)


if __name__ == "__main__":
    main()
