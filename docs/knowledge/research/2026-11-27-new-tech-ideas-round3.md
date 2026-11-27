# New-tech feature ideas, round 3 (2026-11-27)

Third pass for the "original features with the newest techniques" experiment. Rounds 1 and 2 are in
[2026-11-23-new-tech-ideas.md](2026-11-23-new-tech-ideas.md); everything they built or proposed is excluded here
(WebMCP tools, the /mcp server, on-device Ask and Translate, exchange-gap history, voice price check, paid MCP tools,
listing /mcp, moment cards, liquidation tape, market memory, year rankings, citation box, compare pages).

Sources read on 2026-11-27: Chrome release notes 152, 153 and 154 (developer.chrome.com), the Chrome 158 summary on
web-standards.dev and azeemhassni.com (Chrome's own 155+ notes moved to chromestatus.com and were not opened), Chrome
built-in AI docs (Prompt API page last updated 26 Aug 2026), the WebMCP docs and an independent WebMCP status write-up
(c9group.dev, 21 Nov), the Cloudflare changelog and blog to 25 Nov.

## What changed that matters here

- **Prompt API on the open web with structured output** (stable since Chrome 148): `responseConstraint` takes a JSON
  Schema, so the model can be limited to emitting a filter object instead of prose.
- **Chrome ships every two weeks from 153.** 152: CPU Performance API, Connection Allowlists header. 153: `<camera>`
  and `<microphone>` elements, `Iterator.zip`. 154: responsively-sized iframes (the parent sizes an iframe to its
  content), `scroll-marker-group: tabs`, light-dismiss on click. 158 (12 Nov): Web Install API, `navigator.install()`
  and the `<install>` element (desktop only).
- **WebMCP:** origin trial extended to Chrome 162 (ends 30 Mar 2027); the declarative form API was dropped from the
  spec on 8 Oct; the ChatGPT desktop app calls page tools; Gemini in Chrome does not yet in stable.
- **Cloudflare Search for Agents** (25 Nov, beta, all plans): a dashboard toggle gives the site `/.well-known/search`
  for agents (GET or HTTP QUERY, RFC 10008) and adds `agent:*` meta tags to every page. AI Search billing starts
  1 Dec with a monthly free allowance. Also: Workers Rate Limiting binding counts weighted requests (4 Nov), Temporal
  API in Workers (2 Nov), EmbeddingGemma 2 on Workers AI (12 Nov).

## Ranked ideas

| # | Idea | Why it's new | Effort | Cost / settings |
|---|------|--------------|--------|-----------------|
| 1 | **Plain-words filter on the home table**: "AI coins down 5% this week", "large caps up today", "top 10 losers". A rule reader in every browser; for sentences it can't read, the on-device Prompt API with a JSON Schema that only allows filter conditions. The filter is shown as chips above the table, so every row can be checked. **Built (this PR).** | No price site filters its table from a sentence, and none does it on the device. The AI writes no page text. | Medium | None |
| 2 | **Depth and slippage on coin pages**: "buying $10,000 of SOL right now costs about X% more than the price on Coinbase, Y% on Kraken", from the exchanges' public order books on demand. | Unique, checkable numbers (goal 3); free sites show depth only as a ±2% figure per exchange. | Medium | None (public REST) |
| 3 | **Install the price app with one click** (`<install>` element / `navigator.install()`, Chrome 158 desktop), falling back to today's prompt. | New standard API replaces the non-standard install event. | Low | None |
| 4 | **Widgets that size themselves** (responsively-sized iframes, Chrome 154): the embed snippet opts in, so a site that embeds a ticker never shows a scroll bar or empty space. | Removes the most common embed complaint. | Low | None |
| 5 | **Search for Agents + Markdown for Agents** on the zone, so agents can search the site without crawling it. | One toggle; pairs with /mcp. | Very low | Owner's Cloudflare setting; injects tags (check CSP); billing from 1 Dec beyond the free allowance |
| 6 | **Light devices stay light**: the CPU Performance API (152) turns off Market TV animation and slows the table's redraw on low-tier CPUs. | Device-aware performance without user-agent sniffing. | Low | None |

Not recommended now: `<camera>` for scanning a wallet QR code (privacy questions for little gain), Connection
Allowlists (the CSP `connect-src` already limits endpoints), Kitesurf or Browser Run for share images (paid or
experimental).

## Owner decisions this raises

- Idea 5 changes Cloudflare settings and adds markup to every page: needs the owner's yes.
- The plain-words filter uses the on-device model only when the visitor presses "Read it with on-device AI"; it writes
  no text onto the page, so it fits the "no AI filler on published pages" reading the owner confirmed on 23 Nov.
