"""Incomplete job descriptions: spot them, and try to download the full text.

A description is incomplete when it is missing, shorter than store.MIN_DESCRIPTION
(300 characters), or cut off (ends with "..." here, or the AI says it stops mid-sentence).
Before giving up, we open the job's link once and look for the full text:
  1. "JobPosting" data that most career sites (Greenhouse, Lever, Workday, Avature...) put
     in the page for Google - it holds the whole description;
  2. the description box of LinkedIn / Indeed job pages.
LinkedIn links use LinkedIn's public "guest" job page, 2-3 seconds apart, so LinkedIn does not
block us (JobSpy asks for all descriptions at once during the search, and LinkedIn often answers
"too many requests" - those jobs arrive with no text).
If that fails, the job gets status "incomplete - paste description" and is not scored:
paste the text with the report's "Add description" button.
"""

import json
import random
import re
import time

import requests
from bs4 import BeautifulSoup

from agent import store

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept-Language": "en,es;q=0.8,fr;q=0.6",
}
# Description boxes on job pages we know (LinkedIn public page, Indeed)
BOXES = [".show-more-less-html__markup", ".description__text", "#jobDescriptionText"]
CUT_OFF_ENDINGS = ("...", "…", "[...]")
LINKEDIN_GUEST_PAGE = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
_last_linkedin_request = 0.0  # time of the last LinkedIn request (to wait 2-3 seconds between them)


def linkedin_job_id(url: str) -> str:
    """"https://www.linkedin.com/jobs/view/4477402237" -> "4477402237" ("" if not a LinkedIn job)."""
    found = re.search(r"linkedin\.com/jobs/view/(?:[^/?]*-)?(\d+)", str(url))
    return found.group(1) if found else ""


def _wait_for_linkedin() -> None:
    """Wait until 2-3 seconds have passed since the last LinkedIn request."""
    global _last_linkedin_request
    pause = random.uniform(2, 3) - (time.time() - _last_linkedin_request)
    if pause > 0:
        time.sleep(pause)
    _last_linkedin_request = time.time()


def is_incomplete(text: str) -> bool:
    """True if the description is missing, too short, or clearly cut off."""
    text = str(text or "").strip()
    return len(text) < store.MIN_DESCRIPTION or text.endswith(CUT_OFF_ENDINGS)


def _html_to_text(markup: str) -> str:
    """HTML -> plain text with one line per paragraph / bullet."""
    text = BeautifulSoup(markup, "lxml").get_text("\n", strip=True)
    return text.replace("Show more\nShow less", "").strip()


def _from_job_posting_data(soup: BeautifulSoup) -> str:
    """The description inside <script type="application/ld+json"> JobPosting data, if any."""
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except ValueError:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data])
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "JobPosting" and item.get("description"):
                return _html_to_text(item["description"])
    return ""


def fetch_description(url: str) -> str:
    """Open the job's link and return its full description ("" if not found or blocked).
    LinkedIn: its public guest page, 2-3 seconds after the previous LinkedIn request, one try
    (if LinkedIn blocks us, the job is marked incomplete instead of asking again and again)."""
    job_id = linkedin_job_id(url)
    if job_id:
        _wait_for_linkedin()
        url = LINKEDIN_GUEST_PAGE.format(job_id=job_id)
    if not str(url).startswith("http"):
        return ""
    try:
        page = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException:
        return ""
    if page.status_code != 200:  # 429 = "too many requests" (blocked), 404 = job removed...
        return ""
    soup = BeautifulSoup(page.text, "lxml")
    text = _from_job_posting_data(soup)
    if not text:
        box = soup.select_one(", ".join(BOXES))
        text = _html_to_text(str(box)) if box else ""
    return text


def try_to_complete(job: dict) -> str:
    """The full description if the link gives a longer, complete one; otherwise ""."""
    old = str(job.get("description", "")).strip()
    new = fetch_description(job.get("job_url", ""))
    if len(new) >= store.MIN_DESCRIPTION and len(new) > len(old) and not new.endswith(CUT_OFF_ENDINGS):
        return new
    return ""
