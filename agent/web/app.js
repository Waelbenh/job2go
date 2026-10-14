// Job2go AI — the page's behaviour. Plain JavaScript, no libraries.
//
// The job data comes from <script id="data"> (written by agent/report.py).
// Two modes:
//  - opened through serve.py (http://127.0.0.1:8765): buttons send requests to the server
//  - opened as a plain file (file://...): read-only; "Make pack" copies the tailor.py command

const DATA = JSON.parse(document.getElementById("data").textContent);
const JOBS = DATA.jobs;
const served = location.protocol.startsWith("http");
const $ = (id) => document.getElementById(id);

const TABS = [
  ["good", "Good"], ["maybe", "Maybe"], ["manual", "Manual"],
  ["incomplete", "Incomplete"], ["applied", "Applied"], ["notint", "Not interested"],
];
const PACK_FILES = [["cv", "CV"], ["letter", "Letter"], ["prep", "Prep sheet"]];

let currentTab = "good";
let lastPage = "#home";   // where the side panel goes back to when it is closed
let busy = 0;             // while a pack is being made, don't reload the page

// ---------- small helpers ----------

// Builds an element: el("p", {class: "x"}, "text", child, ...)
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function scoreClass(score) {
  if (!score) return "";
  return score >= 8 ? "s-green" : score === 7 ? "s-blue" : score >= 5 ? "s-yellow" : "s-red";
}

function badge(job) {
  return el("div", {class: "badge " + scoreClass(job.score), title: "Final score"}, job.score || "–");
}

function tagList(tags) {
  return el("ul", {class: "tags"}, tags.map(([text, kind, title]) => el("li", {class: "tag " + kind, title}, text)));
}

function jobByNumber(n) { return JOBS.find((job) => job.n === n); }

function toast(text, error) {
  const box = $("toast");
  box.textContent = (error ? "" : "✓ ") + text;
  box.className = "toast" + (error ? " error" : "");
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 8000);
}

// Sends one change to serve.py. Returns the server's answer {ok, message, ...}.
async function post(path, body) {
  try {
    const reply = await fetch(path, {method: "POST", body: JSON.stringify(body || {}),
      headers: {"X-Pack-Button": "1", "Content-Type": "application/json"}});
    return await reply.json();
  } catch (e) {
    return {ok: false, message: "Could not reach serve.py - is it still running in the Terminal?"};
  }
}

// After a change the server has rebuilt the page: reload it, show the message once,
// and keep the scroll position and the open panel (it is in the address: #job/12)
function reloadWith(message, hash) {
  sessionStorage.setItem("message", message);
  sessionStorage.setItem("scroll", String(window.scrollY));
  if (hash && location.hash !== hash) location.hash = hash;
  location.reload();
}

function copyText(text) {
  // navigator.clipboard needs a secure page; the old way works for plain files
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((ok, no) => {
    const t = el("textarea", {}, text);
    document.body.append(t); t.select();
    const done = document.execCommand("copy"); t.remove();
    done ? ok() : no();
  });
}

// ---------- top bar ----------

function drawStats() {
  const s = DATA.stats;
  $("stats").replaceChildren(...[
    [s.tracked, "tracked"], [s.new_today, "new today"], [s.good, "good matches"], [s.applied, "applied"],
  ].map(([value, label]) => el("span", {class: "stat"}, el("b", {}, value), label)));
  $("updated").textContent = " · Page updated " + DATA.updated + ".";
}

// ---------- job cards ----------

function card(job, showX) {
  const open = () => { location.hash = "#job/" + job.n; };
  const labels = [];
  if (job.new) labels.push(el("span", {class: "label new"}, "NEW"));
  if (job.tab === "incomplete") labels.push(el("span", {class: "label inc"}, "NEEDS DESCRIPTION"));
  const x = showX && served && !["applied", "notint"].includes(job.tab)
    ? el("button", {class: "btn small x", title: "Not interested", "aria-label": "Not interested",
        onclick: async (event) => {
          event.stopPropagation();
          event.currentTarget.disabled = true;
          const data = await post("/notinterested/" + job.n);
          data.ok ? reloadWith(data.message) : toast(data.message, true);
        }}, "✕")
    : null;
  return el("article", {class: "card job", tabindex: "0", onclick: open,
                        onkeydown: (event) => { if (event.key === "Enter") open(); }},
    badge(job),
    el("div", {class: "body"},
      el("p", {class: "title"}, labels, job.title),
      el("p", {class: "meta"}, [job.company, job.location || "location not stated", "via " + job.source].join(" · ")),
      tagList(job.key_tags)),
    x);
}

