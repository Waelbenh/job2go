"""Step 1b — Remote job boards: Remotive, Remote OK, Himalayas, We Work Remotely.

Each board has a free public feed. Their terms ask us to:
  - link back to the job page on their site, and name them as the source
    (the report and Excel show "via Remotive" etc. with their link),
  - not call them too often (we remember the last check in
    data/remote_sources_checked.json and skip a board if it was checked recently),
  - not re-publish their jobs on other websites (this tool is only for you).
"""

import html
import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import pandas as pd
import requests
from markdownify import markdownify

from agent import home
from agent.search import KEEP_COLUMNS

HEADERS = {"User-Agent": "job-agent (personal job search tool)"}
CHECKED_FILE = "data/remote_sources_checked.json"

# Name shown in the report/Excel ("via ...") — attribution the boards ask for.
SOURCE_NAMES = {
    "remotive": "Remotive",
    "remoteok": "Remote OK",
    "himalayas": "Himalayas",
    "weworkremotely": "We Work Remotely",
    # JobSpy sites, so every job can show where it came from
    "linkedin": "LinkedIn",
    "indeed": "Indeed",
    "glassdoor": "Glassdoor",
    "google": "Google Jobs",
    "infojobs": "InfoJobs",
}


def source_name(site: str) -> str:
    """'remoteok' -> 'Remote OK'. Unknown sites are shown as they are."""
    return SOURCE_NAMES.get(site, site or "link")

# Minimum hours between two checks of the same board (respecting their limits).
MIN_HOURS_BETWEEN_CHECKS = {
    "remotive": 6,         # Remotive asks for max. 4 calls a day
    "himalayas": 12,       # Himalayas refreshes its data once a day
    "remoteok": 1,
    "weworkremotely": 1,   # their RSS feeds say "refresh at most every 60 min"
}

# We Work Remotely has one RSS feed per category — these fit your target roles.
WWR_FEEDS = [
    "remote-customer-support-jobs",
    "remote-product-jobs",
    "remote-sales-and-marketing-jobs",
    "remote-management-and-finance-jobs",
    "all-other-remote-jobs",
]


# ---------- small helpers ----------

def _to_text(html_text: str) -> str:
    """Job descriptions come as HTML — turn them into readable text."""
    return markdownify(html_text or "").strip()


def _fix_text(text: str) -> str:
    """Remote OK sends some accents garbled ("fÃ¼r" instead of "für").
    Re-reading the letters the right way repairs them; if that fails, keep as is."""
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _job_type_line(job_type) -> str:
    """The board's own job type (e.g. "contract", "Full-Time") as a first line of
    the description, so the AI can tell freelance/contract jobs from employee jobs.
    We keep ALL types (full-time, part-time, contract, freelance)."""
    return f"Job type: {job_type}\n\n" if job_type else ""


def _title_matches(title: str, keywords: list[str], exclude: list[str]) -> bool:
    """True if the title contains a target-role keyword and no excluded word.
    \\b means "word boundary", so "ai" matches "AI specialist" but not "email"."""
    def has(word):
        return re.search(r"\b" + re.escape(word.lower()) + r"\b", title.lower())
    return any(has(k) for k in keywords) and not any(has(x) for x in exclude)


def _job(site, title, company, location, posted, url, description) -> dict:
    """One job in the same columns as the JobSpy jobs."""
    return {
        # html.unescape turns codes like "&amp;" back into "&"
        "site": site, "title": html.unescape(title).strip(),
        "company": html.unescape(company or "").strip(),
        "location": location or "Remote", "is_remote": "True",
        "date_posted": posted.date().isoformat() if posted else "",
        "job_url": url, "description": description,
    }


def _get(url: str, params: dict | None = None) -> requests.Response:
    response = requests.get(url, params=params, headers=HEADERS, timeout=60)
    response.raise_for_status()  # turns "404"/"429" etc. into an error we can show
    return response


# ---------- one function per board ----------

def remotive(keywords: list[str]) -> list[dict]:
    # One call returns all current jobs; we filter by title ourselves.
    data = json.loads(_get("https://remotive.com/api/remote-jobs").content)
    jobs = []
    for j in data["jobs"]:
        jobs.append(_job(
            "remotive", j["title"], j.get("company_name"),
            "Remote — " + (j.get("candidate_required_location") or "not stated"),
            datetime.fromisoformat(j["publication_date"]).replace(tzinfo=timezone.utc),
            j["url"],
            _job_type_line(j.get("job_type"))
            + (f"Salary: {j['salary']}\n\n" if j.get("salary") else "")
            + _to_text(j.get("description")),
        ))
    return jobs


