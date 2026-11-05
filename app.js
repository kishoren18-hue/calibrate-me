import { QUESTIONS } from "./questions.js";
import { decodeResult, encodeResult } from "./share.js";
import { summarize, verdict } from "./stats.js";

const ROUND_OPTIONS = [10, 20, 40];
let rounds = 20;
const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
const STORE_KEY = "calibrate-me:sessions:v1";
const app = document.getElementById("app");

let state = null;

// ---------- storage (per-browser history; the app works without it) ----------
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveSession(summary) {
  try {
    const all = loadSessions();
    all.push({ at: Date.now(), n: summary.n, accuracy: summary.accuracy, overconfidence: summary.overconfidence,
               brier: summary.brier, auroc2: summary.auroc2 });
    localStorage.setItem(STORE_KEY, JSON.stringify(all.slice(-50)));
  } catch { /* storage unavailable: history is just not kept */ }
}

// ---------- helpers ----------
const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "–");
const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "–");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- screens ----------
function intro() {
  const sessions = loadSessions();
  const last = sessions[sessions.length - 1];
  app.innerHTML = `
    <div class="kicker">A metacognition game</div>
    <h1>Do you know<br>what you know?</h1>
    <p>Answer two-choice questions and say how sure you are each time. You don't need to get them all right.
       The goal is for your confidence to be <em>honest</em>: right about 70% of the time when you say 70%,
       and more confident on the answers you actually get right.</p>
    <p class="muted">It uses the same measures cognitive scientists use to study confidence in people, and that AI researchers use to check whether a model knows when it's wrong.</p>
    <fieldset class="rounds"><legend>Round length</legend>
      ${ROUND_OPTIONS.map((n) => `<label><input type="radio" name="rounds" value="${n}" ${n === rounds ? "checked" : ""}> ${n} questions</label>`).join("")}
    </fieldset>
    <div class="actions"><button class="primary" id="start">Start</button></div>
    ${last ? `<p class="muted" style="margin-top:18px">Last time: ${pct(last.accuracy)} correct, ${
      last.overconfidence > 0 ? "overconfident" : "underconfident"} by ${Math.round(Math.abs(last.overconfidence) * 100)} points
      (${sessions.length} session${sessions.length > 1 ? "s" : ""} on this device).</p>` : ""}`;
  app.querySelectorAll('input[name="rounds"]').forEach((r) => (r.onchange = () => (rounds = +r.value)));
  document.getElementById("start").onclick = start;
}

function start() {
  state = {
    rounds,
    items: shuffle(QUESTIONS).slice(0, rounds).map(([q, a, b, correct, why]) => {
      const flip = Math.random() < 0.5; // randomize option order
      return { q, options: flip ? [b, a] : [a, b], correct: flip ? 1 - correct : correct, why };
    }),
    i: 0,
    choice: null,
    trials: [],
    revealed: false,
  };
  question();
}

function question() {
  const it = state.items[state.i];
  const answered = state.revealed;
  const t = state.trials[state.i];
  app.innerHTML = `
    <div class="progress"><div style="width:${(state.i / state.rounds) * 100}%"></div></div>
    <div class="qmeta"><span>Question ${state.i + 1} of ${state.rounds}</span><span class="mono">keys: A / B, then 1–6</span></div>
    <h2 class="question" id="q" tabindex="-1">${esc(it.q)}</h2>
    <div class="options" role="group" aria-labelledby="q">
      ${it.options.map((o, k) => {
        let cls = state.choice === k ? "chosen" : "";
        if (answered) cls = k === it.correct ? "right" : state.choice === k ? "wrong" : "";
        return `<button data-opt="${k}" class="${cls}" aria-pressed="${state.choice === k}" ${answered ? "disabled" : ""}><span class="key">${"AB"[k]}</span>${esc(o)}</button>`;
      }).join("")}
    </div>
    ${!answered ? `
    <div class="conf" ${state.choice === null ? 'style="opacity:.4"' : ""}>
      <div class="conf-label">How sure are you?</div>
      <div class="conf-row" role="group" aria-label="How sure are you?">${LEVELS.map((l, k) => `<button data-conf="${k}" ${state.choice === null ? "disabled" : ""}>${Math.round(l * 100)}%</button>`).join("")}</div>
      <div class="conf-ends"><span>pure guess</span><span>certain</span></div>
    </div>` : `
    <div class="feedback">
      <strong role="status" class="${t.correct ? "good" : "bad"}">${t.correct ? "Correct" : "Not quite"}</strong>
      <span class="muted"> · you said ${Math.round(t.confidence * 100)}%</span>
      <div style="margin-top:6px">${esc(it.why)}</div>
    </div>
    <div class="actions"><button class="primary" id="next">${state.i + 1 === state.rounds ? "See results" : "Next"}</button></div>`}`;

  app.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => choose(+b.dataset.opt)));
  app.querySelectorAll("[data-conf]").forEach((b) => (b.onclick = () => commit(LEVELS[+b.dataset.conf])));
  if (!answered && state.choice === null) document.getElementById("q").focus({ preventScroll: true });
  const next = document.getElementById("next");
  if (next) {
    next.onclick = advance;
    next.focus();
  }
}

