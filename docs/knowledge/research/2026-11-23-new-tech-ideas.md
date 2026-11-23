# New-tech feature ideas, round 2 (2026-11-23)

Second research pass for the "original features with the newest techniques" experiment (draft PR on
`claude/project-thread-ea07mk`). Round 1 ranked five ideas and the PR builds the first four: WebMCP tools
(`assets/agent.js`), a public MCP server (`functions/mcp.js`), on-device "Ask about this coin" and on-device
translation of the About section (`assets/ondevice.js`). This pass looked for what else is newly possible.

Sources read on 2026-11-23: Cloudflare changelog (AI, Workers, Pages; entries to 20 Nov), Cloudflare x402 docs and
the Monetization Gateway post (1 Jul), Chrome release notes 147–152, web.dev "New to the web platform" (Apr, Jun),
Chrome built-in AI docs, the Microsoft Edge blog (19 Nov) and Edge Prompt API docs. Chrome release notes after 152
were not checked (search quota ran out); anything marked "unconfirmed" below needs a re-check before building.

## What changed that matters here

- **Edge joined the Prompt API.** Edge opened a Prompt API origin trial on 19 Nov with its own on-device model (Aion
  Instruct, 2.3B). Same `LanguageModel` interface, so `assets/ondevice.js` runs unchanged once an Edge trial token is
  on the page. From Edge 158 the text carries an invisible "AI output" watermark. Chrome has had it stable since 148
  (desktop only, about 22 GB free disk).
- **Paying agents is real infrastructure now.** Cloudflare's Monetization Gateway (announced 1 Jul) and the Agents
  SDK `paidTool` charge per request or per MCP tool call over x402 (stablecoin settlement). Pay-per-crawl is in
  closed beta with Cloudflare as merchant of record.
- **On-device speech has a quality level.** Chrome 150 adds `quality` (`command`, `dictation`, `conversation`) to
  `SpeechRecognition` with `processLocally: true`, so a page can check whether the device can recognise speech
  without sending audio to a server.
- **CSS/UI:** element-scoped view transitions (147), `contrast-color()` (147, Baseline), gap decorations (149),
  `text-fit` and `background-clip: border-area` (150), `focusgroup` (150), speculation rules `form_submission` (151).
- **Cloudflare Workers:** `request.signal` on by default and the new module registry from compatibility date
  2026-11-17; Workers and Pages keep old versions 30 days (preview URLs of deleted deployments stop working).
  Cloudflare's docs now say "start new projects with Workers"; Pages is still supported.

## Ranked ideas (impact vs effort)

| # | Idea | Impact | Effort | Cost / settings |
|---|------|--------|--------|-----------------|
| 1 | **Exchange-gap history**: a scheduled Worker records the BTC/ETH/SOL… price gap between Coinbase, Kraken and Binance every few minutes into D1, and coin pages show "widest gap this week" with a chart. Unique, verifiable data nobody shows for free (goal 3). | High | Medium | New Worker with a cron trigger and a D1 database (free tier fits). Owner decision: Cloudflare settings. |
| 2 | **Voice price check** on coin and home pages: a mic button, on-device `SpeechRecognition` (`processLocally`, `quality: "command"`), answers read aloud with `speechSynthesis` from the live numbers ("Solana is 142 dollars, down 6 percent today"). No audio leaves the device; no model text. | Medium | Low | None. Chrome 150+ desktop and Android where local recognition is available (unconfirmed per device). |
| 3 | **Edge origin trial** for the Prompt API so "Ask about this coin" also works in Edge. | Medium | Very low | Owner registers the trial (free, sign-in). |
| 4 | **Paid premium MCP tools** (x402 via Cloudflare): keep today's tools free, charge agents a fraction of a cent for heavy ones (gap history, full monthly series). First revenue line that doesn't need AdSense. | Medium (unproven demand) | Medium | Needs a wallet and Cloudflare Monetization Gateway access. Conflicts with CLAUDE.md goal 4 ("revenue only after AdSense approves"): owner decision. |
| 5 | **List `/mcp` where agents look**: `/.well-known/` server card, a line in `llms.txt`, and the public MCP registry. | Medium | Very low | Registry listing needs the owner's account (posting). |
| 6 | **Exchange table polish**: element-scoped view transitions so rows glide when exchanges re-rank on coin pages, `text-fit` for the hero price on phones, `contrast-color()` for change pills on custom themes. | Low | Low | None. |

Not recommended now: server-side price alerts with Web Push (competitors already have it; needs state and push
keys), Summarizer/Writer text on pages (conflicts with the "no AI filler" decision), Browser Run snapshots (paid).

## Owner decisions this raises

- On-device AI answers are generated text. They are never in the HTML, never stored and labelled as AI, but the
  repo's "no AI filler" decision should be read as covering published pages only before this ships.
- Chrome WebMCP trial token and (idea 3) an Edge Prompt API trial token.
- Whether agent-paid tools (idea 4) count as "revenue before AdSense".
- Idea 1 needs a new Cloudflare Worker with a cron and a D1 database.
