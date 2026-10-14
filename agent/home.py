"""Where you live and study: the place names the agent uses, from config.yaml -> home.

The AI sorts every job into a location tier ("<city> city", "<city> metro area", ...), the free
filters keep your area, the CV and letter write your city and your university the same way every
time. All of that reads these values, so the code itself names no city, country or school.
"""

import re
from pathlib import Path

import yaml

_home = (yaml.safe_load(Path("config.yaml").read_text(encoding="utf-8")) or {}).get("home", {}) \
    if Path("config.yaml").exists() else {}

CITY = _home.get("city", "My city")
COUNTRY = _home.get("country", "My country")
# Other countries whose remote jobs you can take (e.g. where you also have the right to work)
ALSO_REMOTE_FROM = list(_home.get("also_remote_from", []))
# "Spanish contract" = employed by a company in your country
CONTRACT_LABEL = f"{_home.get('contract_adjective', 'Local')} contract"

# How your city is written in each language (CV contact line, letter date and closing)
CITY_LOCAL = {"en": CITY, "es": CITY, "fr": CITY, **_home.get("city_local", {})}
CITY_FULL = {lang: f"{name}, {COUNTRY}" for lang, name in CITY_LOCAL.items()} | _home.get("city_full", {})
# Words that count as naming your city in a letter (a regular expression)
CITY_WORDS = re.compile(_home.get("city_words", re.escape(CITY)), re.IGNORECASE)

# For the AI: which places are the metro area, the wider area, and too far
METRO_EXAMPLES = _home.get("metro_examples", "nearby towns")
PROVINCE_EXAMPLES = _home.get("province_examples", "towns up to about 1 hour away")
OUTSIDE_EXAMPLES = _home.get("outside_examples", "other cities, abroad...")

# Your university, written the same way on every CV ("" = no rule)
_uni = _home.get("university", {}) or {}
UNIVERSITY = _uni.get("name", "")
UNIVERSITY_SHORT = _uni.get("short", "")
UNIVERSITY_VARIANTS = re.compile("|".join(_uni.get("variants", [])) or r"(?!x)x", re.IGNORECASE)

# The location tiers (the AI must answer with exactly one of these)
TIER_CITY = f"{CITY} city"
TIER_METRO = f"{CITY} metro area"
TIER_PROVINCE = f"{CITY} province"
TIER_OUTSIDE = f"Outside {CITY} province"
TIER_REMOTE_HOME = f"Remote - hires in {COUNTRY}"
TIERS_REMOTE_ALSO = [f"Remote - hires in {country}" for country in ALSO_REMOTE_FROM]
LOCATION_TIERS = [TIER_CITY, TIER_METRO, TIER_PROVINCE, TIER_OUTSIDE, TIER_REMOTE_HOME, *TIERS_REMOTE_ALSO,
                  "Remote - worldwide", "Remote - other countries only", "Unclear"]
