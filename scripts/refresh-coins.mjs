#!/usr/bin/env node
// Refreshes assets/coins.js: circulating supply + seed price (CoinLore) and the
// exchanges that actually list each coin (Coinbase, Binance, Kraken public APIs).
//
//   node scripts/refresh-coins.mjs           update assets/coins.js
//   node scripts/refresh-coins.mjs --dry     print the report only
//
// Coins with no live feed on any exchange are reported so you can replace them.
import { loadRegistry, writeRegistry } from "./lib/registry.mjs";

const DRY = process.argv.includes("--dry");

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "cryptopriceticker-refresh/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Kraken's REST "wsname" uses legacy codes; WebSocket v2 uses the common tickers.
const KRAKEN_ALIASES = { XBT: "BTC", XDG: "DOGE" };

async function main() {
  const { coins } = loadRegistry();
  console.log(`Loaded ${coins.length} coins. Fetching market data…`);

  const [cbProducts, bnTickers, krPairs, ...coinlorePages] = await Promise.all([
    getJson("https://api.exchange.coinbase.com/products"),
    getJson("https://data-api.binance.vision/api/v3/ticker/24hr"),
    getJson("https://api.kraken.com/0/public/AssetPairs"),
    ...[0, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(start =>
      getJson(`https://api.coinlore.net/api/tickers/?start=${start}&limit=100`).catch(() => ({ data: [] })))
  ]);

  const cb = new Set(cbProducts
    .filter(p => p.quote_currency === "USD" && p.status === "online" && !p.trading_disabled)
    .map(p => p.base_currency));

  // The 24h snapshot still lists delisted pairs with frozen prices; only trust pairs that closed recently.
  const bn = new Map();
  for (const t of bnTickers) {
    const fresh = Date.now() - t.closeTime < 2 * 3600e3;
    if (fresh && t.symbol.endsWith("USDT") && +t.count > 0 && +t.quoteVolume > 10000) bn.set(t.symbol.slice(0, -4), +t.lastPrice);
  }

  const kr = new Map(); // sym -> REST pair name (for the price lookup below)
  for (const [pair, p] of Object.entries(krPairs.result)) {
    if (!p.wsname || !p.wsname.endsWith("/USD") || p.status !== "online") continue;
    const base = p.wsname.split("/")[0];
    kr.set(KRAKEN_ALIASES[base] || base, pair);
  }

  // First (highest-ranked) CoinLore entry per symbol.
  const lore = new Map();
  for (const c of coinlorePages.flatMap(p => p.data || [])) if (!lore.has(c.symbol)) lore.set(c.symbol, c);

  // A coin can trade under a different ticker on some exchanges (e.g. GRAM is still TON on Coinbase/Kraken).
  const tick = (c, ex) => c.tickers?.[ex] || c.sym;

  // Kraken prices for coins Binance doesn't list (one batched request).
  const krOnly = coins.filter(c => !bn.has(tick(c, "BN")) && kr.has(tick(c, "KR"))).map(c => kr.get(tick(c, "KR")));
  const krPrice = new Map();
  if (krOnly.length) {
    const t = await getJson(`https://api.kraken.com/0/public/Ticker?pair=${krOnly.join(",")}`);
    for (const [sym, pair] of kr) if (t.result?.[pair]) krPrice.set(sym, +t.result[pair].c[0]);
  }

  const noFeed = [], loreRejected = [], loreMissing = [];
  for (const c of coins) {
    c.feeds = ["CB", "BN", "KR"].filter(ex => (ex === "CB" ? cb : ex === "BN" ? bn : kr).has(tick(c, ex)));
    if (!c.feeds.length) noFeed.push(c.sym);

    let exchangePrice = bn.get(tick(c, "BN")) ?? krPrice.get(tick(c, "KR"));
    if (exchangePrice === undefined && cb.has(tick(c, "CB"))) {
      exchangePrice = +(await getJson(`https://api.exchange.coinbase.com/products/${tick(c, "CB")}-USD/ticker`).catch(() => ({}))).price || undefined;
    }

    const l = lore.get(c.sym);
    const lp = l ? +l.price_usd : 0;
    // Guard against symbol collisions: CoinLore must agree with the exchange within 25%.
    const loreOk = l && lp > 0 && (!exchangePrice || Math.abs(lp - exchangePrice) / exchangePrice < 0.25);
    if (l && !loreOk) loreRejected.push(c.sym);
    if (!l) loreMissing.push(c.sym);

    if (loreOk && +l.csupply > 0) c.supply = +l.csupply / 1e6;
    c.price = exchangePrice || (loreOk ? lp : c.price);
  }

  console.log(`Coinbase: ${coins.filter(c => c.feeds.includes("CB")).length}, Binance: ${coins.filter(c => c.feeds.includes("BN")).length}, Kraken: ${coins.filter(c => c.feeds.includes("KR")).length}`);
  if (loreMissing.length) console.log(`Not in CoinLore top 1000 (supply kept as-is): ${loreMissing.join(", ")}`);
  if (loreRejected.length) console.log(`CoinLore price disagreed with exchanges (supply kept as-is): ${loreRejected.join(", ")}`);
  if (noFeed.length) console.log(`⚠ NO LIVE FEED on any exchange — consider replacing: ${noFeed.join(", ")}`);
  const noSupply = coins.filter(c => !c.supply).map(c => c.sym);
  if (noSupply.length) console.log(`⚠ Missing supply (set it by hand, in millions): ${noSupply.join(", ")}`);

  if (DRY) return console.log("Dry run — assets/coins.js not modified.");
  writeRegistry(coins, new Date().toISOString().slice(0, 10));
  console.log("Updated assets/coins.js");
}

main().catch(err => { console.error(err); process.exit(1); });
