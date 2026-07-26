// Content script (github.com/*/pull/*). Detects the PR's repo/branch/head-SHA,
// asks the background worker for Qualflare health, and injects a panel. Never
// calls the API directly (that would hit CORS) — all fetching is in background.js.
// metrics.js loaded first exposes globalThis.QF.

const QF = globalThis.QF;
const PANEL_ID = 'qf-panel';
const SETTINGS_URL = chrome.runtime.getURL('src/popup.html');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

// --- PR detection ---------------------------------------------------------
function deepFind(obj, keys, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return null;
  for (const k of keys) if (obj[k] != null && typeof obj[k] !== 'object') return obj[k];
  for (const v of Object.values(obj)) {
    const r = deepFind(v, keys, depth + 1);
    if (r != null) return r;
  }
  return null;
}

function extractPR() {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return null;
  const [, owner, repo, number] = m;

  let branch = null;
  let sha = null;

  // Primary: GitHub embeds PR data as JSON. headRefName = branch, headRefOid = head SHA.
  for (const s of document.querySelectorAll('script[type="application/json"]')) {
    try {
      const json = JSON.parse(s.textContent);
      branch = branch || deepFind(json, ['headRefName', 'head_ref_name']);
      sha = sha || deepFind(json, ['headRefOid', 'head_sha', 'headSha']);
      if (branch && sha) break;
    } catch { /* ignore non-JSON */ }
  }

  // Fallback: the head-ref label in the PR header DOM.
  if (!branch) {
    const el =
      document.querySelector('.head-ref .css-truncate-target') ||
      document.querySelector('.head-ref') ||
      document.querySelector('[class*="head-ref"]');
    branch = el?.title || el?.textContent?.trim() || null;
    // Strip an "owner:" prefix shown for forks.
    if (branch && branch.includes(':')) branch = branch.split(':').pop();
  }

  return branch ? { owner, repo, number, repoFull: `${owner}/${repo}`, branch, sha } : null;
}

// --- mount point ----------------------------------------------------------
function findMount() {
  return (
    document.querySelector('[data-testid="issue-sidebar"]') ||
    document.querySelector('#partial-discussion-sidebar') ||
    document.querySelector('.Layout-sidebar') ||
    document.querySelector('.discussion-sidebar')
  );
}

