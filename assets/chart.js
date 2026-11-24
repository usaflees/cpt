/* Coin page price chart (24h, 7d, 30d, 1y), loaded after app.js (window.CPT). Candles: Binance (USDT), then
 * Coinbase, then Kraken (USD), from each exchange's public API. Without them app.js draws live ticks. */
(function () {
  "use strict";
  const api = window.CPT;
  if (!api || api.MODE !== "coin" || !api.coinChart) return;
  const { state, tickerOf, coinChart, fmtPrice, esc } = api;
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
    // { result: { <pair>: [[time, open, high, low, close, …], …], last } }, oldest first.
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
        const out = { times: kept.map(k => k[0]), closes: kept.map(k => k[1]), name, step: r.step, label, quote };
        cache.set(key, out);
        return out;
      } catch (_) { /* next exchange */ }
    }
    return null;
  }

  // Axis: whole dollars from $1,000 up; the readout keeps full precision.
  const NF0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const usd = v => fmtPrice(v, "USD");
  const axisPrice = v => (v >= 1000 ? "$" + NF0.format(v) : usd(v));
  const HM = { hour: "numeric", minute: "2-digit" }, MD = { month: "short", day: "numeric" };
  const TIME_FMT = { "1d": [HM, HM], "7d": [MD, { weekday: "short", ...MD, hour: "numeric" }], "30d": [MD, { ...MD, hour: "numeric" }], "1y": [{ month: "short", year: "2-digit" }, { ...MD, year: "numeric" }] };
  const fmtTime = (t, key, long) => new Date(t).toLocaleString(undefined, TIME_FMT[key][long ? 1 : 0]);

  // A 600 x 140 viewBox stretched to fit.
  const W = 600, H = 140, PAD = 6;

  function draw(d, key) {
    const { closes, times } = d;
    const min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1;
    const n = closes.length;
    const yAt = v => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
    const line = closes.map((v, i) => `${(i / (n - 1) * W).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
    const area = `M0,${H} L${line.replace(/ /g, " L")} L${W},${H} Z`;
    const first = closes[0], last = closes[n - 1];
    const mid = Math.round((n - 1) / 2);
    const grid = [PAD, H / 2, H - PAD].map(y => `<line x2="${W}" y1="${y}" y2="${y}"/>`).join("");
    const label = `${c.name} price over ${d.name}: from ${usd(first)} to ${usd(last)}, high ${usd(max)}, low ${usd(min)}`;
    box.innerHTML = `<div class="cx ${last >= first ? "cx-up" : "cx-down"}" role="img" aria-label="${esc(label)}">
      <div class="cx-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}<path class="cx-area" d="${area}"/><polyline class="cx-line" points="${line}"/></svg><div class="cx-cross" hidden><span class="cx-dot"></span></div><div class="cx-tip" hidden></div></div>
      <div class="cx-y" aria-hidden="true"><span>${axisPrice(max)}</span><span>${axisPrice(min + span / 2)}</span><span>${axisPrice(min)}</span></div>
      <div class="cx-x" aria-hidden="true"><span>${fmtTime(times[0], key)}</span><span>${fmtTime(times[mid], key)}</span><span>${fmtTime(times[n - 1], key)}</span></div>
    </div>`;

    // Hover or drag for the price and time of any point.
    const plot = box.querySelector(".cx-plot"), cross = plot.querySelector(".cx-cross"), dot = plot.querySelector(".cx-dot"), tip = plot.querySelector(".cx-tip");
    const move = e => {
      const r = plot.getBoundingClientRect();
      const i = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1))) * (n - 1));
      const pct = (i / (n - 1)) * 100;
      cross.hidden = tip.hidden = false;
      cross.style.left = pct + "%";
      dot.style.top = (yAt(closes[i]) / H) * 100 + "%";
      tip.textContent = `${usd(closes[i])} · ${fmtTime(times[i], key, true)}`;
      tip.style.left = pct + "%";
      tip.style.transform = `translateX(-${pct}%)`;
    };
    plot.addEventListener("pointermove", move);
    plot.addEventListener("pointerdown", move);
    plot.addEventListener("pointerleave", () => { cross.hidden = tip.hidden = true; });
    // No % on 24h: the ticker's 24h change already sits by the price.
    const chg = ((last - first) / first) * 100;
    note.textContent = (key === "1d" ? "24h · " : `${chg >= 0 ? "+" : "−"}${Math.abs(chg).toFixed(2)}% over ${d.name} · `) + `${d.step} closes · ${d.label}`;
  }

  let want = "1d";
  async function show(key) {
    want = key;
    if (group) group.querySelectorAll("[data-range]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.range === key)));
    if (!cache.has(key)) note.textContent = "Loading chart…";
    const d = await load(key);
    if (want !== key) return; // a newer choice arrived meanwhile
    if (!d) {
      coinChart.loaded = false; // app.js draws live ticks
      box.innerHTML = `<p class="chart-empty">Waiting for live prices…</p>`;
      if (pair) pair.textContent = `${c.sym}/USD`;
      note.textContent = key === "1d" ? "Live ticks since you opened this page" : `No ${RANGES[key].name} history from the exchanges right now · live ticks`;
      return;
    }
    coinChart.loaded = true;
    draw(d, key);
    if (pair) pair.textContent = `${c.sym}/${d.quote}`;
  }

  if (group) group.addEventListener("click", e => {
    const b = e.target.closest("[data-range]");
    if (b && RANGES[b.dataset.range]) show(b.dataset.range);
  });
  show("1d");
})();
