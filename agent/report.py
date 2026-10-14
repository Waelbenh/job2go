"""Step 3 — Report: the "Job2go AI" web page (data/report.html).

How it works:
  - This file decides WHICH jobs go in which tab (same rules as before) and turns them
    into data (JSON).
  - The look and the buttons live in plain files in agent/web/:
      page.html  the page skeleton (top bar, Home, Jobs, side panel, pop-ups)
      app.css    the colors and layout (grey dark theme)
      app.js     draws the cards, charts and panel from the JSON, and talks to serve.py
  - build() pastes the three files and the JSON into ONE file, data/report.html, so the page
    also opens as a plain file (read-only) when serve.py is not running.
"""

import json
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import yaml

from agent import home, store
from agent.remote_sources import source_name

REPORT = Path("data/report.html")
WEB = Path(__file__).parent / "web"
# Which jobs were "New today" at the last run.py, so the page can be rebuilt later
# (by serve.py or tailor.py) without losing that box
STATE = Path("data/report_state.json")

# How many jobs landed in each part of the last report (run.py prints these in its summary)
last_counts: list = []

# Values that only mean "the job ad doesn't say". They are merged into ONE grey "Unknown" tag.
UNKNOWN_VALUES = {"Not stated", "Unclear", ""}


def pack_files(folder: str) -> dict:
    """Links (relative to data/) to the pack's CV, letter and prep sheet, if they exist.
    If there are several versions (e.g. ..._CV.pdf and ..._CV_v2.pdf), the newest one is used."""
    if not folder or not Path(folder).is_dir():
        return {}
    files = {}
    for key, pattern in (("cv", "*_CV*.pdf"), ("letter", "*_Letter*.pdf"), ("prep", "prep*.html")):
        found = sorted(Path(folder).glob(pattern), key=lambda p: p.stat().st_mtime)
        if found:
            files[key] = found[-1].relative_to("data").as_posix()
    return files


def _tags(job: pd.Series) -> tuple[list, list]:
    """The small colored labels of a job, as [text, kind] pairs.
    kind: "good" (green), "risk" (red), "neutral" (grey outline), "unknown" (grey).
    Returns (all tags, the 3 key tags shown on the card)."""
    good, risk, neutral, unknown = [], [], [], []

    trust = job["trust"]
    trust_tag = None
    if trust == "Trusted":
        trust_tag = ["Trusted", "good"]
    elif trust == "Suspicious":
        trust_tag = ["Suspicious", "risk"]
    elif trust == "Check":
        trust_tag = ["Check", "neutral"]
    elif job["score"]:
        unknown.append("trust")

    tier = job["location_tier"]
    location_tag = None
    if tier in (home.TIER_CITY, home.TIER_METRO, home.TIER_PROVINCE):
        location_tag = [tier.replace(" area", ""), "good"]   # "Valencia city", "Valencia metro" ...
    elif tier in (home.TIER_REMOTE_HOME, "Remote - worldwide"):
        location_tag = ["Remote" + (f" ({home.COUNTRY})" if tier == home.TIER_REMOTE_HOME else " (worldwide)"), "good"]
    elif tier == "Remote - other countries only":
        location_tag = ["Remote, other countries only", "risk"]
    elif tier == home.TIER_OUTSIDE:
        location_tag = [f"Outside {home.CITY}", "risk"]
    elif job["score"]:
        unknown.append("location")

    arrangement = job["arrangement"]
    if arrangement == "Remote":
        if not (location_tag and location_tag[0].startswith("Remote")):
            good.append("Remote")
    elif arrangement in ("Hybrid", "On-site"):
        neutral.append(arrangement)
    elif job["score"]:
        unknown.append("work mode")

    if job["flexible_hours"] == "True":
        good.append("Flexible hours")
    seniority = job["seniority"]
    if seniority.startswith("Entry") or seniority == "Internship":
        good.append("Entry level" if seniority.startswith("Entry") else "Internship")
    elif seniority.startswith("Senior"):
        risk.append("Senior (5+ years)")

    pay = job["pay"]
    if pay in ("Commission only", "Unpaid"):
        risk.append(pay)
    elif job["salary"] and job["salary"] not in UNKNOWN_VALUES:
        neutral.append(job["salary"])
    elif pay == "Not stated" or job["salary"] == "Not stated":
        unknown.append("pay")

    for field, name in (("contract_type", "contract"), ("work_type", "employee or freelance")):
        value = job[field]
        if value in UNKNOWN_VALUES:
            if job["score"]:
                unknown.append(name)
        elif value not in ("Employee",):  # "Employee" is the normal case: no tag needed
            neutral.append(value)

    every = [t for t in (trust_tag, location_tag) if t]
    every += [[t, "good"] for t in good] + [[t, "risk"] for t in risk] + [[t, "neutral"] for t in neutral]
    unknown_tag = ["Unknown", "unknown", "Not stated: " + ", ".join(unknown)] if unknown else None
    if unknown_tag:
        every.append(unknown_tag)

    # Card: trust + location, then the most important other one (a risk beats a good point)
    key = [t for t in (trust_tag, location_tag) if t]
    for extra in [[t, "risk"] for t in risk] + [[t, "good"] for t in good] + [[t, "neutral"] for t in neutral]:
        if len(key) >= 3:
            break
        key.append(extra)
    if len(key) < 3 and unknown_tag:
        key.append(unknown_tag)
    return every, key[:3]


