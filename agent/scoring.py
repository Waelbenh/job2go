"""Step 2 — Score: the AI rates how well each job fits your profile (1-10),
then fixed rules in this file turn that into the final score.

Why two steps? The AI is good at reading a job and judging fit, but it is not
always consistent with rules like "metro area = -1". So the AI only gives a
FIT score for the must-haves (core skills, seniority, languages) plus fixed-choice
answers, and apply_rules() below adds boosts, penalties and caps the same way every
time. All the numbers are in config.yaml -> scoring_rules.
"""

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

import llm
from agent import home

# The exact values the AI is allowed to answer with ("Literal" = only these).
# The location tiers name YOUR city and country (config.yaml -> home), e.g. "Valencia city".
LocationTier = Literal[tuple(home.LOCATION_TIERS)]
Arrangement = Literal["On-site", "Hybrid", "Remote", "Not stated"]
ContractType = Literal[home.CONTRACT_LABEL, "Freelance/contractor", "Foreign contract", "Unclear"]
Pay = Literal["Paid", "Unpaid", "Commission only", "Not stated"]
# Languages the job REQUIRES (config.yaml my_languages says which ones you have)
LanguageNeed = Literal[
    "English", "French", "Arabic", "Spanish (B2 or lower)", "Spanish (C1 / native)",
    "German", "Italian", "Portuguese", "Dutch", "Other",
]
Seniority = Literal["Internship", "Entry / Junior / Associate", "Mid-level", "Senior (5+ years)", "Not stated"]
RoleType = Literal[
    "Customer success / account management", "Customer-facing / support", "Operations", "Sales",
    "Business / product / data analysis", "Marketing / content", "Engineering / IT", "Other",
]
WorkType = Literal["Employee", "Freelance/contract", "Unclear"]
Trust = Literal["Trusted", "Check", "Suspicious"]


class JobFit(BaseModel):
    score: int                    # FIT 1-10 for the must-haves, before the code rules
    summary: str                  # one sentence: why this score
    strengths: list[str]          # what in the profile matches the job
    to_learn: list[str]           # things normally taught on the job (never lower the score)
    red_flags: list[str]          # REAL warning signs only (see the prompt)
    unknowns: list[str]           # missing info: pay, contract, work mode, cut-off text...
    seniority: Seniority
    role_type: RoleType
    languages_required: list[LanguageNeed]   # only REQUIRED languages
    languages_preferred: list[LanguageNeed]  # languages that are "a plus" / preferred
    location_tier: LocationTier
    arrangement: Arrangement
    flexible_hours: bool
    contract_type: ContractType
    pay: Pay
    salary: str                   # e.g. "28-32k EUR/year", "" if not mentioned
    work_type: WorkType           # employee job or freelance/contract work
    trust: Trust                  # does the posting look real and safe?
    trust_reason: str             # short reason for the trust value
    contact: str                  # recruiter email/phone written in the posting, "" if none
    description_cut_off: bool     # true if the text clearly stops mid-sentence / mid-section


def load_rules() -> dict:
    """The scoring_rules section of config.yaml (read fresh, so edits work at once)."""
    return yaml.safe_load(Path("config.yaml").read_text()).get("scoring_rules", {})


def _examples_text() -> str:
    """The calibration examples from config.yaml, as lines for the prompt."""
    lines = []
    for example in load_rules().get("calibration_examples", []):
        job = " ".join(str(example["job"]).split())  # join the lines of a long YAML text
        lines.append(f"- {job} -> fit {example['fit']}, final {example['final']}/10. "
                     f"{' '.join(str(example['reason']).split())}")
    return "\n".join(lines)