// --- rendering ------------------------------------------------------------
// The real Qualflare flame mark (three layered fills — the brand two-tone).
const FLAME_SVG =
  '<svg viewBox="0 0 545 545" fill="none" aria-hidden="true">' +
  '<path fill="#795ECB" d="M251 506.05C251 507.98 249.37 506.8 244.5 501.32C221.7 475.69 207.95 444.01 204.97 410.23C202.54 382.59 209.5 355.57 225.01 332.43C233.27 320.12 251.87 302.29 270.38 288.95C279.11 282.65 293.1 272.51 301.47 266.41C309.84 260.3 317.16 255.02 317.74 254.66C319.4 253.63 317.37 261.2 312.96 272.46C304.52 293.99 292.27 312.22 268.89 338C246.98 362.15 237 380.16 231.47 405.5C229.28 415.53 228.5 436.7 229.92 447.5C232.08 463.9 239.32 485.18 247.49 499.12C249.42 502.41 251 505.53 251 506.05Z"/>' +
  '<path fill="#4134AB" d="M251 506.05C251 505.53 249.42 502.41 247.49 499.12C245.46 495.66 243.49 491.75 241.65 487.58C244.91 494.82 248.64 501.55 252.66 507.25C254.49 509.87 256 512.45 256 513C256 514.63 252.98 514.13 244.31 511.07C201.68 496.04 164.8 463.4 144.22 422.49C136.69 407.52 134.4 401.53 130.58 386.73C126.08 369.32 125 360.28 125 339.88C125 303.97 134.38 273.04 154.1 243.88C160.7 234.12 168.13 225.29 194 196.47C222.52 164.7 237.41 137.97 244.16 106.41C246.21 96.83 246.49 92.93 246.41 74.5C246.33 55.95 246.03 52.19 243.82 42.25C242.44 36.06 241.5 31 241.73 31C243.27 31 256.6 41.71 264.95 49.64C293.25 76.56 312.2 110.55 321.45 151.04C325.18 167.35 326.41 179.48 326.35 199.5C326.29 219.63 324.56 234.34 320.58 248.5C319.81 251.25 318.64 255.52 318 258C317.23 260.93 315.94 264.7 314.37 268.78C317.79 259.6 319.21 253.75 317.74 254.66C317.16 255.02 309.84 260.3 301.47 266.41C293.1 272.51 279.11 282.65 270.38 288.95C251.87 302.29 233.27 320.12 225.01 332.43C209.5 355.57 202.54 382.59 204.97 410.23C207.95 444.01 221.7 475.69 244.5 501.32C249.37 506.8 251 507.98 251 506.05ZM298.82 300.14C291.61 311.57 282.75 322.71 268.89 338C281.88 323.67 291.44 311.67 298.82 300.14ZM230.71 452.54C230.4 450.82 230.13 449.13 229.92 447.5C229.37 443.35 229.15 437.68 229.21 431.7C229.15 437.68 229.38 443.35 229.93 447.5C230.15 449.16 230.41 450.84 230.71 452.54Z"/>' +
  '<path fill="#B8A1FF" d="M230.71 452.54C230.41 450.84 230.15 449.16 229.93 447.5C229.38 443.35 229.15 437.68 229.21 431.7C229.3 422.09 230.12 411.68 231.47 405.5C237 380.16 246.98 362.15 268.89 338C281.88 323.67 291.44 311.67 298.82 300.14C304.71 290.93 309.21 282.02 312.96 272.46C313.46 271.18 313.93 269.95 314.37 268.78C315.95 264.69 317.23 260.93 318 258C318.64 255.52 318.73 254.75 319.5 252C319.78 251.01 320.25 249.5 320.5 248.5C319.87 252.16 320.44 251.77 320.64 251.97C320.93 252.26 326.21 247.33 332.36 241C348.81 224.09 357.1 209.34 360.93 190.13C363.71 176.23 364.31 166.72 363.03 156.63C362.42 151.75 362.19 147.48 362.53 147.14C363.84 145.82 388.7 172.59 394.9 182C406.44 199.52 415.06 220.55 418.68 240C420.83 251.53 421.1 279.36 419.15 288.5C415.97 303.42 408.8 320.99 401.31 332.19C385.64 355.61 375.44 364.69 319.57 404.92C291.23 425.32 279.24 437.49 269.97 455.21C261.69 471.06 259.03 481.31 258.3 500.25C257.81 512.97 257.51 514.99 256.11 514.91C255.23 514.86 250.35 513.32 245.29 511.49C243.33 510.78 241.38 510.04 239.45 509.27C241.06 509.9 242.68 510.5 244.31 511.07C252.98 514.13 256 514.63 256 513C256 512.45 254.49 509.87 252.66 507.25C248.64 501.55 244.91 494.82 241.65 487.58C236.78 476.6 232.75 463.79 230.71 452.54ZM144.22 422.49C155.17 444.25 170.73 463.67 189.31 479.34C167.98 461.48 150.98 438.97 139.81 413.45C141.06 416.14 142.51 419.08 144.22 422.49Z"/>' +
  '</svg>';

// verdict icons (Octicon-style, currentColor).
const ICONS = {
  passed: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0L2.72 8.28a.75.75 0 1 1 1.06-1.06l2.97 2.97 5.97-5.97a.75.75 0 0 1 1.06 0Z"/></svg>',
  failed: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>',
  flaky: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.38A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.573L6.457 1.047ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z"/></svg>',
  dash: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 7.25h8a.75.75 0 0 1 0 1.5H4a.75.75 0 0 1 0-1.5Z"/></svg>',
};

function head(verdict = '') {
  return (
    `<div class="qf-head">` +
    `<span class="qf-tile">${FLAME_SVG}</span>` +
    `<span class="qf-wordmark">Qualflare</span>` +
    `<span class="qf-head__spacer"></span>${verdict}</div>`
  );
}

function makePanel() {
  const el = document.createElement('div');
  el.className = 'qf-panel';
  el.id = PANEL_ID;
  return el;
}

