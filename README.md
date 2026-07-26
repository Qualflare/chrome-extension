# Qualflare for GitHub — Test Health on PRs

A Chrome (Manifest V3) extension that shows a repo's **Qualflare test health inline on GitHub
pull requests** — status, pass/fail counts, **flaky count**, and the AI summary — with a link to
the full launch. It reads the existing Qualflare public API; nothing about the product changes.

## Load it (unpacked, for testing)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. **Load unpacked** → select this `qualflare-extension/` folder.
4. Click the extension icon → **link a repo**:
   - **Private project:** enter `owner/name` + a Qualflare **API token** (`qf_…`, from
     app.qualflare.com → Project → Settings → Access Tokens; the token is scoped to one project).
   - **Public/OSS project:** enter `owner/name` + the **public project slug** (no token needed).
5. Open a pull request on that repo whose branch has a Qualflare launch → a **Qualflare panel**
   appears in the PR sidebar.

## How it works

- `content.js` (on `github.com/*/pull/*`) reads the PR's repo, **branch**, and head SHA, then asks
  the background worker and injects the panel.
- `background.js` (service worker) does the API calls — fetching from the worker **bypasses CORS**
  (the public API only allows `app.qualflare.com` origins), so no server change is needed.
- Matching is **branch-based**: `GET /api/v1/launches?q=<branch>` (or `/p/<slug>/launches` for
  public projects), then the most-recent commit's launches for that branch are aggregated. (Branch,
  not head SHA, because GitHub Actions stamps launches with the *merge* commit, not the PR head.)
- Health math mirrors Qualflare's public metrics logic (`src/lib/metrics.js`).

## Known limitations

- **Manual token per project** — OAuth provisioning is planned.
- **Branch-based matching** — per-commit matching is planned.
- Counts, flaky count, and the AI summary are shown today; a numeric risk badge is planned.
- Vanilla JS (no build step) for fast iteration; may migrate to WXT + React if the UI grows.

## Roadmap

- Per-commit matching (currently branch-based).
- A risk badge when the API surfaces one.
- OAuth token provisioning instead of manual tokens.

## Privacy

See [PRIVACY.md](./PRIVACY.md). The extension stores your repo links and token locally
(`chrome.storage.sync`) and talks only to `api.qualflare.com` — no tracking, analytics, or
third-party servers.
