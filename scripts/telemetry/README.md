# Telemetry collector setup (about 20 minutes, one time)

The collector is a Google Apps Script that lives inside a **private Google Sheet**. It runs as you,
so there is no service account, no key and nothing sensitive in this public repository.

## 1. Prerequisites
1. **Search Console:** add a *Domain* property for `cryptopriceticker.com` (DNS TXT record in Cloudflare)
   and submit `https://cryptopriceticker.com/sitemap.xml`.
2. **Cloudflare Web Analytics** (optional at first): enable it for the Pages project. Then create an API
   token with **Account → Account Analytics → Read** and **Zone → Analytics → Read** for this zone.
   Note your account ID, zone ID and the Web Analytics *site tag*.
3. **Private GitHub repo** for the weekly digest, e.g. `usaflees/cpt-telemetry` (keep it **private**).
   Create a fine-grained personal access token limited to that one repo with *Contents: Read and write*.

## 2. Install
1. Create a new Google Sheet (keep sharing **off**), then **Extensions → Apps Script**.
2. Project Settings → tick **Show "appsscript.json" manifest file**. Paste `appsscript.json` from this folder.
3. Paste `Code.gs` from this folder into `Code.gs`.
4. Project Settings → **Script Properties** → add:

   | Property | Value |
   | --- | --- |
   | `GSC_SITE` | `sc-domain:cryptopriceticker.com` |
   | `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID`, `CF_SITE_TAG` | from step 1.2 (optional) |
   | `GITHUB_TOKEN` | the fine-grained token from step 1.3 |
   | `GITHUB_REPO` | `usaflees/cpt-telemetry` |
   | `ALERT_EMAIL` | optional; defaults to your Google account |

5. Run **`testSetup`** and approve the permissions. Check the log: each source should say OK.
   - If Search Console says the API "has not been used in project …", open Project Settings → *Change
     project*, link a normal Google Cloud project, and enable the **Google Search Console API** there.
6. Run **`cfIntrospect`** once if Cloudflare reports unknown fields, and adjust the field names in
   `collectCloudflare_` to match.
7. Run **`installTriggers`**: nightly collection (~03:00 UTC) and a weekly digest (Sunday ~05:00 UTC).

## What it does
- **Nightly:** one finalized day of Search Console data (page, query×page, page×device, all rows via
  pagination), ~40 URL Inspection checks (every page every ~3 days), Cloudflare page views, Core Web
  Vitals and 4xx/5xx paths. Emails you if a page's index status changes or errors spike.
- **Weekly:** writes `digest/latest.json` to the private repo — page-level totals for the last 28 days
  vs the previous 28, index problems, vitals and errors. Search queries are reduced to coin names,
  tickers and a few intent words; anything else becomes `other`, so raw query text never reaches the AI.

The weekly improvement task reads that digest. See `docs/SELF-IMPROVING.md`.
