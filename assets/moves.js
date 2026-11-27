/* CryptoPriceTicker.com — "When does this coin usually move?" (coin pages).
 *
 * Takes the coin's hourly candles for the last 30 days (Binance, else Kraken, else Coinbase, which gives about 12
 * days), measures each finished hour's move from open to close, and groups the hours by the visitor's own clock:
 * 24 bars for the hours of the day in their time zone, plus weekdays against weekends. Loads when the box comes into
 * view; nothing is stored. Past behaviour only, no forecast. self.cptMoves is exposed for tests (tests/flow.cjs).
 */
(function () {
  "use strict";
  // candles: [[startMs, open, close], ...] → per local hour { avg, n, label } and weekday/weekend averages.
  function group(candles, hourOf, dayOf, labelOf) {
    const hours = Array.from({ length: 24 }, () => ({ sum: 0, n: 0, label: "" }));
    const wk = { sum: 0, n: 0 }, we = { sum: 0, n: 0 };
    for (const [t, o, cl] of candles) {
      if (!(o > 0 && cl > 0)) continue;
      const m = Math.abs(cl / o - 1) * 100, h = hours[hourOf(t)], d = dayOf(t);
      h.sum += m; h.n++;
      if (!h.label) h.label = labelOf(t);
      const g = d === 0 || d === 6 ? we : wk;
      g.sum += m; g.n++;
    }
    const avg = g => (g.n ? g.sum / g.n : null);
    return { hours: hours.map(h => ({ avg: avg(h), n: h.n, label: h.label })), weekday: avg(wk), weekend: avg(we) };
  }
  self.cptMoves = { group };

  const api = window.CPT;
  const box = document.getElementById("movesOut");
  if (!api || api.MODE !== "coin" || !box) return;
  const { state, esc, tickerOf } = api;
  const c = state.coins.get(state.coinPageSym);
  if (!c) return;
  const HOUR = 3600e3, KR_REST = { BTC: "XBT", DOGE: "XDG" };
  const source = c.feeds.includes("BN") ? "Binance" : c.feeds.includes("KR") ? "Kraken" : c.feeds.includes("CB") ? "Coinbase" : null;
  if (!source) return;
  async function get(url) {
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 12000);
    try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(tm); }
  }
  async function candles() {
    if (source === "Binance") {
      const k = await get(`https://data-api.binance.vision/api/v3/klines?symbol=${tickerOf(c, "BN")}USDT&interval=1h&limit=720`);
      return k.map(x => [x[0], +x[1], +x[4]]);
    }
    if (source === "Kraken") {
      const T = tickerOf(c, "KR");
      const j = await get(`https://api.kraken.com/0/public/OHLC?pair=${KR_REST[T] || T}USD&interval=60`);
      if (j.error && j.error.length) throw new Error("kraken");
      const key = Object.keys(j.result).find(k => k !== "last");
      return (j.result[key] || []).map(x => [x[0] * 1000, +x[1], +x[4]]);
    }
    const k = await get(`https://api.exchange.coinbase.com/products/${tickerOf(c, "CB")}-USD/candles?granularity=3600`);
    return k.map(x => [x[0] * 1000, +x[3], +x[4]]).sort((a, b) => a[0] - b[0]);
  }
  const pct = v => (v === null ? "—" : `${v.toFixed(v < 1 ? 2 : 1)}%`);
  const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) { return ""; } })();
  const hourLabel = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: new Date(t).getMinutes() ? "2-digit" : undefined });

  async function load() {
    let rows;
    try { rows = (await candles()).filter(r => r[0] + HOUR <= Date.now()); } catch (e) { rows = []; }
    if (rows.length < 24 * 7) {
      box.innerHTML = `<p class="tm-msg">Couldn't read enough of ${esc(c.sym)}'s hourly prices from ${source} just now. Reload the page to try again.</p>`;
      return;
    }
    const days = Math.round((rows[rows.length - 1][0] - rows[0][0]) / 86400e3);
    const g = group(rows, t => new Date(t).getHours(), t => new Date(t).getDay(), hourLabel);
    const ok = g.hours.filter(h => h.avg !== null);
    const max = Math.max(...ok.map(h => h.avg));
    const hi = ok.reduce((a, b) => (b.avg > a.avg ? b : a)), lo = ok.reduce((a, b) => (b.avg < a.avg ? b : a));
    const nowH = new Date().getHours();
    const bars = g.hours.map((h, i) => `<span class="moves-bar${i === nowH ? " is-now" : ""}" title="${esc(h.label)}: ${pct(h.avg)}"><i style="height:${h.avg === null ? 0 : Math.max(4, h.avg / max * 100).toFixed(1)}%"></i></span>`).join("");
    const ticks = [0, 6, 12, 18].map(i => `<span>${esc(g.hours[i].label || "")}</span>`).join("");
    const nowBar = g.hours[nowH];
    box.innerHTML = `
      <p class="tm-line">Over the last ${days} days, ${esc(c.sym)} moved most in the hour starting <strong>${esc(hi.label)}</strong> your time (an average of ${pct(hi.avg)} from open to close) and least in the hour starting <strong>${esc(lo.label)}</strong> (${pct(lo.avg)}).${nowBar.avg !== null ? ` The hour that started ${esc(nowBar.label)} averaged ${pct(nowBar.avg)}.` : ""}</p>
      <div class="moves-chart" role="img" aria-label="Average hourly move of ${esc(c.sym)} by hour of the day, from ${pct(lo.avg)} to ${pct(hi.avg)}">${bars}</div>
      <div class="moves-ticks" aria-hidden="true">${ticks}</div>
      <p class="tm-line">Weekdays averaged ${pct(g.weekday)} an hour and weekends ${pct(g.weekend)}. Hours are in ${esc(zone || "your device's time zone")}; the highlighted bar is the current hour. Hourly candles from ${source}${source === "Binance" ? " (against USDT)" : ""}. Past moves only, not a forecast.</p>
      <details class="moves-table"><summary>Show the numbers</summary><div class="depth-scroll"><table class="history-table">
        <thead><tr><th scope="col" class="col-left">Hour starting</th><th scope="col">Average move</th><th scope="col">Hours counted</th></tr></thead>
        <tbody>${g.hours.map(h => `<tr><th scope="row" class="col-left">${esc(h.label || "—")}</th><td>${pct(h.avg)}</td><td>${h.n}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "300px" });
    io.observe(box);
  } else load();
})();