# The rules for the AI, shared by the Gemini prompt (one job) and the Claude prompt (batches).
RULES = """You are a careful career advisor for a job seeker based in <CITY>, <COUNTRY>.
Be honest, but judge like a recruiter hiring for THIS level, not like a perfectionist.

FIELDS
- score = FIT 1-10 for the MUST-HAVES only: core skills and experience for the role, seniority, languages.
  9-10 meets almost every must-have; 7-8 meets the main ones, small gaps; 6 core profile fits, the rest is
  learnable; 4-5 real gaps in core skills or a related-but-different field; 2-3 a hard must-have is missing
  (e.g. a required language the candidate lacks, far too senior); 1 unrelated profession.
  * For entry / junior / associate / graduate roles, tasks normally taught on the job (configuring or
    setting up a platform, QA / testing, a specific domain like HR-tech, a specific tool) are NOT gaps:
    put them in to_learn and do NOT lower the score for them.
  * Do NOT add or remove points for location, remote/on-site, contract, pay, seniority level, role type
    or languages the candidate has: the code adds boosts and caps for those afterwards.
  * Missing information never lowers the score: put it in unknowns.
- summary: one sentence, why this score.
- strengths: what in the candidate's profile matches the job (languages, experience, education, tools).
- to_learn: things the job wants that the candidate lacks but can learn on the job.
- red_flags: ONLY real warning signs: commission-only pay, upfront fees or paying to work, scam/MLM signs,
  a REQUIRED language the candidate does not have (e.g. German, native or C1+ Spanish), a senior role needing
  5+ years, on-site/hybrid far from <CITY>. Nothing else; [] if none.
- unknowns: missing or unclear info, e.g. "pay not stated", "contract type not stated", "work mode not
  stated", "description cut off". [] if none.
- seniority: Internship / Entry / Junior / Associate / Mid-level / Senior (5+ years) / Not stated.
  "Entry / Junior / Associate" also for graduate roles and roles asking 0-2 years.
- role_type: Customer success / account management; Customer-facing / support; Operations; Sales;
  Business / product / data analysis; Marketing / content; Engineering / IT; Other.
- languages_required: every language the job REQUIRES (not "a plus"/"nice to have"). Spanish: "Spanish (B2 or
  lower)" for basic/intermediate/B1/B2/"good" Spanish, "Spanish (C1 / native)" for fluent/C1/C2/native/bilingual.
  An English posting that does not mention a language requires "English". [] if none.
- languages_preferred: languages the job calls "a plus", "preferred", "nice to have" (not required). [] if none.
- location_tier: <LOCATION_TIERS>
- arrangement: On-site / Hybrid / Remote / Not stated. flexible_hours: true only if clearly offered.
- contract_type: <CONTRACT> (employee of a company in <COUNTRY>) / Freelance/contractor /
  Foreign contract (employee of a company abroad, e.g. employer-of-record) / Unclear.
- pay: Paid / Unpaid (unpaid internship, volunteer) / Commission only / Not stated. salary: short text like
  "28-32k EUR/year", "" if none.
- work_type: Employee / Freelance/contract (autonomo, contrato mercantil, B2B, independant...) / Unclear.
- trust: Suspicious (asks the candidate to pay anything, only WhatsApp/Telegram/personal email, no real company,
  unrealistic pay, MLM, pushy "urgent / earn big") / Check (odd or missing info, unknown recruiter hiding the
  client) / Trusted (normal posting from a real company). trust_reason: max 15 words.
- contact: recruiter email/phone WRITTEN in the posting ("; " between several), copied exactly, never guessed;
  no no-reply, privacy or accessibility addresses. "" if none.
- description_cut_off: true only if the text clearly stops in the middle of a sentence or right after a
  heading with nothing below it. Otherwise false. A text ending with "[shortened by the job agent]" was
  shortened on purpose: that is NOT cut off.

CALIBRATION EXAMPLES (fit = your score; final = after the code rules):
{examples}
"""

# Your place names (config.yaml -> home) go into the rules
_TIERS_TEXT = (
    f'"{home.TIER_CITY}"; "{home.TIER_METRO}" (30-40 min away: {home.METRO_EXAMPLES}); '
    f'"{home.TIER_PROVINCE}" (rest of the province or anywhere within about 70 km / 1 hour, e.g. '
    f'{home.PROVINCE_EXAMPLES}); "{home.TIER_OUTSIDE}" (farther away, on-site or hybrid: {home.OUTSIDE_EXAMPLES}); '
    f'"{home.TIER_REMOTE_HOME}" (incl. EU/EMEA remote open to {home.COUNTRY}); '
    + "".join(f'"{tier}"; ' for tier in home.TIERS_REMOTE_ALSO)
    + '"Remote - worldwide"; "Remote - other countries only" (e.g. US/UK/LATAM only); "Unclear".')
RULES = (RULES.replace("<LOCATION_TIERS>", _TIERS_TEXT).replace("<CITY>", home.CITY)
         .replace("<COUNTRY>", home.COUNTRY).replace("<CONTRACT>", home.CONTRACT_LABEL))

PROMPT = RULES + """
CANDIDATE PROFILE (YAML):
{profile}

JOB:
Title: {title}
Company: {company}
Location: {location}
Remote: {remote}
Description:
{description}
"""


class JobFitItem(JobFit):
    """One job's answer inside a batch: the same fields as JobFit, plus the job's number."""
    id: int


