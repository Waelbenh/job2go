"""Learning guide: for ONE job, a short plan to learn its "To learn" items (made only when you
press "Make a learning guide" in the web app, never with every pack).

For each item: what it is, why this job needs it, 2-4 free or cheap ways to learn it and a rough
time; then a one-week plan to be ready for the interview.

No invented links: the AI only names WHERE to look (a platform from a fixed list) and WHAT to
search for. The code builds the link itself - a search on that platform - so every link works.

Saved in the job's pack folder (data/applications/<company>_<number>/) as learning_guide.json
(the web app shows it) and learning_guide.md (to read anywhere).
"""

import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Literal
from urllib.parse import quote_plus

import yaml
from pydantic import BaseModel

import llm
import run  # re-uses get_api_key(), like agent/actions.py
from agent import store

APPLICATIONS = Path("data/applications")

# Where the AI may send you, and how the code turns a search into a link
PLATFORMS = {
    "YouTube": "https://www.youtube.com/results?search_query={q}",
    "Coursera": "https://www.coursera.org/search?query={q}",
    "edX": "https://www.edx.org/search?q={q}",
    "LinkedIn Learning": "https://www.linkedin.com/learning/search?keywords={q}",
    "Khan Academy": "https://www.khanacademy.org/search?page_search_query={q}",
    "Google search (official site, docs or free trial)": "https://www.google.com/search?q={q}",
}
Platform = Literal["YouTube", "Coursera", "edX", "LinkedIn Learning", "Khan Academy",
                   "Google search (official site, docs or free trial)"]


class Resource(BaseModel):
    platform: Platform
    search: str          # what to search for on that platform, e.g. "KYC process explained"
    what_you_get: str    # one short line: why this one
    cost: Literal["Free", "Free to audit", "Free trial", "Paid (cheap)"]


class Item(BaseModel):
    skill: str           # the To-learn item, as the job ad says it
    what_it_is: str      # 1-2 plain sentences
    why_this_job: str    # 1 sentence: what the job will ask of you
    resources: list[Resource]  # 2-4
    hours: str           # rough time, e.g. "3-5 hours"


class Day(BaseModel):
    day: str             # "Day 1" ... "Day 7"
    plan: str            # what to do that day, 1-2 sentences


class Guide(BaseModel):
    items: list[Item]
    week: list[Day]      # 7 days
    interview_tip: str   # how to talk about these gaps honestly in the interview


PROMPT = """You are a practical career coach. A job seeker found a job they fit well, but the job ad
asks for a few things they still have to learn. Make a short, practical learning guide.

The job: {title} at {company} ({location})
The things to learn (from the job's screening):
{to_learn}

What the job seeker already has (profile, for context only):
{profile}

The job ad:
{description}

Rules:
- One item per thing to learn, in the same order. Say what it is in plain words, and why THIS job needs it.
- 2-4 resources per item. Prefer free ones. For each, choose a platform from the list and write the exact
  words to search for there (short, specific). Never write a URL: the links are made from your search words.
  For a tool, use "Google search (official site, docs or free trial)" with words like "<tool> free trial"
  or "<tool> documentation getting started".
- A realistic time per item ("2-4 hours").
- A 7-day plan (Day 1 to Day 7) that fits next to a job search, about 1-2 hours a day, ending interview-ready.
- One honest interview tip: how to talk about these points without claiming experience they do not have.
- Plain, simple English. No hype words.
"""


def _folder(job) -> Path:
    """The job's pack folder (the same one tailor.py uses), made if it does not exist yet."""
    if job["pack"]:
        return Path(job["pack"])
    # the same name tailor.py's slug() makes, so a pack made later lands in the same folder
    plain = unicodedata.normalize("NFKD", job["company"]).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "_", plain.lower()).strip("_")[:30] or "job"
    return APPLICATIONS / f"{slug}_{job.name}"


def link(resource: dict) -> str:
    return PLATFORMS[resource["platform"]].format(q=quote_plus(resource["search"]))


def load(number: int) -> dict | None:
    tracker = store.load()
    if number not in tracker.index:
        return None
    file = _folder(tracker.loc[number]) / "learning_guide.json"
    return json.loads(file.read_text(encoding="utf-8")) if file.exists() else None


def make(number: int) -> tuple[bool, str]:
    tracker = store.load()
    if number not in tracker.index:
        return False, f"There is no job #{number}."
    job = tracker.loc[number]
    to_learn = [t.strip() for t in (job["to_learn"] or job["gaps"]).split(";") if t.strip()]
    if not to_learn:
        return False, "This job has nothing in To learn."
    config = yaml.safe_load(Path("config.yaml").read_text())
    profile = yaml.safe_load(Path("profile.yaml").read_text(encoding="utf-8"))
    profile_short = yaml.safe_dump({k: profile.get(k) for k in ("summary", "skills", "experience", "projects")},
                                   allow_unicode=True, sort_keys=False)[:6000]
    prompt = PROMPT.format(title=job["title"], company=job["company"], location=job["location"],
                           to_learn="\n".join(f"- {t}" for t in to_learn), profile=profile_short,
                           description=str(job["description"])[:5000])
    try:
        guide, made_by = llm.generate_pack(prompt, Guide, run.get_api_key(),
                                           config.get("tailoring_model", "gemini-3.8-flash"), temperature=0.4)
    except llm.AllProvidersFailed as error:
        return False, f"No AI was available right now ({str(error)[:120]}). Try again later."

    data = guide.model_dump()
    for item in data["items"]:
        item["resources"] = item["resources"][:4]
        for resource in item["resources"]:
            resource["url"] = link(resource)  # made by code, never by the AI
    data.update(made_on=date.today().isoformat(), made_by=made_by, title=job["title"], company=job["company"])

    folder = _folder(job)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "learning_guide.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "learning_guide.md").write_text(as_markdown(data), encoding="utf-8")
    return True, "Learning guide ready."


def as_markdown(data: dict) -> str:
    out = [f"# Learning guide: {data['title']} at {data['company']}", "",
           f"Made on {data['made_on']} by {data['made_by']}.", ""]
    for item in data["items"]:
        out += [f"## {item['skill']}  ({item['hours']})", "", item["what_it_is"], "",
                f"**Why this job needs it:** {item['why_this_job']}", ""]
        out += [f"- [{r['platform']}: {r['search']}]({r['url']}) ({r['cost']}). {r['what_you_get']}"
                for r in item["resources"]]
        out.append("")
    out += ["## One-week plan", ""] + [f"- **{d['day']}:** {d['plan']}" for d in data["week"]]
    out += ["", "## In the interview", "", data["interview_tip"], ""]
    return "\n".join(out)