function choose(k) {
  if (state.revealed) return;
  state.choice = k;
  question();
}

function commit(conf) {
  if (state.choice === null || state.revealed) return;
  const it = state.items[state.i];
  state.trials[state.i] = { correct: state.choice === it.correct, confidence: conf, q: it.q,
                            answer: it.options[it.correct] };
  state.revealed = true;
  question();
}

function advance() {
  state.i += 1;
  state.choice = null;
  state.revealed = false;
  if (state.i >= state.rounds) results();
  else question();
}

document.addEventListener("keydown", (e) => {
  if (!state || state.i >= state.rounds) return;
  const k = e.key.toLowerCase();
  if (!state.revealed && (k === "a" || k === "b")) choose(k === "a" ? 0 : 1);
  else if (!state.revealed && /^[1-6]$/.test(k)) commit(LEVELS[+k - 1]);
  else if (state.revealed && (k === "enter" || k === " ")) { e.preventDefault(); advance(); }
});

// ---------- results ----------
function calibrationChart(table) {
  const W = 420, H = 300, L = 58, R = 14, T = 12, B = 40;
  const x = (c) => L + ((c - 0.5) / 0.5) * (W - L - R);
  const y = (a) => T + (1 - a) * (H - T - B);
  const ticksX = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const ticksY = [0, 0.25, 0.5, 0.75, 1];
  const maxN = Math.max(1, ...table.map((g) => g.n));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: accuracy at each confidence level">
    ${ticksY.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/>
      <text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t * 100}%</text>`).join("")}
    ${ticksX.map((t) => `<text x="${x(t)}" y="${H - B + 18}" text-anchor="middle">${Math.round(t * 100)}%</text>`).join("")}
    <text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">how sure you said you were</text>
    <text transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">how often you were right</text>
    <line x1="${x(0.5)}" y1="${y(0.5)}" x2="${x(1)}" y2="${y(1)}" stroke="var(--muted)" stroke-dasharray="4 4"/>
    <polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${table.map((g) => `${x(g.confidence)},${y(g.accuracy)}`).join(" ")}"/>
    ${table.map((g) => `<circle cx="${x(g.confidence)}" cy="${y(g.accuracy)}" r="${5 + 9 * Math.sqrt(g.n / maxN)}"
       fill="var(--accent)" fill-opacity=".85"><title>${Math.round(g.confidence * 100)}%: ${g.correct}/${g.n} right</title></circle>`).join("")}
  </svg>`;
}

