"""Job Agent — finds jobs, scores them against your profile, builds a report.

Run it from the job-agent folder with:   python run.py
Options:
  --no-search   skip searching, only score saved jobs and rebuild the report
  --rescore     score ALL saved jobs again with the current rules
                (your status, dates and notes are kept)
  --report-only no searching, no AI: run the free filters on the saved jobs, apply the
                current scoring_rules (config.yaml) again to the saved AI answers, then
                rebuild the report and Excel ("New today" = jobs scored today)
  --rescore-scores 5,6
                score again only the jobs with these scores that were not yet scored with
                the current scoring rules (run it again on another day to finish the rest)
"""

import subprocess
import sys
import time
from datetime import date
from pathlib import Path

import pandas as pd
import yaml

import llm
import prefilter
from agent import contact, dedupe, excel, fulltext, home, infojobs_email, remote_sources, report, scoring, search, store

SECRETS = Path("secrets.yaml")

# Errors that will fail for every job (wrong model, bad key, daily limit used up).
STOP_ERRORS = ("NOT_FOUND", "API_KEY_INVALID", "PERMISSION_DENIED", "RESOURCE_EXHAUSTED")


def get_api_key() -> str:
    if SECRETS.exists():
        key = (yaml.safe_load(SECRETS.read_text()) or {}).get("gemini_api_key", "")
        if key:
            return key
    print("\nFirst run: I need your Gemini API key (from aistudio.google.com).")
    key = input("Paste it here and press Enter: ").strip()
    SECRETS.write_text(yaml.safe_dump({"gemini_api_key": key}))
    print("Saved to secrets.yaml — you won't be asked again.\n")
    return key


def save_fit(tracker, row, job: dict, fit, made_by: str, today: str) -> None:
    """Apply the code rules (config.yaml scoring_rules) to the AI's fit score and write everything into the tracker."""
    fit.score = max(1, min(10, fit.score))
    final, reasons = scoring.apply_rules(fit)  # boosts, penalties, caps
    tracker.loc[row, "fit_score"] = str(fit.score)
    tracker.loc[row, "score"] = str(final)
    tracker.loc[row, "adjustments"] = "; ".join(reasons)
    tracker.loc[row, "summary"] = fit.summary
    for field in ["strengths", "to_learn", "red_flags", "unknowns"]:  # lists -> "a; b; c"
        tracker.loc[row, field] = "; ".join(getattr(fit, field))
    tracker.loc[row, "gaps"] = ""  # replaced by "to_learn" (kept only for old scores)
    tracker.loc[row, "language"] = "; ".join(fit.languages_required) or "Not stated"
    tracker.loc[row, "languages_preferred"] = "; ".join(fit.languages_preferred)
    for field in ["seniority", "role_type", "location_tier", "arrangement", "contract_type", "pay",
                  "salary", "work_type", "trust", "trust_reason"]:
        tracker.loc[row, field] = getattr(fit, field)
    tracker.loc[row, "flexible_hours"] = str(fit.flexible_hours)
    if not tracker.loc[row, "contact"]:  # patterns found nothing: try the AI's answer
        tracker.loc[row, "contact"] = contact.check_ai_contact(fit.contact, job["description"])
    tracker.loc[row, "scored_on"] = today
    tracker.loc[row, "model"] = made_by
    store.save(tracker)  # save after every job (or batch) so nothing is lost


def _download_or_mark(tracker, row, today: str) -> bool:
    """The description is missing, too short or cut off: try to download the full text from
    the job's link. Returns True if the job can be scored now, False if it was marked
    "incomplete - paste description" (not scored; paste the text with "Add description").
    Jobs you added yourself, or already work on (pack ready, applied...), are never marked:
    they are scored with the text they have."""
    full = fulltext.try_to_complete(tracker.loc[row].to_dict())
    if full:
        tracker.loc[row, "description"] = full
        if not tracker.loc[row, "contact"]:
            tracker.loc[row, "contact"] = contact.find_contact(full)
        store.save(tracker)
        print("       full description downloaded from the job's link")
        return True
    if tracker.loc[row, "site"] == store.MANUAL_SITE or tracker.loc[row, "status"] not in ("new", "interested"):
        return True
    tracker.loc[row, "status"] = store.INCOMPLETE_STATUS
    for column in ["score", "fit_score", "adjustments", "strengths", "to_learn", "gaps", "red_flags"]:
        tracker.loc[row, column] = ""
    tracker.loc[row, "summary"] = "Description missing or cut off, and the full text could not be downloaded."
    tracker.loc[row, "unknowns"] = "description incomplete"
    tracker.loc[row, "scored_on"] = today
    store.save(tracker)
    print(f"       -> {store.INCOMPLETE_STATUS} (could not download the full text)")
    return False


