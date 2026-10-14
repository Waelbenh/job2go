"""pack_prompts.py - the instructions tailor.py sends to the AI, one per step.

  ANALYSIS_PROMPT  step 1: understand the job + build the match map (no writing yet)
  WRITE_PROMPT     step 2: write the CV, letter and prep sheet FROM the match map
  REVIEW_PROMPT    step 3: a strict hiring manager scores the draft and writes a better version
  SCORE_PROMPT     step 3b: the same hiring manager only scores a version (to compare)

RULES is shared by steps 2 and 3, so the improved version follows the same rules as the draft.
Everything inside {curly brackets} is filled in by tailor.py.
"""

ANALYSIS_PROMPT = """You are an experienced recruiter. Read the job posting and the candidate's profile and return
a short, honest analysis. Do NOT write a CV or letter yet.

=== PROFILE (the only source of truth about the candidate) ===
{profile}

=== EVIDENCE IDS (use these ids in the match map) ===
{evidence}

=== JOB ===
Title: {title}
Company (as the job board shows it): {company}
Location: {location}
Posting text:
{description}

=== WHAT TO RETURN ===
- lang: the language of the posting text ("en", "es" or "fr").
- company_name: the hiring company's name as the posting writes it (the job board name can be a
  recruiter or wrong).
- real_role_type: what the job REALLY is, judged from the duties, not the title, in a few words (for
  example an "Associate" title that is really an SDR / outbound sales job).
- role_note: one sentence: does the title match the real work? If not, how does it differ?
- main_duties: the 4-6 main duties, one short line each, most important first, in English.
- must_haves: the must-have requirements (experience, languages, tools, education), short lines, English.
- keywords: 6-10 key words or short phrases (1-3 words each) to mirror in the CV and letter, copied
  exactly as they appear in the posting text, in the posting's language (e.g. "outbound", "pipeline").
- company_hook: ONE specific thing about the company from the posting (mission, product, program,
  type of clients) that a letter can open with. Only what the posting says; never invent.
- tech_role: true if the job is in tech, AI, a startup, innovation or automation.
- match_map: one item per main duty, in the same order:
    duty (same text as in main_duties), evidence_id (the profile entry with the STRONGEST real
    evidence for this duty), angle (the name of the angle in that entry's `angles` that fits best,
    or "highlights"), evidence (that fact in a few words, as the profile says it),
    strength ("strong", "medium" or "weak" - "weak" when the profile has nothing close; be honest).
- project_order: ALL project ids (proj1, proj2, ...) from most to least relevant to this job.
  Always consider the AI Job-Search Agent, and put it FIRST for tech, AI, startup, innovation or
  automation roles.
- design: "harvard" (Times New Roman, formal: finance, consulting, law, public sector, big traditional
  companies, academic or US-style postings) or "european" (Calibri, modern: tech, startups, SaaS,
  agencies, international teams). design_reason: one short sentence.
Use only facts from the profile and the posting.
"""


RULES = """=== RULES (code checks all of them; a broken rule means a retry) ===
LANGUAGE: write the CV and the letter in the posting's language ({lang}). The prep sheet is always in
English (interview questions: English first, then the posting language in brackets).

TRUTH: Use only facts that are in the profile. Never invent experience, skills, employers, dates,
grades or numbers. EVERY number in the CV and the letter must appear in the profile (same value).
Do NOT use the "35 to 8 minutes" claim, and do not mention 35 minutes or 8 minutes. No numbers from the
posting (team size, salary...) in the CV or letter. Do not describe duties, results or
responsibilities the profile does not state, do not say a language was used in a job unless the
profile says so for that job, and never claim to have done the job's own tasks.

BUILD FROM THE MATCH MAP: the CV and letter prove the main duties with the evidence in the match map.
Each experience and project in the profile has `highlights` (default wording) and `angles` (other
wordings of the SAME facts, e.g. sales_outbound, client_retention, operations). For each entry use
the angle(s) the match map names, or the angle that fits this job best. You may translate, shorten
and mirror the job's key words, but never add a fact.

CV (must fit ONE A4 page):
 - headline: one short line naming the job family / skills in the posting's own words. It must NOT read
   like a job title the candidate never held (no "Outbound SDR", "Partnerships Associate", ...).
   summary: max 45 words, written for THIS job. Do NOT reuse the profile's default headline or summary.
   Headline + summary together must use at least 2 of the key words.
 - sections in this order: experience, projects, education, skills. Section titles in the posting
   language. Experience/projects/education have entries and an empty skills list; skills has rows
   and an empty entries list. Every entry has source_id = its evidence id (exp1, proj2, edu1, ...).
 - experience: all jobs from the profile, NEWEST FIRST. The most recent job ({latest}) has at least
   2 bullets (use 2 different angles). projects: 2 or 3, in the order of project_order, 1-2 bullets
   each. education: every degree in the profile. skills: 3-4 rows.
 - 8 to 12 bullets in the whole CV, each under 180 characters, most relevant first inside each entry.
   Dates as in the profile (month names in the posting language).
{university_rule} - Skills rows: NO software tools (code adds a tools row) and NO languages row (code adds a Languages
   section). Choose the profile's skills that match the job's must-haves and put them first.
 - Do not write the candidate's name or contact line: code adds them.

TOOLS: tools_shown = tools from tools_inventory that the posting names (exact inventory names, in the
order the posting names them), max 7. If the posting names a tool that is NOT in the inventory, put the
closest inventory tool of the same category in tools_shown (e.g. Pipedrive -> HubSpot) and the
unknown tool in tool_to_learn. NEVER write an unknown tool in the CV, the letter or tools_shown.

LETTER ("paragraphs" = greeting line, 3-4 body paragraphs, one closing paragraph):
 - The body (everything after the greeting) has 260-330 words.
 - The first body paragraph OPENS with something specific about {company_name} (use the company hook)
   and names the role. Never start with "I am applying", "I am writing", "Me dirijo", "Je vous écris"
   or similar.
 - Name at least 3 concrete links between the candidate's real experience and the job's main duties
   (from the match map). List them in "links" (duty + evidence_id).
 - The closing paragraph says the candidate is based in {city} and available for an interview, and
   asks for a conversation.
 - "closing" is ONLY the sign-off phrase (e.g. "Kind regards," / "Atentamente," / "Cordialement,").
 - NOT allowed in the letter: skills the candidate is still learning (no "learning", "basic", Python
   level...), hedging ("close to", "I believe I could", "although I lack", "while I don't have"),
   generic filler ("passionate", "team player", "fast-paced environment", "hit the ground running").
   Calm, concrete, confident, no flattery.

BANNED WORDS (any language): spearheaded, leveraged, passionate, dynamic, results-driven, synergy,
go-getter, rockstar, guru, thrilled, and their Spanish/French equivalents.
"""


