# Job2go AI — Design rules

*Your AI job assistant, ready to go.*

This file is the source of truth for how the new `web/` app looks and moves. Nothing in `web/`
should use a color, font, radius, shadow or animation that is not defined here.

---

## 1. What we learned from the reference sites

Screenshots are in `design-refs/` (homepage + one product section each, 1440×900).

| Site | What makes it feel premium | What we take | What we avoid |
|---|---|---|---|
| **Cursor** | A real, working-looking app window *is* the hero, set on a painted landscape. A small, quiet headline (26px, weight 400) lets the product talk. A custom grotesk font. One orange accent used only for links. | The product in a big "window" as the hero element. A quiet headline next to a loud product. | Light warm-cream background (we are dark). |
| **Linear** | Big, tight headline (64px, weight 510, −1.4px tracking). The headline enters **blurred, then sharpens**. Almost no color: grey on near-black, with depth from thin 1px borders and a faint top glow. Line-art isometric figures (“FIG 0.1”) in quiet columns with vertical dividers. | The blur→sharp entrance for the one page-load moment. Depth from hairlines and light, not from heavy shadows. Restraint: color only where it means something. | Pure near-black (#08090A); the `Inter` font. |
| **Raycast** | A floating “glass” navigation bar with a 1px border. A centered, very short headline. Feature tiles that each glow in their own brand color, so color comes from the *content*. Small monospace footnotes. | The floating glass top bar. Glow coming from content (our green glow lives on the pipeline line and on strong scores). | A grid of identical glowing tiles. |
| **Teal** | Very clear job-search story: a resume being edited, plus a **score ring (32%)** showing quality. Product crops overlap each other and a cursor shows the action. | Score rings as the visual language for “how good is this match.” Overlapping product crops with one highlighted row. | Yellow pill buttons, white SaaS look, “6X” marketing claims. |
| **Huntr** | The kanban **board** (Wishlist / Applied / Interview) shown with one card *mid-drag*, so you see that it moves. A big two-line headline with different sizes. | Showing a card in motion on the board. A headline set in two sizes for real hierarchy. | Playful confetti shapes, purple, ALL-CAPS column titles. |

**The pattern across all five:** the premium ones show *the real product doing one real thing*,
use **one** accent, and get depth from light and thin borders instead of boxes and heavy shadows.

---

## 2. Aesthetic direction

**“The route to your next job.”** Job2go is a calm, charcoal-grey control room where your job search
travels along one green line, from the job boards to a finished application pack, like a transit map
for your career. Everything is quiet grey, and green appears only where something is *good,
active or done*, so when green lights up it means something.

Grounding in the subject: the name says *to go*. A journey has stations, a route and arrivals. That is
where our signature element (the pipeline line), the signage-style display font, and the
departure-board-style numbers come from. It is not a generic “AI dashboard.”

---

## 3. Typography

All three are free Google Fonts. None of them is Inter, Roboto, Open Sans or a system font.

| Role | Font | Why |
|---|---|---|
| **Display** (page titles, hero, big numbers in words) | **Archivo**, *expanded* (`font-stretch: 112–125%`), weight 600–700 | Wide letters feel like transit and road signage: confident and “on the move.” One variable family, so width and weight can be tuned. |
| **Body** (all reading text, buttons, forms) | **Hanken Grotesk**, weight 400 / 500 / 600 | Calm, open, very readable at 14–16px; narrower than Archivo, so the two are clearly different. |
| **Mono** (scores, counts, dates, money — **numbers only**) | **Martian Mono**, weight 400–600, `font-variant-numeric: tabular-nums` | Like a departure board: numbers line up in columns. It also has a width axis, so it matches the expanded Archivo. |

**Type scale** (ratio 1.25, base 16px). Line-height gets tighter as the size grows.

| Token | Size / line-height | Font | Use |
|---|---|---|---|
| `display-xl` | 72 / 1.0, tracking −0.02em | Archivo 125% 700 | The one hero headline per page (showcase only) |
| `display-l` | 48 / 1.05, −0.015em | Archivo 118% 650 | Page titles, section hero |
| `display-m` | 30 / 1.15, −0.01em | Archivo 112% 600 | Section titles |
| `title` | 20 / 1.3 | Hanken 600 | Card / panel titles, job titles |
| `body-l` | 18 / 1.6 | Hanken 400 | Showcase intro text |
| `body` | 15 / 1.55 | Hanken 400 | Default text |
| `small` | 13 / 1.45 | Hanken 500 | Meta lines, tags, help text |
| `num-xl` | 56 / 1 | Martian 500 | The score inside the biggest ring |
| `num` | 14 / 1 | Martian 500 | Scores in lists, stats |

**Rules**
- Sentence case everywhere. **No ALL-CAPS labels**, no tracked-out “eyebrows” above headings.
- Never color or italicize one word of a headline to “accent” it. Hierarchy comes from size and
  weight (see Huntr's two-size headline).
- Reading text max **68 characters** per line (`max-width: 68ch`).
- Mono is for numbers only, never for labels or sentences.
- Text is **left-aligned**. The only centered text is the showcase hero headline.

---

## 4. Color tokens

Charcoal, with a slightly cool tint (not pure black, not the GitHub grey). The green is a refined
version of `#3fb950`: a touch brighter and cooler, so it glows on charcoal without looking neon.

### Base palette
| Token | Hex | Use |
|---|---|---|
| `--charcoal-950` | `#141518` | Deepest layer: behind the app frame, the showcase footer |
| `--charcoal-900` | `#1a1b1f` | **Page background** |
| `--charcoal-850` | `#202126` | Surfaces: panels, list rows |
| `--charcoal-800` | `#272930` | Raised: hover, inputs, popovers |
| `--charcoal-700` | `#33363e` | Borders that need to be seen, active tab |
| `--hairline` | `rgba(255,255,255,0.07)` | 1px borders and dividers (most borders) |
| `--text` | `#ecebe7` | Main text (slightly warm off-white, softer than pure white) |
| `--text-muted` | `#a2a4ab` | Secondary text |
| `--text-faint` | `#6c6f78` | Hints, disabled, placeholder |

### Accent: one green
| Token | Hex | Use |
|---|---|---|
| `--go-500` | `#43c46a` | **The accent.** Primary buttons, active pipeline, good scores, focus ring |
| `--go-400` | `#6bd78a` | Green text on charcoal (better contrast than 500) |
| `--go-900` | `#173523` | Green fills behind green text (tags, badges) |
| `--go-glow` | `rgba(67,196,106,0.35)` | Glow around lit pipeline stations and the top score ring |

### State colors (only for meaning, never decoration)
Always shown **with a number, word or icon**, never color alone.
| Token | Hex | Meaning |
|---|---|---|
| `--score-great` | `--go-500` | Score 8–10 |
| `--score-good` | `#6aa6ff` | Score 7. Also links (`--link`) |
| `--score-maybe` | `#e3b24f` | Score 5–6, “check this” |
| `--score-low` | `#ee6b5f` | Score below 5, red flags, risks |
| `--unknown` | `--charcoal-700` bg + `--text-muted` | One merged “Unknown” tag |

### Layered gradient backgrounds
Depth comes from 3 stacked layers, not from flat color:
1. **Base:** `linear-gradient(180deg, #1d1e23 0%, #1a1b1f 40%, #17181b 100%)`, a slow fall-off downward.
2. **Light:** one soft radial glow per page, *in one place only*:
   `radial-gradient(60% 40% at 15% 0%, rgba(67,196,106,0.08), transparent 70%)`
   (on the showcase it sits behind the hero preview; in the app, behind the page hero).
3. **Grain:** a tiny SVG noise texture at 3% opacity over everything, so large dark areas don't look
   flat or banded.

Surfaces add a top highlight: `inset 0 1px 0 rgba(255,255,255,0.04)`, like light catching an edge.

---

## 5. Spacing, radius, depth

**Spacing scale** (4px base): `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`
- Inside components: 8–16. Between related groups: 24–32. Between page sections: 96 (showcase) / 48 (app).
- Generous outside, tight inside: whitespace *around* an element is always larger than inside it.

**Corner radius by hierarchy.** Bigger objects get rounder corners, so one radius never sits on everything:
| Token | px | Use |
|---|---|---|
| `--r-xs` | 6 | Tags, inputs, small buttons |
| `--r-s` | 10 | Buttons, list rows, menu items |
| `--r-m` | 16 | Panels, popovers, chart blocks |
| `--r-l` | 24 | The hero app window, modals, the pack viewer |
| `--r-full` | 999 | Score chips, avatar, the pipeline stations |

**Depth (shadows):** soft, layered and rare. Most separation comes from the background step plus a hairline.
| Token | Value | Use |
|---|---|---|
| `--depth-1` | `0 1px 0 rgba(255,255,255,.04) inset, 0 1px 2px rgba(0,0,0,.4)` | Rows, inputs |
| `--depth-2` | `0 1px 0 rgba(255,255,255,.05) inset, 0 12px 32px -12px rgba(0,0,0,.6)` | Panels, popovers |
| `--depth-3` | `0 1px 0 rgba(255,255,255,.06) inset, 0 40px 80px -24px rgba(0,0,0,.75)` | Side panel, modal, hero window |
| `--glow-go` | `0 0 0 1px rgba(67,196,106,.45), 0 0 28px var(--go-glow)` | Lit stations, top match ring, focused primary button |

---

## 6. Motion rules

Library: **Motion** (`motion/react`). Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (fast out, soft landing).

| Speed | ms | Use |
|---|---|---|
| `instant` | 120 | Hover, press, toggles |
| `quick` | 220 | Page transitions, tabs, panel content |
| `smooth` | 420 | Side panel slide, modal open |
| `slow` | 900 | Score rings, the entrance sequence |

1. **One staggered entrance per page, and only one.** On first load the page hero and its direct
   children come in together: opacity 0→1, y 12px→0, **blur 6px→0** (from Linear), with a 60ms stagger
   and at most 6 items. Nothing else on the page animates on load. No fade-up on every section.
2. **Page transitions:** the outgoing page fades out (120ms) and the new one fades in with a 6px
   rise (220ms). The top bar and sidebar never move.
3. **Score rings animate up to their number:** the SVG ring draws from 0 to `score/10`, and the mono
   number counts up at the same time (900ms). This happens **once**, the first time a ring scrolls into
   view. In long lists only the first visible 8 rings animate; the rest appear already drawn.
4. **Motion that answers an action is welcome:** panel slide-in, card lifting while dragged on the
   board, “Saved” check, run-progress bar. It shows what changed.
5. **Hover:** only a background step (`charcoal-850 → 800`, 120ms). Cards don't jump or scale.
6. **Reduced motion** (`prefers-reduced-motion: reduce`): no movement, blur or scroll-linking.
   Entrances become a 150ms fade, rings render at their final value, the pipeline line shows fully lit,
   and page changes are instant. Test it with macOS → Accessibility → Display → Reduce motion.

---

## 7. Signature element: the pipeline line

On the showcase page, in **How it works**, a glowing green line runs down the page like a metro line
and passes four **stations**:

```
  ●──  Sources        LinkedIn, Indeed, 4 remote boards, your own finds
  │
  ●──  Filters        free rules drop wrong cities, senior roles, duplicates
  │
  ●──  AI scoring     a fit score 1–10, then clear rules adjust it
  │
  ◉──  Application    tailored CV, letter and interview prep, ready to send
       pack
```

- **Unlit:** the line is a 2px `--charcoal-700` track, and the stations are hollow rings.
- **As you scroll**, a green fill (`--go-500` + `--glow-go`) runs down the track, linked to scroll
  position (`useScroll` + `pathLength`). When the fill reaches a station, the station fills in green
  with a short glow pulse (once), and its step content next to it fades in. The step shows a small,
  real-looking crop of the app (for example: a job count rolling up, a job being filtered out, a score
  ring filling, a PDF sliding out).
- On a phone the line runs down the left edge with the content to its right.
- Reduced motion: the line and all stations show fully lit, with no scroll-linking.
- The **same line in miniature** is reused in the app: the "Run search" progress shows the four
  stations lighting up as `run.py` moves through its steps. That makes the showcase promise real.

This is the one place we spend boldness. Everything around it stays quiet.

---

## 8. Layout rules (avoiding the generic “AI look”)

1. **One big hero per page.** Each page has a single element that is clearly bigger and more
   important than everything else (see the site plan for each page's hero). Everything else is smaller and calmer.
2. **No grids of identical cards.** Lists of jobs are **rows** (score ring, title, company, 3 tags) in
   one column, like a departure board, not a 3-column card wall. Feature highlights on the showcase are
   **alternating, uneven rows** (text 5 columns, product crop 7 columns, then swapped), each a
   different size.
3. **Real hierarchy:** at most 3 levels of text on any surface. If a screen needs a 4th level, split the screen.
4. **Show the product, not icons.** Feature sections use real-looking crops of the app UI (sample
   data). No stock illustrations, emoji or 3D blobs.
5. **Numbering only for real sequences.** The pipeline stations are a real order (1→4). Feature
   lists are not, so they get no 01/02/03.
6. **No template chrome:** no ALL-CAPS eyebrows, no “A · B · C” meta strings (use separate,
   spaced items), no “→” added to every button, no gradient washes as decoration.
7. **Copy:** plain verbs, sentence case, the button says what happens (“Make application pack”, then the toast says
   “Application pack ready”). Empty states tell you what to do next.
8. **Grid:** 12 columns, max width 1200px on the showcase. The app uses a fixed 232px sidebar and fluid content.
   Side gutters are at least 16px on a phone.
9. **Accessibility floor:** text contrast at least 4.5:1. Checked: text 14.4, muted 6.9 (5.8 on raised),
   green 7.7, green-400 on go-900 7.5, blue 7.0, amber 8.8, red 5.7, dark text on a green button 8.1.
   `--text-faint` is only 3.4:1, so it is used **only** for placeholders and disabled items, never for
   information you need to read. A visible
   green focus ring on every control, everything works with the keyboard, and it works at 380px wide.

---

## 9. Site plan (no code yet)

A new **`web/`** folder: **React + Vite + TypeScript + Tailwind + shadcn/ui + Motion**.
The current site (`agent/web/` → `data/report.html`, served by `serve.py`) **keeps working,
unchanged**, until the new app is approved.

### How the pieces connect
```
 web/  (React app)                         Python (existing)
 ──────────────────                        ──────────────────
 "/"  Showcase  ── sample data only ──►  web/src/demo/sampleData.ts   (invented, no personal data)
 "/demo"        ── sample data ───────►  same app screens, fake data
 "/app/*"       ── fetch /api/... ────►  serve.py  (127.0.0.1:8765)
                                            ├─ jobs.csv, packs, run.py, tailor.py
                                            └─ profile.yaml
```
- **While building:** `npm run dev` (Vite, port 5173) forwards `/api/...` to `serve.py` on 8765. The old
  report still opens at `http://127.0.0.1:8765/`.
- **When approved:** `npm run build` makes `web/dist/`, and serve.py then serves it at `/` and
  `/app`. The old report moves to `/classic`, kept as a fallback.
- **Public showcase:** a separate build with only `/` and `/demo` (sample data) can go on free static
  hosting for your CV. `/app` is never in the public build.
- **One set of screens, two data sources:** the app screens get their data as props. `/app` feeds them
  real data from `src/live/` (the ONLY folder allowed to call serve.py); `/` and `/demo` feed them
  `src/demo/sampleData.ts` (the ONLY sample-data file: invented companies, mixed cities, round numbers).
  The code checker (`web/.oxlintrc.json`) enforces this: `fetch` outside `src/live/` is an error, and the
  showcase/demo may not import `src/live/` at all. So the demo is the real app, just with fictional jobs.

### New API in serve.py (JSON, same security rules as today)
`GET /api/jobs` · `GET /api/jobs/<n>` · `GET /api/stats` · `GET /api/charts` · `GET /api/usage` ·
`GET /api/run` · `GET /api/packs` · `GET/PUT /api/profiles/<id>` + the existing POST actions
(`/manual`, `/description`, `/applied`, `/undo`, `/notinterested`, `/interested`, `/make`, `/run`)
and one new one: `POST /api/jobs/<n>/status` (for dragging on the board).
The tab and tag logic stays in Python (`agent/report.py`), so the old and new sites always agree.

### `/` Showcase (public, sample data only)
1. **Hero** *(page hero)*: a short, two-size headline on the left (“Your AI job assistant, / ready to go.”)
   and a big tilted **app window** on the right showing the live-style dashboard. Inside it, a score ring
   fills, a new job row slides in and a status changes (one loop of about 8s, paused when not visible).
   Buttons: **Try the demo** (primary) and **See how it works**.
2. **How it works**: the **pipeline line** with its 4 stations (the signature element).
3. **Feature highlights**: 3–4 alternating, uneven rows: *Scores you can read* (ring + strengths / to learn /
   red flags), *A pack for every job* (CV + letter + prep), *Your board* (card mid-drag, like Huntr),
   *Runs on free AI* (Gemini + Claude fallback, usage meter).
4. **Live-style stats**: one sentence with mono numbers that count up once, e.g. “**1,200** jobs read,
   **50** good matches, **12** applications” (round demo numbers), with no big-number tiles.
5. **Before / after**: a generic sample CV next to the tailored version for one sample job, with a
   slider to compare. Changed lines are marked in green.
6. **Built by Wael**: photo, two lines about you, and links: LinkedIn, CV (PDF), GitHub, portfolio.
   Placeholders for now; the real links are typed into the showcase code later (never read from `profile.yaml`).
7. **Footer**: the remote-board attribution, plus “Try the demo.”

### `/app` My app (private, local only, talks to serve.py)
Layout: a quiet left **sidebar** (Dashboard, Jobs, Board, Packs, Profile), a floating glass **top bar** (search,
**+ Add job**, **Run search**), and content.

| Route | Page hero (the one big thing) | Also on the page |
|---|---|---|
| `/app` **Dashboard** | **Today's best match**: one large panel with a big animated score ring, why it fits, and a "Make pack" button | New today (a list, not a card grid), small charts (sources, score spread, applications per week), AI usage meter, last run + the mini pipeline |
| `/app/jobs` **Jobs** | The list itself, with the top row larger | Tabs (Good / Maybe / Manual / Incomplete / Applied / Not interested), filters, search. Clicking a row opens the **detail panel** (`/app/jobs/:n`): description, score breakdown, AI model, all buttons |
| `/app/board` **Board** | The board: columns New → Pack ready → Applied → Interview → Offer | Drag a card to change status (saves to jobs.csv via the API); Rejected / Not interested folded at the end |
| `/app/packs` **Packs** | The open document, large (CV / Letter / Prep tabs) | Left: list of jobs with packs, with a quality score ring. Download, Remake, Open job |
| Add job | Pop-up from the top bar (`/app/jobs/new` also works as a link) | Same fields as today |
| `/app/profile` **My profile** | A live preview of your CV header and summary as you edit | Sections: About, Experience, Projects, Education, Skills, Languages, Tools (`tools_inventory`), Job preferences (`what_i_want`, `deal_breakers`, locations). Saves to `profile.yaml` |

**My profile, designed for more profiles later**
- Stored per profile: today `profile.yaml` = profile `default`. Later `data/profiles/<id>.yaml`, with a
  profile switcher in the sidebar. The API is already shaped as `/api/profiles/<id>`.
- Saving keeps the comments and order in `profile.yaml` (using `ruamel.yaml`), makes a dated backup
  first, and checks required fields. The rule stays: the app never invents experience. It only
  saves what you typed.
- Edits are forms (lists of entries you can add, reorder and delete), not a raw YAML text box.

### Build order (proposed, one approval at a time)
1. Design tokens + fonts + base components (Tailwind theme, shadcn themed) → screenshot review.
2. serve.py JSON API (with tests) + the data layer (live + sample).
3. `/app`: Dashboard → Jobs + panel → Packs → Board → Add job → Profile.
4. `/` Showcase + `/demo` with sample data.
5. Switch serve.py to the new app and keep `/classic`.