def ready_to_score(tracker, row, today: str) -> bool:
    """Before the AI: a missing / short / "..." description is completed from the link first."""
    if fulltext.is_incomplete(tracker.loc[row, "description"]):
        return _download_or_mark(tracker, row, today)
    return True


def after_cut_off(tracker, row, fit, retried: set, today: str) -> str:
    """After the AI: did it say the text stops mid-sentence? Returns
    "keep" (save this score), "again" (full text downloaded: score again) or "incomplete"."""
    if not fit.description_cut_off or row in retried:
        return "keep"
    if not scoring.ai_saw_full_text(tracker.loc[row, "description"]):
        return "keep"  # a long text we shortened ourselves before sending it: not really cut off
    retried.add(row)  # only one download try per job and run
    before = tracker.loc[row, "description"]
    if not _download_or_mark(tracker, row, today):
        return "incomplete"
    return "again" if tracker.loc[row, "description"] != before else "keep"


def run_prefilter(tracker, config: dict, steps: list) -> None:
    """Free rule-based filter: skip jobs that clearly don't fit, so the AI is never called for them.
    Only jobs caught for the first time are counted (a job filtered the same way before is not)."""
    filtered, newly_filtered = prefilter.apply(tracker, config)
    store.save(tracker)
    per_rule = prefilter.count_by_rule(tracker, newly_filtered)
    steps.append(("  removed: never-titles (status 'irrelevant title')", per_rule[prefilter.TITLE_RULE]))
    steps.append((f"  removed: location not {home.CITY} / not fully remote (status 'wrong location')",
                  per_rule[prefilter.LOCATION_RULE]))
    steps.append(("  removed: engineering title", per_rule[prefilter.ENGINEERING_RULE]))
    steps.append(("  removed: native / C1 Spanish required", per_rule[prefilter.SPANISH_RULE]))
    print(f"     Pre-filter: {len(newly_filtered)} jobs newly filtered (not sent to the AI, "
          f"hidden from the report), {len(filtered)} in total.\n")


def build_outputs(tracker, config: dict, new_urls: set, steps: list,
                  new_when: str = "found in this run") -> None:
    """Build the HTML report and the Excel tracker, print the summary, open the report."""
    page = report.build(tracker, config.get("min_score", 6), config, new_urls, new_when)
    steps += report.last_counts
    workbook = excel.write(tracker, config.get("min_score", 6))
    print(f"     Done: {page}")
    print(f"     Excel tracker: {workbook}\n")
    print("Summary — what each step removed")
    for text, count in steps:
        print(f"  {count:>5}  {text}")
    print()
    if sys.platform == "darwin":
        subprocess.run(["open", str(page)])


