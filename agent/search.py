"""Step 1 — Discover: pull fresh job listings from job sites with JobSpy.

Three kinds of searches, all set in config.yaml:
  1. "searches"            — your normal searches on Indeed + LinkedIn
  2. "freelance_searches"  — freelance/contract searches on the same sites
  3. "google_jobs"         — Google Jobs (can be switched off)
"""

from datetime import date, timedelta

import pandas as pd
from jobspy import scrape_jobs

from agent import home

KEEP_COLUMNS = [
    "site", "title", "company", "location", "is_remote",
    "date_posted", "job_url", "description",
]


def _scrape(label: str, **options) -> pd.DataFrame | None:
    """Run one JobSpy search. If it fails, print why and return None
    (one failing search should never stop the rest)."""
    print(f"  Searching {label} ...")
    try:
        jobs = scrape_jobs(description_format="markdown", verbose=0, **options)
    except Exception as error:
        print(f"    ! Skipped ({str(error)[:120]})")
        return None
    print(f"    found {len(jobs)}")
    return jobs if len(jobs) else None


def find_jobs(config: dict) -> pd.DataFrame:
    """Run every search in config.yaml and return one table of jobs."""
    # Settings shared by the Indeed/LinkedIn searches
    common = dict(
        site_name=config.get("sites", ["indeed", "linkedin"]),
        results_wanted=config.get("results_per_search", 20),
        hours_old=config.get("max_age_days", 3) * 24,  # JobSpy wants hours
        country_indeed=config.get("country", home.COUNTRY),
        # Open each LinkedIn job page for its description (config.yaml). LinkedIn often answers
        # "too many requests" here; agent/fulltext.py fills those gaps later, slowly.
        linkedin_fetch_description=config.get("linkedin_fetch_description", True),
    )

    # 1. Normal searches
    plan = []  # list of (label, options) to run
    for search in config["searches"]:
        remote = bool(search.get("remote", False))
        label = f"'{search['term']}' in {search['location']}" + (" (remote)" if remote else "")
        plan.append((label, dict(common, search_term=search["term"],
                                 location=search["location"], is_remote=remote)))

    # 2. Freelance searches: every term x every location, contract jobs only
    freelance = config.get("freelance_searches") or {}
    for term in freelance.get("terms", []):
        for place in freelance.get("locations", []):
            remote = bool(place.get("remote", False))
            label = (f"freelance '{term}' in {place['location']}"
                     + (" (remote)" if remote else ""))
            plan.append((label, dict(common, search_term=term, location=place["location"],
                                     is_remote=remote,
                                     job_type=freelance.get("job_type", "contract"))))

    # 3. Google Jobs: one search per term from "searches", written as a
    #    Google sentence like "customer success jobs in <your city>, <country> since yesterday"
    if config.get("google_jobs", False):
        template = config.get("google_search_template", f"{{term}} jobs in {home.CITY}, {home.COUNTRY}")
        terms = dict.fromkeys(s["term"] for s in config["searches"])  # unique, same order
        for term in terms:
            sentence = template.format(term=term)
            plan.append((f"Google Jobs: '{sentence}'", dict(
                site_name=["google"], google_search_term=sentence,
                results_wanted=config.get("results_per_search", 20),
            )))

    frames = []
    for label, options in plan:
        jobs = _scrape(label, **options)
        if jobs is not None:
            frames.append(jobs)
    if not frames:
        return pd.DataFrame(columns=KEEP_COLUMNS)

    all_jobs = pd.concat(frames, ignore_index=True)
    for column in KEEP_COLUMNS:
        if column not in all_jobs.columns:
            all_jobs[column] = ""
    all_jobs = all_jobs[KEEP_COLUMNS].fillna("")
    all_jobs["date_posted"] = all_jobs["date_posted"].astype(str)
    # The same job often appears in several searches — keep it once.
    return all_jobs.drop_duplicates(subset="job_url").reset_index(drop=True)


def drop_old(found: pd.DataFrame, max_age_days: int) -> tuple[pd.DataFrame, int]:
    """Safety net: remove jobs whose posting date is older than max_age_days.
    (Jobs with no readable date are kept.) Returns the table and how many were removed."""
    oldest = (date.today() - timedelta(days=max_age_days)).isoformat()
    posted = found["date_posted"].astype(str).str[:10]  # "2026-10-09"
    too_old = posted.str.match(r"\d{4}-\d{2}-\d{2}$") & (posted < oldest)
    return found[~too_old].reset_index(drop=True), int(too_old.sum())