// ---------- Home ----------

function drawHome() {
  const fresh = JOBS.filter((job) => job.new);
  $("new-when").textContent = `${DATA.new_when}, score ${DATA.settings.new_min}+`;
  $("new-today").replaceChildren(...(fresh.length ? fresh.map((job) => card(job, true))
    : [el("p", {class: "empty"}, "No new strong matches in the last run. Click “Run search” to look for more.")]));

  // Jobs per source: horizontal bars
  const sources = DATA.charts.sources;
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));
  $("chart-sources").replaceChildren(...sources.map(([name, n]) =>
    el("div", {class: "hbar", title: `${name}: ${n} jobs`},
      el("span", {class: "name"}, name),
      el("span", {class: "track"}, el("span", {class: "fill", style: `display:block;width:${n / maxSource * 100}%`})),
      el("span", {class: "val"}, n))));

  // Score spread and applications per week: columns
  $("chart-scores").replaceChildren(columns(DATA.charts.scores.map(([score, n]) =>
    [score, n, `Score ${score}: ${n} jobs`, scoreClass(score)])));
  $("chart-weeks").replaceChildren(columns(DATA.charts.weeks.map(([week, n]) =>
    [week, n, `Week of ${week}: ${n} applications`, ""]), true));
  drawUsage(DATA.usage);
}

// A small column chart. rows = [[label, value, tooltip, color class], ...]
function columns(rows, thinLabels) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  const wrap = el("div", {class: "cols"});
  rows.forEach(([label, n, tip, color], i) => {
    // with many weeks, only every 2nd label fits
    const name = thinLabels && i % 2 ? "" : label;
    wrap.append(el("div", {class: "col", title: tip},
      el("div", {class: "colbar"},
        el("span", {class: "val"}, n || ""),
        el("span", {class: "fill " + color, style: `height:${n / max * 82}%`})),
      el("span", {class: "name"}, name || " ")));
  });
  return wrap;
}

function drawUsage(usage) {
  if (!usage || usage.claude_cap === undefined) {
    $("usage").replaceChildren(el("p", {class: "muted"}, "No usage data."));
    return;
  }
  const share = usage.claude_cap ? usage.claude_used / usage.claude_cap : 1;
  const meterClass = "meter" + (share >= 1 ? " full" : share >= .8 ? " warn" : "");
  const rows = [
    el("div", {class: "usage-row"}, el("span", {}, "Claude scoring"),
      el("span", {}, usage.claude_on ? `${usage.claude_used} / ${usage.claude_cap} jobs` : "switched off")),
    el("div", {class: meterClass, title: `${Math.round(share * 100)}% of today's cap`},
      el("span", {style: `width:${Math.min(100, share * 100)}%`})),
  ];
  for (const g of usage.gemini) {
    rows.push(el("div", {class: "usage-row"},
      el("span", {}, el("span", {class: "dot" + (g.out ? " off" : "")}), `Gemini ${g.role.toLowerCase()}`),
      el("span", {class: "muted", title: g.model}, g.out ? "out of quota until tomorrow" : "available")));
  }
  $("usage").replaceChildren(...rows);
}

// ---------- Jobs page ----------

function filters() {
  return {
    text: $("search").value.trim().toLowerCase(),
    score: Number($("f-score").value),
    source: $("f-source").value,
    remote: $("f-remote").value,
    location: $("f-location").value,
  };
}

