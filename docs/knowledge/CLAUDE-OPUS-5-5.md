# Getting the most out of Claude Opus 5.5 on this site

Researched 2026-11-02 from Anthropic's docs and blog (sources in
[research/2026-11-02-opus-5-5-and-search-news.md](research/2026-11-02-opus-5-5-and-search-news.md)).

## The model in one paragraph
Claude Opus 5.5 (`claude-opus-5-5`, released Sept 22, 2026) is built for long-running agentic coding and knowledge
work: 1M-token context, 128K output, $4 / $20 per million input/output tokens. Thinking is always on; the
**effort level** is the main control for how hard it thinks. Its default is `medium`, and Anthropic reports that
Opus 5.5 at `medium` matches or beats Opus 5 at `high`, while costing about 40% less per task. At the same
level it thinks more than Opus 5, especially at `xhigh` and `max`.

## Effort: which level for which job here
| Level | Use it on this project for | Notes |
| --- | --- | --- |
| `low` | Copy tweaks, renames, a single CSS value, reviewing a small diff | A reviewer reported Opus 5.5 at `low` found more bugs in diffs than Opus 5 at its highest level |
| `medium` (default) | Clear-scope features: a new page section, a generator change, a new chart | Plenty for everyday work |
| `high` | Bugs in existing code, anything touching both `app.js` and the generator, performance or accessibility debugging | Checks more edge cases and verifies more |
| `xhigh` ("extra high") | Whole-site audits, redesigns across many pages, long unattended runs, the monthly SEO-proposal run | Deeper reasoning at higher token cost; Anthropic: reserve for work where it measurably helps |
| `max` | Security review, hunting a bug nobody can find | Prone to overthinking; slow |
| `ultracode` | Big multi-part jobs (e.g. "audit every page type and fix what you find") | A Claude Code setting, not a level: Claude plans a dynamic workflow of subagents. `claude --effort ultracode` starts at `xhigh` with it on |

**Where to set it**
- **Claude Code on the web / desktop / app:** model picker → **Effort**. In the terminal: `/effort xhigh`
  (or `/effort ultracode`), or `claude --effort xhigh`.
