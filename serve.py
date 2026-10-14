"""serve.py - a small local web server for the Job2go AI page (data/report.html).

Usage:  python serve.py        (stop it with Ctrl+C)

Only Python's standard library. It listens on 127.0.0.1 (your computer only - nobody
else on the network can reach it). What it does:
  GET  /               -> shows data/report.html
  GET  /applications/  -> opens the files of a pack (PDFs, prep sheet)
  GET  /api/run        -> progress of "Run search" (the last lines run.py printed)
  GET  /api/usage      -> today's AI usage (Claude used / cap, Gemini quota)
  GET  /api/jobs       -> all jobs of the page (same tabs and tags as report.html) + stats, for the
                          new web app in web/ (without the long descriptions, to keep it small)
  GET  /api/jobs/<n>   -> one job, with its full description
  GET  /api/profiles/default            -> profile.yaml as data (the "My profile" page)
  PUT  /api/profiles/default/<section>  -> saves one section of profile.yaml (agent/profile_edit.py:
                                           backup first, comments and other sections kept)
  POST /run            -> starts `python run.py` in the background (one run at a time)
  POST /make/<number>  -> runs `python tailor.py <number>` and sends back the result
And small changes to the tracker (the code is in agent/actions.py). After each one
data/jobs.csv, the Excel file and the report are saved, so the page just reloads:
  POST /manual                   -> adds a job you found yourself and scores it
  POST /description/<number>     -> saves a pasted description and re-scores the job
  POST /applied/<number>         -> status "applied" with today's date
  POST /undo/<number>            -> takes "applied" back
  POST /notinterested/<number>   -> status "not interested"
  POST /interested/<number>      -> takes "not interested" back
The new web app (web/) sends the same actions with /api in front (POST /api/applied/<number> ...),
plus one of its own:
  POST /api/jobs/<number>/status -> {"status": "interview"}: a card dragged on the Board
  POST /api/remake/<number>      -> {"note": "..."}: makes the pack again (agent/pack_versions.py);
                                    the new one replaces the old one only when it is complete
  POST /api/guide/<number>       -> makes a learning guide for the job's "To learn" items
  GET  /api/jobs/<number>/guide  -> that guide (agent/learning_guide.py)
"""

import json
import os
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime, timedelta
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import llm
import yaml
from agent import actions, learning_guide, pack_versions, profile_edit, report, store

HOST, PORT = "127.0.0.1", 8765
DATA = Path("data").resolve()
REPORT = DATA / "report.html"
LOCK = threading.Lock()  # only one pack at a time (Word and the AI are slow)
TYPES = {".html": "text/html; charset=utf-8", ".pdf": "application/pdf",
         ".md": "text/plain; charset=utf-8", ".json": "application/json"}


class SearchRun:
    """`python run.py` running in the background, started by the page's "Run search" button.
    A helper thread reads what run.py prints, so the page can show it live."""

    def __init__(self):
        self.process = None
        self.lines = deque(maxlen=300)  # the last 300 lines run.py printed
        self.started = 0.0
        self.code = None                # exit code when finished (0 = everything went fine)

    def running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def start(self) -> None:
        self.lines.clear()
        self.code = None
        self.started = time.time()
        # -u and PYTHONUNBUFFERED: print each line at once (not in blocks), so progress is live
        self.process = subprocess.Popen(
            [sys.executable, "-u", "run.py"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL, text=True, bufsize=1, env={**os.environ, "PYTHONUNBUFFERED": "1"})
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self) -> None:
        for line in self.process.stdout:
            line = line.rstrip()
            self.lines.append(line)
            print(f"  [run] {line}", flush=True)
        self.code = self.process.wait()
        print(f"\n--- Run search finished (exit code {self.code}) ---", flush=True)

    def status(self) -> dict:
        seconds = int(time.time() - self.started) if self.started else 0
        return {"running": self.running(), "code": self.code, "lines": list(self.lines),
                "elapsed": f"{seconds // 60} min {seconds % 60:02d} s"}


RUN = SearchRun()


