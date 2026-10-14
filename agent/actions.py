"""Changes made from the report page (the buttons and the form), through serve.py.

Each action:
  1. loads the tracker and first picks up anything you typed in Excel (so nothing is lost),
  2. makes ONE change and saves data/jobs.csv,
  3. rebuilds data/Job Tracker.xlsx and data/report.html, so the page can simply reload.
Every function returns (ok, message) - the message is shown on the page.
"""

import threading
from datetime import date
from pathlib import Path

import yaml

import llm
import run  # re-uses get_api_key() and save_fit(), so scoring works exactly like run.py
from agent import contact, excel, report, scoring, store

# Two clicks at the same moment must not both write data/jobs.csv
LOCK = threading.Lock()


def _config() -> dict:
    return yaml.safe_load(Path("config.yaml").read_text())


def _load():
    tracker = store.load()
    return excel.read_edits(tracker)  # keep what you typed in Excel


def _save_and_rebuild(tracker) -> str:
    """Save the tracker, rebuild Excel + the report. Returns a warning ("" if all went fine)."""
    store.save(tracker)
    config = _config()
    min_score = config.get("min_score", 6)
    warning = ""
    try:
        excel.write(tracker, min_score)
    except Exception as error:  # e.g. the file is locked - the change itself is already saved
        warning = f" (Could not rebuild the Excel file: {error}. Close it in Excel.)"
    report.build(tracker, min_score, config)
    return warning


def _score(number: int) -> str:
    """Score one job with the AI, in the same order as run.py: Gemini, the backup Gemini,
    then Claude. Returns "" if it worked, otherwise a short explanation."""
    config = _config()
    profile_text = Path("profile.yaml").read_text()
    job = store.load().loc[number].to_dict()
    try:
        try:
            fit, made_by = scoring.score_job(run.get_api_key(), config["model"], profile_text, job)
        except llm.GeminiExhausted:  # no Gemini model could answer: try Claude
            if llm.claude_scoring_left_today() == 0:
                return "Gemini is busy or out of quota today and Claude is off or at its daily cap."
            answers = scoring.score_batch_with_claude(profile_text, [job])
            if not answers:
                return "Claude did not return a usable score."
            _, fit, made_by = answers[0]
    except Exception as error:
        return f"The AI could not score it: {str(error)[:150]}"
    # The AI takes a few seconds; load a fresh copy in case something else changed meanwhile
    with LOCK:
        tracker = _load()
        run.save_fit(tracker, number, job, fit, made_by, date.today().isoformat())
        _save_and_rebuild(tracker)
    return ""


def _check_description(text: str) -> str:
    if len(text) < store.MIN_DESCRIPTION:
        return (f"The description is only {len(text)} characters. Paste the full job text "
                f"(at least {store.MIN_DESCRIPTION} characters).")
    return ""


def add_manual(title: str, company: str, location: str, link: str, description: str) -> tuple[bool, str]:
    """A job you found yourself. Saved with source "manual", never filtered, scored right away."""
    title, company, location = title.strip(), company.strip(), location.strip()
    link, description = link.strip(), description.strip()
    if not title or not company:
        return False, "Job title and company are needed."
    if link and not link.startswith(("http://", "https://")):
        return False, "The link must start with http:// or https:// (or leave it empty)."
    problem = _check_description(description)
    if problem:
        return False, problem
    with LOCK:
        tracker = _load()
        if link and link in set(tracker["job_url"]):
            number = tracker.index[tracker["job_url"] == link][0]
            return False, f"This link is already in the tracker as job #{number} ({tracker.at[number, 'title']})."
        number = len(tracker)  # the next row = the new job number
        job = {column: "" for column in store.COLUMNS}
        job.update(found_on=date.today().isoformat(), status="new", title=title, company=company,
                   location=location, site=store.MANUAL_SITE, date_posted=date.today().isoformat(),
                   # Every job needs a unique "link" (Excel uses it to match rows), even without one
                   job_url=link or f"manual:{number}", description=description,
                   contact=contact.find_contact(description))
        tracker.loc[number] = job
        warning = _save_and_rebuild(tracker)
    problem = _score(number)
    if problem:
        return True, f"Saved as job #{number}, but not scored yet: {problem} It will be scored on the next run.{warning}"
    return True, f"Saved and scored as job #{number}.{warning}"