- **Scheduled task:** claude.ai/code → Scheduled tasks → the task → Edit; the **model selector** in the prompt box
  has **Effort**. (Claude can't change this through its tools; the owner sets it.) Recommended for the weekly
  maintenance task: **Medium**. Since Nov 3 the run is one script plus CI and preview QA, so extra thinking buys
  little. Raise it to **High** once telemetry exists and the monthly SEO-proposal step starts doing real work.
- Phrases like "think hard" or "be thorough" don't raise effort and can be deleted; change the level instead.

## How to ask (what Anthropic recommends for Opus 5.5)
1. **Hand over the whole task with a finish line.** "Done means: `bash tests/run.sh` ends with QA PASSED, the
   change is live, and STATE.md is updated. Stop and ask only if a check fails for a reason you can't explain."
2. **Say when to stop.** Opus 5.5 sometimes ends a long turn with a summary that announces the next step instead of
   taking it. Naming the stops you don't want, and the ones you do, fixes this (our CLAUDE.md has the rule).
3. **For design work, name the patterns you don't want** (e.g. "no centred hero with a soft gradient and three
   feature cards"). "Avoid a generic look" just swaps one default for another.
4. **Big audits:** ask it to split the work across subagents (one per page type), check each one's evidence, and
   finish with one table.
5. **Long runs:** "Keep a checklist in TASKS.md and tick items as you go." Read the file, not the scrollback.
6. **Review prompt that works:** "Review the diff on this branch against main. List only problems you'd block the
   merge for, each with file and line, why it's wrong, and how to show it fails."
7. **End-of-run format:** "Blocked on me / Changed / Found" (also in CLAUDE.md).
8. Don't ask it to print its internal reasoning in the reply: that can be declined. Ask "explain your choice in
   three sentences" instead.

## Verification is the biggest lever
Anthropic's top Claude Code tip: give Claude a check it can run. Here that is:
- `bash tests/run.sh`: build, seo-lint, link check, live checks, browser tests, accessibility. Against a preview:
  `bash tests/run.sh https://<branch-alias>.cryptopriceticker.pages.dev`.
- Stricter options when nobody is watching: `/goal <condition>` (a separate model checks the condition after every
  turn), a `Stop` hook that blocks finishing until a command passes, or a second-opinion subagent that tries to
  refute the result.
- Rules that must never be broken belong in **deterministic** places, not prose: CI ("Site checks"),
  `classify-change`, the forbidden-file list in `seo-lint --base`, branch protection. CLAUDE.md is guidance Claude
  may judge doesn't apply.

## CLAUDE.md, skills, hooks: what goes where
| Mechanism | Use here | Status |
| --- | --- | --- |
| `CLAUDE.md` (always loaded) | Check commands, places the code misleads, past decisions, stop rules. Short (< ~200 lines) | ✅ |
| Skill (`.claude/skills/<name>/SKILL.md`, loaded on demand) | Repeated procedures: `ship` (QA → preview → live → IndexNow) | ✅ |
| Hooks (`settings.json`, deterministic) | E.g. block edits to generated files, run seo-lint before finishing | 🔜 optional |
| Subagents / dynamic workflows | Parallel audits, research, second-opinion reviews | Use per task |
| Plugins worth trying | `frontend-design` (Anthropic-verified design skill), `playwright` (browser checks), `code-review` | 🔜 owner choice |

## Scheduled tasks: facts that matter for the weekly run
- Research preview; available on Pro, Max, Ultra, Team and Enterprise; runs count against the account's usage.
- Each run clones the selected repositories fresh and pushes to `claude/`-prefixed branches. **The repository must
  be selected under Edit → Advanced settings → Repository**, or pushes fail with 403 (what happened on Oct 30).
- Runs start in auto mode (a classifier approves actions); one blocked action doesn't end the run.
- All connected connectors are included by default, with write access: remove the ones the task doesn't need.
- Commits and PRs appear as the owner's GitHub user.
- Limits: schedules at most hourly; 100 scheduled runs an hour per account; "Run now" 30 an hour per task.
- Model and effort are chosen in the task's model selector and apply to every run.

## Keeping Pro plan usage low
Usage grows with the number of turns, with how much text each turn adds to the context (tool output, files read),
and with effort. What we did about each:
| Cost driver | Change |
| --- | --- |
| Many small tool calls in the weekly run (20 turns on Nov 2 just to reach the push) | `scripts/weekly-refresh.sh` runs refresh → stats → build → lint → links → classify in one call with a one-screen summary and exit codes |
| Polling a deploy turn by turn | `tests/wait-deploy.sh <url>` waits in one call |
| Long QA output read every time | `tests/run.sh` prints one line per check; logs only for failures |
| Huge diffs (a refresh changed ~8,400 lines, 7,278 of them in the stats file) | `content/coin-stats.json` is one coin per line: a refresh now changes ~114 lines in it |
| Reading big generated files | CLAUDE.md says to grep them instead |
| Accidental reruns (a stray `--help` once ran a real refresh) | Data scripts reject unknown flags |
| Effort higher than the job needs | Weekly task on **Medium**; interactive default `medium`, `xhigh` only for audits/redesigns |
| Unneeded connectors in scheduled tasks | The weekly task has none; keep it that way |
Other levers: `/clear` between unrelated tasks; one Claude session changing the site at a time (two in parallel
cost a merge on Nov 2); Batch/API pricing doesn't apply to the subscription, so fewer, fuller turns are what saves.

## Guardrails we keep regardless of model
- Never feed raw search queries, analytics or credentials to the agent; it reads the sanitized digest only.
- The agent edits data files (`content/seo-overrides.json`, `content/experiments.json`), never page templates,
  `assets/app.*`, `scripts/`, `tests/`, `_headers`, `.github/` or `CLAUDE.md`.
- Anthropic's usage policy (effective Nov 12, 2026) bars using Claude to seed sources that AI answers draw from with
  manipulative content. Our content rules already forbid this.