function matches(job, f) {
  if (f.text) {
    const hay = [job.title, job.company, job.location, job.summary, job.source].join(" ").toLowerCase();
    if (!hay.includes(f.text)) return false;
  }
  if (f.score && job.score < f.score) return false;
  if (f.source && job.source !== f.source) return false;
  if (f.remote === "yes" && !job.remote) return false;
  if (f.remote === "no" && job.remote) return false;
  if (f.location && job.loc_group !== f.location) return false;
  return true;
}

function drawJobs() {
  const f = filters();
  const shown = JOBS.filter((job) => matches(job, f));
  $("tabs").replaceChildren(...TABS.map(([key, label]) =>
    el("button", {class: key === currentTab ? "active" : "", role: "tab",
                  onclick: () => { location.hash = "#jobs/" + key; }},
      label, el("span", {class: "count"}, shown.filter((job) => job.tab === key).length))));
  const list = shown.filter((job) => job.tab === currentTab);
  const empty = {
    good: "No good matches yet.", maybe: "No “maybe” jobs.", manual: "Use “+ Add job” to add a job you found yourself.",
    incomplete: "No jobs waiting for a description.", applied: "No applications yet.",
    notint: "Nothing here. Click ✕ on a job you don't want, and it moves here.",
  }[currentTab];
  const intro = currentTab === "incomplete" ? el("p", {class: "muted"},
    "The description was missing or cut off and could not be downloaded. Open the job, copy its full text " +
    "and use “Add description”: the job is then scored.") : null;
  $("job-list").replaceChildren(...[intro, ...(list.length ? list.map((job) => card(job, true))
    : [el("p", {class: "empty"}, f.text || f.score || f.source || f.remote || f.location
        ? "No jobs match these filters." : empty)])].filter(Boolean));
}

function setupFilters() {
  const sources = [...new Set(JOBS.map((job) => job.source))].sort();
  $("f-source").append(...sources.map((s) => el("option", {}, s)));
  for (const id of ["f-score", "f-source", "f-remote", "f-location"]) $(id).onchange = drawJobs;
  $("f-clear").onclick = () => {
    for (const id of ["f-score", "f-source", "f-remote", "f-location"]) $(id).selectedIndex = 0;
    $("search").value = "";
    drawJobs();
  };
  $("search").oninput = () => {
    if (!location.hash.startsWith("#jobs")) location.hash = "#jobs/" + currentTab;
    else drawJobs();
  };
}

// ---------- side panel (job details) ----------

