// CryptoPriceTicker.com public MCP server (experimental): https://cryptopriceticker.com/mcp
//
// Lets AI apps that support remote MCP connectors (Claude, ChatGPT, IDE agents) ask the site for its own
// computed coin data and a live two-exchange quote. Stateless Streamable HTTP: each POST is one JSON-RPC
// message answered with one JSON body; no sessions, no auth, no storage, no cookies, no logging.
// Hand-written (no SDK) so the site keeps having no build step and no dependencies.
//
// Data:
//   /content/coin-stats.json  weekly computed stats (closes, changes, 52-week range, volatility, drawdown,
//                             monthly closes), read through env.ASSETS so it never leaves the private /content
//                             path except as these tool answers
//   /assets/coins.js          the coin registry (name, sectors, exchanges)
//   Coinbase Exchange and Kraken public tickers, fetched only by get_live_price and cached 20 s at the edge
//
// Runs only for /mcp (listed in /_routes.json); every other request never invokes a Function.
const SITE = "https://cryptopriceticker.com";
// Newest first; Cloudflare's own MCP servers list 2026-07-28 support (developers.cloudflare.com, read 2026-11-23).
const VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SECTORS = ["L1", "L2", "DePIN", "AI", "DeFi", "RWA", "Privacy", "Gaming", "Meme", "Stable"];
const KRAKEN_REST = { BTC: "XBT", DOGE: "XDG" }; // Kraken's REST names that differ from the ticker
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id, authorization", "access-control-expose-headers": "mcp-protocol-version" };

const page = sym => `${SITE}/coin/${sym.toLowerCase()}/`;
const num = v => (typeof v === "number" && isFinite(v) ? v : null);

