#!/usr/bin/env node
// Builds content/coin-stats.json: per-coin performance figures computed from daily candles,
// used by scripts/build-coin-pages.mjs for the "Performance" and "Price history" sections.
//
//   node scripts/fetch-coin-stats.mjs
//
// Source per coin: Binance (USDT) if listed, else Kraken (USD), else Coinbase (USD).
// Run it before build-coin-pages.mjs whenever you refresh the site (the weekly maintenance
// task does this), so the stats and the pages' "updated" dates move together.
import { writeFileSync } from "node:fs";
import { ROOT, loadRegistry } from "./lib/registry.mjs";
if (process.argv.length > 2) { console.error("Unknown argument(s): " + process.argv.slice(2).join(" ") + "\nUsage: node scripts/fetch-coin-stats.mjs   (no options; rewrites content/coin-stats.json)"); process.exit(1); }

const DAY = 86400e3;

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "cryptopriceticker-stats/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const tick = (c, ex) => c.tickers?.[ex] || c.sym;

// Each loader returns [{ t: openTimeMs, close }] for daily candles, oldest first.
const loaders = {
  async BN(c) {
    const k = await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${tick(c, "BN")}USDT&interval=1d&limit=400`);
    return k.map(r => ({ t: r[0], close: +r[4] }));
  },
  async KR(c) {
    const r = await getJson(`https://api.kraken.com/0/public/OHLC?pair=${tick(c, "KR")}USD&interval=1440`);
    if (r.error?.length) throw new Error(r.error.join(","));
    const key = Object.keys(r.result).find(k => k !== "last");
    return r.result[key].map(x => ({ t: x[0] * 1000, close: +x[4] }));
  },
  async CB(c) {
    const r = await getJson(`https://api.exchange.coinbase.com/products/${tick(c, "CB")}-USD/candles?granularity=86400`);
    return r.map(x => ({ t: x[0] * 1000, close: +x[4] })).reverse();
  }
};
const SOURCE_NAMES = { BN: "Binance", KR: "Kraken", CB: "Coinbase" };

function summarize(candles) {
  // Drop today's unfinished candle so every figure uses completed days.
  const today = Math.floor(Date.now() / DAY) * DAY;
  const days = candles.filter(d => d.t < today && d.close > 0);
  if (days.length < 8) return null;
  const last = days[days.length - 1];
  const back = n => (days.length > n ? days[days.length - 1 - n].close : null);
  const pct = n => (back(n) ? +(((last.close - back(n)) / back(n)) * 100).toFixed(2) : null);
  const year = days.slice(-365);
  const hi = year.reduce((a, d) => (d.close > a.close ? d : a), year[0]);
  const lo = year.reduce((a, d) => (d.close < a.close ? d : a), year[0]);
  const rets = days.slice(-31).map((d, i, arr) => (i ? Math.log(d.close / arr[i - 1].close) : null)).slice(1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  // Month-end closes for the last 12 completed months.
  const monthly = [];
  for (const d of days) {
    const m = new Date(d.t).toISOString().slice(0, 7);
    if (monthly.length && monthly[monthly.length - 1].month === m) monthly[monthly.length - 1].close = d.close;
    else monthly.push({ month: m, close: d.close });
  }
  const thisMonth = new Date(last.t + DAY).toISOString().slice(0, 7);
  const completed = monthly.filter(m => m.month < thisMonth).slice(-13);
  // Largest peak-to-trough fall of the daily close within the year (STRATEGY B2).
  let peak = year[0], dd = { pct: 0, from: year[0], to: year[0] };
  for (const d of year) {
    if (d.close > peak.close) peak = d;
    const fall = (d.close - peak.close) / peak.close;
    if (fall < dd.pct) dd = { pct: fall, from: peak, to: d };
  }
  return {
    asOf: new Date(last.t).toISOString().slice(0, 10),
    close: last.close,
    change7d: pct(7), change30d: pct(30), change90d: pct(90), change1y: pct(365),
    high52w: hi.close, high52wDate: new Date(hi.t).toISOString().slice(0, 10),
    low52w: lo.close, low52wDate: new Date(lo.t).toISOString().slice(0, 10),
    historyDays: year.length,
    volatility30d: +(sd * Math.sqrt(365) * 100).toFixed(1), // annualized, from daily log returns
    maxDrawdown1y: +(dd.pct * 100).toFixed(1),
    maxDrawdownFrom: new Date(dd.from.t).toISOString().slice(0, 10),
    maxDrawdownTo: new Date(dd.to.t).toISOString().slice(0, 10),
    monthly: completed.map((m, i) => ({
      month: m.month,
      close: m.close,
      change: i ? +(((m.close - completed[i - 1].close) / completed[i - 1].close) * 100).toFixed(2) : null
    })).slice(-12),
    // Daily log returns for the last 90 days, keyed by date; used for the BTC correlation, then dropped.
    _rets: days.slice(-91).map((d, i, arr) => (i ? [new Date(d.t).toISOString().slice(0, 10), Math.log(d.close / arr[i - 1].close)] : null)).slice(1)
  };
}

// Pearson correlation of two coins' daily log returns on the dates both have (needs ≥ 60).
function correlation(a, b) {
  const mb = new Map(b);
  const pairs = a.filter(([d]) => mb.has(d)).map(([d, r]) => [r, mb.get(d)]);
  if (pairs.length < 60) return null;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length, my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? +(sxy / Math.sqrt(sxx * syy)).toFixed(2) : null;
}

async function main() {
  const { coins } = loadRegistry();
  const out = {};
  const failed = [];
  // Small batches keep well inside every exchange's public rate limits.
  for (let i = 0; i < coins.length; i += 6) {
    await Promise.all(coins.slice(i, i + 6).map(async c => {
      // Prefer Binance, but fall back to an exchange with a longer history when Binance has
      // less than a year (e.g. GRAM, listed on Binance only after the TON → GRAM rename).
      let best = null;
      for (const ex of ["BN", "KR", "CB"].filter(e => c.feeds.includes(e))) {
        try {
          const s = summarize(await loaders[ex](c));
          if (s && (!best || s.historyDays > best.historyDays)) best = { source: SOURCE_NAMES[ex], ...s };
          if (best?.historyDays >= 365) break;
        } catch (_) { /* try the next exchange */ }
      }
      if (best) out[c.sym] = best; else failed.push(c.sym);
    }));
    await new Promise(r => setTimeout(r, 400));
  }
  const btc = out.BTC && out.BTC._rets;
  for (const [sym, s] of Object.entries(out)) {
    if (btc && sym !== "BTC") s.corrBtc90d = correlation(s._rets, btc);
    delete s._rets;
  }
  const updated = Object.values(out).map(s => s.asOf).sort().pop();
  // One coin per line: a weekly refresh then diffs ~114 lines instead of ~7,000 (smaller PRs, cheaper to review).
  const body = Object.entries(out).map(([sym, v]) => `  ${JSON.stringify(sym)}: ${JSON.stringify(v)}`).join(",\n");
  writeFileSync(ROOT + "content/coin-stats.json", `{\n "updated": ${JSON.stringify(updated)},\n "coins": {\n${body}\n }\n}\n`);
  console.log(`Stats for ${Object.keys(out).length}/${coins.length} coins (as of ${updated}).`);
  if (failed.length) console.log(`⚠ No candle data: ${failed.join(", ")}`);
}

main().catch(err => { console.error(err); process.exit(1); });
