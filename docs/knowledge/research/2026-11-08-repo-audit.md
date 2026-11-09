# Repository and platform audit (2026-11-08)

Checks run on `main` at `b056ba7` and on the live site. Sources: Cloudflare docs (Workers static assets
migration guide, `_headers`, Markdown for Agents, AI Crawl Control, Content Signals), GitHub Well-Architected
"Securing GitHub Actions Workflows" (updated Jul 1, 2026), html-validate 9.4.1, Lighthouse 12.2.1 (mobile).

## Results

| Area | Finding | Action |
| --- | --- | --- |
| Secrets | No tokens or private keys in the tree; no blobs over 1 MB in history | None |
| HTML | 133 files, 0 errors once style-only rules (void-style, inline style) are excluded | None |
| Lighthouse (live, mobile) | Home 83/100/100/100 (TBT 680 ms), BTC page 92/100/100/100, trust 96/100/100/100 | See GTM row |
| Google Tag Manager | Container `GTM-PD9TXJX` has **no tags** (`"tags":[]`). It still costs ~115 KiB (`gtm.js`) and makes Google load `gtag.js` a second time (~167 KiB, `&cx=c`): ~280 KiB and ~0.4 s of main thread per page for nothing. Only one `page_view` is sent (measured), so no double counting | **Owner decision**: drop GTM (keep GA4 via gtag.js) or keep it for future tags |
| Licence | Trust/about pages say "open source", but the repo has no LICENSE, which legally means all rights reserved | **Owner decision**: pick a licence (e.g. MIT for code) or reword to "public source code" |
| `www.cryptopriceticker.com` | No DNS record: the name doesn't resolve | **Owner**: add `www` as a Pages custom domain and a redirect to the apex |
| `cryptopriceticker.pages.dev` | Served the full site without `noindex` (branch previews have it) | **Done**: `_headers` rule for that hostname; `check-live` verifies it |
| GitHub Actions | `actions/checkout@v4`, `setup-node@v4` (3 majors old, Node 20 runtime), tag-pinned, workflow-level permissions | **Done**: SHA-pinned v7.0.1 / v7.1.0, job-level `contents: read`, `concurrency`, Dependabot (monthly, grouped) |
| Content Signals | robots.txt allowed everything but didn't state AI-use preferences (4% of sites do) | **Done** (shipped by another session on Nov 8): `Content-Signal: search=yes, ai-input=yes, ai-train=yes`, the owner's existing choice |
| Repo hygiene | No `.gitignore`, no `SECURITY.md` | **Done**; private vulnerability reporting is a repo setting (**owner**) |
| Markdown for Agents | Cloudflare can serve `text/markdown` to agents that ask for it (zone setting, AI Crawl Control) | **Owner** (dashboard toggle); no code needed |
| Pages vs Workers | Cloudflare recommends Workers static assets for *new* projects; Pages keeps working and has Early Hints and branch aliases that the QA flow uses | Stay on Pages; revisit only if a needed feature is Workers-only |
