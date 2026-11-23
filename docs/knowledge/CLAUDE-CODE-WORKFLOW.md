# Working with Claude Code and Claude Duet on this site

Updated 2026-11-18 from Anthropic's docs, the Claude Code changelog (2.1.323–2.1.327) and a week of user reports.
Sources and dates: [research/2026-11-18-claude-code-and-duet.md](research/2026-11-18-claude-code-and-duet.md).
Model and effort choices stay in [CLAUDE-OPUS-5-5.md](CLAUDE-OPUS-5-5.md); this file is about how sessions are set up
and how a feature gets from idea to a reviewed pull request. A short version loads in every session from
[`.claude/rules/claude-workflow.md`](../../.claude/rules/claude-workflow.md). Re-check by 2026-12-18.

## 1. What each kind of session loads
Most work here happens in cloud sessions and Claude Duet threads, and those load less of the repo than a terminal does.

| In the repo | Terminal / Desktop | Duet or Project cloud thread |
| --- | --- | --- |
| Root `CLAUDE.md`, `.claude/CLAUDE.md` | ✅ | ✅ |
| `.claude/rules/*.md` without `paths` | ✅ every session | ✅ |
| `.claude/rules/*.md` with `paths`, subfolder `CLAUDE.md` | ✅ when matching files are touched | ❌ |
| `.claude/skills/` (e.g. `ship`) | ✅ on demand | ❌ not loaded: open the file by path |
| `.claude/agents/`, commands | ✅ | ❌ |
| `.claude/settings.json` (permissions, hooks, env, plugins), `.mcp.json` | ✅ | ❌ |

What follows for this repo:
- Anything every session must know goes in `CLAUDE.md` or a `.claude/rules/` file **without** `paths`. Keep both short.
- Procedures (ship, the feature recipe below) live in files that `CLAUDE.md` names by path, so a cloud thread can open
  them even though skills don't load there.
- Rules that must hold every time are enforced by CI ("Site checks", `classify-change`, `seo-lint --base`) and branch
  protection, not by hooks: hooks don't run in cloud threads.

## 2. Feature recipe (customer-facing features)
Use this for anything a visitor will see: a new tool, page section, chart, widget or data feature.
1. **Check fit first.** Is it in `docs/QUEUE.md` or `docs/STRATEGY.md`? Does it break a rule in `CLAUDE.md` Decisions
   or the goal order (no new URL families until indexing catches up)? If it does, say so before building.
2. **Write the finish line into the task.** One short spec in the PR description or the task brief: what the visitor
   sees, on which pages, what data it uses and where that data comes from, and "done means": named checks pass
   (`bash tests/run.sh` ends with `QA PASSED`), works at 375 px in dark and light, no layout shift, no fake data.
3. **Say what Claude can't see.** API limits and terms, the CSP allowlist, the owner's decisions, anything only in
   the owner's head. Everything visible in the code, leave out.
4. **One thread, one feature, one draft PR** on a `claude/` branch. Before pushing, list open PRs and name any that
   touch the same files (two threads on one file means a merge for someone).
5. **Check at each step, not only at the end.** After each part: the quick check (`node scripts/build-coin-pages.mjs
   && node scripts/seo-lint.mjs`, `node tests/links.mjs`); at the end the full QA, then preview QA
   (`.claude/skills/ship/SKILL.md` steps 1–4). Paste the command and its summary line as evidence.
6. **Fresh-eyes review before the owner sees it.** A subagent that didn't write the code reviews the diff against
   the spec: "report only gaps that affect correctness, users or the rules in CLAUDE.md, each with file and line;
   skip style". Fix what's real; ignore the rest.
7. **Stop at the owner's yes.** Going live follows the `ship` skill, only when the owner asks for that change to go
   live. Record durable lessons in `facts.jsonl`.

## 3. Prompts that work now (Opus 5.5 era)
- Give the whole task in one message with a testable end state, plus what Claude can't discover from the repo.
- Plain wording. No IMPORTANT, capitals or repetition: current models over-apply emphasis. If a line keeps being
  missed, the file is too long or the rule belongs in CI.
- No "think hard", "be thorough", "keep going, don't be lazy". Raise effort instead, or put `ultrathink` in the one
  prompt that needs it.
- Don't describe the stack or folder layout in `CLAUDE.md`: Claude reads the repo. Keep what the code hides
  ("Where the code misleads").
- For research and audits: "mark anything you couldn't confirm and say where you looked."
- When it drifts: `Esc` and redirect. After two failed corrections, start fresh with one better prompt rather than a
  third correction.
- Ask for evidence (the command and its output) rather than "all checks pass".

## 4. Keeping Claude Duet and project threads cheap (Pro plan)
- **Effort:** Claude Duet has no model or effort setting; it runs on Opus 5.5 and picks the effort per job, so
  there's nothing to change there. Claude Code's own Projects (claude.ai/code) default threads to Opus at `high`;
  if you use one, set Project settings > General > Thread effort to Medium.
- **Close finished tasks.** Open tasks are re-checked every few hours and use the plan even when idle (user reports).
  Mark a task done once its PR is merged or the answer landed.
- **Few channels.** Channels share one memory; extra channels mostly add places to look. One for this site is enough.
- **Fresh thread for new work.** A thread idle over an hour re-reads its whole history on a follow-up, and a thread
  watching a PR wakes on every CI failure or comment. Ask it to stop watching a PR you've decided on.
- **One thread changes the repo at a time** unless the tasks touch different files (see `claude-parallel-chats` in
  facts.jsonl: seven parallel chats re-merged each other's work).
- Background work (morning brief, check-ins) counts against the same limits as chat.

## 5. Claude Duet habits for this project
- Message it like a colleague in one line; bigger asks become tasks with their own thread and a PR.
- Put standing rules in project instructions (sent to every thread) and repo rules in `CLAUDE.md`. Ask it to read your
  standing instructions back every couple of weeks and say which are stale.
- "A task runs now; a wait needs a routine." To wait on something (a review, a data source, a date), ask for a
  scheduled task that checks for it, not a task that looks once and stops.
- From the phone, Duet can check on and steer a Claude Code session on your computer (Desktop app open, or remote
  control on) and show its approval prompts as cards.
- Dashboard steps (Cloudflare tokens, secrets, Search Console) stay with the owner; say up front which step will
  need you so the thread can do everything else first.

## 6. Upkeep
- When a new model or a big Claude Code release lands: run `/doctor prompt-audit` in a terminal session to find
  CLAUDE.md lines and skills that only compensated for the old model, and `/status` after editing anything in `.claude/`.
- Terminal-only tools worth knowing: Code Mode (experimental, 2.1.323+) for many-file mechanical edits; `/goal` for
  unattended runs; `/code-review` for a fresh-context review; `/btw` for side questions.
- Scheduled tasks ask before running a skill that declares `allowed-tools` or hooks (2.1.325). Keep skills used by
  scheduled tasks free of those, or add `Skill(name)` to `permissions.allow`.
- New findings: a dated file in `research/`, a line in `facts.jsonl`, then update this guide.
