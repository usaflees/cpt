# Working with Claude Code on this repo

Loaded in every session, cloud and Claude Duet threads included. Full guide and sources:
`docs/knowledge/CLAUDE-CODE-WORKFLOW.md`.

- Cloud and Duet threads don't load `.claude/skills/`, agents, hooks or `.claude/settings.json`. Open a procedure
  by its path (shipping: `.claude/skills/ship/SKILL.md`). Must-always rules are enforced by CI, not hooks.
- Building something visitors will see: follow the feature recipe in section 2 of the guide. State the finish line
  as named checks, check after each part, and paste each command with its summary line as evidence.
- One thread, one feature, one draft PR on a `claude/` branch. Before pushing, name any open PR that touches the
  same files.
- Before handing a PR to the owner, have a subagent that didn't write it review the diff against the spec: only
  gaps that affect correctness, users or the CLAUDE.md rules, with file and line; skip style.
- In research and audits, mark anything you couldn't confirm and say where you looked.
- Write instructions plainly: no IMPORTANT, capitals or "think hard". Use effort, or `ultrathink` for one turn.
