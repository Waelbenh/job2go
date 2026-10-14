"""Step 1c — InfoJobs alert emails (read from Gmail, read-only).

InfoJobs sends you "job alert" emails. This reads them over IMAP and turns every
job inside into a normal job row (source "InfoJobs"), so the usual pre-filter and
AI scoring run on them.

Safety: the mailbox is opened READ-ONLY. This code never deletes, moves, flags
or sends anything (BODY.PEEK even keeps the emails "unread").

Needs GMAIL_ADDRESS and GMAIL_APP_PASSWORD in the .env file.
Only emails from InfoJobs senders in the last max_age_days days (config.yaml) are looked at, and each
email is remembered (data/infojobs_emails_done.json) so it is never read twice.

Test only the login with:   python -m agent.infojobs_email
"""

import email
import imaplib
import json
import re
from datetime import date, timedelta
from email.header import decode_header, make_header
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import requests
from markdownify import markdownify

import llm
from agent.search import KEEP_COLUMNS

IMAP_HOST = "imap.gmail.com"
DONE_FILE = Path("data/infojobs_emails_done.json")
DAYS_BACK = 3  # default; run.py passes max_age_days from config.yaml
SENDER_WORD = "infojobs"  # the "From" line must contain this
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

# Link texts that are buttons/footer links, not job titles.
NOT_A_TITLE = re.compile(
    r"^(ver (oferta|todas|más|mas)|inscr[ií]bete|apply|ver en|darme de baja|dar de baja|"
    r"gestionar|configura|modificar|editar|accede|entra|infojobs|privacidad|ayuda|"
    r"política|politica|aviso legal|descarga|app)", re.IGNORECASE)


# ---------- connecting to Gmail ----------

def connect() -> imaplib.IMAP4_SSL:
    """Log in to Gmail. Raises an error with a clear message if it fails."""
    address = llm._read_env_key("GMAIL_ADDRESS")
    password = llm._read_env_key("GMAIL_APP_PASSWORD").replace(" ", "")  # Google shows it in groups
    if not address or not password:
        raise RuntimeError("GMAIL_ADDRESS or GMAIL_APP_PASSWORD is missing in the .env file.")
    mailbox = imaplib.IMAP4_SSL(IMAP_HOST)
    mailbox.login(address, password)
    mailbox.select("INBOX", readonly=True)  # readonly: nothing can be changed
    return mailbox


# ---------- reading the email HTML ----------

class _LinkReader(HTMLParser):
    """Walks through an email's HTML and builds a list of items, in order:
    ("link", url, text) for every link and ("text", line) for every other line."""

    def __init__(self):
        super().__init__()
        self.items = []
        self._href = None
        self._buffer = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._flush()
            self._href = dict(attrs).get("href", "")
        elif tag in ("br", "p", "div", "tr", "td", "li", "h1", "h2", "h3", "h4"):
            if self._href is None:
                self._flush()

    def handle_endtag(self, tag):
        if tag == "a":
            text = " ".join("".join(self._buffer).split())
            self._buffer = []
            if self._href:
                self.items.append(("link", self._href, text))
            elif text:
                self.items.append(("text", text))
            self._href = None
        elif tag in ("p", "div", "tr", "td", "li", "h1", "h2", "h3", "h4"):
            if self._href is None:
                self._flush()

    def handle_data(self, data):
        self._buffer.append(data)

    def _flush(self):
        text = " ".join("".join(self._buffer).split())
        self._buffer = []
        if text:
            self.items.append(("text", text))

    def close(self):
        super().close()
        self._flush()


def _is_infojobs_link(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return url.startswith("http") and SENDER_WORD in host


def extract_jobs(html_body: str, plain_body: str = "") -> list[dict]:
    """Every job in one alert email: title, company, location, link.
    A job = a link with a title-like text; the first text lines after it are the
    company and the location (until the next job starts)."""
    reader = _LinkReader()
    reader.feed(html_body or "")
    reader.close()
    items = reader.items

    starts = []  # positions of the job links
    seen_urls = set()
    for position, item in enumerate(items):
        if item[0] != "link":
            continue
        _, url, text = item
        if not _is_infojobs_link(url) or len(text) < 4 or NOT_A_TITLE.match(text):
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)
        starts.append(position)

    jobs = []
    for number, position in enumerate(starts):
        end = starts[number + 1] if number + 1 < len(starts) else len(items)
        _, url, title = items[position]
        lines = [i[1] for i in items[position + 1:end] if i[0] == "text"][:6]
        jobs.append({
            "title": title, "url": url,
            "company": lines[0] if lines else "",
            "location": lines[1] if len(lines) > 1 else "",
            "extra": "\n".join(lines),  # the email's own text about the job
        })
    return jobs


