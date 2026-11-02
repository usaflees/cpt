> **Research snapshot, 2026-10-30.** Keeping telemetry private; Cloudflare Pages and GitHub facts. Sources are cited inline; facts may have changed since. Current decisions and status live in [../PLAYBOOK.md](../PLAYBOOK.md) and [../DECISIONS.md](../DECISIONS.md).

# Telemetry pipeline for cryptopriceticker.com: infrastructure, security and hosting QA (as of 2026-10-30)

Context verified locally: `gh api repos/usaflees/cpt` returns `"visibility":"public"`, default branch `main`. The repo root holds the site plus non-site files (`README.md`, `docs/AUDIT.md`, `scripts/`, `content/`), and the existing `_headers` file already marks `/scripts/*`, `/content/*`, `/docs/*` and `/README.md` as `X-Robots-Tag: noindex`. That confirms that repo-root files other than pages are being deployed and served today.

## Q1. Cloudflare Pages: skip strings, previews and branch controls, quotas, and whether a root-level .md file is public

### Takeaway
Gemini's plan is partly wrong. Cloudflare Pages honors only five skip flags (`[CI Skip]`, `[CI-Skip]`, `[Skip CI]`, `[Skip-CI]`, `[CF-Pages-Skip]`), they must be a prefix of the commit message, and they are case-insensitive. `[ci skip]` and `[skip pages]` are not on the list. More importantly, skipping the build does not keep the file private. The repo is public on GitHub, and the next normal commit to `main` deploys AI_TELEMETRY_CONTEXT.md, after which anyone can fetch https://cryptopriceticker.com/AI_TELEMETRY_CONTEXT.md.

