# Access: who can change the repository and publish the site (2026-11-11)

Goal set by the owner: the owner and Claude sessions can read the repository, push and publish; nobody else can.
This note says how that works today, what the repository enforces by itself, and which settings only the owner
can change. Sources checked 2026-11-11: GitHub Docs (plans, rulesets, protected branches, secret scanning,
Dependabot options), `git ls-remote` on the pinned actions.

## 1. Every way the live site can change

A push to `main` is a deploy (Cloudflare Pages), so "who can publish" means "who can move `main`", plus the
accounts around it.

| Path | Who holds it today | What limits it |
| --- | --- | --- |
| Push to `main` on GitHub | Only `usaflees` (the single collaborator, admin). Checked through the API on 2026-11-11 | GitHub account security (§3.1). `main` has **no ruleset yet** (§3.2) |
| Claude Code sessions | Push as the owner through the Claude GitHub App, only to the repositories attached to the session | Whoever can sign in to the owner's claude.ai account can push. Session scope, connectors (§3.4) |
| `data-refresh.yml` (weekly, GitHub's own token) | One job, `publish`, may write | Split jobs and re-checks (§2) |
| Pull requests from strangers (public repo) | Anyone can open one; nobody but the owner can merge | Checks run with a read-only token and no secrets; `CODEOWNERS` |
| Cloudflare account | Dashboard users and API tokens can deploy directly, change DNS, headers and redirects | Cloudflare account security (§3.3) |
| Domain registrar and DNS | Whoever controls them controls the site whatever the repository says | Registrar lock, 2FA, DNSSEC (§3.3) |
| Google Tag Manager `GTM-PD9TXJX` | Container users can add tags that load on every page | Strict CSP blocks Custom HTML tags; keep the container's user list to the owner (§3.5) |

## 2. What the repository enforces (no settings needed)

- **Workflows are linted** (`scripts/seo-lint.mjs` section 3c, run in CI on every pull request and push): top-level
  `permissions: {}`; every action is a GitHub-maintained `actions/*` pinned to a full commit SHA; no
  `pull_request_target`, `workflow_run`, issue or comment triggers; no repository secrets or variables; every
  checkout uses `persist-credentials: false`; no `${{ }}` expression inside a shell script (values go through
  `env`); a write permission or the token is allowed only in `data-refresh.yml` job `publish`.
- **The weekly refresh cannot be used to publish anything but numbers.** Job `refresh` (read-only token) calls the
  exchange APIs, installs Playwright and axe-core from npm (`--ignore-scripts`, exact versions) and runs QA; all it
  hands on is a patch. Job `publish` installs nothing, applies the patch to a clean `main` and re-checks it with
  `main`'s own scripts before pushing: `classify-change` (only data files; `assets/coins.js` compared as text, so
  only supply and price numbers and the update date may differ), `check-refresh` (the stats file may hold only
  numbers, dates and plain names), a rebuild that must reproduce every generated page byte for byte, and `seo-lint`.
  Before this, one job did everything while holding the write token, and a generated page was accepted without
  comparing it with the build.
- **`.github/CODEOWNERS`** gives every file to `@usaflees` (takes effect with the ruleset option in §3.2).
- **The automated weekly task** may not touch `scripts/`, `tests/`, `.github/`, `_headers`, `assets/app.*`,
  `CLAUDE.md` (`seo-lint --base`, `classify-change`).
- **The deployed site** returns 404 for the repository's working files (`functions/_middleware.js`), sends a strict
  CSP and HSTS, and has no secrets: nothing in the tree or history matches a credential pattern (re-scanned today).

## 3. Settings only the owner can change

Claude sessions cannot reach account or repository settings, and should not: see §5. In order of value.

### 3.1 GitHub account (github.com → Settings)
1. **Password and authentication:** two-factor on with a passkey or security key; recovery codes stored offline.
   This account is the one key to everything in §1's first three rows.
2. **Applications → Installed GitHub Apps:** expect Claude and Cloudflare Workers and Pages, each set to "Only select
   repositories". **Authorized OAuth Apps:** revoke anything you don't recognise.
3. **Developer settings → Personal access tokens** and **SSH and GPG keys:** delete what you don't use. A classic
   token with `repo` scope is a second key to `main`.

