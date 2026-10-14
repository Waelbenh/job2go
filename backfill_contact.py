"""One-off: fill the Contact column for jobs already saved. No Gemini calls, no cost.

Run it from the job-agent folder with:   python backfill_contact.py
It only fills EMPTY contact cells (using the patterns in agent/contact.py), then
rebuilds data/Job Tracker.xlsx and data/report.html so the new column shows up.
"""

from agent import contact, excel, report, store

tracker = store.load()
tracker = excel.read_edits(tracker)  # keep anything you changed in Excel first

missing = tracker["contact"] == ""
tracker.loc[missing, "contact"] = tracker.loc[missing, "description"].map(contact.find_contact)
store.save(tracker)

found = (tracker["contact"] != "").sum()
print(f"{found} of {len(tracker)} jobs now have a contact.")

report.build(tracker, 6)
excel.write(tracker, 6)
print("Rebuilt data/report.html and data/Job Tracker.xlsx.")
