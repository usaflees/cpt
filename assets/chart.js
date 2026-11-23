/* Coin page price chart: 24h, 7d, 30d and 1y ranges (coin pages only).
 * Loaded after assets/app.js, which exposes window.CPT. Candles come from Binance (USDT pair) first, then
 * Coinbase, then Kraken (USD pairs), straight from each exchange's public API in the browser. Until candles
 * load, or if no exchange answers, app.js keeps drawing the live ticks seen since the page opened. */
(function () {
  "use strict";
  const api = window.CPT;
  if (!api || api.MODE !== "coin" || !api.coinChart) return;
  const { state, buildSparkline, tickerOf, coinChart, fmtPrice } = api;
  const $ = id => document.getElementById(id);
  const c = state.coins.get(state.coinPageSym);
  const box = $("cpChart"), note = $("cpChartNote"), pair = $("cpChartPair"), group = document.querySelector(".chart-ranges");
  if (!c || !box || !note) return;

  const BN = "https://data-api.binance.vision/api/v3";
  const CB = "https://api.exchange.coinbase.com";
  const KR = "https://api.kraken.com/0/public";
  const KR_NAME = { BTC: "XBT", DOGE: "XDG" }; // Kraken REST names that differ from the ticker
  const DAY = 864e5;
  // bn: Binance interval and count; cb: Coinbase granularity in seconds (at most 300 candles per call);
  // kr: Kraken interval in minutes (at most 720 candles per call).
  const RANGES = {
    "1d": { ms: DAY, bn: ["15m", 96], cb: 900, kr: 15, name: "24h", step: "15-min" },
    "7d": { ms: 7 * DAY, bn: ["1h", 168], cb: 3600, kr: 60, name: "7 days", step: "hourly" },
    "30d": { ms: 30 * DAY, bn: ["4h", 180], cb: 21600, kr: 240, name: "30 days", step: "4-hour" },
    "1y": { ms: 365 * DAY, bn: ["1d", 365], cb: 86400, kr: 1440, name: "1 year", step: "daily" }
  };

  const getJson = async url => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return res.json();
  };
  // Each source returns [timeMs, close] pairs, oldest first.
  const SOURCES = [
    ["BN", "Binance", "USDT", async r => (await getJson(`${BN}/uiKlines?symbol=${tickerOf(c, "BN")}USDT&interval=${r.bn[0]}&limit=${r.bn[1]}`)).map(k => [+k[0], +k[4]])],
    // Newest first: [time, low, high, open, close, volume].
    ["CB", "Coinbase", "USD", async r => (await getJson(`${CB}/products/${tickerOf(c, "CB")}-USD/candles?granularity=${r.cb}`)).map(k => [k[0] * 1e3, +k[4]]).reverse()],
    // { error, result: { <pair>: [[time, open, high, low, close, vwap, volume, count], …], last } }, oldest first.
    ["KR", "Kraken", "USD", async r => {
      const t = tickerOf(c, "KR");
      const body = await getJson(`${KR}/OHLC?pair=${KR_NAME[t] || t}USD&interval=${r.kr}`);
      const rows = body && body.result && Object.entries(body.result).find(([k]) => k !== "last");
      return rows ? rows[1].map(k => [k[0] * 1e3, +k[4]]) : [];
    }]
  ];

  const cache = new Map();
  async function load(key) {
    if (cache.has(key)) return cache.get(key);
    const r = RANGES[key];
    for (const [ex, label, quote, get] of SOURCES) {
      if (!c.feeds.includes(ex)) continue;
      try {
        const rows = await get(r);
        const end = rows.length ? rows[rows.length - 1][0] : 0;
        const kept = rows.filter(([t, v]) => t > end - r.ms && v > 0);
        if (kept.length < 2) continue;
        const days = (end - kept[0][0]) / DAY;
        // Coinbase returns at most 300 daily candles: say so instead of calling it a year.
        const name = key === "1y" && days < 330 ? `${Math.round(days)} days` : r.name;
        const out = { closes: kept.map(k => k[1]), name, step: r.step, label, quote };
        cache.set(key, out);
        return out;
      } catch (_) { /* next exchange */ }
    }
    return null;
  }

  let want = "1d";
  async function show(key) {
    want = key;
    if (group) group.querySelectorAll("[data-range]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.range === key)));
    if (!cache.has(key)) note.textContent = "Loading chart…";
    const d = await load(key);
    if (want !== key) return; // a newer choice arrived while this one loaded
    if (!d) {
      coinChart.loaded = false; // app.js draws live ticks on its next update
      box.innerHTML = buildSparkline([], true, 600, 140, { fluid: true });
      note.textContent = key === "1d" ? "Live ticks since you opened this page" : `No ${RANGES[key].name} history from the exchanges right now · live ticks`;
      return;
    }
    const { closes } = d;
    const first = closes[0], last = closes[closes.length - 1];
    const chg = ((last - first) / first) * 100;
    coinChart.loaded = true;
    box.innerHTML = buildSparkline(closes, last >= first, 600, 140, {
      fluid: true,
      label: `${c.name} price over ${d.name}: from ${fmtPrice(first)} to ${fmtPrice(last)}, high ${fmtPrice(Math.max(...closes))}, low ${fmtPrice(Math.min(...closes))}`
    });
    note.textContent = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}% · ${d.name} · ${d.step} · ${d.label}`;
    if (pair) pair.textContent = `${c.sym}/${d.quote}`;
  }

  if (group) group.addEventListener("click", e => {
    const b = e.target.closest("[data-range]");
    if (b && RANGES[b.dataset.range]) show(b.dataset.range);
  });
  show("1d");
})();
