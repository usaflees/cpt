> **Research snapshot, 2026-11-02.** Claude Opus 5.5, Claude Code features relevant to maintaining this site, and
> search news from mid-October to early November 2026. Current guidance: [../CLAUDE-OPUS-5-5.md](../CLAUDE-OPUS-5-5.md)
> and [../PLAYBOOK.md](../PLAYBOOK.md).

# Claude Opus 5.5 and Claude Code

## Model facts
- Released Sept 22, 2026; ID `claude-opus-5-5`; 1M context; 128K max output (300K on Batch, beta); $4 / $20 per
  MTok; cache read $0.20; Batch 50% off; adaptive thinking always on (can't be disabled; `thinking: disabled` returns
  400); default effort `medium`; reliable knowledge cutoff June 2026; retirement not before Sept 22, 2027.
  — [Opus 5.5 overview](https://platform.claude.com/docs/en/models/opus-5-5/overview),
  [What's new](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5)
- "Performs at the level of Claude Fable 5.1 on most work and costs 40% less to run than Opus 5." At default
  effort (medium) it beats Opus 5 at max on Anthropic's coding benchmark "for about a fifth of the cost."
  — [Introducing Claude Opus 5.5](https://www.anthropic.com/news/claude-opus-5-5)
- Generates output >30% faster than Opus 5 and uses fewer tokens per task. Strongest on multistep work in a real
  repository; sustains multi-hour audits and migrations with parallel subagents.
  — [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)

## Effort
- Levels: `low`, `medium` (default on Opus 5.5 and Haiku 5.5), `high` (default elsewhere), `xhigh` (between high and
  max; available on Opus 4.7 and newer), `max`. Effort affects all output tokens, including tool calls.
  — [Effort](https://platform.claude.com/docs/en/build-with-claude/effort)
- Opus 5.5 guidance: start at `medium` for well-specified agentic coding, move to `high` for harder or longer tasks;
  use `xhigh`/`max` only where evals show a gain; set a large `max_tokens` at high levels (thinking counts toward
  it); lowering effort reduces thinking more reliably than prompt instructions; changing top-level effort between
  requests invalidates the prompt cache (per-message effort, beta, keeps it).
  — [Effort](https://platform.claude.com/docs/en/build-with-claude/effort),
  [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
- Claude Code's table: `low` quick exchanges you review; `medium` day-to-day work with clear scope; `high` work
  where verification matters or edge cases are likely (e.g. a bug in existing code); `xhigh` deeper reasoning at
  higher token spend; `max` hard problems Claude works through alone (e.g. security), "may show diminishing
  returns and is prone to overthinking"; `ultracode` is a Claude Code setting, not a level, that "plans a dynamic
  workflow for each substantive task at any effort level". `claude --effort ultracode` turns it on at `xhigh`
  (Claude Code v2.1.203+). Settings: `effortLevel` (`low`–`xhigh`; `max` not accepted there), `ultracode: true`.
  — [Model configuration](https://code.claude.com/docs/en/model-config)
- Claude apps: "Extra high (xhigh) is designed for long-running coding and agentic tasks, offering deeper reasoning
  than high without the full token cost of max." — [Change the model, effort, and thinking settings](https://support.claude.com/en/articles/8664678-change-the-model-effort-and-thinking-settings)
- A reviewer (secondhand, via Anthropic) saw Opus 5.5 at the lowest effort find more bugs in code review than Opus 5
  at high, with fewer false alarms. — [Giallo Studio, Sept 23, 2026](https://giallostudio.it/en/blog/claude-opus-5-5-code-review) (low confidence: secondary source)

## Prompting and long runs
- Hand over the whole task, say what "done" looks like and when to stop; delete "think carefully" lines; name the
  early stops to avoid ("a summary that announces the next step instead of taking it", offers to continue,
  non-blocking option lists) and the stops you want (before destructive actions); put status notes in the same
  message as the next action; keep the task list in a file; split audits across subagents and check their
  evidence; for design, list the specific patterns to avoid; don't request internal reasoning in the reply
  (`reasoning_extraction` refusal category). — [Getting the most out of Opus 5.5 (Addy Osmani, Sept 22, 2026)](https://claude.dev/blog/getting-the-most-out-of-opus-5-5/)
- In Anthropic's tests the "keep going" instruction roughly halved the share of agentic tasks with a long silent
  stretch, with no measurable cost change; keep your own confirmation for risky actions.
  — [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)

## Claude Code practices
- "Give Claude a check it can run: tests, a build, a screenshot to compare." Options from soft to strict: in the
  prompt, `/goal` (a separate model checks a condition after every turn), a `Stop` hook (Claude Code ends the turn
  after 8 consecutive blocks), a second-opinion subagent or dynamic workflow. `/verify` builds and runs the app.
  — [Best practices](https://code.claude.com/docs/en/best-practices)
- Deterministic vs not: prompts, CLAUDE.md and skills are Claude's call; hooks, deny rules, sandbox, tests, CI and
  branch protection are enforced. "If you keep adding emphasis to a CLAUDE.md line and Claude still misses it,
  that's a sign the line belongs in a hook." — [Best practices](https://code.claude.com/docs/en/best-practices)
- CLAUDE.md: keep it short, only what Claude can't learn from the code: how to confirm work (exact commands),
  misleading places, decisions not in the repo, anything corrected twice. Don't describe architecture (Claude reads
  the repo). Aim under ~200 lines. — [Best practices](https://code.claude.com/docs/en/best-practices),
  [Give Claude context](https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts)
- "Tell Claude to keep going / don't be lazy" is outdated advice that can cause over-work; current defaults are Opus
  5.5 at medium in auto mode with automatic compaction. — [Best practices](https://code.claude.com/docs/en/best-practices)
- Skills: repeated workflows go in `.claude/skills/<name>/SKILL.md`; hooks such as PostToolUse auto-format and
  PostCompact re-inject instructions. — [Power user tips](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips),
  [Steering Claude Code (June 18, 2026)](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more)
- Web design: Anthropic's `frontend-design` plugin (verified; ~1.1M installs) sets an aesthetic direction before
  coding; the `playwright` plugin lets Claude screenshot and test pages; Claude in Chrome and the desktop Browser
  pane can auto-verify UI changes. — [frontend-design](https://claude.com/marketplace/plugins/frontend-design),
  [Desktop app](https://code.claude.com/docs/en/desktop), [Subframe guide (Oct 10, 2026)](https://www.subframe.com/tips/claude-code-frontend-design)

## Scheduled tasks
- Saved prompt + repositories + connectors, run on Anthropic's cloud; Pro, Max, Ultra, Team, Enterprise; research
  preview. Repos are cloned per run; Claude pushes `claude/`-prefixed branches. Select a model **and effort level**
  in the prompt box's model selector. All connectors are included by default (with writes); remove unneeded ones.
  Runs start in auto mode. Commits and PRs appear as the owner. Limits: no schedule more often than hourly;
  100 scheduled runs per hour per account; Run now/API 30 per hour per task. Usage limits apply; with usage credits
  on, runs can continue on metered overage. — [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines)

# Search news, mid-October to early November 2026
- No Google core update since the one that ran May 21 to June 2; the September spam update ran Sept 24 to Oct 8;
  unconfirmed volatility mid/late October. — [LoopLoop, Oct 30, 2026](https://www.getlooploop.com/news/google-search-in-october-2026-the-ai-answer-took-the-page)
- Oct 15: AI Mode and AI Overviews add more inline links, dedicated "official websites" sections and news carousels;
  Preferred Sources usage up 7× since January. — [Google blog](https://blog.google/products-and-platforms/products/search/updates-ai-mode-overviews-explore-web)
- Oct 26: Search Central docs updated guidance on preventing user-generated spam; Oct 2026 also updated guidance on
  using generative AI content. — [Search Central: what's new](https://developers.google.com/search/updates)
- Oct 30: Google, Microsoft, OpenAI and Anthropic back one robots.txt AI-training opt-out (`__usage_ai-training`,
  IETF draft). Google will treat it like disallowing Google-Extended (doesn't affect Search) and aims to support it
  in 2027; Bing applies its new training/grounding preferences from Feb 1, 2027.
  — [Search Central blog](https://developers.google.com/search/blog/2026/10/ai-training-control),
  [PPC Land](https://ppc.land/google-microsoft-openai-and-anthropic-back-one-ai-training-opt-out/),
  [fireup.pro](https://fireup.pro/news/ai-training-opt-out-robots-txt)
- Oct 13: Bing Webmaster Tools' AI Performance report adds "Topics Portfolio", grouping queries a site is cited for
  in Copilot and Bing AI answers. — [LoopLoop](https://www.getlooploop.com/news/google-search-in-october-2026-the-ai-answer-took-the-page)
- Search Console added a filter for searches that combine images and text. — [Yoast, Oct 28, 2026](https://yoast.com/the-october-2026-seo-update-by-yoast-recap/)
- Anthropic's usage policy (published Oct 8, effective Nov 12, 2026) bars using Claude to seed the sources AI answers
  draw from with manipulative content. — [LoopLoop](https://www.getlooploop.com/news/google-search-in-october-2026-the-ai-answer-took-the-page) (secondary; check the policy text before relying on details)
