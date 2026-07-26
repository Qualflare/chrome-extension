# Privacy Policy — Qualflare for GitHub

**Last updated: 2026-07-23**

This extension is designed to collect as little as possible.

## What it stores

- The **GitHub repo → Qualflare project** links you create, and the **Qualflare API token or public
  project slug** you enter, are stored **locally in your browser** via `chrome.storage.sync`
  (synced across your Chrome profile by Google, not by us). They are never sent to any server we
  operate.

## What it sends, and where

- When you view a GitHub pull request for a linked repo, the extension makes read-only requests to
  **`https://api.qualflare.com`** (the Qualflare public API) to fetch that branch's test-run
  summary. Your API token (when using a private project) is sent to `api.qualflare.com` only, as the
  standard `Authorization` header — the same endpoint the Qualflare CLI uses.
- No data is sent to any other destination. There is **no analytics, tracking, telemetry, or
  advertising**, and nothing is sold or shared with third parties.

## Permissions

- `storage` — to save your repo links and token locally.
- `host_permissions: https://api.qualflare.com/*` — to fetch test data from the Qualflare API.
- Content script on `github.com/*/pull/*` — to read the current PR's repo/branch and render the panel.

## Removing your data

Remove individual repo links in the extension popup, or uninstall the extension to clear everything
it stored.

## Contact

Questions: support@qualflare.com
