# Open source and platform releases, Oct 24 – Nov 23, 2026: what could help this site (2026-11-23)

Question from the owner: which recent open source releases for Claude Code, AI tooling and Cloudflare could help
cryptopriceticker.com? Method: Parallel web searches, then direct reads of release pages and official blogs (GitHub
releases for anthropics/claude-code, claude-agent-sdk-typescript, anthropic-sdk-typescript, cloudflare/agents,
vercel/ai, huggingface/transformers.js; code.claude.com; the MCP blog; developers.cloudflare.com changelogs;
blog.cloudflare.com). Owner-facing copy: the Claude Doc "Open source releases for CryptoPriceTicker".

These are **possibilities**, not queued work. Each candidate also has a line in `facts.jsonl` (status `watch` with a
review date, or `info`). Before building one, check it against the indexing rule (`docs/INDEXING-PLAN.md`: no new
URL families), the CSP and size budgets, and the no-fake-data rule, and put it through `docs/QUEUE.md`.

Verdicts: **use now** fits the site today with no new account or binding; **later** needs a binding, paid usage
or an owner decision; **watch** is not a fit yet.

## Top 5 for this site

1. **A public MCP server for coin data (later).** The MCP TypeScript SDK 2.x (`@modelcontextprotocol/server`,
   2.4.0 on Oct 23) implements the stateless 2026-07-28 spec: no `initialize` handshake, no sessions, so one Pages
   Function can answer each request on its own. The spec is frozen until the next release, targeted for
   2027-03-30 under the new six-month cycle ([MCP blog, Nov 11](https://blog.modelcontextprotocol.io/posts/mcp-release-cycle/)).
   Agents could query prices, supply and stats from the build snapshot. One endpoint (for example `/mcp`), served
   `noindex`, is not a new page family. **Already in progress:** draft PR #23 adds a hand-written stateless MCP
   endpoint at `/mcp` (no SDK, so the site keeps no build step) plus WebMCP tools; build on that PR rather than
   starting again. The SDK stays the reference for the spec.
2. **Workers and Pages keep versions for 30 days (use now).** Since Nov 19, Pages deployments older than 30 days
   are deleted, except the 100 most recent and production, and their preview URLs stop working
   ([changelog](https://developers.cloudflare.com/changelog/post/2026-11-19-workers-pages-version-retention/)).
   Production is unaffected. Preview URLs recorded in `docs/` as evidence will go dead: cite commit SHAs or PR
   numbers instead.
3. **EmbeddingGemma 2 on Workers AI (later).** Open multimodal embedding model, 768 dimensions, $0.0017 per million
   input tokens ([changelog, Nov 12](https://developers.cloudflare.com/changelog/post/2026-11-12-embeddinggemma-2-workers-ai/)).
   Embeddings computed once in the build (114 coins) could drive "similar coins" links and search with no model
   call at page load. Needs an account API token in CI.
4. **Kitesurf open source and Browser Run /snapshot (later).** Kitesurf, Cloudflare's browser engine for agents,
   is open source under Apache 2.0 ([blog, Nov 13](https://blog.cloudflare.com/kitesurf-open-source/),
   [repo](https://github.com/cloudflare/kitesurf)); it runs on Workers, speaks CDP and supports WebMCP. Browser Run
   /snapshot now returns links, scraped elements, PDF and extracted JSON from one load
   ([changelog, Nov 19](https://developers.cloudflare.com/changelog/post/2026-11-19-snapshot-all-formats/)). Either
   could extend `scripts/seo-audit.mjs` to rendered pages (what crawlers and agents see after JavaScript).
5. **Claude Code 2.1.321–2.1.329 (use now, owner's local install).** 2.1.321 fixes MCP OAuth sending refresh tokens
   to another host on a redirect; 2.1.327 `/status` lists broken skill, agent and command files and
   `claude mcp add-json <name> -` reads a server's JSON from stdin; 2.1.329 `/tasks` lists scheduled tasks and
   `/loop` wakeups ([releases](https://github.com/anthropics/claude-code/releases)).

Runner-up: **Clairic-flash** (9B) and Clairic, Cloudflare's extraction models, now open-weight and on Workers AI
([blog, Nov 18](https://blog.cloudflare.com/open-clairic/)). They return typed values from text, images and PDFs,
so they could draft supply or unlock data for `content/*.json`; every value would still need a human check.

## Claude Code and MCP

| Date | Release | For this site |
| --- | --- | --- |
| Nov 20 | Claude Code 2.1.330: easel mod draws charts on request (macOS/Linux) | Watch |
| Nov 20 | Claude Agent SDK (TS) 0.3.330; recent releases made hook options arrays and stopped auto-approving sandboxed Bash without `autoAllowBashIfSandboxed` | Watch; pin versions if we ever run our own agent |
| Nov 19 | Claude Code 2.1.329: `/tasks` shows scheduled tasks and `/loop` wakeups; `/mcp` shows a remote server's refusal message | Use now |
| Nov 17 | Claude Code 2.1.327: `/status` lists broken skills/agents/commands; `mcp add-json` from stdin; fix for `claude mcp add` deleting keys in `.mcp.json` | Use now |
| Nov 17 | Anthropic TS SDK 1.10.0 (docs and renames) | Watch; we make no API calls |
| Nov 12 | Claude Code 2.1.323: Code Mode (experimental; see fact `claude-code-mode`), `engines["claude-code"]` in `plugin.json`, typed plugin hook checks | Later, local terminal only |
| Nov 11 | MCP moves to two spec releases a year; next is 2027-03-30 | Background |
| Nov 9 | Claude Code 2.1.321: Claude Fable 5.2; MCP OAuth redirect fix | Use now (update) |
| Nov 6 | Claude Code 2.1.319: MCP task calls run in the background; `permissions.denyInsteadOfPrompting` | Later; settings are owner-only here |
| Oct 30 | MCP Ruby SDK reaches Tier 1 (six Tier 1 SDKs) | Background |
| Oct 23 | MCP TypeScript SDK 2.4.0 (split packages, stateless spec, Skills over MCP) | Later: top pick 1 |

## AI tooling for a website

Downloaded in-browser models (Transformers.js, WebLLM) still cost megabytes against seo-lint's size budgets.
Models built into the browser are different: Chrome's Prompt API and Edge's Prompt API trial need no download, and
draft PR #23 uses them for "Ask" and "Translate" on coin pages (its facts `chrome-prompt-api-web` and
`edge-prompt-api-trial` land with that PR). Otherwise, server-side models on Workers AI fit better.

| Date | Release | For this site |
| --- | --- | --- |
| Nov 20 | Vercel AI SDK 7.0.179 (Apache 2.0; v7 is ESM-only, Node 22) | Later; Workers AI's binding is simpler for one model |
| Oct 28 | Transformers.js 4.3.2 (adds LFM3 support) | Watch; only as an opt-in page loaded on demand |

Background, before the window: Chrome's WebMCP origin trial (June 9, 2026) lets a page register tools for browser
agents; Kitesurf added WebMCP support in September.

## Cloudflare

| Date | Release | For this site |
| --- | --- | --- |
| Nov 20 | Agents SDK 0.34.0 (Pi 1.6: tools that wait without keeping the agent awake); 0.33.0 on Nov 3; Agent Skills as files on Oct 29 | Watch |
| Nov 20 | Browser Run `/script`; `/snapshot` formats on Nov 19 | Later: top pick 4 |
| Nov 19 | Workers and Pages keep versions for 30 days | Use now: top pick 2 |
| Nov 19 | Durable Object reliability during runtime updates; automatic DO retries on Nov 5 | Watch; no DOs here |
| Nov 18 | Clairic and Clairic-flash open weights | Later: runner-up |
| Nov 17 | Cloudflare CLI (`cf`) 1.0 release candidate | Watch; we deploy by Git push |
| Nov 17 | Compatibility date 2026-11-17+ turns on the new module registry and `request.signal` by default (announced Nov 2) | Only if the Pages project's compatibility date is moved (dashboard setting); run full QA on a preview if so |
| Nov 13 | Kitesurf open source (Apache 2.0) | Later: top pick 4 |
| Nov 12 | EmbeddingGemma 2 on Workers AI | Later: top pick 3 |
| Nov 12 | AI Search can index a D1 database (beta); AI Search billing starts Dec 1 | Watch; no D1 here |
| Nov 4 | D1 enforces a 50 MB query result limit | Not applicable |
| Nov 3 | New AI Gateways require authentication (can't be turned off) | If we add a gateway, the Function needs its token as a secret |

## Not confirmed

- Claude Code versions come from GitHub release pages and the changelog RSS; a direct read of the docs changelog
  stopped at 2.1.311, so small releases in between may be missing.
- `modelcontextprotocol/servers` v2.3.0–v2.5.0 (Nov 4–18) appeared in a search result but not on a direct read of
  the releases page (date-tagged releases through Aug 31 only). Left out.
- Clairic's weights license and the full model's size were not stated in what was read.
- Licenses were confirmed only for Kitesurf and the Vercel AI SDK (Apache 2.0).
- Cloudflare items dated Oct 26 – Nov 5 came from a summarized read of a long changelog page; titles and links are
  exact, details should be re-checked before acting.
- The Pages project's compatibility date is in the Cloudflare dashboard and was not checked.
