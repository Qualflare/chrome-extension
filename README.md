# Qualflare for GitHub — Test Health on PRs

A Chrome (Manifest V3) extension that shows a repo's **Qualflare test health inline on GitHub
pull requests** — status, pass/fail counts, **flaky count**, and the AI summary — with a link to
the full launch. It reads the existing Qualflare public API; nothing about the product changes.

> **Why this exists (not a backlink trick).** A store listing's outbound link is almost certainly
> `nofollow`, so this is built as a genuine **product-engagement** surface (activate/retain users
> where they work — GitHub PRs), not for SEO. The link value that matters is earned organically
> (reviews, "best QA extensions" mentions), not the store link itself.

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
- Health math is ported from `app-ui/src/components/public/metrics.ts` (`src/lib/metrics.js`).

## Known limitations (MVP)

- **Manual token per project** (clunky) — an OAuth flow is a Phase-2 item.
- **No numeric risk score** — that field is internal to the Qualflare API and not on the public
  response yet (Phase 2: expose `riskLevel` / `healthScore`). MVP shows counts + flaky + AI text.
- **Icons not included** — add `icons/` (16/48/128 px) before publishing to the Web Store.
- Vanilla JS (no build step) for fast iteration; migrate to WXT + React if the UI grows.

## Roadmap (Phase 2, small `api-service` changes)

- `?commit=<sha>` filter + index on `launches.commit` → precise per-commit lookup.
- Surface the AI risk score on the public launch response → risk badge in the panel.
- OAuth token provisioning; project-level failure-clusters widget.
