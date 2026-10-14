"""Excel tracker — data/Job Tracker.xlsx, rebuilt on every run.

Three tabs:
  - "To review":       final score 6+ and status new / interested, best first
  - "My applications": status applied / interview / offer
  - "All jobs":        everything

You edit four columns, in ANY tab: Status, Applied on, Follow up, Notes.
On the next run the agent first READS those edits back from every tab, then
rewrites the file — so your changes are never lost.
The long "why this score" text is only in the HTML report, to keep Excel tidy.
Close the file in Excel before running the agent.
"""

from datetime import date, datetime
from pathlib import Path

import pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from agent.remote_sources import source_name

WORKBOOK = Path("data/Job Tracker.xlsx")

STATUSES = ["new", "interested", "pack ready", "pack incomplete", "applied", "interview", "offer", "rejected", "not interested", "filtered", "irrelevant title", "wrong location", "duplicate", "incomplete - paste description"]
REVIEW_STATUSES = ["new", "interested", "pack ready", "pack incomplete"]
APPLICATION_STATUSES = ["applied", "interview", "offer"]

# (header in Excel, column in data/jobs.csv, width)
COLUMNS = [
    ("Score", "score", 7),
    ("Status", "status", 13),
    ("Filter reason", "filter_reason", 30),
    ("Job title", "title", 34),
    ("Company", "company", 20),
    ("Location", "location", 18),
    ("Work type", "work_type", 17),
    ("Trust", "trust", 11),
    ("Location tier", "location_tier", 20),
    ("Arrangement", "arrangement", 12),
    ("Contract type", "contract_type", 16),
    ("Pay", "pay", 10),
    ("Salary", "salary", 14),
    ("Language", "language", 18),
    ("Contact", "contact", 28),
    ("Applied on", "applied_on", 11),
    ("Follow up", "follow_up", 11),
    ("Notes", "notes", 30),
    ("Tool to learn", "tool_to_learn", 16),
    ("Pack", "pack", 34),
    ("Quality", "quality", 8),
    ("Model", "model", 30),
    ("Pack model", "pack_model", 30),
    ("Link", "job_url", 20),
]
EDITABLE = {"Status": "status", "Applied on": "applied_on", "Follow up": "follow_up", "Notes": "notes"}

# Score colors: green 7+, yellow 5-6, red 1-4
GREEN = PatternFill("solid", fgColor="C6EFCE")
YELLOW = PatternFill("solid", fgColor="FFEB9C")
RED = PatternFill("solid", fgColor="FFC7CE")
HEADER = PatternFill("solid", fgColor="1F3A5F")


def _as_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    return str(value).strip()


def read_edits(tracker: pd.DataFrame) -> pd.DataFrame:
    """Copy what you typed in Excel (status, dates, notes) back into the tracker.

    Looks at every tab. A value counts as an edit when it differs from what
    the tracker has. If two tabs disagree, the first tab wins (with a warning).
    """
    if not WORKBOOK.exists():
        return tracker
    try:
        book = load_workbook(WORKBOOK)
    except Exception as error:
        print(f"     ! Could not read your Excel edits ({error}). Is the file open?")
        return tracker

    by_url = {url: i for i, url in tracker["job_url"].items()}
    # For each (job, field): every value found, in tab order
    found: dict[tuple[str, str], list[str]] = {}
    for sheet in book.worksheets:
        headers = [cell.value for cell in sheet[1]]
        if "Link" not in headers:
            continue  # not a jobs tab
        link_col = headers.index("Link")
        for row in sheet.iter_rows(min_row=2):
            cell = row[link_col]
            url = cell.hyperlink.target if cell.hyperlink else _as_text(cell.value)
            if url not in by_url:
                continue
            for header, field in EDITABLE.items():
                if header not in headers:
                    continue
                value = _as_text(row[headers.index(header)].value)
                if field == "status":
                    value = value.lower() or "new"
                found.setdefault((url, field), []).append(value)

    changed = 0
    for (url, field), values in found.items():
        current = tracker.at[by_url[url], field]
        edits = [v for v in values if v != current]
        if not edits:
            continue
        if len(set(edits)) > 1:
            title = tracker.at[by_url[url], "title"][:40]
            print(f"     ! '{title}': different {field} in two tabs — kept '{edits[0]}'.")
        tracker.at[by_url[url], field] = edits[0]
        changed += 1
    if changed:
        print(f"     Picked up {changed} change(s) you made in Excel.")
    return tracker


def _fill_sheet(sheet, table: pd.DataFrame) -> None:
    """Write the header row and one row per job into a tab."""
    for col, (header, _, width) in enumerate(COLUMNS, start=1):
        cell = sheet.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = HEADER
        sheet.column_dimensions[cell.column_letter].width = width

    no_wrap = Alignment(wrap_text=False, vertical="center")
    for r, (_, job) in enumerate(table.iterrows(), start=2):
        for c, (header, field, _) in enumerate(COLUMNS, start=1):
            value = job.get(field, "")
            if field == "score":
                value = int(job["_score"]) if job["_score"] else None
            cell = sheet.cell(row=r, column=c, value=value if value != "" else None)
            cell.alignment = no_wrap
            if field == "score" and value:
                cell.fill = GREEN if value >= 7 else YELLOW if value >= 5 else RED
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.font = Font(bold=True)
            # A manual job without a link keeps its id (e.g. "manual:690") as plain text,
            # because read_edits() uses this column to find the job again
            if field == "job_url" and value.startswith("http"):
                cell.value = f"via {source_name(job['site'])}"  # credits the job board
                cell.hyperlink = value
                cell.font = Font(color="0563C1", underline="single")

    last_col = sheet.cell(row=1, column=len(COLUMNS)).column_letter
    last_row = len(table) + 1
    sheet.freeze_panes = "C2"
    sheet.auto_filter.ref = f"A1:{last_col}{max(last_row, 2)}"

    # Status dropdown, only on the rows that have a job
    if len(table):
        status_list = DataValidation(
            type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=True
        )
        sheet.add_data_validation(status_list)
        status_list.add(f"B2:B{last_row}")


def write(tracker: pd.DataFrame, min_score: int = 6) -> Path:
    table = tracker.copy()
    table["_score"] = pd.to_numeric(table["score"], errors="coerce").fillna(0)
    table = table.sort_values(["_score", "found_on"], ascending=False)

    to_review = table[(table["_score"] >= min_score) & table["status"].isin(REVIEW_STATUSES)]
    applications = table[table["status"].isin(APPLICATION_STATUSES)].sort_values(
        ["applied_on", "_score"], ascending=False
    )

    book = Workbook()
    tabs = [("To review", to_review), ("My applications", applications), ("All jobs", table)]
    for i, (name, rows) in enumerate(tabs):
        sheet = book.active if i == 0 else book.create_sheet()
        sheet.title = name
        _fill_sheet(sheet, rows)

    WORKBOOK.parent.mkdir(exist_ok=True)
    book.save(WORKBOOK)
    return WORKBOOK
