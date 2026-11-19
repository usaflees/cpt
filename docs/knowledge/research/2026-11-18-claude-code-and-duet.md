> **Research snapshot, 2026-11-18.** Claude Code and Claude Duet changes and best practices from 11 to 18 November
> 2026, read for how this site is built (static, Cloudflare Pages, worked on mostly from cloud sessions and Claude Duet
> threads). The working rules that came out of it are in [../CLAUDE-CODE-WORKFLOW.md](../CLAUDE-CODE-WORKFLOW.md);
> each durable finding is also a line in [../facts.jsonl](../facts.jsonl).
> Confidence words: **official** (Anthropic's own docs, changelog or help center), **reported** (Anthropic staff
> quoted second-hand, trade press), **claim** (a single blog or post).
> Docs pages carry no publish date. "Read 18 Nov" means the page said this on that day, not that it changed this week.

# 1. What changed, 11–18 November 2026

| Date | Change | Confidence | What it means here |
| --- | --- | --- | --- |
| 11 Nov | Lydia Hallie (Claude Code team) talk "Rethinking Claude Code Best Practices" at AI Engineer CODE ([write-up](https://ai.engineer/code/2026/talks/lydia-hallie), [video](https://www.youtube.com/watch?v=vlfCjWuv4es)). Drop instructions that compensated for older models; keep only what the model can't discover from the code; deny rules for anything irreversible; checks at intermediate checkpoints, not only at the end; CI as the common gate for many sessions; fresh-context review; human review in proportion to risk | official (Anthropic speaker) | Our CLAUDE.md is already short and check-first. Run a prompt audit when a model changes (below) |
| 12 Nov | Claude Code 2.1.323: **Code Mode** (experimental, opt-in): Claude writes JavaScript that makes several tool calls in one step ([changelog](https://code.claude.com/docs/en/changelog), [docs](https://code.claude.com/docs/en/code-mode)). Terminal only: not in `-p`, the Desktop app, VS Code or cloud sessions; 10-minute limit per piece of code | official | Not usable in the cloud sessions and Duet threads we mostly work in. Worth trying in a local terminal for many-file mechanical changes |
| 12 Nov | 2.1.323: start-up warning for Bash allow rules with `*` in a variable's value; plugins can state a Claude Code version range | official | No effect (we have no such rules or plugins) |
| 13 Nov | 2.1.325: **scheduled tasks and `/loop` now ask before running a skill that declares `allowed-tools` or hooks**; add `Skill(name)` to `permissions.allow` to run it unattended. Sandboxed Bash follows the normal permission flow by default | official | Our `ship` skill declares neither, and the daily task prompts don't call skills. Don't add `allowed-tools` to a skill a scheduled task uses without the allow rule, or the run waits for a person |
| ~12 Nov | Claude Duet can check on and steer Claude Code sessions (local with the Desktop app or remote control on, or cloud) from the phone; a card in the main channel asks for approvals ([Duet Directory](https://duetdirectory.com/claude-code), quoting the Duet team on X) | reported | The owner can approve a local session's prompts from the phone |
| 16 Nov | 2.1.326: a hook's `"decision": "block"` holds in more cases; Code Mode with agent teams; Claude's file tools refuse writes to sign-in files; `/status` row says when a provider or env var turns features off | official | No hooks here today, so nothing to change |
| 17 Nov | 2.1.327: `/status` lists broken agent, skill, command and output style files and hook matchers that never match; `ExitWorktree` asks before removing a worktree with unsaved work; Claude is told not to commit files that likely hold secrets | official | `/status` is the quick health check after editing `.claude/` |
| 17 Nov | Claude Desktop: choose a Stable or Latest release channel ([Releasebot](https://releasebot.io/updates/anthropic), from Anthropic's notes) | reported | Owner choice |
| 9 Nov (just before the window) | Claude Fable 5.2 (`claude-fable-5-2`) is the default Fable model, 1M context, $8/$40 per Mtok; `/model fable` in Claude Code ([changelog](https://code.claude.com/docs/en/changelog), [dev.to weekly](https://dev.to/aicoding-guide/this-week-in-claude-code-codex-and-gemini-cli-week-of-november-15-2026-4pmm)) | official | Twice Opus 5.5's price. Keep Opus 5.5 as the default; Fable only for a hard bug or audit that Opus missed |

# 2. Official docs read 18 Nov (current state, not necessarily new)

**Best practices** ([best-practices](https://code.claude.com/docs/en/best-practices)):
- Two kinds of instruction: non-deterministic (prompt, CLAUDE.md, skills: Claude decides) and deterministic (hooks,
  deny rules, CI, branch protection: the harness enforces). "If you keep adding emphasis to a CLAUDE.md line and
  Claude still misses it, that line belongs in a hook." The reverse also holds.
- "If your repo already has a check, the single most useful line in your CLAUDE.md is the command that runs it."
  Ask for evidence: the command and its output, not "all tests pass".
- Strictness ladder for "done": in the prompt → `/goal <condition>` (a separate model checks after every turn) →
  `Stop` hook (exit 2 sends Claude back; 8 blocks in a row max) → `/code-review` in a fresh subagent.
- Review against a spec, and keep "skip style" in the review prompt: a reviewer asked to find problems always finds
  something, and fixing every finding adds needless layers.
- Before an unattended run, answer five questions: what done looks like, how it checks itself, what it may touch,
  what stops it, where the result goes and who signs off.
- Steering: watch the first minute, `Esc` when it drifts, after two failed corrections `/clear` and write a better
  prompt. `/btw` asks a side question without adding to history.
- Cost: `/clear` between unrelated tasks; `/usage` breaks usage down by skill, subagent and MCP server; the prompt
  cache lasts about an hour on a subscription (5 minutes for subagents), and an idle session past ~200K tokens is
  compacted before the cache expires.
- Subagents give parallelism, a fresh reviewer, or fewer tools, not a smarter answer, and every one costs tokens;
  `model: haiku` for simple jobs.
- "What you can stop doing": IMPORTANT/ALL CAPS, "think hard" (use effort, or `ultrathink` for one turn), "keep
  going / don't be lazy", describing architecture and file layout in CLAUDE.md, subagents "to protect context".

**Memory** ([memory](https://code.claude.com/docs/en/memory)): CLAUDE.md under ~200 lines; `@path` imports load the
whole file every session (max 4 hops); `.claude/rules/*.md` without `paths` load every session like CLAUDE.md,
with `paths` only when matching files are touched; skills load only when used.

**Projects / cloud threads** ([claude-projects](https://code.claude.com/docs/en/claude-projects)), the setup Claude
Duet channels run on:
- A cloud thread loads each repository's root `CLAUDE.md`, `.claude/CLAUDE.md` and `.claude/rules/`. It does **not**
  load subdirectory `CLAUDE.md` files, path-scoped rules, `.claude/skills/`, `.claude/agents/`, commands,
  `.mcp.json`, or `.claude/settings.json` (permissions, hooks, env, plugins).
- Project instructions (up to 16,000 characters) are sent to every thread; project memory `MEMORY.md` is read at
  thread start. Repo rules belong in the repo's CLAUDE.md.
- New projects run threads on Opus at **high** effort, the fastest way to use the plan; change **Thread effort** in
  Project settings > General. A thread idle over an hour re-reads its whole conversation on a follow-up; threads
  watching a PR wake on CI failures and comments.
- When several threads guess or stall, fix the gap once in project instructions or the environment, send one thread,
  then the rest.

**Skills** ([skills](https://code.claude.com/docs/en/skills)): `/doctor prompt-audit` checks CLAUDE.md and skills for
outdated or conflicting instructions; `/skill-doctor` shows each skill's context cost; `/verify` can record its
recipe to `.claude/skills/verify/SKILL.md`, and a project `verify` skill makes Claude run it before each commit;
`disable-model-invocation: true` keeps a side-effect skill (deploy) from running on Claude's own initiative.

**Scheduled tasks** ([routines](https://code.claude.com/docs/en/routines)): runs start in auto mode; push to
`claude/` branches; protect `main` with a branch rule the task can't bypass; a missing GitHub connection skips runs
for up to 72 hours, then turns the task off.

**Auto-fix PRs** ([claude-code-on-the-web](https://code.claude.com/docs/en/claude-code-on-the-web#auto-fix-pull-requests)):
needs the Claude GitHub App on the repo; Claude can't see merge conflicts from base-branch moves, ask it to rebase.

# 3. Claude Duet (help center and users)

- [Get started with Claude Duet](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet) (read 18
  Nov, official): runs on Opus 5.5, model not selectable; channels share one memory; the Tasks tab tracks work and
  only the owner can mark a task complete; background work (morning brief, check-ins) counts against plan limits;
  research-preview limit resets (Pro: three) expire 15 Dec 2026; it can read your work in Claude but not change it.
- [Natalie Walls, "My First Day with Claude Duet"](https://nataliewalls.com/blog/first-day-with-claude-duet), 13 Nov
  (claim): a Cloudflare-stack site moved to D1 as a series of small PRs with a pre-merge check; asks in one line,
  bigger asks become tasks, code comes back as a PR after checks pass; dashboard steps (tokens, secrets) stay with
  the owner; about 75% of the weekly $20-plan limit in a heavy first stretch.
- [Duet Directory](https://duetdirectory.com/), read 12–18 Nov (claim, user reports it cites): unfinished tasks keep
  being reviewed every few hours and use limits; keep few channels (one reviewer kept three); scheduled runs can't
  use custom connectors.
- [Eric, "I Gave Claude Duet a Job Description"](https://promptedbyeric.substack.com/p/hire-duet-like-a-chief-of-staff),
  6 Nov (claim, before the window): write standing instructions; ask Duet to read them back every two weeks; "a task
  runs now, a wait needs a routine"; give a threshold and an undo for bulk changes.

# 4. Couldn't verify or reach

- Parallel's web search hit its free-tier rate limit; searches went through the built-in web search and page fetches.
- No official Anthropic post on Duet's Claude Code sessions was found; the feature is reported via the Duet Directory
  quoting the Duet team on X.
- The Hacker News thread and developersdigest playbook on Opus 5.5 that searches surfaced date from 22 Sept to 3 Oct,
  outside the window; their advice is already in [../CLAUDE-OPUS-5-5.md](../CLAUDE-OPUS-5-5.md).
- Whether `@path` imports in CLAUDE.md expand in cloud threads isn't stated; `.claude/rules/` without `paths` is, so
  that's what this repo uses for always-loaded guidance.