def add_description(number: int, description: str) -> tuple[bool, str]:
    """Save a pasted description for a job that had none (or a very short one), then re-score it."""
    description = description.strip()
    problem = _check_description(description)
    if problem:
        return False, problem
    with LOCK:
        tracker = _load()
        if number not in tracker.index:
            return False, f"There is no job #{number}."
        tracker.at[number, "description"] = description
        if tracker.at[number, "status"] == store.INCOMPLETE_STATUS:  # complete now: back to "new"
            tracker.at[number, "status"] = "new"
        if not tracker.at[number, "contact"]:
            tracker.at[number, "contact"] = contact.find_contact(description)
        warning = _save_and_rebuild(tracker)
    problem = _score(number)
    if problem:
        return True, f"Description saved, but not re-scored: {problem} The old score is kept.{warning}"
    return True, f"Description saved and job #{number} re-scored.{warning}"


def mark_applied(number: int) -> tuple[bool, str]:
    """Status -> "applied", with today's date in "Applied on"."""
    with LOCK:
        tracker = _load()
        if number not in tracker.index:
            return False, f"There is no job #{number}."
        tracker.at[number, "status"] = "applied"
        tracker.at[number, "applied_on"] = date.today().isoformat()
        return True, "Marked as applied." + _save_and_rebuild(tracker)


def _status_before(tracker, number: int) -> str:
    """The status a job goes back to after an "Undo": pack ready / incomplete / new."""
    if report.pack_files(tracker.at[number, "pack"]):
        return "pack ready"
    if not tracker.at[number, "score"] and len(tracker.at[number, "description"].strip()) < store.MIN_DESCRIPTION:
        return store.INCOMPLETE_STATUS
    return "new"


def mark_not_interested(number: int) -> tuple[bool, str]:
    """Status -> "not interested": the job moves to the "Not interested" tab."""
    with LOCK:
        tracker = _load()
        if number not in tracker.index:
            return False, f"There is no job #{number}."
        tracker.at[number, "status"] = "not interested"
        return True, f"Job #{number} moved to “Not interested”." + _save_and_rebuild(tracker)


def undo_not_interested(number: int) -> tuple[bool, str]:
    with LOCK:
        tracker = _load()
        if number not in tracker.index:
            return False, f"There is no job #{number}."
        tracker.at[number, "status"] = _status_before(tracker, number)
        return True, "Undone." + _save_and_rebuild(tracker)


def undo_applied(number: int) -> tuple[bool, str]:
    """Back to "pack ready" if the job has a pack, otherwise "new"; the date is cleared."""
    with LOCK:
        tracker = _load()
        if number not in tracker.index:
            return False, f"There is no job #{number}."
        tracker.at[number, "status"] = "pack ready" if report.pack_files(tracker.at[number, "pack"]) else "new"
        tracker.at[number, "applied_on"] = ""
        return True, "Undone." + _save_and_rebuild(tracker)


# The statuses the new web app's Board can set by dragging a card to a column
BOARD_STATUSES = ["new", "pack ready", "applied", "interview", "offer", "rejected", "not interested"]


def set_status(number: int, status: str) -> tuple[bool, str]:
    """Board: a job dragged to another column. "applied" gets today's date if it has none yet."""
    status = status.strip().lower()
    if status not in BOARD_STATUSES:
        return False, f"Unknown status: {status!r}."
    with LOCK:
        tracker = _load()
        if number not in tracker.index:
            return False, f"There is no job #{number}."
        tracker.at[number, "status"] = status
        if status in store.APPLIED_STATUSES and not tracker.at[number, "applied_on"]:
            tracker.at[number, "applied_on"] = date.today().isoformat()
        elif status in ("new", "pack ready"):  # moved back before "Applied": no date (like Undo)
            tracker.at[number, "applied_on"] = ""
        return True, f"Job #{number} moved to “{status.capitalize()}”." + _save_and_rebuild(tracker)


def rebuild() -> str:
    """Rebuild Excel + the report without changing anything (e.g. after a remade pack got its
    normal file names back). Returns a warning ("" if all went fine)."""
    with LOCK:
        return _save_and_rebuild(_load())