def _location_group(job: pd.Series) -> str:
    """For the location filter: your city (e.g. Valencia) / Remote / Other / Unknown."""
    tier = job["location_tier"]
    if tier in (home.TIER_CITY, home.TIER_METRO, home.TIER_PROVINCE):
        return home.CITY
    if tier.startswith("Remote") or job["arrangement"] == "Remote":
        return "Remote"
    if tier == home.TIER_OUTSIDE:
        return "Other"
    return "Unknown"


def _job_data(job: pd.Series, tab: str, new: bool = False) -> dict:
    """One job as a small dict for the page (app.js turns it into a card and a side panel)."""
    score = int(job["score"]) if str(job["score"]).isdigit() else 0
    url = job["job_url"] if job["job_url"].startswith("http") else ""  # a manual job may have no link
    every, key = _tags(job)
    files = pack_files(job["pack"])
    short = len(job["description"].strip()) < store.MIN_DESCRIPTION or job["status"] == store.INCOMPLETE_STATUS
    remote = job["is_remote"] == "True" or job["arrangement"] == "Remote" or job["location_tier"].startswith("Remote")
    return {
        "n": int(job.name),  # the job number = its row in data/jobs.csv (used by tailor.py)
        "tab": tab, "new": new, "score": score,
        "title": job["title"], "company": job["company"], "location": job["location"],
        "source": "added by you" if job["site"] == store.MANUAL_SITE else source_name(job["site"]),
        "url": url, "status": job["status"], "found_on": job["found_on"], "applied_on": job["applied_on"],
        "remote": remote, "loc_group": _location_group(job),
        "tags": every, "key_tags": key,
        "summary": job["summary"], "fit": job["fit_score"], "adjustments": job["adjustments"],
        "strengths": job["strengths"], "to_learn": job["to_learn"] or job["gaps"],
        "red_flags": job["red_flags"], "unknowns": job["unknowns"],
        "trust": job["trust"], "trust_reason": job["trust_reason"], "contact": job["contact"],
        "language": job["language"], "languages_preferred": job["languages_preferred"],
        "model": job["model"], "scored_on": job["scored_on"], "pack_model": job["pack_model"],
        "quality": job["quality"], "tool_to_learn": job["tool_to_learn"],
        "files": files, "short": short, "description": job["description"],
    }


def _charts(tracker: pd.DataFrame) -> dict:
    """Numbers for the 3 small charts on the Home page."""
    sources = Counter(source_name(site) if site != store.MANUAL_SITE else "Added by you"
                      for site in tracker["site"])
    top = sources.most_common(6)
    other = sum(sources.values()) - sum(count for _, count in top)
    if other:
        top.append(("Other", other))

    scores = pd.to_numeric(tracker["score"], errors="coerce").dropna().astype(int)
    spread = [[s, int((scores == s).sum())] for s in range(1, 11)]

    # Applications per week: the last 8 weeks (Monday to Sunday), oldest first
    monday = date.today() - timedelta(days=date.today().weekday())
    weeks = [monday - timedelta(weeks=i) for i in range(7, -1, -1)]
    applied_days = pd.to_datetime(tracker["applied_on"], errors="coerce").dropna().dt.date
    per_week = []
    for start in weeks:
        count = int(((applied_days >= start) & (applied_days < start + timedelta(days=7))).sum())
        per_week.append([start.strftime("%d %b"), count])
    return {"sources": top, "scores": spread, "weeks": per_week}


def _usage() -> dict:
    """AI usage at the moment the page was built (serve.py gives live numbers)."""
    try:
        import llm  # imported here: the report must still build if the AI packages are missing
        return llm.usage_status()
    except Exception:
        return {}


def build(tracker: pd.DataFrame, min_score: int, config: dict | None = None,
          new_urls: set | None = None, new_when: str = "found in this run") -> Path:
    """Writes data/report.html: the page skeleton + the data from page_data()."""
    data = page_data(tracker, min_score, config, new_urls, new_when)
    # "</" inside the JSON would end the <script> tag early, so it is written as "<\/"
    data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    page = (WEB / "page.html").read_text(encoding="utf-8")
    # The job data goes in last, so text inside a job ad can never be mistaken for a {{...}} slot
    page = (page.replace("{{CSS}}", (WEB / "app.css").read_text(encoding="utf-8"))
                .replace("{{JS}}", (WEB / "app.js").read_text(encoding="utf-8"))
                .replace("{{DATA}}", data_json))
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(page, encoding="utf-8")
    return REPORT


