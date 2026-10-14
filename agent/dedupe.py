"""Duplicates — the same job posted more than once is kept only once.

Two jobs count as the same when ALL of these are true:
  - same city,
  - very similar title,
  - posted within `days_apart` days of each other (config.yaml -> duplicates),
  - and the same company, OR similar description text, OR one of them is an agency / job-board
    repost (so two different companies hiring for a "Customer Success Manager" are NOT merged).

Which one is kept (first rule that decides):
  1. a job you already worked on (status interested / applied / ...) always stays,
  2. a direct employer beats an agency or job-board repost,
  3. the longer description wins.
The others get status "duplicate". They are never scored, but stay in data/jobs.csv.
"""

import re
import unicodedata
from datetime import date, timedelta
from difflib import SequenceMatcher

import pandas as pd

from agent import store

# Jobs in these statuses can be turned into duplicates (nothing you did is lost).
CAN_BE_DUPLICATE = ("new", "")
# Statuses that are not part of the comparison at all.
SKIP_STATUSES = (*store.SKIPPED_STATUSES, "rejected", "not interested")


def _plain(text: str) -> str:
    """Lowercase, no accents, no punctuation: 'Gestión de Clientes (H/M)' -> 'gestion de clientes h m'."""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def _title_key(title: str) -> str:
    # drop gender markers like "(m/f/d)" or "(H/M)" — but keep "(French)" or "(Market Risk)"
    title = re.sub(r"[(\[]\s*(?:[mfdwhx*]\s*[/|]\s*)+[mfdwhx*]\s*[)\]]", " ", str(title), flags=re.I)
    return _plain(title)


def _city_key(location: str) -> str:
    """'Valencia, Valencian Community, Spain' -> 'valencia' (the first part). Remote jobs keep their text."""
    return _plain(str(location).split(",")[0])


def _company_key(company: str) -> str:
    key = _plain(company)
    return re.sub(r"\b(sl|slu|sa|s l|s a|ltd|inc|gmbh|llc)\b", "", key).strip()


def _is_agency(company: str, agency_words: list[str]) -> bool:
    key = f" {_plain(company)} "
    return any(f" {_plain(word)} " in key for word in agency_words if _plain(word))  # whole words only


def _day(row) -> date | None:
    for column in ("date_posted", "found_on"):
        text = str(row[column])[:10]
        try:
            return date.fromisoformat(text)
        except ValueError:
            continue
    return None


def _words(text: str) -> set[str]:
    return {w for w in _plain(text[:1500]).split() if len(w) > 3}


def _similar_text(a: str, b: str) -> bool:
    wa, wb = _words(a), _words(b)
    return bool(wa and wb) and len(wa & wb) / len(wa | wb) >= 0.5


def mark_duplicates(tracker: pd.DataFrame, config: dict) -> int:
    """Mark duplicates in the tracker (changes it in place). Returns how many were marked."""
    settings = config.get("duplicates") or {}
    if not settings.get("enabled", True):
        return 0
    days_apart = timedelta(days=settings.get("days_apart", 7))
    min_similarity = settings.get("title_similarity", 0.94)
    agency_words = settings.get("agency_words", [])

    pool = tracker[~tracker["status"].isin(SKIP_STATUSES)]
    # Only compare jobs from the same city (keeps this fast with thousands of jobs)
    groups: dict[str, list] = {}
    for row, job in pool.iterrows():
        groups.setdefault(_city_key(job["location"]), []).append(row)

    def keeper_rank(row):  # bigger = better; the best one in a pair is kept
        job = tracker.loc[row]
        # a job you added yourself counts as worked on, so it is always the one kept
        worked_on = job["status"] not in CAN_BE_DUPLICATE or job["site"] == store.MANUAL_SITE
        direct = not _is_agency(job["company"], agency_words)
        return (worked_on, direct, len(job["description"]))

    marked = 0
    for rows in groups.values():
        titles = {r: _title_key(tracker.at[r, "title"]) for r in rows}
        for i, a in enumerate(rows):
            for b in rows[i + 1:]:
                if tracker.at[a, "status"] == "duplicate" or tracker.at[b, "status"] == "duplicate":
                    continue  # one was already merged into another job
                if SequenceMatcher(None, titles[a], titles[b]).ratio() < min_similarity:
                    continue
                day_a, day_b = _day(tracker.loc[a]), _day(tracker.loc[b])
                if day_a and day_b and abs(day_a - day_b) > days_apart:
                    continue
                same_company = _company_key(tracker.at[a, "company"]) == _company_key(tracker.at[b, "company"])
                agency = (_is_agency(tracker.at[a, "company"], agency_words)
                          or _is_agency(tracker.at[b, "company"], agency_words))
                if not (same_company or agency
                        or _similar_text(tracker.at[a, "description"], tracker.at[b, "description"])):
                    continue
                keep, drop = (a, b) if keeper_rank(a) >= keeper_rank(b) else (b, a)
                if (tracker.at[drop, "status"] not in CAN_BE_DUPLICATE
                        or tracker.at[drop, "site"] == store.MANUAL_SITE):
                    continue  # both are jobs you worked on (or added yourself): leave them alone
                tracker.at[drop, "status"] = "duplicate"
                tracker.at[drop, "filter_reason"] = f"duplicate of job #{keep}"
                marked += 1
    return marked