function historyChart(sessions) {
  if (sessions.length < 2) return "";
  const W = 420, H = 140, L = 44, R = 12, T = 12, B = 26;
  const vals = sessions.map((s) => s.overconfidence);
  const lim = Math.max(0.2, ...vals.map(Math.abs));
  const x = (i) => L + (i / (sessions.length - 1)) * (W - L - R);
  const y = (v) => T + ((lim - v) / (2 * lim)) * (H - T - B);
  return `<h2 style="margin-top:28px">Over time</h2>
  <p class="muted">Overconfidence per session on this device. Closer to the middle line is better.</p>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Overconfidence across sessions">
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-dasharray="4 4"/>
    <text x="${L - 8}" y="${y(lim) + 4}" text-anchor="end">over</text>
    <text x="${L - 8}" y="${y(-lim) + 4}" text-anchor="end">under</text>
    <polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="var(--accent)"/>`).join("")}
    <text x="${L}" y="${H - 6}">first</text><text x="${W - R}" y="${H - 6}" text-anchor="end">latest</text>
  </svg>`;
}

function results() {
  const s = summarize(state.trials);
  saveSession(s);
  const misses = state.trials.filter((t) => !t.correct).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  app.innerHTML = `
    <div class="kicker">Your results</div>
    <h2>${esc(verdict(s))}</h2>
    <div class="stats">
      <div class="stat"><div class="v">${pct(s.accuracy)}</div><div class="k">Accuracy</div><div class="h">questions right</div></div>
      <div class="stat"><div class="v">${pct(s.meanConfidence)}</div><div class="k">Average confidence</div><div class="h">how sure you felt</div></div>
      <div class="stat"><div class="v">${s.overconfidence >= 0 ? "+" : ""}${Math.round(s.overconfidence * 100)}</div><div class="k">Overconfidence</div><div class="h">confidence minus accuracy</div></div>
      <div class="stat"><div class="v">${num(s.auroc2)}</div><div class="k">Discrimination</div><div class="h">type-2 AUROC; 0.5 = none, 1 = perfect</div></div>
      <div class="stat"><div class="v">${num(s.brier, 3)}</div><div class="k">Brier score</div><div class="h">lower is better; guessing 50% = 0.25</div></div>
    </div>
    <div class="panel">${calibrationChart(s.table)}
      <p class="muted" style="margin:8px 0 0">Dots on the dashed line mean your confidence was honest. Dots below it mean you were overconfident at that level.</p></div>
    ${misses.length ? `<h2 style="margin-top:28px">Your most confident misses</h2><ul class="misses">${misses.map((m) =>
      `<li>${esc(m.q)} You said <b>${Math.round(m.confidence * 100)}%</b>; the answer was <b>${esc(m.answer)}</b>.</li>`).join("")}</ul>` : ""}
    ${historyChart(loadSessions())}
    <details class="explain" style="margin-top:24px"><summary>What these numbers mean</summary>
      <p style="margin-top:10px"><b>Calibration</b> asks whether your confidence matches your accuracy on average. <b>Discrimination</b>
      (type-2 AUROC, also called metacognitive sensitivity) asks whether you were more confident on the answers you got right than on the ones you got wrong.
      You can be perfectly calibrated with no discrimination at all, by saying 70% on everything when you get 70% right. Good judgment needs both.</p>
      <p>These are the same measures used to study confidence in people and to check whether AI models know when they're wrong.
      With ${state.rounds} questions they're rough; play a few rounds to see a trend.</p>
      <p>Reliability ${num(s.reliability, 3)} · resolution ${num(s.resolution, 3)} · uncertainty ${num(s.uncertainty, 3)} (Murphy decomposition of the Brier score).</p>
    </details>
    <div class="actions"><button class="primary" id="again">Play again</button><button id="share">Copy share link</button><button id="home">Home</button></div>
    <p class="muted" id="share-note" style="font-size:13px"></p>`;
  document.getElementById("share").onclick = () => share(s);
  document.getElementById("again").onclick = start;
  document.getElementById("home").onclick = () => { state = null; intro(); };
}

function shareUrl(s) {
  return `${location.origin}${location.pathname}#r=${encodeResult(s)}`;
}

async function share(s) {
  const url = shareUrl(s);
  const note = document.getElementById("share-note");
  try {
    await navigator.clipboard.writeText(url);
    note.textContent = "Link copied. It contains only your scores, not your answers.";
  } catch {
    note.innerHTML = `Copy this link: <input readonly value="${esc(url)}" style="width:100%" onfocus="this.select()">`;
  }
}

function sharedView(s) {
  app.innerHTML = `
    <div class="kicker">A shared result</div>
    <h2>${esc(verdict(s))}</h2>
    <div class="stats">
      <div class="stat"><div class="v">${pct(s.accuracy)}</div><div class="k">Accuracy</div><div class="h">over ${s.n} questions</div></div>
      <div class="stat"><div class="v">${s.overconfidence >= 0 ? "+" : ""}${Math.round(s.overconfidence * 100)}</div><div class="k">Overconfidence</div><div class="h">confidence minus accuracy</div></div>
      <div class="stat"><div class="v">${num(s.auroc2)}</div><div class="k">Discrimination</div><div class="h">type-2 AUROC</div></div>
    </div>
    <div class="panel">${calibrationChart(s.table)}</div>
    <div class="actions"><button class="primary" id="try">Can you beat it? Play now</button></div>`;
  document.getElementById("try").onclick = () => {
    history.replaceState(null, "", location.pathname);
    intro();
  };
}

const sharedResult = location.hash.startsWith("#r=") ? decodeResult(location.hash.slice(3)) : null;
if (sharedResult) sharedView(sharedResult);
else intro();