class PageData:
    """The jobs for the new web app: report.page_data(), made again only when data/jobs.csv
    (or the "New today" list) changed since the last time - building it takes a moment."""

    def __init__(self):
        self.key = None
        self.data = None
        self.lock = threading.Lock()

    def get(self) -> dict:
        files = [store.TRACKER, report.STATE, Path("config.yaml")]
        key = tuple(f.stat().st_mtime if f.exists() else 0 for f in files)
        with self.lock:
            if key != self.key:
                config = yaml.safe_load(Path("config.yaml").read_text())
                tracker = store.load()
                self.data = report.page_data(tracker, config.get("min_score", 6), config)
                # report.html leaves rejected jobs out; the new app's Board shows them in a folded column
                rejected = tracker[tracker["status"] == "rejected"]
                self.data["jobs"] += [report._job_data(job, "rejected") for _, job in rejected.iterrows()]
                self.data["funnel"] = funnel(tracker)
                self.key = key
            return self.data

    def job_list(self) -> dict:
        """Everything, but each job without its description (only its length), to keep it small.
        Jobs with a pack also say if the pack got its polish step (pack_polished)."""
        data = self.get()
        jobs = [{**{k: v for k, v in job.items() if k != "description"},
                 "description_length": len(job["description"]),
                 **({"pack_polished": pack_versions.polished(self.folder(job))} if job["files"] else {})}
                for job in data["jobs"]]
        return {**data, "jobs": jobs}

    @staticmethod
    def folder(job: dict) -> str:
        """The pack folder of a job, from its files (e.g. applications/x_12/..._CV.pdf -> data/applications/x_12)"""
        first = next(iter(job["files"].values()))
        return str((DATA / first).parent)

    def job(self, number: int) -> dict | None:
        for job in self.get()["jobs"]:
            if job["n"] == number:
                return {**job, "pack_polished": pack_versions.polished(self.folder(job))} if job["files"] else job
        tracker = store.load()  # a job that is on no tab (e.g. filtered out): still show it
        if number not in tracker.index:
            return None
        return report._job_data(tracker.loc[number], "hidden")


# The free filters' statuses, as the Dashboard names them
FILTER_LABELS = {"wrong location": "Wrong location", "irrelevant title": "Title you never want",
                 "duplicate": "Duplicate", "filtered": "Other rules (language, engineering...)"}


def funnel(tracker) -> dict:
    """The last 7 days in numbers, for the Dashboard: found -> filtered out (and why) -> scored -> good."""
    since = (datetime.now() - timedelta(days=7)).date().isoformat()
    week = tracker[tracker["found_on"] >= since]
    filtered = [[label, int((week["status"] == status).sum())] for status, label in FILTER_LABELS.items()]
    kept = week[~week["status"].isin(store.SKIPPED_STATUSES)]  # (some filtered jobs have an old score)
    scores = kept["score"].map(lambda s: int(s) if str(s).isdigit() else 0)
    return {"days": 7, "found": len(week), "filtered": [f for f in filtered if f[1]],
            "scored": int((scores > 0).sum()), "good": int((scores >= 7).sum())}


PAGE = PageData()