function renderState(pr, resp) {
  // Non-ok states: header + a single directive message.
  const messages = {
    unconfigured:
      `Link <strong>${esc(pr.repoFull)}</strong> to a Qualflare project to see test health. ` +
      `<a href="${esc(SETTINGS_URL)}" target="_blank" rel="noopener">Link this repo →</a>`,
    unauthorized:
      `Qualflare token expired or invalid for this repo. ` +
      `<a href="${esc(SETTINGS_URL)}" target="_blank" rel="noopener">Update it →</a>`,
    'not-found': `That public Qualflare project slug wasn't found.`,
    'no-data': `No Qualflare run for <code>${esc(resp.branch || pr.branch)}</code> yet.`,
  };
  if (resp.state !== 'ok') {
    const el = makePanel();
    const msg = messages[resp.state] || `Couldn't reach Qualflare${resp.message ? ` — ${esc(resp.message)}` : ''}.`;
    el.innerHTML = head() + `<div class="qf-body"><p class="qf-msg">${msg}</p></div>`;
    return el;
  }

  // ok — the health view.
  const agg = QF.aggregate(resp.launches);
  const failing = QF.failingCount(agg);
  const total = QF.total(agg) || 1;
  const passW = (agg.passedCount / total) * 100;
  const failW = (failing / total) * 100;
  const skipW = Math.max(0, 100 - passW - failW);
  const passRatePct = Math.round(QF.passRate(agg) * 100);

  let verdict = QF.overallStatus(agg); // passed | failed | skipped | pending
  if (verdict === 'passed' && agg.flakyCount > 0) verdict = 'flaky';
  const VLABEL = { passed: 'Passing', failed: 'Failing', flaky: 'Flaky', skipped: 'Skipped', pending: 'Pending' };
  const VICON = { passed: ICONS.passed, failed: ICONS.failed, flaky: ICONS.flaky, skipped: ICONS.dash, pending: ICONS.dash };
  const verdictHtml = `<span class="qf-verdict qf-verdict--${verdict}">${VICON[verdict]}${VLABEL[verdict]}</span>`;

  const metric = (val, lbl, mod = '') =>
    `<div class="qf-metric ${mod}"><span class="qf-metric__val">${val}</span><span class="qf-metric__lbl">${lbl}</span></div>`;

  let body =
    `<div class="qf-meter">` +
    `<div class="qf-meter__track"><div class="qf-meter__fill">` +
    `<span class="qf-seg qf-seg--pass" style="width:${passW}%"></span>` +
    `<span class="qf-seg qf-seg--fail" style="width:${failW}%"></span>` +
    `<span class="qf-seg qf-seg--skip" style="width:${skipW}%"></span>` +
    `</div></div><span class="qf-meter__pct">${passRatePct}%</span></div>` +
    `<div class="qf-metrics">` +
    metric(agg.passedCount, 'Passed') +
    metric(failing, 'Failing', failing ? 'qf-metric--fail' : '') +
    metric(agg.flakyCount, 'Flaky', agg.flakyCount ? 'qf-metric--flaky' : '') +
    (agg.skippedCount ? metric(agg.skippedCount, 'Skipped') : '') +
    `</div>`;

  if (resp.aiSummary) {
    const s = resp.aiSummary.length > 200 ? resp.aiSummary.slice(0, 200).trim() + '…' : resp.aiSummary;
    body += `<div class="qf-ai"><span class="qf-ai__tag">AI</span> ${esc(s)}</div>`;
  }

  const ref = esc(resp.branch) + (resp.commit ? ` · ${esc(resp.commit.slice(0, 7))}` : '');
  body +=
    `<div class="qf-foot"><span class="qf-ref" title="${esc(resp.branch)}">${ref}</span>` +
    `<span class="qf-foot__spacer"></span>` +
    `<a class="qf-link" href="${esc(resp.link)}" target="_blank" rel="noopener">View in Qualflare →</a></div>`;

  const el = makePanel();
  el.innerHTML = head(verdictHtml) + `<div class="qf-body">${body}</div>`;
  return el;
}

// --- run ------------------------------------------------------------------
let running = false;
async function run() {
  if (running) return;
  const pr = extractPR();
  document.getElementById(PANEL_ID)?.remove();
  if (!pr) return;
  const mount = findMount();
  if (!mount) return;

  running = true;
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'QF_FETCH', repo: pr.repoFull, branch: pr.branch, sha: pr.sha,
    });
    if (extractPR()?.number !== pr.number) return; // navigated away mid-fetch
    const panel = renderState(pr, resp || { state: 'error' });
    document.getElementById(PANEL_ID)?.remove();
    (findMount() || mount).prepend(panel);
  } catch {
    /* extension context invalidated on reload — ignore */
  } finally {
    running = false;
  }
}

// GitHub is a soft-navigation SPA — re-run on Turbo/pjax + URL changes.
let lastUrl = location.href;
const tick = () => { if (location.href !== lastUrl) { lastUrl = location.href; run(); } };
document.addEventListener('turbo:load', run);
document.addEventListener('pjax:end', run);
setInterval(tick, 1000);
run();