function openPanel(job) {
  const body = $("panel-body");
  const msg = el("p", {class: "p-msg", hidden: true});
  const say = (text, error) => { msg.textContent = text; msg.className = "p-msg" + (error ? " error" : ""); msg.hidden = false; };

  // --- buttons ---
  const buttons = [];
  const hasPack = Object.keys(job.files).length > 0;
  if (hasPack) buttons.push(el("button", {class: "btn primary", onclick: () => { location.hash = "#pack/" + job.n; }}, "View pack"));
  const make = el("button", {class: "btn" + (hasPack ? "" : " primary"), disabled: job.short,
    title: job.short ? "Add the full description first" : null,
    onclick: () => makePack(job, make, say)}, hasPack ? "Remake pack" : "Make pack");
  buttons.push(make);

  const descForm = el("div", {class: "desc-form", hidden: true},
    el("textarea", {placeholder: "Paste the full job description here"}),
    el("div", {class: "row"}, el("button", {class: "btn primary", onclick: async (event) => {
      const text = descForm.querySelector("textarea").value;
      const button = event.currentTarget;
      button.disabled = true; button.textContent = "Saving and scoring…";
      const data = await post("/description/" + job.n, {description: text});
      if (data.ok) return reloadWith(data.message, "#job/" + job.n);
      button.disabled = false; button.textContent = "Save and re-score";
      say(data.message, true);
    }}, "Save and re-score")));

  if (served) {
    buttons.push(el("button", {class: "btn", onclick: () => {
        descForm.hidden = !descForm.hidden;
        if (!descForm.hidden) descForm.querySelector("textarea").focus();
      }}, "Add description"));
    if (job.tab === "applied") {
      if (job.status === "applied")  // interview / offer were set by you in Excel: no undo here
        buttons.push(action(job, "/undo/", "Undo applied", say));
    } else {
      buttons.push(action(job, "/applied/", "Mark applied", say));
    }
    if (job.tab === "notint") buttons.push(action(job, "/interested/", "Undo not interested", say));
    else if (job.tab !== "applied") buttons.push(action(job, "/notinterested/", "Not interested", say, "danger"));
  }
  if (job.url) buttons.push(el("a", {class: "btn", href: job.url, target: "_blank", rel: "noopener"}, "Open job link ↗"));

  // --- score breakdown ---
  const part = (icon, kind, title, text) => el("div", {class: "box"},
    el("h3", {}, el("span", {class: "ico " + kind}, icon), title),
    el("p", {class: text ? "" : "muted"}, text || "Nothing noted."));
  const scoreLine = job.fit && Number(job.fit) !== job.score
    ? `AI fit score ${job.fit} → final ${job.score} (${job.adjustments})` : job.score ? `Score ${job.score}` : "Not scored yet";
  const facts = [
    job.trust && job.trust !== "Trusted" && job.trust_reason ? ["Trust", job.trust_reason] : null,
    job.language ? ["Languages required", job.language + (job.languages_preferred ? ` · a plus: ${job.languages_preferred}` : "")] : null,
    job.contact ? ["Contact", job.contact] : null,
    job.tool_to_learn ? ["Tools to learn", job.tool_to_learn] : null,
    job.quality ? ["Pack quality", `${job.quality}/10` + (job.pack_model ? ` (by ${job.pack_model})` : "")] : null,
  ].filter(Boolean);

  // .filter(Boolean) drops the parts that are switched off (null)
  body.replaceChildren(...[
    el("div", {class: "p-head"}, badge(job), el("div", {},
      el("h2", {}, job.new ? el("span", {class: "label new"}, "NEW") : null, job.title),
      el("p", {class: "meta"}, [job.company, job.location || "location not stated"].join(" · ")),
      el("p", {class: "meta"}, job.url ? ["via ", el("a", {href: job.url, target: "_blank"}, job.source)] : job.source,
        ` · status: ${job.status}` + (job.applied_on ? ` (${job.applied_on})` : "") + ` · job #${job.n}`))),
    el("div", {style: "margin-top:12px"}, tagList(job.tags)),
    el("div", {class: "p-actions"}, buttons),
    msg,
    descForm,
    !served ? el("p", {class: "p-msg"}, "Start python serve.py to use all buttons.") : null,
    el("div", {class: "box"},
      el("h3", {}, "Score breakdown"),
      job.summary ? el("p", {}, job.summary) : null,
      el("p", {class: "small"}, scoreLine),
      el("p", {class: "small"}, job.model ? `Scored by ${job.model} on ${job.scored_on}` : "No AI has scored this job yet."),
      facts.map(([label, text]) => el("p", {class: "small"}, el("b", {}, label + ": "), text))),
    el("div", {class: "breakdown"},
      part("✓", "good", "Strengths", job.strengths),
      part("↗", "learn", "To learn", job.to_learn),
      part("!", "risk", "Red flags", job.red_flags),
      part("?", "unknown", "Unknown", job.unknowns)),
    el("div", {class: "box"},
      el("h3", {}, "Full description"),
      job.short ? el("p", {class: "p-msg error"}, "This description is missing or too short. Use “Add description”.") : null,
      el("div", {class: "description"}, job.description || "No description saved.")),
  ].filter(Boolean));
  $("panel").hidden = false;
  $("overlay").hidden = false;
  $("panel").scrollTop = 0;
}

// A button that sends one change (applied, undo, not interested) and reloads the page
function action(job, path, label, say, extra) {
  const button = el("button", {class: "btn" + (extra ? " " + extra : ""), onclick: async () => {
    button.disabled = true; button.textContent = "Saving…";
    const data = await post(path + job.n);
    if (data.ok) return reloadWith(data.message, "#job/" + job.n);
    button.disabled = false; button.textContent = label;
    say(data.message, true);
  }}, label);
  return button;
}