// ---------- Data (cached per isolate for 10 minutes) ----------
let cache = null;
async function loadData(env, origin) {
  if (cache && Date.now() - cache.at < 600e3) return cache;
  const get = async path => { const r = await env.ASSETS.fetch(new URL(path, origin)); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.text(); };
  const [statsText, coinsText] = await Promise.all([get("/content/coin-stats.json"), get("/assets/coins.js")]);
  const stats = JSON.parse(statsText);
  // coins.js is one object literal per line (generated format); Workers can't eval, so read the fields we need.
  const coins = [];
  for (const line of coinsText.split("\n")) {
    const sym = /\bsym: "([A-Z0-9]+)"/.exec(line);
    if (!sym) continue;
    const field = re => (re.exec(line) || [])[1];
    const list = s => (s ? s.split(",").map(x => x.trim().replace(/"/g, "")).filter(Boolean) : []);
    const tickers = {};
    for (const [, ex, t] of (field(/tickers: \{([^}]*)\}/) || "").matchAll(/(CB|BN|KR): "([A-Z0-9]+)"/g)) tickers[ex] = t;
    coins.push({ sym: sym[1], name: field(/\bname: "([^"]+)"/), sectors: list(field(/sectors: \[([^\]]*)\]/)), feeds: list(field(/feeds: \[([^\]]*)\]/)), tickers });
  }
  cache = { at: Date.now(), updated: stats.updated, stats: stats.coins || {}, coins, bySym: new Map(coins.map(c => [c.sym, c])) };
  return cache;
}

function statsView(d, c) {
  const s = d.stats[c.sym];
  if (!s) return { symbol: c.sym, name: c.name, page: page(c.sym), stats: null, note: "No daily history computed for this coin yet." };
  const monthly = (s.monthly || []).filter(m => num(m.change) !== null);
  const best = monthly.reduce((a, m) => (!a || m.change > a.change ? m : a), null);
  const worst = monthly.reduce((a, m) => (!a || m.change < a.change ? m : a), null);
  return {
    symbol: c.sym, name: c.name, sectors: c.sectors, page: page(c.sym),
    as_of: s.asOf, source: s.source, close_usd: num(s.close),
    change_pct: { "7d": num(s.change7d), "30d": num(s.change30d), "90d": num(s.change90d), "1y": num(s.change1y) },
    high_52w: { usd: num(s.high52w), date: s.high52wDate || null }, low_52w: { usd: num(s.low52w), date: s.low52wDate || null },
    volatility_30d_pct: num(s.volatility30d),
    max_drawdown_1y: { pct: num(s.maxDrawdown1y), from: s.maxDrawdownFrom || null, to: s.maxDrawdownTo || null },
    best_month: best && { month: best.month, change_pct: best.change }, worst_month: worst && { month: worst.month, change_pct: worst.change }
  };
}
const median = xs => { const v = xs.filter(x => x !== null).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return Math.round((v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) * 100) / 100; };

async function quote(c, ex) {
  const t = c.tickers[ex] || c.sym;
  const url = ex === "CB" ? `https://api.exchange.coinbase.com/products/${t}-USD/ticker` : `https://api.kraken.com/0/public/Ticker?pair=${KRAKEN_REST[t] || t}USD`;
  const req = new Request(url, { headers: { "user-agent": "cryptopriceticker.com MCP", accept: "application/json" } });
  const edge = typeof caches !== "undefined" ? caches.default : null;
  let res = edge && (await edge.match(req));
  if (!res) {
    res = await fetch(req, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    res = new Response(res.body, res); res.headers.set("cache-control", "public, max-age=20");
    if (edge) await edge.put(req, res.clone());
  }
  const j = await res.json();
  const p = ex === "CB" ? parseFloat(j.price) : parseFloat(Object.values(j.result || {})[0]?.c?.[0]);
  return p > 0 ? p : null;
}

// ---------- Tools ----------
const symbolList = { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10, description: "Ticker symbols, e.g. [\"BTC\",\"SOL\"]" };
const TOOLS = [
  {
    name: "list_coins",
    title: "List tracked coins",
    description: "The coins CryptoPriceTicker.com tracks (about 115), with name, sectors and page, optionally filtered to one sector.",
    inputSchema: { type: "object", properties: { sector: { type: "string", enum: SECTORS } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (d, { sector }) => ({ coins: d.coins.filter(c => !sector || c.sectors.includes(sector)).map(c => ({ symbol: c.sym, name: c.name, sectors: c.sectors, page: page(c.sym) })) })
  },
  {
    name: "get_coin_stats",
    title: "Coin performance stats",
    description: "Computed from a year of daily closes: last weekly close, 7d/30d/90d/1y change, 52-week high and low with dates, 30-day volatility, largest fall in the year with dates, best and worst month. Dated; refreshed weekly. Not live prices: use get_live_price for those.",
    inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (d, { symbol }) => { const c = d.bySym.get(String(symbol || "").toUpperCase()); return c ? statsView(d, c) : { error: `Unknown symbol ${symbol}; call list_coins.` }; }
  },
  {
    name: "compare_coins",
    title: "Compare coins",
    description: "Side-by-side performance of 2 to 5 coins from the same dated stats as get_coin_stats: changes, volatility, largest fall and 52-week range.",
    inputSchema: { type: "object", properties: { symbols: { ...symbolList, minItems: 2, maxItems: 5 } }, required: ["symbols"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (d, { symbols }) => {
      const list = (Array.isArray(symbols) ? symbols : []).slice(0, 5).map(s => d.bySym.get(String(s).toUpperCase()));
      if (list.length < 2 || list.some(c => !c)) return { error: "Give 2 to 5 known symbols; call list_coins." };
      return { coins: list.map(c => { const v = statsView(d, c); return { symbol: v.symbol, name: v.name, as_of: v.as_of || null, change_pct: v.change_pct || null, volatility_30d_pct: v.volatility_30d_pct ?? null, max_drawdown_1y_pct: v.max_drawdown_1y?.pct ?? null, high_52w_usd: v.high_52w?.usd ?? null, low_52w_usd: v.low_52w?.usd ?? null, page: v.page }; }) };
    }
  },
  {
    name: "get_sector_performance",
    title: "Sector performance",
    description: "Median 7d, 30d and 1y change and volatility of the coins in one sector (Layer 1, AI, DePIN, DeFi and so on), with its best and worst performer over 30 days. From the dated weekly stats.",
    inputSchema: { type: "object", properties: { sector: { type: "string", enum: SECTORS } }, required: ["sector"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (d, { sector }) => {
      if (!SECTORS.includes(sector)) return { error: `sector must be one of ${SECTORS.join(", ")}` };
      const rows = d.coins.filter(c => c.sectors.includes(sector) && d.stats[c.sym]).map(c => ({ c, s: d.stats[c.sym] }));
      if (!rows.length) return { error: "No stats for this sector yet." };
      const by30 = rows.filter(r => num(r.s.change30d) !== null).sort((a, b) => b.s.change30d - a.s.change30d);
      const pick = r => r && { symbol: r.c.sym, name: r.c.name, change_30d_pct: r.s.change30d };
      return {
        sector, as_of: d.updated, coins: rows.length,
        median_change_pct: { "7d": median(rows.map(r => num(r.s.change7d))), "30d": median(rows.map(r => num(r.s.change30d))), "1y": median(rows.map(r => num(r.s.change1y))) },
        median_volatility_30d_pct: median(rows.map(r => num(r.s.volatility30d))),
        best_30d: pick(by30[0]), worst_30d: pick(by30[by30.length - 1])
      };
    }
  },
  {
    name: "get_live_price",
    title: "Live price on two exchanges",
    description: "Current USD price of up to 5 coins on Coinbase and Kraken (where listed), fetched now and cached for 20 seconds, with the gap between the two in basis points. A missing exchange is null.",
    inputSchema: { type: "object", properties: { symbols: { ...symbolList, maxItems: 5 } }, required: ["symbols"] },
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: async (d, { symbols }) => {
      const list = (Array.isArray(symbols) ? symbols : []).slice(0, 5); // at most 10 upstream requests per call
      const out = await Promise.all(list.map(async s => {
        const c = d.bySym.get(String(s).toUpperCase());
        if (!c) return { symbol: String(s), error: "unknown symbol" };
        const [cb, kr] = await Promise.all(["CB", "KR"].map(ex => (c.feeds.includes(ex) ? quote(c, ex).catch(() => null) : null)));
        const gap = cb && kr ? Math.round((Math.abs(cb - kr) / Math.min(cb, kr)) * 1e5) / 10 : null;
        return { symbol: c.sym, name: c.name, coinbase_usd: cb, kraken_usd: kr, gap_bps: gap, page: page(c.sym) };
      }));
      return { as_of: new Date().toISOString(), note: "Gaps ignore fees and spreads.", prices: out };
    }
  }
];

// ---------- JSON-RPC over Streamable HTTP ----------
const json = (body, status = 200, extra = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex", ...CORS, ...extra } });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg, env, origin) {
  if (!msg || typeof msg !== "object") return rpcError(null, -32600, "Invalid Request");
  const { id, method } = msg;
  const params = msg.params && typeof msg.params === "object" ? msg.params : {};
  // A JSON-RPC response or error posted by the client (no method): accepted, nothing to answer.
  if (msg.jsonrpc === "2.0" && method === undefined && ("result" in msg || "error" in msg)) return null;
  if (msg.jsonrpc !== "2.0" || typeof method !== "string") return rpcError(id, -32600, "Invalid Request");
  if (id === undefined) return null; // notification (e.g. notifications/initialized): nothing to answer
  if (method === "initialize") {
    const asked = params.protocolVersion;
    return { jsonrpc: "2.0", id, result: {
      protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "cryptopriceticker", title: "CryptoPriceTicker.com", version: "0.1.0", websiteUrl: SITE },
      instructions: "Coin data from CryptoPriceTicker.com. get_coin_stats, compare_coins and get_sector_performance use dated weekly stats; get_live_price fetches Coinbase and Kraken now. Cite the coin's page when you use a number."
    } };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS.map(({ run, ...t }) => t) } };
  if (method === "tools/call") {
    const tool = TOOLS.find(t => t.name === params.name);
    if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
    let data;
    try { data = await tool.run(await loadData(env, origin), params.arguments && typeof params.arguments === "object" ? params.arguments : {}); }
    catch (e) { data = { error: "The site's data could not be read just now; try again." }; }
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: Boolean(data && data.error) } };
  }
  return rpcError(id, -32601, `Method not found: ${method}`);
}

// ---------- Rate limit (best effort, per isolate) ----------
// Each visitor (CF-Connecting-IP) gets 60 requests a minute, and 20 of them may be get_live_price, the only
// tool that reaches the exchanges (its answers are also edge-cached for 20 s). Counters live in this isolate's
// memory for one minute and are never written anywhere; a busy edge location runs several isolates, so this
// caps runaway clients, not a determined one. A Cloudflare WAF rate-limiting rule is the hard limit.
const LIMITS = { all: 60, live: 20 }, WINDOW = 60e3, MAX_BODY = 16_384;
const hits = new Map();
function overLimit(ip, kind, now = Date.now()) {
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > WINDOW) hits.delete(k);
  const key = kind + "|" + ip;
  let h = hits.get(key);
  if (!h || now - h.at > WINDOW) { h = { at: now, n: 0 }; hits.set(key, h); }
  h.n++;
  return h.n > LIMITS[kind] ? Math.ceil((h.at + WINDOW - now) / 1000) : 0;
}
const tooMany = (id, wait) => json(rpcError(id ?? null, -32000, `Too many requests: try again in ${wait} s.`), 429, { "retry-after": String(wait) });

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json(rpcError(null, -32000, "This MCP endpoint takes JSON-RPC over POST (Streamable HTTP, no sessions). Add https://cryptopriceticker.com/mcp to your AI app as a remote MCP connector."), 405, { allow: "POST, OPTIONS" });
  const origin = new URL(request.url).origin;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  let wait = overLimit(ip, "all");
  if (wait) return tooMany(null, wait);
  if (+(request.headers.get("content-length") || 0) > MAX_BODY) return json(rpcError(null, -32600, "Request too large"), 413);
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json(rpcError(null, -32600, "Request too large"), 413);
    body = JSON.parse(text);
  } catch (e) { return json(rpcError(null, -32700, "Parse error"), 400); }
  if (Array.isArray(body)) return json(rpcError(null, -32600, "Batches are not supported"), 400);
  if (body?.method === "tools/call" && body.params?.name === "get_live_price" && (wait = overLimit(ip, "live"))) return tooMany(body.id, wait);
  const out = await handle(body, env, origin);
  return out === null ? new Response(null, { status: 202, headers: CORS }) : json(out, 200, body?.method === "initialize" ? { "mcp-protocol-version": out.result?.protocolVersion || VERSIONS[0] } : {});
}
