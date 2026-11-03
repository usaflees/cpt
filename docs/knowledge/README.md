# Knowledge base

Everything learned while building and optimising cryptopriceticker.com, in one place, for the owner and for
Claude sessions (interactive and scheduled). Start with the playbook; open the research notes only when you need
the evidence behind a rule.

| File | What it holds | Update when |
| --- | --- | --- |
| [../STRATEGY.md](../STRATEGY.md) | **The roadmap**: measured baseline, pillars A–F, prioritized backlog, what we decided against, KPIs | Roadmap items ship or priorities change |
| [../NEWS-AND-MONETIZATION.md](../NEWS-AND-MONETIZATION.md) | News block and phased, compliance-gated monetization plan; decisions only the owner can make | Owner decisions, phase changes |
| [PLAYBOOK.md](PLAYBOOK.md) | The working rules: SEO, content, performance, accessibility, growth, measurement, security, each marked done / owner action / next / don't | A rule changes or a "next" item ships |
| [DECISIONS.md](DECISIONS.md) | Dated decision log with the reason and source for each choice | Any non-obvious choice is made or reversed |
| [STATE.md](STATE.md) | Snapshot of the live site: pages, features, scores, QA results, open owner actions, known trade-offs | After each release |
| [CLAUDE-OPUS-5-5.md](CLAUDE-OPUS-5-5.md) | How to get the most out of Claude Opus 5.5 and Claude Code on this project: effort levels, scheduled tasks, prompting, verification | New model or Claude Code features |
| [RETROSPECTIVE.md](RETROSPECTIVE.md) | What we did Oct 29 – Nov 3, what it achieved (before/after), what went wrong and the lessons | After a major round of work |
| [research/](research/README.md) | Raw, sourced research snapshots (web crawls of Google, Bing, Cloudflare, Anthropic and practitioner sources) | New research round (add a new dated file; don't rewrite old ones) |

Related, outside this folder:
- [../../CLAUDE.md](../../CLAUDE.md): the short instructions every Claude session in this repo loads.
- [../SELF-IMPROVING.md](../SELF-IMPROVING.md): the rules the automated loop follows.
- [../WEEKLY-TASK.md](../WEEKLY-TASK.md): copy of the scheduled task's prompt.
- [../LAUNCH-KIT.md](../LAUNCH-KIT.md): launch checklist, venues and post skeletons.
- [../AUDIT.md](../AUDIT.md): the original audit (October 2026), kept as history.
- [../../tests/README.md](../../tests/README.md): the QA suite (`bash tests/run.sh`).

## How to use it
- **Before changing the site:** read the relevant PLAYBOOK section and check DECISIONS for a past call on the same thing.
- **After a release:** update STATE.md (scores, page count, open items) and tick PLAYBOOK items that shipped.
- **New research:** save it as `research/YYYY-MM-DD-topic.md` with sources inline, then fold any changed rule into
  PLAYBOOK.md and log the decision. Research files are snapshots: correct a mistake with a note, don't rewrite them.
- This repo is **public**. Never add search queries, analytics exports, credentials or personal data here; they
  belong in the private `usaflees/cpt-telemetry` repo.