function closePanel() {
  $("panel").hidden = true;
  $("overlay").hidden = true;
}

// "Make pack" / "Remake": runs tailor.py through serve.py (1-2 minutes)
async function makePack(job, button, say) {
  if (!served) {
    const command = "python tailor.py " + job.n;
    try {
      await copyText(command);
      say("Copied: " + command + " - paste it in the Terminal (in the job-agent folder). " +
          "Start python serve.py to make packs from this page.");
    } catch (e) { say("Could not copy. Type this in the Terminal: " + command, true); }
    return;
  }
  const label = button.textContent;
  button.disabled = true; button.textContent = "Working…";
  say("Making the pack takes 1-2 minutes. Keep this page open.");
  busy++;
  const data = await post("/make/" + job.n);
  busy--;
  if (data.ok) {
    const note = data.tool_to_learn && data.tool_to_learn.length
      ? "Pack ready. Tools to learn (not on the CV): " + data.tool_to_learn.join(", ") : "Pack ready.";
    return reloadWith(note, "#pack/" + job.n);
  }
  button.disabled = false; button.textContent = label;
  say(data.message || "Something went wrong.", true);
}

// ---------- pack viewer ----------

function openPack(job, which) {
  const files = job.files;
  const keys = PACK_FILES.filter(([key]) => files[key]);
  if (!keys.length) { location.hash = "#job/" + job.n; return; }
  which = files[which] ? which : keys[0][0];
  $("pack-title").textContent = `Application pack · ${job.company}`;
  $("pack-tabs").replaceChildren(...keys.map(([key, label]) =>
    el("button", {class: key === which ? "active" : "", onclick: () => { location.hash = `#pack/${job.n}/${key}`; }}, label)));
  const src = files[which];
  if ($("pack-frame").getAttribute("src") !== src) $("pack-frame").src = src;
  $("pack-download").href = src;
  $("pack-download").setAttribute("download", src.split("/").pop());
  $("pack-open").href = src;
  const msg = $("pack-msg");
  msg.hidden = true;
  const remake = $("pack-remake");
  remake.disabled = false; remake.textContent = "Remake";
  remake.onclick = () => makePack(job, remake, (text, error) => {
    msg.textContent = text; msg.hidden = false; msg.style.color = error ? "#ff9a94" : "";
  });
  $("pack").hidden = false;
}

// ---------- "Add job" pop-up ----------

function setupAddJob() {
  const modal = $("add"), form = $("add-form"), msg = form.querySelector(".msg");
  $("add-btn").onclick = () => { modal.hidden = false; form.querySelector("input").focus(); };
  $("add-close").onclick = () => { modal.hidden = true; };
  modal.onclick = (event) => { if (event.target === modal) modal.hidden = true; };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    msg.className = "msg"; msg.textContent = "Saving and scoring with the AI - about 10-30 seconds…";
    const data = await post("/manual", Object.fromEntries(new FormData(form)));
    if (data.ok) return reloadWith(data.message, "#jobs/manual");
    button.disabled = false;
    msg.className = "msg error"; msg.textContent = data.message || "Something went wrong.";
  };
}

// ---------- "Run search" with live progress ----------

function setupRun() {
  $("run-btn").onclick = async () => {
    $("run-btn").disabled = true;
    const data = await post("/run");
    if (!data.ok) { $("run-btn").disabled = false; return toast(data.message, true); }
    watchRun();
  };
  $("run-close").onclick = () => { $("runbox").hidden = true; };
  watchRun(true);  // a run started before this page was (re)loaded is shown too
}

