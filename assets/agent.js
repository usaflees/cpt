/* CryptoPriceTicker.com — tools for AI agents (WebMCP, experimental).
 *
 * WebMCP lets a page hand the visitor's browser agent a short list of named tools with JSON schemas,
 * so an agent can ask "what is SOL on each exchange right now?" instead of reading the screen.
 * Chrome runs it as an origin trial (document.modelContext); the ChatGPT desktop browser calls the tools.
 *
 * Loaded by assets/app.js only when document.modelContext.registerTool exists, so other browsers never
 * download this file. Every answer comes from the live exchange prices the page already streams
 * (window.CPT.state): no server, no extra requests, nothing leaves the browser except what the
 * visitor's own agent reads. Holdings ("My bag") are deliberately not exposed.
 *
 * Tools: find_coins, get_prices, get_movers (home page only), get_exchange_gaps, convert_amount (read-only),
 *        update_watchlist, set_price_alert (change this browser's saved data; each shows a toast).
 */
(function () {
  "use strict";
  const api = window.CPT;
  const mc = document.modelContext;
  if (!api || !mc || typeof mc.registerTool !== "function" || window.CPT_AGENT) return;
  const { state, coinUrl, showToast } = api;
  const SITE = "https://cryptopriceticker.com";
  const EX = { CB: "coinbase_usd", BN: "binance_usdt", KR: "kraken_usd" }; // Binance quotes USDT, not USD
  const FRESH_MS = 90e3; // a quote older than this (socket dropped, quiet market) is left out of gaps
  const HOME = api.MODE === "home"; // coin pages stream only their coin plus BTC, ETH and SOL
  const SECTORS = ["L1", "L2", "DePIN", "AI", "DeFi", "RWA", "Privacy", "Gaming", "Meme", "Stable"];
  const MAX_LIST = 25;

  const round = (v, sig = 6) => (v > 0 && isFinite(v) ? Number(v.toPrecision(sig)) : null);
  const pct = v => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  // "Load more pairs" coins (hasPage false) have guessed market caps and no page, so agents never see them.
  const coins = () => Array.from(state.coins.values()).filter(c => c.hasPage !== false && !c.estimated);
  const bySym = s => { const c = state.coins.get(String(s || "").trim().toUpperCase()); return c && c.hasPage !== false && !c.estimated ? c : undefined; };
  const asOf = () => new Date().toISOString();
  const err = message => ({ error: message });

  // One coin as the agent sees it. Prices before the first live tick are the build-time snapshot.
  function view(c, withExchanges) {
    const out = {
      symbol: c.sym, name: c.name, price_usd: round(c.price), change_24h_pct: c.live ? pct(c.change24h) : null,
      market_cap_usd: c.live ? Math.round(c.mcap) : null, sectors: c.sectors, live: Boolean(c.live), page: SITE + coinUrl(c.sym)
    };
    if (withExchanges) {
      const at = c.exAt || {}, now = Date.now();
      out.exchanges = Object.fromEntries(c.feeds.map(ex => [EX[ex], c.exPrices[ex] > 0 ? { price: round(c.exPrices[ex]), age_s: at[ex] ? Math.round((now - at[ex]) / 1e3) : null } : null]));
    }
    return out;
  }
  function gap(c) {
    const now = Date.now();
    const quotes = c.feeds.filter(ex => c.exPrices[ex] > 0 && now - ((c.exAt || {})[ex] || 0) < FRESH_MS).map(ex => [EX[ex], c.exPrices[ex]]);
    if (quotes.length < 2) return null;
    quotes.sort((a, b) => a[1] - b[1]);
    const lo = quotes[0], hi = quotes[quotes.length - 1];
    return { symbol: c.sym, gap_bps: Math.round(((hi[1] - lo[1]) / lo[1]) * 1e4 * 10) / 10, cheapest: lo[0], dearest: hi[0], prices: Object.fromEntries(quotes.map(([n, p]) => [n, round(p)])) };
  }
  // Exact ticker first, then names that start with the query ("eth" → Ethereum before Tether).
  const score = (c, q) => (c.sym.toLowerCase() === q ? 3 : c.name.toLowerCase().startsWith(q) ? 2 : c.name.toLowerCase().includes(q) ? 1 : 0);
  const symbolsArg = { type: "array", items: { type: "string" }, maxItems: MAX_LIST, description: "Ticker symbols, e.g. [\"BTC\",\"SOL\"]" };

  const tools = [
    {
      name: "find_coins",
      title: "Find coins",
      description: "Search the coins this site tracks by name, ticker or sector. Returns symbol, name, sectors and the coin's page. Use it to turn a name like 'ether' into a ticker before calling other tools.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "Name, ticker or sector (L1, L2, DePIN, AI, DeFi, RWA, Privacy, Gaming, Meme, Stable)" } }, required: ["query"] },
      annotations: { readOnlyHint: true },
      execute({ query }) {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return err("query is empty");
        const hits = coins().filter(c => c.sym.toLowerCase() === q || c.name.toLowerCase().includes(q) || c.sectors.some(s => s.toLowerCase() === q))
          .sort((a, b) => score(b, q) - score(a, q) || b.mcap - a.mcap).slice(0, MAX_LIST);
        return { count: hits.length, coins: hits.map(c => ({ symbol: c.sym, name: c.name, sectors: c.sectors, page: SITE + coinUrl(c.sym) })) };
      }
    },
    {
      name: "get_prices",
      title: "Live prices by exchange",
      description: "Live USD price, 24-hour change and market cap for up to 25 coins, plus each exchange's own last price and its age in seconds (Coinbase USD, Binance USDT, Kraken USD). live=false means the page has no live tick yet and price_usd is an earlier snapshot.",
      inputSchema: { type: "object", properties: { symbols: symbolsArg }, required: ["symbols"] },
      annotations: { readOnlyHint: true },
      execute({ symbols }) {
        const list = (Array.isArray(symbols) ? symbols : [symbols]).slice(0, MAX_LIST);
        const found = list.map(bySym).filter(Boolean);
        const unknown = list.filter(s => !bySym(s));
        return { as_of: asOf(), coins: found.map(c => view(c, true)), unknown_symbols: unknown };
      }
    },
    HOME && {
      name: "get_movers",
      title: "Biggest 24h movers",
      description: "The coins that rose or fell most in the last 24 hours (live exchange data), optionally within one sector.",
      inputSchema: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["gainers", "losers"] },
          sector: { type: "string", enum: SECTORS },
          limit: { type: "integer", minimum: 1, maximum: 15 }
        },
        required: ["direction"]
      },
      annotations: { readOnlyHint: true },
      execute({ direction, sector, limit }) {
        const n = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 15);
        const pool = coins().filter(c => c.live && !c.sectors.includes("Stable") && (!sector || c.sectors.includes(sector)));
        if (!pool.length) return err("No live prices yet; try again in a few seconds.");
        pool.sort((a, b) => (direction === "losers" ? a.change24h - b.change24h : b.change24h - a.change24h));
        return { as_of: asOf(), direction: direction === "losers" ? "losers" : "gainers", sector: sector || "all", coins: pool.slice(0, n).map(c => view(c, false)) };
      }
    },
    {
      name: "get_exchange_gaps",
      title: "Price gaps between exchanges",
      description: "How far apart Coinbase (USD), Binance (USDT) and Kraken (USD) price the same coin right now, in basis points, with the cheapest and dearest exchange; only quotes from the last 90 seconds count. Without symbols: the widest gaps on the home page, this coin on a coin page. Gaps ignore fees, spreads, transfer times and the USDT/USD difference, so they are not arbitrage profit.",
      inputSchema: { type: "object", properties: { symbols: symbolsArg, limit: { type: "integer", minimum: 1, maximum: 15 } } },
      annotations: { readOnlyHint: true },
      execute({ symbols, limit } = {}) {
        const n = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 15);
        const pool = Array.isArray(symbols) && symbols.length ? symbols.slice(0, MAX_LIST).map(bySym).filter(Boolean)
          : HOME ? coins().filter(c => !c.sectors.includes("Stable")) : [bySym(state.coinPageSym)].filter(Boolean);
        const all = pool.map(gap).filter(Boolean);
        const gaps = all.sort((a, b) => b.gap_bps - a.gap_bps).slice(0, n);
        return { as_of: asOf(), note: "Gaps ignore fees, spreads, transfer times and the USDT/USD difference.", coins_checked: pool.length, gaps, coins_without_two_fresh_quotes: pool.length - all.length };
      }
    },
    {
      name: "convert_amount",
      title: "Convert between coins and USD",
      description: "Convert an amount between any two tracked coins or USD at live prices, e.g. 0.5 BTC to ETH or 1000 USD to SOL.",
      inputSchema: {
        type: "object",
        properties: { amount: { type: "number", exclusiveMinimum: 0 }, from: { type: "string", description: "Ticker or USD" }, to: { type: "string", description: "Ticker or USD" } },
        required: ["amount", "from", "to"]
      },
      annotations: { readOnlyHint: true },
      execute({ amount, from, to }) {
        const usd = code => { const k = String(code || "").trim().toUpperCase(); if (k === "USD") return 1; const c = state.coins.get(k); return c && c.price > 0 ? c.price : null; };
        const a = Number(amount), f = usd(from), t = usd(to);
        if (!(a > 0)) return err("amount must be above 0");
        if (!f || !t) return err(`Unknown or unpriced code: ${!f ? from : to}. Use a ticker from find_coins, or USD.`);
        const live = [from, to].every(k => String(k).toUpperCase() === "USD" || state.coins.get(String(k).toUpperCase()).live);
        return { as_of: asOf(), amount: a, from: String(from).toUpperCase(), to: String(to).toUpperCase(), result: round((a * f) / t, 8), live };
      }
    },
    {
      name: "update_watchlist",
      title: "Change the watchlist",
      description: "Add coins to, or remove them from, the visitor's watchlist saved in this browser (starred coins on the home page). Reversible; nothing is sent anywhere. With action 'list', returns the current watchlist.",
      inputSchema: { type: "object", properties: { action: { type: "string", enum: ["add", "remove", "list"] }, symbols: symbolsArg }, required: ["action"] },
      annotations: { readOnlyHint: false },
      execute({ action, symbols }) {
        if (action !== "list") {
          const list = (Array.isArray(symbols) ? symbols : []).map(bySym).filter(Boolean).map(c => c.sym);
          if (!list.length) return err("No known symbols given.");
          list.forEach(sym => api.setWatch(sym, action === "add"));
          showToast(`🤖 Your assistant ${action === "add" ? "added" : "removed"} ${list.join(", ")} ${action === "add" ? "to" : "from"} your watchlist.`);
        }
        return { watchlist: Array.from(state.watchlist) };
      }
    },
    {
      name: "set_price_alert",
      title: "Set or clear a price alert",
      description: "Set a price alert saved in this browser: the page notifies the visitor when the coin crosses target_usd while the site is open. One alert per coin; omit target_usd to clear it. Reversible; nothing is sent anywhere.",
      inputSchema: { type: "object", properties: { symbol: { type: "string" }, target_usd: { type: "number", exclusiveMinimum: 0 } }, required: ["symbol"] },
      annotations: { readOnlyHint: false },
      execute({ symbol, target_usd }) {
        const c = bySym(symbol);
        if (!c) return err(`Unknown symbol ${symbol}.`);
        const target = Number(target_usd);
        if (target_usd === undefined || target_usd === null) { api.setAlert(c.sym, null); showToast(`🤖 Your assistant cleared the ${c.sym} alert.`); return { symbol: c.sym, alert_usd: null }; }
        if (!(target > 0)) return err("target_usd must be above 0");
        api.setAlert(c.sym, target);
        showToast(`🤖 Your assistant set an alert: ${c.sym} at $${target}`);
        return { symbol: c.sym, alert_usd: target, current_price_usd: round(c.price), live: Boolean(c.live) };
      }
    }
  ];

  tools.splice(0, tools.length, ...tools.filter(Boolean));
  const ctrl = new AbortController();
  window.CPT_AGENT = { tools: tools.map(t => t.name), unregister: () => ctrl.abort() };
  // Results are returned as JSON text: the format every current WebMCP client accepts.
  tools.forEach(t => {
    const run = t.execute;
    t.execute = async input => JSON.stringify(run(input || {}));
    Promise.resolve(mc.registerTool(t, { signal: ctrl.signal })).catch(() => {});
  });
  addEventListener("pagehide", e => { if (!e.persisted) ctrl.abort(); });
})();