WRITE_PROMPT = """You write a tailored application pack for a job seeker, using ONLY the profile below.

=== PROFILE (the only source of truth about the candidate) ===
{profile}

=== EVIDENCE IDS ===
{evidence}

=== JOB ===
Title: {title}
Company: {company_name}
Location: {location}
Source link: {url}
Earlier screening: score {score}/10 | summary="{summary}" | gaps="{gaps}" | red flags="{red_flags}"
| trust="{trust}" ({trust_reason})
Posting text:
{description}

=== JOB ANALYSIS AND MATCH MAP (build the CV and letter from this) ===
{analysis}

{rules}
PREP SHEET (prep_md, Markdown, English, plain and simple wording). Start with
"# Prep sheet: <company> – <title>" then a line with the job link, then these sections:
 ## 1. The role in plain words
 ## 2. Why you fit  (only real profile facts)
 ## 3. Gaps and how to answer honestly  (a table: Gap | Honest answer; every real gap, e.g. language
      level, years of experience, missing tools or sector knowledge)
 ## 4. Likely interview questions  (exactly 5, each with 2-3 short answer points from the profile)
 ## 5. Good questions to ask them  (exactly 3)
 ## 6. Quick trust check  (use the earlier screening notes and the posting text only)
 ## 7. Tools  (which tools the CV shows; which are in tool_to_learn)
 ## 8. Uncertain / check yourself  (also list any sentence in the CV or letter that goes slightly
      beyond the profile's exact wording)
Mark anything you are not sure about "(uncertain)" and list it in section 8. You cannot browse the
web: say that company facts, reviews and salary were NOT verified online. Never invent salary,
company size or reviews; if the posting does not say, write "not stated".
{fixes}"""


REVIEW_PROMPT = """You are a strict hiring manager hiring for this exact job: {title} at {company_name}.
You get many applications; only clear, specific, evidence-based ones get an interview.

=== THE JOB ===
{analysis}
Posting text:
{description}

=== CANDIDATE PROFILE (the only true facts; the CV and letter may not go beyond it) ===
{profile}

=== EVIDENCE IDS ===
{evidence}

=== THE DRAFT (JSON) ===
{draft}

=== YOUR TASK ===
TRUTH AUDIT FIRST: read every sentence of the CV and the letter and compare it with the profile.
unsupported_claims = every phrase that the profile does NOT support, quoted exactly (invented tasks,
results, skills or outputs like "executive presentations", inflated wording like "rigorous research
training" or "full ownership of outcomes", work done AT a company that was only a case study, a
headline that looks like a job title the candidate never held). Empty list only if everything is true.
A version with ANY unsupported claim scores at most 5 on evidence.

1. Score the draft CV and the draft letter 1-10 on each of:
   relevance (does it address the main duties and must-haves?), evidence (real, specific proof from
   the profile?), specificity (written for THIS company and role, not generic?), clarity (easy to
   scan, plain words, no filler?). Be strict: 9-10 only if you would invite the candidate at once.
2. weaknesses: the top 3 concrete weaknesses of the draft (what exactly, and where).
3. improved_cv and improved_letter: ONE improved version that removes every unsupported claim and fixes
   those weaknesses. Same JSON shape as the draft. Keep what is already good. Follow every rule below.

{rules}"""


SCORE_PROMPT = """You are a strict hiring manager hiring for this exact job: {title} at {company_name}.

=== THE JOB ===
{analysis}
Posting text:
{description}

=== CANDIDATE PROFILE (the only true facts) ===
{profile}

=== THE APPLICATION (JSON) ===
{draft}

TRUTH AUDIT FIRST: read every sentence of the CV and the letter and compare it with the profile.
unsupported_claims = every phrase that the profile does NOT support, quoted exactly (invented tasks,
results, skills or outputs like "executive presentations", inflated wording like "rigorous research
training" or "full ownership of outcomes", work done AT a company that was only a case study, a
headline that looks like a job title the candidate never held). Empty list only if everything is true.
A version with ANY unsupported claim scores at most 5 on evidence.

Then score the CV and the letter 1-10 on each of: relevance (does it address the main duties and
must-haves?), evidence (real, specific proof from the profile?), specificity (written for THIS company
and role?), clarity (easy to scan, plain words?). Be strict: 9-10 only if you would invite the
candidate at once. weaknesses: the top 3 concrete weaknesses that remain.
"""