async function watchRun(onLoad) {
  let state;
  try { state = await (await fetch("/api/run")).json(); } catch (e) { return; }
  if (onLoad && !state.running) return;
  const box = $("runbox");
  box.hidden = false;
  box.classList.toggle("failed", !state.running && state.code !== 0);
  $("run-btn").disabled = state.running;
  $("run-close").hidden = state.running;

  // run.py prints "1/3  Searching ...", "2/3  Scoring ...", "[5/20] job title", "3/3  Building report"
  let step = 0, steps = 3, sub = 0;
  for (const line of state.lines) {
    const big = line.match(/^(\d)\/(\d)\s/);
    if (big) { step = Number(big[1]); steps = Number(big[2]); sub = 0; }
    const small = line.match(/^\s+\[(\d+)\/(\d+)\]/);
    if (small) sub = Number(small[1]) / Number(small[2]);
  }
  let share = step ? (step - 1 + sub) / steps : 0.03;
  if (!state.running) share = 1;
  $("run-bar").style.width = Math.max(3, share * 100) + "%";
  $("run-title").textContent = state.running ? "Searching for jobs…"
    : state.code === 0 ? "Done! Loading the new results…" : "The run stopped with an error";
  $("run-step").textContent = state.running ? (step ? `step ${step} of ${steps}` : "starting") + ` · ${state.elapsed}`
    : state.code === 0 ? "" : "See the lines below, or the Terminal where serve.py runs.";
  const log = $("run-log");
  log.textContent = state.lines.slice(-12).join("\n");
  log.scrollTop = log.scrollHeight;

  if (state.running) setTimeout(watchRun, 1500);
  else if (state.code === 0 && !onLoad) setTimeout(() => reloadWith("Search finished. The page shows the new results."), 1200);
}

// ---------- page switching (the part after # in the address) ----------

let firstRoute = true;

function route() {
  const [page, a, b] = location.hash.slice(1).split("/");
  $("pack").hidden = true;
  if (page === "job" || page === "pack") {
    const job = jobByNumber(Number(a));
    if (!job) { location.hash = lastPage; return; }
    if (firstRoute) lastPage = "#jobs/" + job.tab;  // page opened straight on a job: go back to its tab
    firstRoute = false;
    if (lastPage === "#home") showPage("home");
    else showPage("jobs", lastPage.split("/")[1]);
    if (page === "job") openPanel(job);
    else { openPanel(job); openPack(job, b); }
    return;
  }
  closePanel();
  firstRoute = false;
  if (page === "jobs") {
    showPage("jobs", TABS.some(([key]) => key === a) ? a : currentTab);
    lastPage = "#jobs/" + currentTab;
  } else {
    showPage("home");
    lastPage = "#home";
  }
}

function showPage(name, tab) {
  if (tab) currentTab = tab;
  $("page-home").hidden = name !== "home";
  $("page-jobs").hidden = name !== "jobs";
  for (const link of document.querySelectorAll(".nav a")) link.classList.toggle("active", link.dataset.page === name);
  if (name === "jobs") drawJobs();
}

// ---------- start ----------

drawStats();
drawHome();
setupFilters();
if (served) { setupAddJob(); setupRun(); }
else {
  for (const node of document.querySelectorAll(".server-only")) node.hidden = true;
  for (const node of document.querySelectorAll(".server-note")) node.hidden = false;
}
$("panel-close").onclick = $("overlay").onclick = () => { location.hash = lastPage; };
$("pack-close").onclick = () => { location.hash = location.hash.replace("#pack/", "#job/").split("/").slice(0, 2).join("/"); };
$("pack").onclick = (event) => { if (event.target === $("pack")) $("pack-close").click(); };
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!$("add").hidden) $("add").hidden = true;
  else if (!$("pack").hidden) $("pack-close").click();
  else if (!$("panel").hidden) location.hash = lastPage;
});
window.addEventListener("hashchange", route);
route();

// The message of the last change, shown once after the reload
const message = sessionStorage.getItem("message");
if (message) { sessionStorage.removeItem("message"); toast(message); }
const scroll = sessionStorage.getItem("scroll");
if (scroll) { sessionStorage.removeItem("scroll"); window.scrollTo(0, Number(scroll)); }
// Usage numbers change during the day: ask serve.py for fresh ones
if (served) fetch("/api/usage").then((r) => r.json()).then(drawUsage).catch(() => {});
