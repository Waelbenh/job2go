"""Free pre-filter — skips jobs that clearly don't fit, BEFORE the AI sees them.

Why: every Gemini call uses up your free daily quota. These rules cost nothing.
The rules live in config.yaml under "prefilter", so you can edit them yourself.

A filtered job is NOT deleted. It stays in data/jobs.csv with a "filter_reason"
saying which rule caught it, and one of these statuses:
  "irrelevant title" - the title is on the never-titles list (nurse, driver, SAP...)
  "wrong location"   - another city, not fully remote
  "filtered"         - an engineering title, or native Spanish required

Run it on its own with:   python prefilter.py
(run.py also calls it automatically before scoring.)
"""

import re
import unicodedata
from pathlib import Path

import yaml

from agent import home, store

# A1, A2, B1, B2: if one sits next to a C1/native word, the text is listing several
# levels (a form menu, or "B2 or C1") and does NOT demand native Spanish.
OTHER_LEVELS = re.compile(r"(?<!\w)[AB][12](?!\w)", re.IGNORECASE)

SPANISH_RULE = "Spanish level"
ENGINEERING_RULE = "Engineering title"
TITLE_RULE = "Never-title"
LOCATION_RULE = "Location"

# The status each rule gives (the first word of filter_reason tells the rule)
TITLE_STATUS = "irrelevant title"
LOCATION_STATUS = "wrong location"
OTHER_STATUS = "filtered"
FILTER_STATUSES = [TITLE_STATUS, LOCATION_STATUS, OTHER_STATUS]