# For Claude only the profile parts needed to judge fit are sent (keeps usage low).
PROFILE_PARTS_FOR_CLAUDE = ["headline", "summary", "languages", "education", "experience",
                            "skills", "tools_inventory", "what_i_want", "deal_breakers"]

BATCH_PROMPT = RULES + """
Score every job below. Answer with one JSON list: one object per job, "id" = the job's number.

CANDIDATE (YAML):
{profile}

JOBS:
{jobs}
"""

BATCH_SIZE = 10               # jobs per Claude request
BATCH_DESCRIPTION_CHARS = 3000  # shorter than a single-job request, to keep Claude usage low


def score_batch_with_claude(profile_text: str, jobs: list[dict]) -> list[tuple[dict, JobFit, str]]:
    """Score up to BATCH_SIZE jobs with ONE Claude request.
    Returns (job, fit, "claude/haiku") for every job Claude answered correctly;
    jobs missing from the answer are simply left out (they stay unscored until the next run)."""
    profile = yaml.safe_load(profile_text) or {}
    short_profile = yaml.safe_dump({k: profile[k] for k in PROFILE_PARTS_FOR_CLAUDE if k in profile},
                                   allow_unicode=True, sort_keys=False)
    blocks = []
    for number, job in enumerate(jobs):
        description = _shorten(job.get("description", ""), BATCH_DESCRIPTION_CHARS) or "(no description available)"
        blocks.append(f"--- JOB id={number} ---\nTitle: {job.get('title', '')}\nCompany: {job.get('company', '')}\n"
                      f"Location: {job.get('location', '')}\nRemote: {job.get('is_remote', '')}\n"
                      f"Description:\n{description}")
    prompt = BATCH_PROMPT.format(examples=_examples_text(), profile=short_profile, jobs="\n\n".join(blocks))
    items = llm.score_batch_with_claude(prompt, JobFitItem)
    model = llm.settings()["claude_scoring_model"]
    done, results = set(), []
    for item in items:
        if 0 <= item.id < len(jobs) and item.id not in done:  # ignore ids that don't exist or repeat
            done.add(item.id)
            results.append((jobs[item.id], item, f"claude/{model}"))
    return results


MAX_DESCRIPTION_CHARS = 6000
SECONDS_BETWEEN_CALLS = 7  # stays under the free-tier per-minute limit
SHORTENED = "\n[shortened by the job agent]"


def _shorten(description: str, limit: int) -> str:
    """The first `limit` characters, with a note when we cut it ourselves (so the AI
    does not think the posting itself is cut off)."""
    text = str(description or "")
    return text[:limit] + SHORTENED if len(text) > limit else text


def ai_saw_full_text(description: str) -> bool:
    """False if we shortened the text before the AI read it (Claude gets the shortest version);
    then the AI's "cut off" answer is about OUR cut and is ignored."""
    return len(str(description or "")) <= BATCH_DESCRIPTION_CHARS