def remoteok(keywords: list[str]) -> list[dict]:
    data = json.loads(_get("https://remoteok.com/api").content)
    jobs = []
    for j in data[1:]:  # the first item is their legal notice, not a job
        salary = ""
        if j.get("salary_min"):
            salary = f"Salary: {j['salary_min']}-{j.get('salary_max', '')} USD/year\n\n"
        jobs.append(_job(
            "remoteok", _fix_text(j.get("position", "")), _fix_text(j.get("company") or ""),
            "Remote — " + (_fix_text(j.get("location") or "") or "not stated"),
            datetime.fromisoformat(j["date"]) if j.get("date") else None,
            j["url"],
            salary + _fix_text(_to_text(j.get("description"))),
        ))
    return jobs


def himalayas(keywords: list[str]) -> list[dict]:
    # Himalayas has a search: one call per keyword, only jobs open to your country (config.yaml home).
    jobs = []
    for keyword in keywords:
        data = _get(
            "https://himalayas.app/jobs/api/search",
            {"q": keyword, "country": home.COUNTRY, "sort": "recent"},
        ).json()
        for j in data.get("jobs", []):
            places = j.get("locationRestrictions") or []
            if not places:
                where = "Worldwide"
            elif len(places) > 5:
                where = f"{len(places)} countries incl. {home.COUNTRY}"
            else:
                where = ", ".join(places)
            salary = ""
            if j.get("minSalary"):
                salary = (f"Salary: {j['minSalary']}-{j.get('maxSalary', '')} "
                          f"{j.get('currency', '')}/{j.get('salaryPeriod', '')}\n\n")
            jobs.append(_job(
                "himalayas", j["title"], j.get("companyName"), "Remote — " + where,
                datetime.fromtimestamp(j["pubDate"], timezone.utc) if j.get("pubDate") else None,
                j["guid"],  # the job's page on Himalayas
                _job_type_line(j.get("employmentType")) + salary + _to_text(j.get("description")),
            ))
        time.sleep(1)  # be gentle between calls
    return jobs


def weworkremotely(keywords: list[str]) -> list[dict]:
    jobs = []
    for feed in WWR_FEEDS:
        xml = _get(f"https://weworkremotely.com/categories/{feed}.rss").content
        for item in ET.fromstring(xml).iter("item"):
            text = lambda tag: (item.findtext(tag) or "").strip()
            # WWR titles look like "Company: Job title"
            company, _, title = text("title").partition(": ")
            if not title:
                company, title = "", company
            jobs.append(_job(
                "weworkremotely", title, company,
                "Remote — " + (text("region") or text("country") or "not stated"),
                parsedate_to_datetime(text("pubDate")) if text("pubDate") else None,
                text("link"),
                _job_type_line(text("type")) + _to_text(text("description")),
            ))
        time.sleep(1)
    return jobs


FETCHERS = {
    "remotive": remotive,
    "remoteok": remoteok,
    "himalayas": himalayas,
    "weworkremotely": weworkremotely,
}


# ---------- run all switched-on boards ----------

def _load_checked() -> dict:
    try:
        with open(CHECKED_FILE) as file:
            return json.load(file)
    except (FileNotFoundError, ValueError):
        return {}


def find_remote_jobs(config: dict) -> pd.DataFrame:
    """Fetch every board switched on in config.yaml, keep only target roles."""
    switches = config.get("remote_sources", {}) or {}
    keywords = config.get("remote_role_keywords", [])
    exclude = config.get("remote_exclude_words", [])
    oldest = datetime.now(timezone.utc) - timedelta(days=config.get("max_age_days", 3))
    checked = _load_checked()
    now = datetime.now()

    rows = []
    for name, fetch in FETCHERS.items():  # name = "remotive", fetch = remotive() ...
        if not switches.get(name, False):
            continue  # switched off in config.yaml
        label = SOURCE_NAMES[name]
        last = checked.get(name)
        if last:
            hours_ago = (now - datetime.fromisoformat(last)).total_seconds() / 3600
            if hours_ago < MIN_HOURS_BETWEEN_CHECKS[name]:
                print(f"  {label}: skipped, checked {hours_ago:.1f}h ago "
                      f"(wait {MIN_HOURS_BETWEEN_CHECKS[name]}h between checks)")
                continue
        print(f"  Checking {label} ...")
        try:
            found = fetch(keywords)
        except Exception as error:  # one broken board should not stop the rest
            print(f"    ! Skipped ({str(error)[:120]})")
            continue
        checked[name] = now.isoformat(timespec="seconds")
        kept = [
            j for j in found
            if _title_matches(j["title"], keywords, exclude)
            and (j["date_posted"] == "" or j["date_posted"] >= oldest.date().isoformat())
        ]
        print(f"    {len(found)} jobs, {len(kept)} match your roles")
        rows.extend(kept)

    with open(CHECKED_FILE, "w") as file:
        json.dump(checked, file, indent=2)

    if not rows:
        return pd.DataFrame(columns=KEEP_COLUMNS)
    table = pd.DataFrame(rows)[KEEP_COLUMNS].fillna("").astype(str)
    return table.drop_duplicates(subset="job_url").reset_index(drop=True)