def page_data(tracker: pd.DataFrame, min_score: int, config: dict | None = None,
              new_urls: set | None = None, new_when: str = "found in this run") -> dict:
    """All the data of the page (jobs with their tab and tags, stats, charts), as a dict.
    Used by build() for report.html, and by serve.py's /api/jobs for the new web app,
    so both always show the same tabs.

    Which job goes in which tab (settings in config.yaml):
      New today     = jobs found in THIS run (links in new_urls) with score >= new_today_min_score
                      (shown on Home, and with a NEW label at the top of the Good tab)
      Good          = score >= good_match_min, Trusted first, then by score
      Maybe         = score from min_score up to good_match_min - 1
      Manual        = jobs you added yourself, whatever their score
      Incomplete    = description missing / cut off: not scored until you paste it
      Applied       = status applied / interview / offer
      Not interested= status "not interested"
      below min_score is left out of the page (it stays in data/jobs.csv)."""
    if config is None:
        config = yaml.safe_load(Path("config.yaml").read_text())
    good_min = config.get("good_match_min", 7)
    trust_order = config.get("trust_order", ["Trusted", "Check", "Suspicious"])
    new_min = config.get("new_today_min_score", 7)

    # new_urls is None when the page is rebuilt outside run.py (serve.py, tailor.py):
    # then "New today" keeps the jobs it had at the last run
    if new_urls is None:
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
        new_urls, new_when = set(state.get("new_urls", [])), state.get("new_when", new_when)
    else:
        STATE.parent.mkdir(exist_ok=True)
        STATE.write_text(json.dumps({"new_urls": sorted(new_urls), "new_when": new_when}))

    # Applied jobs: only in the "Applied" tab, newest first
    applied = tracker[tracker["status"].isin(store.APPLIED_STATUSES)].copy()
    applied["_score"] = pd.to_numeric(applied["score"], errors="coerce").fillna(0)
    applied = applied.sort_values(["applied_on", "_score"], ascending=False)

    not_interested = tracker[tracker["status"] == "not interested"].iloc[::-1]

    hidden_statuses = ["rejected", "not interested", *store.SKIPPED_STATUSES, *store.APPLIED_STATUSES]
    active = tracker[~tracker["status"].isin(hidden_statuses)].copy()
    active["_score"] = pd.to_numeric(active["score"], errors="coerce").fillna(0)
    # Unknown / empty trust counts like "Check" (position 1)
    fallback = trust_order.index("Check") if "Check" in trust_order else len(trust_order)
    active["_trust"] = active["trust"].map(lambda t: trust_order.index(t) if t in trust_order else fallback)

    # Jobs you added yourself: their own tab, whatever their score, newest first
    is_manual = active["site"] == store.MANUAL_SITE
    manual = active[is_manual].iloc[::-1]
    active = active[~is_manual]

    # Description missing / cut off and not downloadable: own tab, not scored
    is_incomplete = active["status"] == store.INCOMPLETE_STATUS
    incomplete = active[is_incomplete].sort_values("found_on", ascending=False)
    active = active[~is_incomplete]

    # "New today": found in this run and strong
    is_new = active["job_url"].isin(new_urls or set()) & (active["_score"] >= new_min)
    new_today = active[is_new].sort_values(["_trust", "_score"], ascending=[True, False])
    active = active[~is_new]

    good = active[active["_score"] >= good_min].sort_values(
        ["_trust", "_score", "found_on"], ascending=[True, False, False])
    maybe = active[(active["_score"] >= min_score) & (active["_score"] < good_min)].sort_values(
        ["_score", "found_on"], ascending=False)
    hidden = len(active) - len(good) - len(maybe)

    last_counts[:] = [
        (f"= New today ({new_when}, score {new_min}+)", len(new_today)),
        (f"= Good matches (score {good_min}+)", len(good)),
        (f"= Maybe (score {min_score}-{good_min - 1})", len(maybe)),
        (f"  left out of the report (score below {min_score}, still in the tracker)", hidden),
        (f"= {store.INCOMPLETE_STATUS}", len(incomplete)),
        ("= Manual input jobs (added by you)", len(manual)),
        ("= Applied", len(applied)),
        ("= Not interested", len(not_interested)),
    ]

    jobs = [_job_data(job, "good", new=True) for _, job in new_today.iterrows()]
    for tab, table in (("good", good), ("maybe", maybe), ("manual", manual), ("incomplete", incomplete),
                       ("applied", applied), ("notint", not_interested)):
        jobs += [_job_data(job, tab) for _, job in table.iterrows()]

    data = {
        "updated": f"{datetime.now():%d %b %Y, %H:%M}",
        "new_when": new_when,
        "settings": {"good_min": good_min, "min_score": min_score, "new_min": new_min,
                     "min_description": store.MIN_DESCRIPTION},
        "stats": {"tracked": len(tracker), "new_today": len(new_today),
                  "good": len(new_today) + len(good), "applied": len(applied)},
        "charts": _charts(tracker),
        "usage": _usage(),
        "jobs": jobs,
    }
    return data
