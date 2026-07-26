// Background service worker. Content scripts run under the github.com origin, so a
// direct API call would be blocked by the public API's CORS (which only allows
// app.qualflare.com). Fetching from the service worker instead — with
// host_permissions for api.qualflare.com — bypasses CORS entirely. So ALL network
// calls live here; the content script only messages us.

const API = 'https://api.qualflare.com';

// --- storage --------------------------------------------------------------
async function getMapping(repo) {
  const { mappings = {} } = await chrome.storage.sync.get('mappings');
  // Popup stores keys lowercased; the content script sends the URL-canonical case.
  return mappings[repo.toLowerCase()] || null;
}

// --- fetch helpers --------------------------------------------------------
async function fetchLaunchesPrivate(token, branch) {
  const url = `${API}/api/v1/launches?q=${encodeURIComponent(branch)}&limit=60`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`api ${res.status}`);
  return normalizeList(await res.json());
}

async function fetchLaunchesPublic(slug) {
  const url = `${API}/p/${encodeURIComponent(slug)}/launches?limit=60`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) throw new Error('not-found');
  if (!res.ok) throw new Error(`api ${res.status}`);
  return normalizeList(await res.json());
}

// The list endpoints may return a bare array or an envelope ({data|items|launches}).
function normalizeList(json) {
  if (Array.isArray(json)) return json;
  return json?.data ?? json?.items ?? json?.launches ?? json?.results ?? [];
}

// --- matching -------------------------------------------------------------
// Pick the launches that belong to this PR. Branch is the reliable key (GitHub
// Actions stamps launches with the merge SHA, not the PR head), so: exact-branch
// match, then prefer the commit group that matches the PR head SHA if present,
// else the most-recent commit's launches.
function selectLaunches(launches, branch, sha) {
  const onBranch = launches.filter((l) => (l.branch || '') === branch);
  if (!onBranch.length) return { launches: [], commit: null };

  const shaMatch = sha
    ? onBranch.filter(
        (l) => l.commit && (l.commit === sha || l.commit.startsWith(sha) || sha.startsWith(l.commit)),
      )
    : [];
  if (shaMatch.length) return { launches: shaMatch, commit: shaMatch[0].commit };

  // Most recent first, then group by that top launch's commit.
  const sorted = [...onBranch].sort(
    (a, b) => new Date(b.createdAt || b.startedAt || 0) - new Date(a.createdAt || a.startedAt || 0),
  );
  const topCommit = sorted[0].commit;
  const group = topCommit ? sorted.filter((l) => l.commit === topCommit) : [sorted[0]];
  return { launches: group, commit: topCommit || null };
}

// --- main handler ---------------------------------------------------------
async function handleFetch({ repo, branch, sha }) {
  const mapping = await getMapping(repo);
  if (!mapping) return { state: 'unconfigured' };

  let launches;
  try {
    launches =
      mapping.mode === 'public'
        ? await fetchLaunchesPublic(mapping.slug)
        : await fetchLaunchesPrivate(mapping.token, branch);
  } catch (e) {
    if (e.message === 'unauthorized') return { state: 'unauthorized' };
    if (e.message === 'not-found') return { state: 'not-found' };
    return { state: 'error', message: e.message };
  }

  const { launches: matched, commit } = selectLaunches(launches, branch, sha);
  if (!matched.length) return { state: 'no-data', branch };

  // aiSummary is free text on the private response (absent on the public one).
  const ai = matched.map((l) => l.aiSummary).find((s) => typeof s === 'string' && s.trim());
  const link =
    mapping.projectUrl ||
    (mapping.mode === 'public' ? `https://qualflare.com/p/${mapping.slug}` : 'https://app.qualflare.com');

  return {
    state: 'ok',
    branch,
    commit,
    launches: matched.map((l) => ({
      framework: l.framework, status: l.status,
      totalCount: l.totalCount, passedCount: l.passedCount, failedCount: l.failedCount,
      errorCount: l.errorCount, skippedCount: l.skippedCount, timeoutCount: l.timeoutCount,
      abortedCount: l.abortedCount, flakyCount: l.flakyCount, retryCount: l.retryCount,
    })),
    aiSummary: ai || null,
    link,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'QF_FETCH') {
    handleFetch(msg).then(sendResponse).catch((e) => sendResponse({ state: 'error', message: String(e) }));
    return true; // async response
  }
});