### 3.2 Repository `usaflees/cpt` (Settings)
1. **Rules → Rulesets → New branch ruleset** on the default branch, enforcement Active, empty bypass list, with
   **Restrict deletions** and **Block force pushes**. This protects history from a mistake or a stolen token and
   does not get in the way of Claude's fast-forward releases or the weekly refresh. Don't add "Require a pull
   request" or "Require status checks" yet: both would stop the `ship` skill's fast-forward and the refresh job's
   push (GitHub's own token can't be put on a personal repository's bypass list).
2. **Actions → General:** allow only actions created by GitHub; "Require approval for all external contributors"
   for fork pull requests; workflow permissions "Read repository contents"; untick "Allow GitHub Actions to create
   and approve pull requests". (The refresh job asks for its write permission in the workflow file, so the
   read-only default doesn't break it.)
3. **Advanced Security:** turn on Private vulnerability reporting (SECURITY.md points to it), Secret Protection with
   push protection, and Dependabot alerts. All free while the repository is public.
4. **Collaborators, Deploy keys, Webhooks, Secrets and variables:** should all stay empty (collaborators: only you).
5. Optional tidy-up: delete merged session branches (`ccr-…`, `claude/…`); turn off Wiki, Projects and Discussions.

### 3.3 Cloudflare and the domain
1. Account two-factor with a passkey or security key; **Manage Account → Members:** only you.
2. **My Profile → API Tokens:** delete unused tokens; never use the Global API Key. Any token with Pages edit
   rights can publish without touching GitHub.
3. Pages project → Settings → Builds: production branch `main`. Branch previews are public by design (the QA flow
   reads them). Putting Cloudflare Access in front of previews would lock Claude's preview QA out too.
4. DNSSEC on; registrar lock on and two-factor at the registrar. (Open already: the duplicate `_dmarc` record.)

### 3.4 Claude (claude.ai)
1. The claude.ai login can push to `main` through any session, so protect it like the GitHub account (two-factor on
   the Google account behind it).
2. Keep the Claude GitHub App on "Only select repositories": `usaflees/cpt` and `usaflees/cpt-telemetry`.
3. **Connectors:** sessions on this repository currently also carry connectors that have nothing to do with it
   (mail, drive, shop and exchange accounts). A session reads web pages and pull-request text; the fewer accounts
   it can act on, the less a hostile page could ever reach. Use an environment or scheduled-task setting without
   them for this repository.
4. Environment network access "limited" (package registries plus the hosts the QA needs) rather than unrestricted.

### 3.5 Google
Two-factor on the Google account; in Tag Manager and Analytics → Admin → User management, only you. A GTM user can
publish tags to every visitor.

## 4. Making the repository private (owner's open wish, HANDOFF Nov 10)

Private changes who can **read** the source, history and `docs/`; it does not change who can write (already only
you), and the shipped HTML, CSS and JavaScript stay readable in every browser.

| | Public (today) | Private, GitHub Free | Private, GitHub Pro |
| --- | --- | --- | --- |
| Source, history, strategy notes | Anyone can read | Only you and your apps | Same |
| Ruleset / branch protection on `main` | Available | **Not enforced** | Available |
| Secret scanning and push protection | Free | Not offered for personal private repositories | Not offered |
| Private vulnerability reporting, public issues | Yes | No (nobody can see the repository) | No |
| Pull requests from strangers | Possible (read-only checks) | Impossible | Impossible |
| Actions minutes | Unlimited | 2,000 a month (this repository uses a small fraction) | 3,000 |
| Cloudflare Pages, Claude, Dependabot | Work | Work | Work |

Before the switch, in one release: reword "public source code" and remove the GitHub links (trust and about pages,
footers, README, `llms.txt`, JSON-LD `sameAs`, `security.txt`, SECURITY.md) and give security reports a new
contact, which needs an address from the owner. If the repository goes private, take GitHub Pro with it so §3.2's
ruleset keeps working.

## 5. Why Claude does not hold GitHub admin rights

Claude sessions read, push, open pull requests and run workflows; that is everything building and publishing the
site needs. Settings (rulesets, collaborators, visibility, apps, tokens) are reachable only from the owner's signed-in
browser. Handing a session an admin token would put the keys to the locks in the same place as the thing being
locked: a session reads outside content every day, and one successful trick could then remove the protections
above. So the split is deliberate: Claude prepares and checks, the owner clicks the few settings in §3.