def apply_rules(fit: JobFit) -> tuple[int, list[str]]:
    """Turn the AI's fit score into the final score, with the numbers in config.yaml scoring_rules.

    Returns (final score, list of the rules that changed it).
    Order: 1. boosts (only if fit >= boost_min_fit): French/Arabic + the others (at most max_other_boost)
           2. penalties   3. caps (real red flags)   4. keep it between 1 and 10.
    Example: fit 6, home city, entry level, a boosted language required -> 6 + 2 (language) + 1 (max) = 9.
    """
    rules = load_rules()
    boosts, penalties, caps = rules.get("boosts", {}), rules.get("penalties", {}), rules.get("caps", {})
    score = fit.score
    reasons = []
    tier = fit.location_tier
    my_languages = set(rules.get("my_languages", []))

    # 1. Boosts (only if the fit is good enough)
    if fit.score >= rules.get("boost_min_fit", 4):
        # Language boost: the job requires OR prefers one of boost_languages (French, Arabic)
        wanted = set(fit.languages_required) | set(fit.languages_preferred)
        special = [language for language in rules.get("boost_languages", []) if language in wanted]
        if special and boosts.get("language"):
            score += boosts["language"]
            reasons.append(f"+{boosts['language']} ({', '.join(special)})")
        # All other boosts together: at most max_other_boost
        found = []  # (points, reason)
        if tier in rules.get("boost_location_tiers", []):
            found.append((boosts.get("location", 0), tier))
        if fit.seniority in rules.get("entry_levels", []):
            found.append((boosts.get("entry_level", 0), "entry level"))
        if fit.role_type in rules.get("boost_role_types", []):
            found.append((boosts.get("role_type", 0), fit.role_type.lower()))
        total = sum(points for points, _ in found)
        added = min(total, rules.get("max_other_boost", total))
        if added:
            names = ", ".join(reason for points, reason in found if points)
            limit = f", max +{added}" if added < total else ""
            reasons.append(f"+{added} ({names}{limit})")
            score += added

    # 2. Penalties: location and pay (older config files call them valencia_metro_area / valencia_province)
    metro = penalties.get("metro_area", penalties.get("valencia_metro_area"))
    province = penalties.get("province", penalties.get("valencia_province"))
    if tier == home.TIER_METRO:
        if fit.arrangement == "Hybrid" or fit.flexible_hours:
            reasons.append("metro area, but hybrid/flexible: no change")
        elif metro:
            score -= metro
            reasons.append(f"metro area -{metro}")
    elif tier == home.TIER_PROVINCE and province:
        score -= province
        reasons.append(f"{home.CITY} province -{province}")
    pay_penalty = {"Unpaid": penalties.get("unpaid", 0),
                   "Commission only": penalties.get("commission_only", 0)}.get(fit.pay, 0)
    if pay_penalty:
        score -= pay_penalty
        reasons.append(f"{fit.pay.lower()} -{pay_penalty}")

    # 3. Caps: real red flags. The final score can never be higher than the cap.
    missing = [language for language in fit.languages_required if language not in my_languages]
    if "onsite_outside_home" not in caps and "onsite_outside_valencia" in caps:  # older config files
        caps = {**caps, "onsite_outside_home": caps["onsite_outside_valencia"]}
    checks = [
        ("language_i_dont_have", bool(missing), f"needs {', '.join(missing)}"),
        ("senior_5_plus_years", fit.seniority == "Senior (5+ years)", "senior, 5+ years"),
        ("onsite_outside_home", tier == home.TIER_OUTSIDE and fit.arrangement != "Remote",
         f"on-site/hybrid outside {home.CITY}"),
        ("remote_other_countries_only", tier == "Remote - other countries only", "remote for other countries only"),
        ("suspicious_posting", fit.trust == "Suspicious", "suspicious posting"),
    ]
    for key, applies, name in checks:
        if applies and key in caps:
            if score > caps[key]:
                reasons.append(f"{name}: capped at {caps[key]}")
            score = min(score, caps[key])

    # Salary not stated, contract type, work type and "Unclear" location: no change (on purpose).
    final = max(1, min(10, score))  # always between 1 and 10
    return final, reasons


def _split(cell: str) -> list[str]:
    """"English; French" -> ["English", "French"] ("Not stated" or "" -> [])."""
    return [part.strip() for part in str(cell).split(";") if part.strip() and part.strip() != "Not stated"]


def recalculate(job) -> tuple[int, list[str]] | None:
    """Apply the CURRENT rules again to a job's saved AI answers, without calling the AI.
    Only for scores made with these rules (they have a seniority); None for older scores."""
    if not job["seniority"] or not str(job["fit_score"]).isdigit():
        return None
    fit = JobFit.model_construct(  # model_construct = no checks, only the fields apply_rules reads
        score=int(job["fit_score"]), languages_required=_split(job["language"]),
        languages_preferred=_split(job["languages_preferred"]), seniority=job["seniority"],
        role_type=job["role_type"], location_tier=job["location_tier"], arrangement=job["arrangement"],
        flexible_hours=job["flexible_hours"] == "True", pay=job["pay"], trust=job["trust"])
    return apply_rules(fit)


def score_job(api_key: str, model: str, profile_text: str, job: dict) -> tuple[JobFit, str]:
    """Returns the score and which AI made it, e.g. "gemini/gemini-3.5-flash-lite".
    Raises llm.GeminiExhausted if no Gemini model could answer (run.py then tries Claude)."""
    prompt = PROMPT.format(
        examples=_examples_text(),
        profile=profile_text,
        title=job.get("title", ""),
        company=job.get("company", ""),
        location=job.get("location", ""),
        remote=job.get("is_remote", ""),
        description=_shorten(job.get("description", ""), MAX_DESCRIPTION_CHARS)
        or "(no description available)",
    )
    # llm.generate_score tries the Gemini model, then gemini_backup_model (tries/timeouts: config.yaml)
    return llm.generate_score(prompt, JobFit, api_key, model, temperature=0.2)