# ---------- the job page ----------

def fetch_description(url: str) -> tuple[str, str]:
    """Try to download the job page. Returns (clean_url, description_text),
    or (url, "") if InfoJobs blocks us or the page has no real content."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
    except requests.RequestException:
        return url, ""
    final = response.url
    # Alert links are often tracking redirects: keep the real offer link, without tracking parameters.
    clean = final.split("?")[0] if _is_infojobs_link(final) else url
    if response.status_code != 200:
        return clean, ""
    page = re.sub(r"(?is)<(script|style|nav|header|footer)\b.*?</\1>", "", response.text)
    text = markdownify(page).strip()
    blocked = re.search(r"captcha|access denied|are you a robot|unusual traffic|forbidden",
                        text[:2000], re.IGNORECASE)
    if blocked or len(text) < 400:
        return clean, ""
    return clean, text


# ---------- reading the emails ----------

def _load_done() -> list[str]:
    try:
        return json.loads(DONE_FILE.read_text())
    except (FileNotFoundError, ValueError):
        return []


def _bodies(message) -> tuple[str, str]:
    """(html, plain text) of an email."""
    html_body, plain = "", ""
    for part in message.walk():
        kind = part.get_content_type()
        if kind not in ("text/html", "text/plain"):
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        if kind == "text/html":
            html_body += text
        else:
            plain += text
    return html_body, plain


def find_infojobs_jobs(known_urls: set[str], days_back: int = DAYS_BACK) -> pd.DataFrame:
    """Read new InfoJobs alert emails and return their jobs (links in known_urls are skipped)."""
    try:
        mailbox = connect()
    except Exception as error:
        print(f"  ! Skipped — could not log in to Gmail ({str(error)[:120]})")
        return pd.DataFrame(columns=KEEP_COLUMNS)

    done = _load_done()
    since = (date.today() - timedelta(days=days_back)).strftime("%d-%b-%Y")
    rows, newly_done = [], []
    try:
        _, data = mailbox.search(None, "SINCE", since, "FROM", SENDER_WORD)
        ids = data[0].split()
        print(f"  {len(ids)} InfoJobs emails in the last {days_back} days.")
        for mail_id in ids:
            # BODY.PEEK[] = read the email without marking it as read
            _, parts = mailbox.fetch(mail_id, "(BODY.PEEK[])")
            message = email.message_from_bytes(parts[0][1])
            message_id = (message.get("Message-ID") or "").strip() or f"{since}-{mail_id.decode()}"
            if message_id in done:
                continue
            subject = str(make_header(decode_header(message.get("Subject", ""))))
            html_body, plain = _bodies(message)
            jobs = extract_jobs(html_body, plain)
            print(f"  Email \"{subject[:50]}\": {len(jobs)} jobs")
            posted = date.today().isoformat()
            for job in jobs:
                if job["url"] in known_urls:
                    continue
                url, page_text = fetch_description(job["url"])
                if url in known_urls:
                    continue
                known_urls.add(job["url"])
                known_urls.add(url)
                if page_text:
                    description = page_text
                else:  # page blocked: keep what the email says
                    description = ("[PARTIAL description: InfoJobs page not available, "
                                   "this is only the text from the alert email]\n\n"
                                   f"{job['title']}\n{job['extra']}")
                rows.append({
                    "site": "infojobs", "title": job["title"], "company": job["company"],
                    "location": job["location"], "is_remote": "",
                    "date_posted": posted, "job_url": url, "description": description,
                })
            newly_done.append(message_id)
    except Exception as error:
        print(f"  ! Stopped reading emails ({str(error)[:120]})")
    finally:
        try:
            mailbox.logout()
        except Exception:
            pass

    if newly_done:
        DONE_FILE.parent.mkdir(exist_ok=True)
        DONE_FILE.write_text(json.dumps(done + newly_done, indent=2))

    if not rows:
        return pd.DataFrame(columns=KEEP_COLUMNS)
    table = pd.DataFrame(rows)[KEEP_COLUMNS].fillna("").astype(str)
    return table.drop_duplicates(subset="job_url").reset_index(drop=True)


if __name__ == "__main__":
    # Login test only: reads no emails.
    box = connect()
    status, data = box.search(None, "SINCE", (date.today() - timedelta(days=DAYS_BACK)).strftime("%d-%b-%Y"),
                              "FROM", SENDER_WORD)
    print(f"Gmail login works. InfoJobs emails in the last {DAYS_BACK} days: {len(data[0].split())}")
    box.logout()