def main() -> None:
    config = yaml.safe_load(Path("config.yaml").read_text())
    profile_text = Path("profile.yaml").read_text()
    profile_ready = "FILL ME" not in profile_text

    tracker = store.load()
    tracker = excel.read_edits(tracker)  # keep what you changed in Excel
    store.save(tracker)
    steps = []  # (what happened, how many jobs) — printed as a summary at the end
    max_age = config.get("max_age_days", 7)
    new_urls = set()  # links of the jobs added in THIS run (for the "New today" box in the report)

    if "--report-only" in sys.argv:
        print("Report only — no searching, no AI. Using the jobs already saved.\n")
        print("1/2  Free filters on the saved jobs ...")
        run_prefilter(tracker, config, steps)
        # The scoring rules in config.yaml may have changed: apply them again to the saved AI answers
        changed = 0
        for row in tracker.index:
            result = scoring.recalculate(tracker.loc[row])
            if result:
                final, reasons = result
                changed += tracker.loc[row, "score"] != str(final)
                tracker.loc[row, "score"] = str(final)
                tracker.loc[row, "adjustments"] = "; ".join(reasons)
        store.save(tracker)
        print(f"     Current scoring rules applied again (no AI): {changed} scores changed.\n")
        steps.append(("  scores changed by the current scoring rules (no AI)", changed))
        print("2/2  Building report ...")
        # No jobs were found in this run, so "New today" shows the jobs scored today
        today = date.today().isoformat()
        new_urls = set(tracker.loc[tracker["scored_on"] == today, "job_url"])
        build_outputs(tracker, config, new_urls, steps, new_when="scored today")
        return

    if "--no-search" in sys.argv:
        print(f"1/3  Search skipped — using the {len(tracker)} jobs already saved.\n")
    else:
        print("1/3  Searching job sites ...")
        found = search.find_jobs(config)
        print("     Remote job boards ...")
        remote = remote_sources.find_remote_jobs(config)
        found = pd.concat([found, remote], ignore_index=True)
        if config.get("infojobs_email", False):
            print("     InfoJobs alert emails ...")
            mails = infojobs_email.find_infojobs_jobs(set(tracker["job_url"]), max_age)
            found = pd.concat([found, mails], ignore_index=True)
        steps.append((f"Found on the job sites (posted in the last {max_age} days)", len(found)))
        before = len(found)
        found = found.drop_duplicates(subset="job_url")
        steps.append(("  removed: same link found twice", before - len(found)))
        found, too_old = search.drop_old(found, max_age)
        steps.append((f"  removed: older than {max_age} days", too_old))
        already = int(found["job_url"].isin(tracker["job_url"]).sum())
        steps.append(("  removed: already saved from earlier runs", already))
        new_jobs = found[~found["job_url"].isin(tracker["job_url"])]
        tracker, new_count = store.add_new(tracker, found)
        new_urls = set(new_jobs["job_url"])
        store.save(tracker)
        steps.append(("= New jobs added to the tracker", new_count))
        print(f"     {len(found)} jobs found, {new_count} new.")
        for site, count in new_jobs["site"].value_counts().items():
            print(f"       new from {remote_sources.source_name(site)}: {count}")
        print()

    # Recruiter email/phone from each description (free, no AI). Only fills
    # empty cells, so a contact found earlier is kept.
    missing = tracker["contact"] == ""
    tracker.loc[missing, "contact"] = tracker.loc[missing, "description"].map(contact.find_contact)
    store.save(tracker)

    run_prefilter(tracker, config, steps)

    # Same job posted several times: keep one, mark the rest "duplicate" (never scored)
    duplicates = dedupe.mark_duplicates(tracker, config)
    store.save(tracker)
    steps.append(("  removed: duplicates (kept the direct employer / longer text)", duplicates))
    print(f"     Duplicates: {duplicates} jobs marked as duplicates (not sent to the AI).\n")

    print("2/3  Scoring jobs with AI ...")
    if not profile_ready:
        print("     Skipped: profile.yaml still has 'FILL ME' parts.")
        print("     (Fill your profile in with Claude, then run again.)\n")
    else:
        api_key = get_api_key()
        today = date.today().isoformat()
        can_score = ~tracker["status"].isin([*store.SKIPPED_STATUSES, store.INCOMPLETE_STATUS])
        old_rules_left = None  # for --rescore-scores: how many still have an old-rules score at the end
        if "--rescore-scores" in sys.argv:
            # e.g. "--rescore-scores 5,6": only jobs with these scores. Scores made with the current
            # rules always fill "seniority", so an empty seniority = not rescored yet (resumable).
            wanted = sys.argv[sys.argv.index("--rescore-scores") + 1].split(",")
            old_rules = can_score & tracker["score"].isin(wanted) & (tracker["seniority"] == "")
            to_score = tracker.index[old_rules].tolist()
            print(f"     Rescoring the jobs scored {', '.join(wanted)} with the current rules.")
        elif "--rescore" in sys.argv:
            # Everything not already scored today (so a stopped rescore can resume)
            to_score = tracker.index[(tracker["scored_on"] != today) & can_score].tolist()
            print("     Rescoring all saved jobs with the current rules.")
        else:
            to_score = tracker.index[(tracker["score"] == "") & can_score].tolist()
        steps.append(("= Sent to the AI for scoring", len(to_score)))
        if to_score:
            print(f"     {len(to_score)} jobs to score (about {len(to_score) * 8 // 60 + 1} min).")
        else:
            print("     All jobs already scored.")
        # Order: Gemini, second Gemini (job by job) -> Claude (batches of 10, up to the daily cap).
        # Jobs Gemini cannot take (daily limit used up, slow, busy) wait in `pending` for Claude.
        pending = []   # (row, job) waiting for Claude
        retried = set()  # jobs whose full text was already downloaded once in this run
        incomplete = 0   # jobs marked "incomplete - paste description"
        stopped = False
        for number, row in enumerate(to_score, start=1):
            job = tracker.loc[row].to_dict()
            print(f"     [{number}/{len(to_score)}] {job['title'][:60]} — {job['company'][:30]}")
            if not ready_to_score(tracker, row, today):
                incomplete += 1
                continue
            try:
                while True:  # runs twice only if the AI says the text is cut off and a full one was downloaded
                    job = tracker.loc[row].to_dict()
                    fit, made_by = scoring.score_job(api_key, config["model"], profile_text, job)
                    outcome = after_cut_off(tracker, row, fit, retried, today)
                    if outcome != "again":
                        break
            except llm.GeminiExhausted:
                pending.append((row, tracker.loc[row].to_dict()))
                continue
            except Exception as error:
                message = str(error)
                print(f"       ! Could not score: {message[:120]}")
                if any(code in message for code in STOP_ERRORS):
                    print("\n     Stopping scoring — this error will repeat for every job.")
                    print("     Progress is saved. Copy this message to Claude.\n")
                    stopped = True
                    break
                continue
            if outcome == "incomplete":
                incomplete += 1
                continue
            save_fit(tracker, row, job, fit, made_by, today)
            print(f"       score {tracker.loc[row, 'score']} (fit {fit.score}) by {made_by}")
            time.sleep(scoring.SECONDS_BETWEEN_CALLS)

        # Claude: 10 jobs per request, until the daily cap is reached
        unscored = 0  # jobs nobody could score: they stay unscored and are tried again next run
        if pending and not stopped:
            print(f"     Gemini could not score {len(pending)} jobs - trying Claude in batches of {scoring.BATCH_SIZE} ...")
        while pending and not stopped:
            room = llm.claude_scoring_left_today()
            if room == 0:
                print("     Claude is off, failed, or today's cap is reached.")
                unscored += len(pending)
                break
            size = min(scoring.BATCH_SIZE, room)
            chunk, pending = pending[:size], pending[size:]
            try:
                answers = scoring.score_batch_with_claude(profile_text, [job for _, job in chunk])
            except Exception as error:
                print(f"       ! Claude batch failed: {str(error)[:100]}")
                unscored += len(chunk)
                continue
            answered = set()
            for job, fit, made_by in answers:
                row = next(r for r, j in chunk if j is job)
                answered.add(row)
                outcome = after_cut_off(tracker, row, fit, retried, today)
                if outcome == "incomplete":
                    incomplete += 1
                elif outcome == "again":  # full text downloaded: back in the queue
                    pending.append((row, tracker.loc[row].to_dict()))
                else:
                    save_fit(tracker, row, job, fit, made_by, today)
                    print(f"       {job['title'][:50]} — score {tracker.loc[row, 'score']} (fit {fit.score}) by {made_by}")
            print(f"       Claude answered {len(answered)} of {len(chunk)} jobs in this batch.")
            unscored += len(chunk) - len(answered)
        if unscored:
            print(f"     {unscored} jobs stay unscored for now; they will be tried again on the next run.")
        if incomplete:
            print(f"     {incomplete} jobs marked '{store.INCOMPLETE_STATUS}' - paste their text in the report.")
            steps.append((f"  not scored: {store.INCOMPLETE_STATUS}", incomplete))
        if "--rescore-scores" in sys.argv:
            old_rules_left = int((can_score & tracker["status"].ne(store.INCOMPLETE_STATUS)
                                  & tracker["score"].isin(wanted) & (tracker["seniority"] == "")).sum())
            if old_rules_left:
                print(f"     {old_rules_left} jobs scored {', '.join(wanted)} still use the old rules: "
                      f"run the same command again (e.g. tomorrow) to finish them.")
        print(f"     {llm.claude_scoring_summary()}")
        print()

    print("3/3  Building report ...")
    build_outputs(tracker, config, new_urls, steps)


if __name__ == "__main__":
    main()
