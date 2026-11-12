// Market snapshot for scripts/build-seo-engine.mjs: three tiers, one normalized schema.
//
//   1. CoinGecko  /coins/markets          (full data: 24h high/low, ATH, FDV, 7-day sparkline)
//   2. CoinPaprika /v1/tickers            (no 24h high/low and no sparkline: those fields stay null)
//   3. data/market-snapshot-cache.json    (the last good snapshot, committed, so a build never fails or
//                                          renders blank pages when both APIs are down or rate-limited)
//
// GitHub runners share IP addresses that CoinGecko often answers with 429, so every request is retried
// with backoff and any 429/5xx/network error falls through to the next tier.
// Normalized asset: { sym, name, rank, price, mcap, fdv, vol, high, low, chg24, chg7, ath, athDate,
//                     circ, total, max, spark[], updated }   (USD; percentages in %; null = not provided)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { ROOT } from "./registry.mjs";

export const CACHE_PATH = ROOT + "data/market-snapshot-cache.json";
const num = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
const sig = (v, n = 8) => (v == null ? null : Number(v.toPrecision(n)));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, { tries = 3, headers = {}, log = () => {} } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "cpt-build/1.0", ...headers }, signal: AbortSignal.timeout(25000) });
      if (res.ok) return await res.json();
      last = new Error(`HTTP ${res.status}`);
      // 4xx other than 429 (e.g. 451 geo-block, 403) will not improve on retry.
      if (res.status !== 429 && res.status < 500) break;
      const wait = Math.min(Number(res.headers.get("retry-after")) * 1000 || 0, 20000) || 1500 * 3 ** i;
      log(`  ${new URL(url).host}: HTTP ${res.status}, retry in ${Math.round(wait / 1000)} s`);
      if (i < tries - 1) await sleep(wait);
    } catch (e) {
      last = e;
      if (i < tries - 1) await sleep(1500 * 3 ** i);
    }
  }
  throw last;
}

// Keep ~56 points (one per 3 hours) of the 168 hourly sparkline values: enough for a 320 px line.
const thin = arr => {
  if (!Array.isArray(arr) || arr.length < 8) return null;
  const step = Math.max(1, Math.round(arr.length / 56));
  const out = arr.filter((_, i) => i % step === 0 || i === arr.length - 1).map(v => sig(num(v), 6));
  return out.every(v => v != null) ? out : null;
};

async function fromCoinGecko(ids, log) {
  const key = process.env.COINGECKO_API_KEY;
  const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1" +
    "&sparkline=true&price_change_percentage=24h,7d";
  const rows = await getJson(url, { log, headers: key ? { "x-cg-demo-api-key": key } : {} });
  if (!Array.isArray(rows) || rows.length < 50) throw new Error("unexpected CoinGecko response");
  const byId = new Map(rows.map(r => [r.id, r]));
  const assets = [];
  for (const [sym, id] of Object.entries(ids)) {
    const r = byId.get(id);
    if (!r) continue;
    assets.push({
      sym, name: r.name, rank: num(r.market_cap_rank), price: num(r.current_price), mcap: num(r.market_cap),
      fdv: num(r.fully_diluted_valuation), vol: num(r.total_volume), high: num(r.high_24h), low: num(r.low_24h),
      chg24: sig(num(r.price_change_percentage_24h_in_currency ?? r.price_change_percentage_24h), 6),
      chg7: sig(num(r.price_change_percentage_7d_in_currency), 6),
      ath: num(r.ath), athDate: r.ath_date ? r.ath_date.slice(0, 10) : null,
      circ: num(r.circulating_supply), total: num(r.total_supply), max: num(r.max_supply),
      spark: thin(r.sparkline_in_7d && r.sparkline_in_7d.price), updated: r.last_updated || null
    });
  }
  return { source: "CoinGecko", sourceUrl: "https://www.coingecko.com/", assets };
}

async function fromCoinPaprika(ids, log) {
  const rows = await getJson("https://api.coinpaprika.com/v1/tickers?quotes=USD", { log });
  if (!Array.isArray(rows) || rows.length < 50) throw new Error("unexpected CoinPaprika response");
  // CoinPaprika has its own ids; match on ticker symbol and take the highest-ranked asset with that symbol.
  const bySym = new Map();
  for (const r of rows) {
    if (!r.rank || !r.quotes || !r.quotes.USD) continue;
    const prev = bySym.get(r.symbol);
    if (!prev || r.rank < prev.rank) bySym.set(r.symbol, r);
  }
  const assets = [];
  for (const [sym, , alt] of Object.entries(ids).map(([s, id]) => [s, id, PAPRIKA_SYMBOL[s]])) {
    const r = bySym.get(alt || sym);
    if (!r) continue;
    const q = r.quotes.USD, price = num(q.price), max = num(r.max_supply) || null, total = num(r.total_supply) || null;
    assets.push({
      sym, name: r.name, rank: r.rank, price, mcap: num(q.market_cap),
      fdv: price != null && (max || total) ? price * (max || total) : null,
      vol: num(q.volume_24h), high: null, low: null, chg24: num(q.percent_change_24h), chg7: num(q.percent_change_7d),
      ath: num(q.ath_price), athDate: q.ath_date ? q.ath_date.slice(0, 10) : null,
      circ: num(r.circulating_supply) ?? (price && q.market_cap ? q.market_cap / price : null), total, max,
      spark: null, updated: r.last_updated || null
    });
  }
  return { source: "CoinPaprika", sourceUrl: "https://coinpaprika.com/", assets };
}
// Registry tickers that CoinPaprika lists under another symbol.
const PAPRIKA_SYMBOL = { GRAM: "TON" };

export function readCache() {
  return existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : null;
}

// ids: { SYM: "coingecko-id" }. Returns { source, sourceUrl, fetchedAt, tier, assets }.
export async function loadSnapshot(ids, { offline = false, log = console.log } = {}) {
  const tiers = offline ? [] : [["CoinGecko", fromCoinGecko], ["CoinPaprika", fromCoinPaprika]];
  for (const [i, [name, fn]] of tiers.entries()) {
    try {
      const snap = await fn(ids, log);
      const usable = snap.assets.filter(a => a.price > 0 && a.mcap > 0);
      if (usable.length < 50) throw new Error(`only ${usable.length} usable assets`);
      const out = { ...snap, assets: usable, fetchedAt: new Date().toISOString().slice(0, 19) + "Z", tier: i + 1 };
      mkdirSync(ROOT + "data", { recursive: true });
      // One asset per line keeps diffs of the committed fallback readable.
      writeFileSync(CACHE_PATH, `{"source":${JSON.stringify(out.source)},"sourceUrl":${JSON.stringify(out.sourceUrl)},"fetchedAt":"${out.fetchedAt}","assets":[\n` +
        out.assets.map(a => JSON.stringify(a)).join(",\n") + "\n]}\n");
      log(`Market data: ${name} (tier ${i + 1}), ${usable.length} assets`);
      return out;
    } catch (e) {
      log(`Market data: ${name} failed (${e.message}); trying the next tier`);
    }
  }
  const cached = readCache();
  if (!cached || !cached.assets || cached.assets.length < 50) throw new Error("No market data: APIs failed and data/market-snapshot-cache.json is missing or too small");
  log(`Market data: committed cache from ${cached.fetchedAt} (${cached.source}), ${cached.assets.length} assets`);
  return { ...cached, tier: 3 };
}
