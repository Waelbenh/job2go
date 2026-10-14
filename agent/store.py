"""Tracker — every job ever found, its score and your status, in data/jobs.csv.

You can open data/jobs.csv in Numbers or Excel and change the "status"
column yourself (new / applied / interview / rejected / not interested).
Close it again before the next run.
"""

from datetime import date
from pathlib import Path

import pandas as pd

TRACKER = Path("data/jobs.csv")

# Statuses given by the free filters (prefilter.py, dedupe.py). Jobs with one of these
# are never sent to the AI and are hidden from the report.
SKIPPED_STATUSES = ["filtered", "irrelevant title", "wrong location", "duplicate"]
# Jobs you sent an application for: shown in the report's "Applied" section only
APPLIED_STATUSES = ["applied", "interview", "offer"]
# The `site` (source) of jobs you add yourself on the report page. Never filtered.
MANUAL_SITE = "manual"
# A description shorter than this counts as missing -> "Add description" button
MIN_DESCRIPTION = 300
# A job whose description is missing / too short / cut off and could not be downloaded
# (agent/fulltext.py). It is not scored until you paste the text with "Add description".
INCOMPLETE_STATUS = "incomplete - paste description"
COLUMNS = [
    "found_on", "status",
    "filter_reason",  # why prefilter.py skipped the job ("" if it wasn't filtered)
    "score",        # FINAL score, after the rules in config.yaml scoring_rules
    "fit_score",    # fit score from the AI, before the rules
    "adjustments",  # which rules changed the score, e.g. "+2 (entry level, ...)"
    "title", "company", "location", "is_remote", "site", "date_posted", "job_url",
    "summary",
    "strengths",    # what in your profile matches the job
    "to_learn",     # things you can learn on the job (they don't lower the score)
    "gaps",         # old scores only (before "to_learn" existed)
    "red_flags",    # real warning signs only
    "unknowns",     # missing info: pay, contract, work mode... (never lowers the score)
    "seniority", "role_type",
    "location_tier", "arrangement", "flexible_hours", "contract_type", "pay", "salary",
    "language",     # languages the job requires
    "languages_preferred",  # languages the job calls "a plus"
    "work_type",    # Employee / Freelance/contract / Unclear
    "trust", "trust_reason",  # Trusted / Check / Suspicious, and why
    "contact",      # recruiter email / phone found in the description ("" if none)
    "scored_on",    # date the job was last scored
    "model",        # which AI made the score, e.g. "gemini/gemini-3.5-flash-lite"
    "pack_model",   # which AI wrote the application pack
    "quality",      # the recruiter-review score of the pack (1-10), see tailor.py
    "applied_on", "follow_up", "notes",
    "tool_to_learn",  # tools a job asks for that are not in tools_inventory
    "pack",         # folder with the tailored CV, letter and prep sheet
    "description",
]


def load() -> pd.DataFrame:
    if TRACKER.exists():
        table = pd.read_csv(TRACKER, dtype=str).fillna("")
        for column in COLUMNS:
            if column not in table.columns:
                table[column] = ""
        return table[COLUMNS]
    return pd.DataFrame(columns=COLUMNS)


def add_new(tracker: pd.DataFrame, found: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Add jobs not seen before. Returns the updated tracker and how many were new."""
    new = found[~found["job_url"].isin(tracker["job_url"])].copy()
    if new.empty:
        return tracker, 0
    new["found_on"] = date.today().isoformat()
    new["status"] = "new"
    for column in COLUMNS:
        if column not in new.columns:
            new[column] = ""
    new = new[COLUMNS].astype(str)
    return pd.concat([tracker, new], ignore_index=True), len(new)


def save(tracker: pd.DataFrame) -> None:
    TRACKER.parent.mkdir(exist_ok=True)
    tracker.to_csv(TRACKER, index=False)
