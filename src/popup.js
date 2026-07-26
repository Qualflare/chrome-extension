// Settings popup — manage GitHub-repo → Qualflare-project links in chrome.storage.sync.
const listEl = document.getElementById('list');
const form = document.getElementById('add');
const tokenRow = document.getElementById('tokenRow');
const slugRow = document.getElementById('slugRow');

// Repo keys are stored lowercased so they match the content script's URL-derived key.
const normRepo = (s) => s.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').toLowerCase();

async function getMappings() {
  const { mappings = {} } = await chrome.storage.sync.get('mappings');
  return mappings;
}

async function render() {
  const mappings = await getMappings();
  const repos = Object.keys(mappings).sort();
  if (!repos.length) {
    listEl.innerHTML = '<li class="empty">No repos linked yet — add one above.</li>';
    return;
  }
  listEl.innerHTML = '';
  for (const repo of repos) {
    const m = mappings[repo];
    const li = document.createElement('li');
    const badge = m.mode === 'public' ? 'public' : 'token';
    li.innerHTML =
      `<span class="repo" title="${repo}">${repo}</span>` +
      `<span class="badge">${badge}</span>` +
      `<button class="del" data-repo="${repo}">Remove</button>`;
    li.querySelector('.del').addEventListener('click', async () => {
      const next = await getMappings();
      delete next[repo];
      await chrome.storage.sync.set({ mappings: next });
      render();
    });
    listEl.appendChild(li);
  }
}

// Toggle token vs slug field by mode.
form.addEventListener('change', (e) => {
  if (e.target.name === 'mode') {
    const isPublic = form.mode.value === 'public';
    tokenRow.hidden = isPublic;
    slugRow.hidden = !isPublic;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const repo = normRepo(form.repo.value);
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    alert('Enter the repo as owner/name.');
    return;
  }
  const mode = form.mode.value;
  const entry = { mode };
  if (mode === 'public') {
    entry.slug = form.slug.value.trim();
    if (!entry.slug) { alert('Enter the public project slug.'); return; }
  } else {
    entry.token = form.token.value.trim();
    if (!entry.token) { alert('Enter your Qualflare API token (qf_...).'); return; }
  }

  const mappings = await getMappings();
  mappings[repo] = entry;
  await chrome.storage.sync.set({ mappings });
  form.reset();
  tokenRow.hidden = false;
  slugRow.hidden = true;
  render();
});

render();