### Cited Findings
- Pages skips a deployment "By adding the `[CI Skip]`, `[CI-Skip]`, `[Skip CI]`, `[Skip-CI]`, or `[CF-Pages-Skip]` flag as a prefix in your commit message". "The prefixes are not case sensitive." A skipped build produces no check run or commit status. — [Cloudflare Pages GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- The Git integration features include "Preview deployments for custom branches, generating preview URLs for a commit to any branch in the repository" and "Skipping builds using a commit message". — [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- Branch control has three Preview options: "All non-Production branches" (the default, which "will automatically deploy any and every commit to a preview branch"), "None", and "Custom branches". Custom rules accept static names or wildcards at the start or end. Evaluation order is "(1) Excludes, (2) Includes, (3) Skip", and a branch that matches neither list is skipped. Example: Include `*`, Exclude `dependabot/*`. Production auto-deploys can be switched off with "Enable automatic production branch deployments". — [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- A push to a non-production branch such as `development` creates a preview at `<hash>.<project>.pages.dev` plus a branch alias `development.<project>.pages.dev`. "By default, these deployment URLs are public." Access policies can restrict previews, but "this will only protect your preview deployments … and not your `*.pages.dev` domain or custom domain." Previews send `X-Robots-Tag: noindex`. — [Preview deployments (updated Oct 12, 2026)](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- Free plan: "1 build at a time" and "500" builds per month (Pro 5 concurrent / 5,000; Business 20 / 20,000). Builds time out after 20 minutes. Concurrency counts per account. Free sites can hold up to 20,000 files. Preview deployments are unlimited. — [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- "When you are working without a framework, leave the Build command field blank." "The root directory … If not specified, Cloudflare assumes that your linked git repository is the root directory." — [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/index.md)
- Pages has no user-configurable ignore file. It "would automatically exclude some files and folders from being uploaded as static assets such as `node_modules`, `.DS_Store`, and `.git`". `.assetsignore` (gitignore syntax) exists only for **Workers Static Assets**. — [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/); [Workers static assets binding: Ignoring assets](https://developers.cloudflare.com/workers/static-assets/binding)
- A Cloudflare engineer said in Feb 2025 that an include/exclude option "won't be added to Pages" and pointed to Workers `.assetsignore`. — [workers-sdk discussion #13538](https://github.com/cloudflare/workers-sdk/discussions/13538)
- Pages `_redirects`: "Redirects are always followed, regardless of whether or not an asset matches the incoming request." Supported codes are 301/302/303/307/308. Rewrites with other status codes (such as 404) are not supported. 200 proxying works for relative URLs only. Limits are 2,000 static + 100 dynamic rules. — [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/); [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- Automatic deployments can be disabled entirely: turn off production auto-deploy and set Preview to None, then deploy with Wrangler. "If you deploy using the Git integration, you cannot switch to Direct Upload later." — [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)

### Inferences
- **The Gemini commit message only works if the flag comes first.** Pages requires the flag "as a prefix", so a message like `chore: update telemetry [skip ci]` would probably still trigger a Pages build. Use `[skip ci] chore: update telemetry` or `[CF-Pages-Skip] …`. Because matching is case-insensitive, a lowercase `[skip ci]` prefix matches `[Skip CI]`. `[ci skip]` (word order reversed) and `[skip pages]` are not documented Pages strings.
- **Skipping a build does not stop the file being published.** A skip only prevents the deployment for that one commit. The next commit to `main` that is not skipped (any human edit) builds the whole repo root, AI_TELEMETRY_CONTEXT.md included, and the file is then served at `/AI_TELEMETRY_CONTEXT.md` on the custom domain, `cpt.pages.dev`-style aliases and every hashed deployment URL. The existing `_headers` noindex rules for README/docs show this already happens for repo files.
- **Quota.** Daily skipped commits use no builds. Without skipping, 30 to 31 builds a month is well under the 500 limit. Builds run one at a time, so a telemetry build could delay a real deploy by a few minutes.
- **Options to keep the file off the site, weakest to strongest:**
  1. Add a `_redirects` line such as `/AI_TELEMETRY_CONTEXT.md / 301`. The redirect takes precedence, so the path is not served, but the file stays in the deployment bundle and in the public GitHub repo.
  2. Move the site into a subdirectory (for example `public/`) and set it as the build output directory. Nothing outside it is uploaded. This is the cleanest hosting fix, but it means a one-time restructure that changes relative paths.
  3. Migrate to Workers Static Assets and use `.assetsignore`.
  4. Do not store telemetry in this repo at all (see Q2). This is the only option that also solves the public-GitHub exposure.
- **A separate branch in the same repo is not private.** Under default branch controls, a `telemetry` branch creates a public preview at `telemetry.<project>.pages.dev` serving the whole tree. You would need Custom branches (Include `*`, Exclude `telemetry`) or Preview set to None, and the data would still be in the public repo.

### Gaps
- Cloudflare does not say whether the skip flag is checked on the HEAD commit only or on every commit in a multi-commit push. Pages docs also do not say whether trailing (non-prefix) flags are ever honored. "Prefix" is the only documented behavior.
- I could not confirm whether Pages URL matching is case-sensitive, for example whether `/ai_telemetry_context.md` would bypass a redirect on the exact-case path.

## Q2. Where telemetry snapshots should live instead

### Takeaway
Because usaflees/cpt is public, any commit to any branch, including an orphan branch, can be read by anyone and stays in git history permanently. Artifacts on a public repo can be downloaded by any signed-in GitHub user. The safe options are a **private GitHub repo**, a **private Google Sheet or Drive file** under the owner's account, or **Cloudflare R2/KV** behind auth. A private repo or a private Sheet fits best with how Claude and Gemini read context.

### Cited Findings
- Artifacts: "People who are signed into GitHub and have read access to a repository can download workflow artifacts." Default retention is 90 days. Public repos allow 1 to 90 days and private repos 1 to 400 days. — [Downloading workflow artifacts](https://docs.github.com/actions/managing-workflow-runs/downloading-workflow-artifacts); [Repository Actions settings](https://docs.github.com/github/administering-a-repository/managing-repository-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-repository)
- `actions/upload-artifact` `retention-days` "must be between 1 and 90 inclusive" unless repo settings change that. — [actions/upload-artifact README](https://github.com/actions/upload-artifact)
- **Recent change:** starting October 1, 2026, the same retention setting also governs checks, workflow runs and commit statuses, which were previously kept for 400+ days. The public-repo maximum is 90 days. — [GitHub changelog 2026-08-27](https://github.blog/changelog/2026-08-27-actions-retention-will-cover-checks-workflow-runs-and-statuses); [Org retention docs](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization)
- R2 free tier: 10 GB-month of storage, 1M Class A and 10M Class B operations a month, free egress. Standard storage only. — [R2 pricing](https://developers.cloudflare.com/r2/pricing)
- Workers KV free plan: 100,000 reads a day, 1,000 writes a day, 1 GB storage, 25 MiB maximum value size. — [KV limits](https://developers.cloudflare.com/kv/platform/limits)
- Claude's Google Drive connector can read Google Sheets, among other formats. Google caps exports of Docs, Sheets and Slides at about 10 MB. — [Claude docs: Google Drive connector](https://claude.com/docs/connectors/google/drive)

### Inferences
Pros and cons of each storage option:
- **Root of the public repo (the Gemini plan): reject.** The file is publicly served by Pages after the next normal deploy and readable on GitHub. Every daily snapshot stays in git history forever. It adds 365 bot commits a year to `main` and risks push races with human commits.
- **Orphan branch in the public repo: reject.** It is still public on GitHub and in history, it creates a public Pages preview unless excluded, and Claude or Gemini cannot easily read a non-default branch.
- **Artifacts: usable for transient handoff only.** On a public repo any signed-in user can download them, so they are not private. Retention is capped at 90 days. They are awkward for an LLM to read.
- **GitHub Issue or Discussion on the public repo: reject.** It is fully public.
- **Private repo (for example `usaflees/cpt-telemetry`) holding JSON or Markdown snapshots: recommended for the GitHub path.** It is private, versioned and diffable. The Claude Code or GitHub connector can read it. The workflow can live in the private repo, and its scheduled workflows are not subject to the public-repo 60-day auto-disable (see Q4). It needs a token with write access to the private repo, and if the workflow lives there, the default GITHUB_TOKEN of that repo is enough.
- **Private Google Sheet or Drive file (the Apps Script plan): recommended for the no-infrastructure path.** It never touches GitHub or Cloudflare, uses no service account key, and both Claude (Drive connector) and Gemini (Workspace app) can read it.
- **R2 or KV: workable but more moving parts.** It needs a Cloudflare API token stored as a secret, and the bucket must stay non-public (no r2.dev public URL). LLM tools cannot read it natively.
- **Sensitivity.** GSC query strings, landing pages, CTR/position and GA4 traffic and referrer data are competitive intelligence: they show which keywords and pages earn traffic. Publishing them daily hands competitors your SEO playbook. GA4 dimensions could also include city, device or user-agent level data, so aggregate it before storing.

### Gaps
- No official source tested whether the Claude GitHub connector reads non-default branches or private repos the user owns. Connector capabilities depend on the account.
- I did not verify GitHub Free's Actions minutes quota for private repos in 2026.

## Q3. Google Cloud auth from GitHub Actions: service account key vs Workload Identity Federation, and the secure-by-default org policy

### Takeaway
Google and the official `google-github-actions/auth` action both prefer Workload Identity Federation over JSON keys. Keys "never expire" by default and are a high-value leak target. Since **May 3, 2024**, organizations created on or after that date have `iam.disableServiceAccountKeyCreation` and key upload enforced by default. A personal Gmail project with "No organization" is not in an org, so that policy does not block it. Even so, WIF is the right choice for this pipeline.

### Cited Findings
- "Workload Identity Federation is recommended over Service Account Keys as it obviates the need to export a long-lived credential". The setups are, in order: "(Preferred) Direct Workload Identity Federation", "Workload Identity Federation through a Service Account", "Service Account Key JSON". Keys "must be secured and treated like a password … By default, these credentials never expire". — [google-github-actions/auth README](https://github.com/google-github-actions/auth)
- Direct WIF: "not all Google Cloud resources support `principalSet` identities, and the resulting token has a maximum lifetime of 10 minutes". "To generate OAuth 2.0 access tokens or ID tokens, you _must_ provide a service account email, and the Workload Identity Pool must have `roles/iam.workloadIdentityUser`" on the service account. — [auth README](https://github.com/google-github-actions/auth)
- WIF through a service account, setup steps: (1) create the service account, (2) create a Workload Identity Pool, (3) and (4) create an OIDC Provider. "Always add an Attribute Condition to restrict entry into the Workload Identity Pool". Map claims to attributes before asserting on them. (5) Grant `roles/iam.workloadIdentityUser` on the service account to `principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${REPO}`. Workflow usage: `uses: 'google-github-actions/auth@v3'` with `service_account` and `workload_identity_provider`. — [auth README](https://github.com/google-github-actions/auth)
- "If your organization was created on or after May 3, 2024, this constraint is enforced by default" applies to `iam.disableServiceAccountKeyCreation`, to key upload, and to automatic role grants for default service accounts. The managed equivalent is `iam.managed.disableServiceAccountKeyCreation`. — [Restrict service account usage (2026-10-09)](https://cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts); [Best practices for SA keys](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
- "Google Cloud security baseline constraints are enforced for all organizations created on or after May 3, 2024. Some organizations created between February 2024 and April 2024 might also have these default policy enforcements set." The baseline lists `constraints/iam.managed.disableServiceAccountKeyCreation`. — [Manage security baseline constraints](https://docs.cloud.google.com/resource-manager/docs/manage-baseline-constraints)
- Leaked-key response: `iam.serviceAccountKeyExposureResponse`. "Starting on June 16, 2024, if you don't set a value … Google Cloud will default to the behavior described for `DISABLE_KEY`" (auto-disable plus notification). "Google Cloud doesn't guarantee that it will detect exposed keys." — [Restrict service account usage](https://cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts)
- "A service account can have up to 10 keys. By default, service account keys never expire." — [Create and delete SA keys](https://docs.cloud.google.com/iam/docs/keys-create-delete)
- Community answer (not official): projects under "No Organization" do not inherit org policies, and `gcloud resource-manager org-policies list --project` returned 0 items. — [Google Developer forums, June 2024](https://discuss.google.dev/t/organization-policy-constraints/156786). A 2025 forum thread describes a user who was blocked by an org policy and worked around it with "a new Gmail account, which is not governed by any existing organization policies." — [forum thread](https://discuss.google.dev/t/cant-disable-inherited-iam-organization-policy-service-account-key-creation-blocked-at-project-lev/192983)

### Inferences
- **Risks of the GCP_SA_KEY plan:** a non-expiring credential stored in GitHub secrets on a public repo; exfiltration through a compromised third-party action or npm package in the same job (see Q4 on `npm install --no-save` with unpinned versions); manual rotation; and auto-disable by Google if it ever leaks into a public commit, which would silently break the pipeline. The JSON key only grants what the service account can reach, which here is GSC and GA4 read access, but that data is the sensitive asset.
- **Use "WIF through a Service Account", not Direct WIF.** Search Console and GA4 grant access to an *email identity* (the service account), not to a `principalSet`. Set the attribute condition to something like `assertion.repository == 'usaflees/cpt'` (or the private telemetry repo) and preferably also check `ref` and `workflow`. Request an access token with the needed scopes (`webmasters.readonly`, `analytics.readonly`). The auth README documents a "Generating OAuth 2.0 access tokens" input section. The exact input name `access_token_scopes` comes from my prior knowledge and was not re-verified in this session.
- If the owner's personal Google account created the GCP project with no organization, key creation probably still works. That explains why Gemini's plan is feasible, but it is still discouraged.

### Gaps
- No official Google page explicitly says that "No organization" projects are exempt from secure-by-default. The only evidence is community answers plus the docs' "organization created on or after" wording.
- I did not verify GA4 Data API or Search Console API behavior with tokens that have a 10-minute lifetime. That limit applies to Direct WIF only, and nightly queries finish well within an hour.

## Q4. Can a WIF-authenticated service account call the Search Console API?

### Takeaway
Yes in principle. The API works for any identity that has owner, full or restricted access to the property, and Google's own Indexing API docs tell you to add a service account email as a (delegated) owner. **However, since about April 2026 many users report that the Search Console (and GA4) "Add user" UI rejects service account emails ("email not found")**. The documented workaround is to make the service account a verified owner through the Site Verification API.

### Cited Findings
- "You must have appropriate access (owner, full, read) to any Google Search Console account that you wish to access using the API." — [Search Console API overview](https://developers.google.com/webmaster-tools/about)
- Google's Indexing API prerequisites: verify ownership, then add "your service account email as the delegated owner". — [Indexing API prereqs (2026-07-16)](https://developers.google.com/search/apis/indexing-api/v3/prereqs)
- Threads from Apr 27-28, 2026 report "Failed to add user: email not found" when adding a service account to GSC, with "The same error occurs in GA4". A Product Expert says it "has been escalated". — [GSC community thread 428766086](https://support.google.com/webmasters/thread/428766086/service-account-email-not-found-when-adding-to-search-console?hl=en); [thread 429020059](https://support.google.com/webmasters/thread/429020059/unable-to-add-service-account-email-to-google-search-console?hl=en)
- Workaround reported in thread 429020059 (user-contributed, May 2026). Acting as the service account, call Site Verification `webResource.getToken` (DNS_TXT, INET_DOMAIN), add the TXT record, call `webResource.insert`, then call Search Console `sites.add` for `sc-domain:…`. After that, "sites.list returns it as siteOwner and the API works." For GA4, the admin user calls Admin API `accessBindings.create` with the `analytics.manage.users` scope. — [thread 429020059](https://support.google.com/webmasters/thread/429020059/unable-to-add-service-account-email-to-google-search-console?hl=en)
- An older Product Expert answer says a service account may also need to call `sites.add` for the property before `sites.list` shows it. — [thread 199491034 (2023)](https://support.google.com/webmasters/thread/199491034/unable-to-list-sites-within-search-console-api?hl=en)

### Inferences
- WIF does not change any of this. The federated token impersonates the same service account email, so whatever access that email has in GSC or GA4 applies. Grant the least privilege available: a GSC "Restricted" user (or "Full" if the UI bug forces the owner route) and the GA4 "Viewer" role.
- The Site Verification workaround makes the service account a **verified owner**, which is a powerful role (it can add or remove users). That widens the blast radius. An Apps Script running as the human owner (Q6) avoids the problem entirely.

### Gaps
- I could not confirm whether Google fixed the service-account "Add user" bug after mid-2026. The threads I saw did not show a resolution.

## Q5. GitHub Actions caveats: schedules, GITHUB_TOKEN, permissions, skip strings

### Takeaway
Scheduled runs can be delayed or dropped at busy times. They run only from the default branch. In a public repo they are auto-disabled after 60 days without repository activity. Pushes made with GITHUB_TOKEN never trigger other Actions workflows, so `[skip ci]` is irrelevant for Actions. Cloudflare Pages, however, is a GitHub App webhook and does see those pushes. A `contents: write` token in a job that runs `npm install` of unpinned packages is the main supply-chain risk.

### Cited Findings
- "The `schedule` event can be delayed during periods of high loads … High load times include the start of every hour. If the load is sufficiently high enough, some queued jobs may be dropped." Scheduled workflows run only on the default branch. "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." The shortest interval is 5 minutes. **New:** an optional IANA `timezone` key on `schedule` (for example `timezone: "America/New_York"`), and non-standard `@daily`-style syntax is unsupported. — [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- "When a public repository is forked, scheduled workflows are disabled by default." — [Disable and enable workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
- "With the exception of `workflow_dispatch` and `repository_dispatch`, other `GITHUB_TOKEN`-triggered events do not create workflow runs at all." — [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Actions skip strings (anywhere in the message, for push/pull_request only): `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a `skip-checks: true` trailer. "Skip instructions only apply to the `push` and `pull_request` events." — [Skipping workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)
- "Anyone with write access to a repository can modify the permissions granted to the `GITHUB_TOKEN` … by editing the `permissions` key in the workflow file." Workflows from fork PRs get no secrets, and their GITHUB_TOKEN is read-only. — [Repository Actions settings](https://docs.github.com/github/administering-a-repository/managing-repository-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-repository); [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

### Inferences
- GitHub's skip strings and Cloudflare's skip strings are different sets. `[skip ci]` as a prefix satisfies both (Cloudflare is case-insensitive). `[ci skip]` satisfies GitHub only.
- For the 60-day rule: daily bot commits to the repo probably count as "repository activity" and keep the schedule alive, but I found no doc confirming that bot commits count. If telemetry moves out of the public repo, the public repo's scheduled workflow could be disabled after 60 quiet days. Putting the workflow in a private repo avoids that, since the rule is stated for public repos.
- Schedule at an odd minute (for example `17 6 * * *`) to avoid top-of-hour drops. GSC data lags about 2 to 3 days, so exact timing does not matter.
- Hardening if any GitHub workflow is kept:
  - `permissions: {contents: read, id-token: write}` for WIF. Add `contents: write` only in a separate job that commits, ideally to the private repo.
  - Pin actions by commit SHA.
  - Replace `npm install --no-save googleapis @google-analytics/data` (it resolves floating latest versions on every run) with a committed `package.json` and lockfile and `npm ci`, or call the REST endpoints directly with `fetch` and no dependencies.
  - Never `cat` or echo the credentials file.
- Branch protection on `main` (required PRs or checks) blocks GITHUB_TOKEN direct pushes unless a bypass is granted. Granting a bypass weakens protection. Another reason not to commit telemetry to `main`.

### Gaps
- No official confirmation that bot or GITHUB_TOKEN commits count as "repository activity" for the 60-day rule.

## Q6. The Apps Script plus Google Sheet option

### Takeaway
This works and is lower-risk. A time-driven trigger runs as the owner's Google account, so there is no service account, no key, no GitHub secret and nothing public. GA4 has an official `AnalyticsData` advanced service. Search Console has no advanced service in the current list, so you call its REST API with `UrlFetchApp` plus `ScriptApp.getOAuthToken()` and declare the `webmasters.readonly` scope in `appsscript.json`. Consumer quotas (6 min per execution, 90 min of trigger runtime per day, 20,000 UrlFetch calls per day) are far above what one nightly pull needs. Claude's Drive connector reads Sheets, and so does Gemini's Workspace app.

### Cited Findings
- Consumer (gmail.com) vs Workspace quotas: URL Fetch calls 20,000/day vs 100,000/day; trigger total runtime 90 min/day vs 6 hr/day; script runtime 6 min per execution for both; 20 triggers per user per script; URL Fetch response size 50 MB per call. — [Apps Script quotas (2026-09-03)](https://developers.google.com/apps-script/guides/services/quotas)
- Time-driven triggers run anywhere from every minute to monthly. A 9 AM trigger fires at a time between 9 and 10 AM that stays consistent from day to day. Installable triggers run with the authorization of the user who created them. — [Installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- The `AnalyticsData` advanced service exposes the GA4 Data API v1 (for example `AnalyticsData.Properties.runReport(request, 'properties/ID')`) and must be enabled before use. — [Analytics Data Service](https://developers.google.com/apps-script/advanced/analyticsdata)
- For APIs without an advanced service, call them with `UrlFetchApp.fetch` using an `Authorization: Bearer ${ScriptApp.getOAuthToken()}` header, and "manually specify the required OAuth scopes in the script's manifest". — [Advanced Google services](https://developers.google.com/apps-script/guides/services/advanced); [ScriptApp.getOAuthToken](https://developers.google.com/apps-script/reference/script/script-app)
- A community index of the advanced services pages lists Analytics Data, Analytics Admin, YouTube and others but no Search Console service. — [rajeevmps/google-apps-script-docs advanced-services index](https://github.com/rajeevmps/google-apps-script-docs/blob/master/advanced-services/README.md) (community mirror, not official)
- Claude's Google Drive connector reads Google Sheets. Exports are capped at about 10 MB, and above that Claude gets only the file's metadata. — [Claude docs: Google Drive](https://claude.com/docs/connectors/google/drive). Separate Google Sheets connectors (beta, Oct 2026) can create and edit Sheets live. — [Anthropic announcement, Oct 6, 2026](https://claude.com:8443/resources/articles/claude-now-works-in-google-docs-sheets-and-slides); [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors)
- The Gemini Apps Google Workspace app can "Summarize, get quick answers, and find information from Google Workspace services like Gmail, Docs, and Drive" (invoked with `@`). It cannot access Drive content "that isn't in a document, spreadsheet, presentation, or PDF". So spreadsheets are in scope. — [Gemini Apps Help: Google Workspace app](https://support.google.com/gemini/answer/15229592?hl=en)

### Inferences
- One nightly run needs only about 3 to 10 API calls and a few seconds, well under every quota.
- OAuth scopes the owner approves once: `https://www.googleapis.com/auth/webmasters.readonly`, `https://www.googleapis.com/auth/analytics.readonly` (added automatically by the advanced service), `spreadsheets.currentonly` or `spreadsheets`, and `script.external_request` for UrlFetch.
- Security profile: data stays in the owner's private Drive, and the only credential is the owner's Google session. The risks are (a) accidentally sharing the Sheet by link, and (b) the owner's Google account being compromised, which would expose GSC and GA4 anyway.
- Weaknesses: the code lives outside git unless you use clasp; there is less observability; and the Sheet stores tabular data, not curated Markdown. A small "summary" tab with pre-aggregated rows (top queries with deltas, top pages, CTR anomalies) is more LLM-friendly than raw dumps.

### Gaps
- I could not reach an official Google page that explicitly says "no Search Console advanced service". The finding rests on the community index plus my not finding it in Google's listings.
- I did not verify whether Gemini's `@Google Drive` handles large multi-tab Sheets reliably. Its file limits are documented only for uploads (100 MB, 10 files).

## Q7. Does it matter whether the repo is public or private?

### Takeaway
Yes, and here it decides the question. `usaflees/cpt` is **public**, so the Gemini plan would publish daily search-query and traffic intelligence in three places: GitHub, git history and (after the next deploy) the live website.

### Cited Findings
- `gh api repos/usaflees/cpt` returns `private:false, visibility:"public"`, `default_branch:"main"`, `pushed_at:"2026-10-27T21:56:20Z"`. (Checked directly in this session.)
- On a public repo, artifacts are downloadable by any signed-in user. — [Downloading workflow artifacts](https://docs.github.com/actions/managing-workflow-runs/downloading-workflow-artifacts)
- Google may auto-disable a service account key detected in a public repository (default `DISABLE_KEY` since June 16, 2024). — [Restrict service account usage](https://cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts)
- Anyone can fork a public repo. Fork PR workflows get no secrets, and scheduled workflows are disabled on forks. — [Repository Actions settings](https://docs.github.com/github/administering-a-repository/managing-repository-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-repository); [Disable and enable workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)

### Inferences
QA verdict on the Gemini plan, claim by claim:

| Claim | Verdict |
|---|---|
| "`[skip ci]` stops Cloudflare Pages rebuilding" | **Partly true.** It works only as a prefix. It does not stop the file going live on the next real deploy. |
| "Auth with an SA JSON key in GCP_SA_KEY" | **Works but discouraged.** Use WIF through a service account. Keys may be blocked in post-May-2024 orgs, but probably not in a no-org Gmail project. |
| "`npm install --no-save …`" | **Works but risky.** Floating versions run in a job that holds credentials. Pin versions or use plain `fetch`. |
| "Service account added to GSC as a user" | **Correct in principle, currently unreliable.** The Add-user UI rejects service account emails as of Apr-May 2026; the workaround is the Site Verification API. |
| "Commit AI_TELEMETRY_CONTEXT.md to the repo root" | **Unsafe.** Public on GitHub, in permanent history and on the live site. |

Safest efficient design, in order of preference:
1. **Apps Script bound to a private Google Sheet** under the site owner's account. Use the `AnalyticsData` advanced service for GA4, and UrlFetchApp with the user's OAuth token and `webmasters.readonly` for Search Console. Run a nightly trigger at an off-peak hour and write a compact "LLM summary" tab plus raw tabs with a 16-month cap. Claude (Drive connector) and Gemini (`@Google Drive`) read it directly. No service account, key, GitHub secret, Cloudflare change or public exposure.
2. **If the git and Actions route is preferred:** create a **private** repo `usaflees/cpt-telemetry` and put the scheduled workflow there. Use `permissions: {contents: write, id-token: write}`, `google-github-actions/auth@v3` with WIF through a dedicated read-only service account, and an attribute condition pinned to that repo. Pin dependencies or use REST `fetch`, write `snapshots/YYYY-MM-DD.json` plus `LATEST.md`, and commit there. Give the public cpt repo no telemetry and no GCP secrets. Delete GCP_SA_KEY if it was created, and delete the key in GCP.
3. **Regardless of choice, harden cpt's hosting:**
   - Move the site into `public/` and set it as the output directory, so README, docs and scripts stop being served. Or at minimum add `_redirects` rules for any non-site file.
   - Set Preview branch control to Custom and exclude bot or data branches.
   - Consider an Access policy on previews.

### Gaps
- I did not check whether the repo's existing git history already contains any secrets or telemetry. Not in scope; a secret scan is recommended.