class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, data: dict) -> None:
        self.send_bytes(status, json.dumps(data).encode(), "application/json")

    def host_ok(self) -> bool:
        # Blocks "DNS rebinding": a web page on another site pretending to be localhost
        return self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")

    def do_GET(self) -> None:
        if not self.host_ok():
            return self.send_bytes(403, b"Forbidden", "text/plain")
        path = unquote(self.path.split("?")[0])
        if path in ("/", "/report.html"):
            if not REPORT.exists():
                return self.send_bytes(404, b"No report yet. Run: python run.py", "text/plain")
            return self.send_bytes(200, REPORT.read_bytes(), TYPES[".html"])
        if path == "/api/run":
            return self.send_json(200, RUN.status())
        if path == "/api/usage":
            return self.send_json(200, llm.usage_status())
        if path == "/api/jobs":
            return self.send_json(200, PAGE.job_list())
        if path == "/api/profiles/default":
            return self.send_json(200, {"profile": profile_edit.load(), "sections": list(profile_edit.SECTIONS)})
        if path.startswith("/api/jobs/") and path.endswith("/guide") and path.split("/")[3].isdigit():
            guide = learning_guide.load(int(path.split("/")[3]))
            return self.send_json(200, guide) if guide else self.send_json(404, {"message": "No guide yet."})
        if path.startswith("/api/jobs/") and path[len("/api/jobs/"):].isdigit():
            job = PAGE.job(int(path[len("/api/jobs/"):]))
            return self.send_json(200, job) if job else self.send_json(404, {"message": "No such job."})
        # Only files inside data/applications/ may be opened
        target = (DATA / path.lstrip("/")).resolve()
        allowed = (DATA / "applications").resolve()
        if allowed in target.parents and target.is_file():
            kind = TYPES.get(target.suffix.lower(), "application/octet-stream")
            return self.send_bytes(200, target.read_bytes(), kind)
        self.send_bytes(404, b"Not found", "text/plain")

    def read_body(self) -> dict:
        """The form fields the page sent, as a dict (at most 200 KB)."""
        size = int(self.headers.get("Content-Length") or 0)
        if not 0 < size <= 200_000:
            return {}
        try:
            data = json.loads(self.rfile.read(size))
        except ValueError:
            return {}
        return {key: str(value) for key, value in data.items()} if isinstance(data, dict) else {}

    def do_POST(self) -> None:
        # The custom header can't be sent by other websites, so only our own page can change things
        if not (self.host_ok() and self.headers.get("X-Pack-Button")):
            return self.send_json(403, {"ok": False, "message": "Not allowed."})
        action, number = self.route()
        # run.py rewrites data/jobs.csv at the end, so nothing else may change it meanwhile
        if RUN.running():
            return self.send_json(409, {"ok": False, "message": "A search is running. Wait until it "
                                                                "finishes (see the progress bar), then try again."})
        if action == "run" and not number:
            return self.start_run()
        if action == "make" and number.isdigit():
            return self.make_pack(number)
        if action == "remake" and number.isdigit():
            return self.remake_pack(number, self.read_body().get("note", ""))
        if action == "guide" and number.isdigit():
            return self.make_guide(int(number))
        if action == "status" and number.isdigit():
            ok, message = actions.set_status(int(number), self.read_body().get("status", ""))
            print(f"  {message}", flush=True)
            return self.send_json(200, {"ok": ok, "message": message})
        simple = {"applied": actions.mark_applied, "undo": actions.undo_applied,
                  "notinterested": actions.mark_not_interested, "interested": actions.undo_not_interested}
        try:
            if action == "manual" and not number:
                body = self.read_body()
                print(f"\n--- Adding a job by hand: {body.get('title', '')[:60]} ---", flush=True)
                ok, message = actions.add_manual(body.get("title", ""), body.get("company", ""),
                                                 body.get("location", ""), body.get("link", ""),
                                                 body.get("description", ""))
            elif action == "description" and number.isdigit():
                print(f"\n--- Adding a description to job {number} ---", flush=True)
                ok, message = actions.add_description(int(number), self.read_body().get("description", ""))
            elif action in simple and number.isdigit():
                ok, message = simple[action](int(number))
            else:
                return self.send_json(404, {"ok": False, "message": "Unknown action."})
        except Exception as error:  # show the problem on the page instead of a silent failure
            print(f"  ! {action} failed: {error!r}", flush=True)
            return self.send_json(200, {"ok": False, "message": f"Something went wrong: {error}"})
        print(f"  {message}", flush=True)
        self.send_json(200, {"ok": ok, "message": message})

    def do_PUT(self) -> None:
        """My profile: save one section. Same checks as the buttons (only our own page may do it)."""
        if not (self.host_ok() and self.headers.get("X-Pack-Button")):
            return self.send_json(403, {"ok": False, "message": "Not allowed."})
        prefix = "/api/profiles/default/"
        if not self.path.startswith(prefix):
            return self.send_json(404, {"ok": False, "message": "Unknown address."})
        size = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(size)) if 0 < size <= 200_000 else None
        except ValueError:
            body = None
        if not isinstance(body, dict) or "value" not in body:
            return self.send_json(400, {"ok": False, "message": "Nothing to save."})
        try:
            ok, message = profile_edit.save_section(self.path[len(prefix):], body["value"])
        except Exception as error:  # show the problem on the page; profile.yaml is only written when all checks pass
            print(f"  ! saving the profile failed: {error!r}", flush=True)
            return self.send_json(200, {"ok": False, "message": f"Not saved: {error}"})
        print(f"  My profile: {message}", flush=True)
        self.send_json(200, {"ok": ok, "message": message})

    def route(self) -> tuple[str, str]:
        """(action, job number) from the address. The new web app puts /api in front:
        /api/applied/12 is the same as /applied/12, and /api/jobs/12/status is ("status", "12")."""
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts[0] == "api":
            parts = parts[1:]
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "status":
                return "status", parts[1]
        return (parts[0] if parts else ""), "/".join(parts[1:])

    def start_run(self) -> None:
        if LOCK.locked():
            return self.send_json(409, {"ok": False, "message": "A pack is being made. Start the search "
                                                                "when it is finished."})
        print("\n--- Run search: python run.py ---", flush=True)
        RUN.start()
        self.send_json(200, {"ok": True, "message": "Search started."})

    def make_pack(self, number: str) -> None:
        if not LOCK.acquire(blocking=False):
            return self.send_json(409, {"ok": False, "message": "Another pack is being made. "
                                                                "Wait for it to finish, then try again."})
        try:
            print(f"\n--- Making pack for job {number} ---", flush=True)
            run = subprocess.run([sys.executable, "tailor.py", number], capture_output=True,
                                 text=True, timeout=600)
            print(run.stdout + run.stderr, flush=True)
        except subprocess.TimeoutExpired:
            return self.send_json(200, {"ok": False, "message": "It took more than 10 minutes, so I stopped."})
        finally:
            LOCK.release()
        # tailor.py ends with one line: RESULT: {...json...}
        result = [l for l in run.stdout.splitlines() if l.startswith("RESULT: ")]
        if result:
            return self.send_json(200, json.loads(result[-1][len("RESULT: "):]))
        self.send_json(200, {"ok": False, "message": "tailor.py stopped with an error. "
                                                     "See the Terminal where serve.py is running."})

    def remake_pack(self, number: str, note: str) -> None:
        """Makes the pack again next to the old one (--suffix remake). Only when the new one is
        complete does it replace the old one (the old files go to old/<date-time>/)."""
        tracker = store.load()
        if not number.isdigit() or int(number) not in tracker.index or not tracker.at[int(number), "pack"]:
            return self.send_json(200, {"ok": False, "message": "This job has no pack to remake yet."})
        folder = Path(tracker.at[int(number), "pack"])
        if not LOCK.acquire(blocking=False):
            return self.send_json(409, {"ok": False, "message": "Another pack is being made. "
                                                                "Wait for it to finish, then try again."})
        try:
            print(f"\n--- Remaking the pack for job {number}" + (f" (your note: {note[:80]})" if note else "") + " ---", flush=True)
            env = {**os.environ, "JOB2GO_PACK_NOTE": note.strip()}
            run = subprocess.run([sys.executable, "tailor.py", number, "--suffix", pack_versions.SUFFIX],
                                 capture_output=True, text=True, timeout=600, env=env)
            print(run.stdout + run.stderr, flush=True)
            lines = [l for l in run.stdout.splitlines() if l.startswith("RESULT: ")]
            result = json.loads(lines[-1][len("RESULT: "):]) if lines else {}
            if result.get("ok") and pack_versions.complete(folder):
                old = pack_versions.swap_in(folder)
                actions.rebuild()  # the page and Excel point at the normal file names again
                quality = store.load().at[int(number), "quality"]
                return self.send_json(200, {"ok": True, "message": "New pack ready" +
                                            (f", quality {quality}/10" if quality else "") +
                                            f". The old one is kept in {old.as_posix()}."})
            pack_versions.discard(folder)
            reason = result.get("message", "") if not result.get("ok") else ""  # tailor.py says why it stopped
            return self.send_json(200, {"ok": False, "message": "The new pack could not be made, so your old "
                                                                f"pack is unchanged. {reason[:200]}".strip()})
        except subprocess.TimeoutExpired:
            pack_versions.discard(folder)
            return self.send_json(200, {"ok": False, "message": "It took more than 10 minutes, so I stopped. "
                                                                "Your old pack is unchanged."})
        finally:
            LOCK.release()

    def make_guide(self, number: int) -> None:
        print(f"\n--- Making a learning guide for job {number} ---", flush=True)
        try:
            ok, message = learning_guide.make(number)
        except Exception as error:
            print(f"  ! learning guide failed: {error!r}", flush=True)
            ok, message = False, f"Something went wrong: {str(error)[:200]}"
        print(f"  {message}", flush=True)
        self.send_json(200, {"ok": ok, "message": message})

    def log_message(self, format, *args) -> None:
        pass  # keep the Terminal quiet; we print our own messages


def main() -> None:
    os.chdir(Path(__file__).parent)  # paths below are relative to the job-agent folder
    if not REPORT.exists():
        sys.exit("No report found. Run `python run.py --no-search` first.")
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        sys.exit(f"Port {PORT} is already in use - is serve.py already running in another Terminal?")
    url = f"http://{HOST}:{PORT}/"
    print(f"Job2go AI is at {url}  (press Ctrl+C to stop)")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
