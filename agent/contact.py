"""Contact — find a recruiter / hiring email or phone number in a job description.

Plain "regular expressions" (text patterns), no AI, so it is free and instant.
Example: "Send your CV to ana.lopez@acme.es or call +34 628 452 723"
         -> "ana.lopez@acme.es; +34 628 452 723"
"""

import re

# name@domain.com  (the domain must end in letters, e.g. ".com", ".es")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}")

# Phone numbers, two shapes only, so salaries and dates are not picked up:
#   1) international: +34 628 452 723, +1 (203) 964-0096
#   2) Spanish 9 digits starting with 6, 7, 8 or 9: 652 067 523, 935.795.978, 963 12 34 56
PHONE = re.compile(
    r"\+\d{1,3}[ .-]?\(?\d{1,4}\)?(?:[ .-]?\d{2,4}){2,4}"
    r"|(?<![\d.,])[6789]\d{2}(?:[ .]?\d{3}[ .]?\d{3}|[ .]\d{2}[ .]\d{2}[ .]\d{2})(?![\d.,]\d)"
)

# Addresses that are not a person to contact about the job.
SKIP_ADDRESS = ("noreply", "no-reply", "no_reply", "donotreply", "do-not-reply", "mailer-daemon",
                "privacy", "dpo", "gdpr", "dataprotection", "accommodat", "accomodat",
                "support", "example.")
# Generic job-board addresses (the board itself, not the recruiter).
SKIP_DOMAINS = ("linkedin.", "indeed.", "glassdoor.", "infojobs.", "remotive.", "remoteok.",
                "remote.co", "himalayas.", "weworkremotely.", "jooble.", "adzuna.", "ziprecruiter.",
                "monster.", "jobtoday.", "tecnoempleo.")
# If one of these words is written just before an email/phone, it is about
# privacy or disability support, not about applying.
SKIP_CONTEXT = ("privacy", "privacidad", "data protection", "protección de datos", "gdpr",
                "accommodation", "accomodation", "disability", "support",
                "tratamiento", "dpo-")


def _wanted(text: str, start: int, found: str) -> bool:
    if any(word in found.lower() for word in SKIP_ADDRESS):
        return False
    if "@" in found and any(domain in found.lower().split("@")[-1] for domain in SKIP_DOMAINS):
        return False
    before = text[max(0, start - 80):start].lower()
    return not any(word in before for word in SKIP_CONTEXT)


def find_contact(description: str) -> str:
    """Return emails and phones found, joined with "; ", or "" if none."""
    text = str(description or "").replace("\\", "")  # job sites escape "_" and "@" as "\_"
    found = []
    for match in EMAIL.finditer(text):
        email = match.group().strip(".")
        if _wanted(text, match.start(), email) and email.lower() not in [f.lower() for f in found]:
            found.append(email)
    for match in PHONE.finditer(text):
        phone = match.group().strip()
        digits = re.sub(r"\D", "", phone)
        if not 9 <= len(digits) <= 15:
            continue
        if _wanted(text, match.start(), phone) and digits not in [re.sub(r"\D", "", f) for f in found]:
            found.append(phone)
    return "; ".join(found[:3])  # at most 3, to keep the column short


def check_ai_contact(ai_contact: str, description: str) -> str:
    """Keep Gemini's contact only if it is really written in the description.

    Gemini can catch things the patterns miss (e.g. "ana at acme dot es"), but
    an AI can also invent things, so we double-check it against the text.
    """
    text = str(description or "").lower()
    kept = []
    for part in re.split(r"[;,]", ai_contact or ""):
        part = part.strip()
        if not part or any(word in part.lower() for word in SKIP_ADDRESS):
            continue
        if "@" in part and any(d in part.lower().split("@")[-1] for d in SKIP_DOMAINS):
            continue
        if "@" in part:
            name = part.split("@")[0].lower()
            if len(name) >= 3 and name in text:
                kept.append(part)
        else:
            digits = re.sub(r"\D", "", part)
            if len(digits) >= 9 and digits[-6:] in re.sub(r"\D", "", text):
                kept.append(part)
    return "; ".join(kept)