def _plain(text: str) -> str:
    """Lower case without accents: 'Almacén' -> 'almacen'. Used by the title and location rules."""
    text = unicodedata.normalize("NFKD", str(text).lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def _word_pattern(words: list[str], plain: bool = False) -> re.Pattern:
    """One regex that finds any of the words as WHOLE words (so 'qa' is not inside 'aquaria').
    plain=True removes accents from the words, to match text that went through _plain()."""
    words = [_plain(w) if plain else w.lower() for w in words]
    parts = [re.escape(w) for w in sorted(words, key=len, reverse=True)]
    return re.compile(r"(?<!\w)(?:" + "|".join(parts) + r")(?!\w)", re.IGNORECASE)


def make_rules(config: dict) -> dict:
    """Turn the lists from config.yaml into ready-to-use regexes."""
    settings = config["prefilter"]
    spanish, engineering = settings["spanish"], settings["engineering"]
    never = settings.get("never_titles", {})
    place = settings.get("location", {})
    plain = lambda key: _word_pattern(place.get(key) or ["-none-"], plain=True)
    return {
        # Rule A: never-titles
        "never_titles": _word_pattern(never.get("title_words") or ["-none-"], plain=True),
        "never_allowed": _word_pattern(never.get("allow_in_title") or ["-none-"], plain=True),
        # Rule B: location
        "location_on": place.get("enabled", False),
        "keep_places": plain("keep_places"),
        "far_places": plain("far_places"),
        "unclear_places": plain("unclear_places"),
        "remote_ok": plain("remote_ok_regions"),
        "remote_words": plain("remote_words"),
        "hybrid_words": plain("hybrid_words"),
        "full_remote": plain("full_remote_phrases"),
        # Rules 1 and 2
        "distance": spanish.get("max_distance", 40),
        "level": _word_pattern(spanish["level_words"]),
        "spanish": _word_pattern(spanish["spanish_words"]),
        "other_language": _word_pattern(spanish["other_language_words"]),
        "required": _word_pattern(spanish["required_words"]),
        "optional": _word_pattern(spanish["optional_words"]),
        "required_section": _word_pattern(spanish["required_sections"]),
        "optional_section": _word_pattern(spanish["optional_sections"]),
        "regional": _word_pattern(spanish["regional_words"]),
        "title_words": _word_pattern(engineering["title_words"]),
        "allowed": _word_pattern(engineering["allow_in_title"]),
    }


def _nearest_language_is_spanish(text: str, level_match: re.Match, rules: dict) -> bool:
    """Is the language word closest to this level word Spanish (and close enough)?"""
    distance = rules["distance"]
    best_gap, best_is_spanish = distance + 1, False
    for key in ("spanish", "other_language"):
        for word in rules[key].finditer(text):
            # characters between the two words (0 if they touch)
            gap = max(word.start() - level_match.end(), level_match.start() - word.end(), 0)
            if gap < best_gap:
                best_gap, best_is_spanish = gap, key == "spanish"
    return best_is_spanish


# Where a sentence / bullet starts and ends
SEGMENT_BREAK = re.compile(r"\n|\s\*\s|\.\s")


def _segment(text: str, position: int) -> str:
    """The sentence or bullet that contains this position."""
    start = max((m.end() for m in SEGMENT_BREAK.finditer(text, 0, position)), default=0)
    end = SEGMENT_BREAK.search(text, position)
    return text[start:end.start() if end else len(text)]


def _clearly_required(text: str, level: re.Match, rules: dict) -> bool:
    """True only if the text says this Spanish level is mandatory."""
    line = _segment(text, level.start())
    if rules["optional"].search(line):    # "se valorará", "a plus"... -> nice-to-have
        return False
    if rules["regional"].search(line):    # bilingual Basque/Catalan/Galician + Spanish
        return False
    if rules["required"].search(line):    # "imprescindible", "must"... in the same bullet
        return True
    # No clue in the bullet itself: use the heading above ("Requisitos" / "Se valorará")
    before = text[:level.start()]
    last_required = max((m.start() for m in rules["required_section"].finditer(before)), default=-1)
    last_optional = max((m.start() for m in rules["optional_section"].finditer(before)), default=-1)
    return last_required > last_optional


def check_title(title: str, rules: dict) -> str:
    """Rule A: the title is clearly not my kind of job (nurse, driver, SAP consultant...)."""
    title = _plain(title)
    if rules["never_allowed"].search(title):
        return ""
    hit = rules["never_titles"].search(title)
    return f"{TITLE_RULE}: '{hit.group(0)}'" if hit else ""


def check_location(location: str, is_remote: str, title: str, description: str, rules: dict) -> str:
    """Rule B: keep your area (city/province, config.yaml prefilter), fully remote jobs and unclear locations.
    Returns the reason to drop the job, or "" to keep it. Steps are explained in config.yaml."""
    if not rules["location_on"]:
        return ""
    place, head = _plain(location), _plain(f"{title} {location}")
    # Is this job CLEARLY fully remote? (needed to keep a job in another city)
    said_remote = rules["remote_words"].search(head) and not rules["hybrid_words"].search(head)
    site_remote = (is_remote == "True" and rules["full_remote"].search(_plain(description))
                   and not rules["hybrid_words"].search(head))
    fully_remote = bool(said_remote or site_remote)

    # 1. A far town inside your region (far_places in config.yaml)
    far = rules["far_places"].search(place)
    if far:
        return "" if fully_remote else f"{LOCATION_RULE}: '{location}' is too far (not fully remote)"
    # 2. Your city / province (keep_places)
    if rules["keep_places"].search(place):
        return ""
    # 3. Only words like your country / "Remote" (or nothing at all): unclear, keep
    rest = rules["unclear_places"].sub(" ", place)
    if not re.search(r"\w", rest):
        return ""
    # 4. Remote-board location "Remote — ...": keep if it names your country, Europe, worldwide...
    if rules["remote_words"].match(place.strip()):
        if rules["remote_ok"].search(place):
            return ""
        return f"{LOCATION_RULE}: '{location}' does not hire from {' or '.join([home.COUNTRY, *home.ALSO_REMOTE_FROM])}"
    # 5. Another city or region: only clearly fully remote jobs stay
    if fully_remote:
        return ""
    return f"{LOCATION_RULE}: '{location}' is not {home.CITY} (and not fully remote)"


def check_job(title: str, description: str, rules: dict) -> str:
    """Rules 1 and 2. Return the reason to filter this job, or "" to keep it."""
    # Rule 2 first (cheap): engineering title, unless the allow-list says it's fine
    if not rules["allowed"].search(title):
        hit = rules["title_words"].search(title)
        if hit:
            return f"{ENGINEERING_RULE}: '{hit.group(0)}'"

    # Rule 1: native / C1 / C2 Spanish asked for in the title or description
    text = f"{title}\n{description}"
    for level in rules["level"].finditer(text):
        around = text[max(level.start() - 15, 0):level.end() + 15]
        if OTHER_LEVELS.search(around):
            continue
        if _nearest_language_is_spanish(text, level, rules) and _clearly_required(text, level, rules):
            start = max(level.start() - 30, 0)
            snippet = " ".join(text[start:level.end() + 30].split())
            return f"{SPANISH_RULE}: '...{snippet}...'"
    return ""


def apply(tracker, config: dict):
    """Filter jobs that are still "new" (you haven't touched them).
      - never-title and location rules: ALL "new" jobs, also ones scored earlier
        (the score stays saved; the job just disappears from the report)
      - engineering title and Spanish level: only jobs not scored yet
    Jobs you marked interested / pack ready / applied... are never filtered.
    Returns (all filtered rows, rows that were NOT filtered this way before)."""
    rules = make_rules(config)
    # Jobs filtered earlier get checked again, so a rule you edited in config.yaml
    # takes effect (a job that no longer matches goes back to "new").
    again = tracker["status"].isin(FILTER_STATUSES) & (
        (tracker["score"] == "") | tracker["status"].isin([TITLE_STATUS, LOCATION_STATUS]))
    before = {row: tracker.at[row, "filter_reason"] for row in tracker.index[again]}
    tracker.loc[again, ["status", "filter_reason"]] = ["new", ""]
    # Jobs you added yourself on the report page ("manual") are never filtered
    todo = tracker.index[(tracker["status"] == "new") & (tracker["filter_reason"] == "")
                         & (tracker["site"] != store.MANUAL_SITE)]
    hits = []
    for row in todo:
        job = tracker.loc[row]
        # Order: title (cheapest), location, then engineering title / Spanish level
        status, reason = TITLE_STATUS, check_title(job["title"], rules)
        if not reason:
            status = LOCATION_STATUS
            reason = check_location(job["location"], job["is_remote"], job["title"], job["description"], rules)
        if not reason and job["score"] == "":
            status, reason = OTHER_STATUS, check_job(job["title"], job["description"], rules)
        if reason:
            tracker.at[row, "status"] = status
            tracker.at[row, "filter_reason"] = reason
            hits.append(row)
    # "new" = the reason changed (a job that was filtered the same way last time is not counted again)
    new_hits = [row for row in hits if before.get(row) != tracker.at[row, "filter_reason"]]
    return hits, new_hits


def count_by_rule(tracker, rows: list) -> dict:
    """How many of these rows each rule caught, e.g. {"Location": 12, "Never-title": 3}."""
    rules = (TITLE_RULE, LOCATION_RULE, ENGINEERING_RULE, SPANISH_RULE)
    return {rule: sum(tracker.at[r, "filter_reason"].startswith(rule) for r in rows) for rule in rules}


def show_summary(tracker, hits: list, examples: int = 10) -> None:
    """Print how many jobs each rule caught, with example titles."""
    for rule in (TITLE_RULE, LOCATION_RULE, SPANISH_RULE, ENGINEERING_RULE):
        rows = [r for r in hits if tracker.at[r, "filter_reason"].startswith(rule)]
        print(f"\n=== {rule}: {len(rows)} jobs filtered ===")
        for row in rows[:examples]:
            print(f"  - {tracker.at[row, 'title'][:60]} | {tracker.at[row, 'company'][:25]}")
            print(f"      {tracker.at[row, 'filter_reason'][:130]}")


if __name__ == "__main__":
    config = yaml.safe_load(Path("config.yaml").read_text())
    tracker = store.load()
    hits, _ = apply(tracker, config)
    store.save(tracker)
    print(f"Checked unscored jobs: {len(hits)} filtered (never sent to the AI).")
    show_summary(tracker, hits)
