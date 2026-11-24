/* CryptoPriceTicker.com — Time Machine (coin pages): "What would it be worth?"
 *
 * Amount + date → what that amount bought at the day's closing price, what it is worth now at the live price,
 * and the lowest and highest point along the way. Daily closes come from Binance (BTCUSDT-style pairs, back to
 * 2017) or, for coins Binance doesn't list, Coinbase (300 days per request), then Kraken (last 720 days only). Nothing loads until the visitor
 * presses Calculate. Past performance only; the box never projects forward.
 */
(function () {
  "use strict";
  const api = window.CPT;
  const form = document.getElementById("tmForm");
  if (!api || api.MODE !== "coin" || !form) return;
  const { state, fmtPrice, getRate, currSymbol } = api;
  // Money amounts (what the visitor put in, what it is worth): two decimals in the display currency.
  const money = usd => { const r = getRate(); return r ? currSymbol() + (usd / r).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; };
  const c = state.coins.get(state.coinPageSym);
  if (!c) return;
  const $ = id => document.getElementById(id);
  const out = $("tmOut"), dateIn = $("tmDate"), amtIn = $("tmAmt");
  const DAY = 86400e3;
  const day = t => new Date(t).toISOString().slice(0, 10);
  const nice = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const yesterday = day(Date.now() - DAY);
  dateIn.max = yesterday;
  const source = c.feeds.includes("BN") ? "Binance" : c.feeds.includes("CB") ? "Coinbase" : c.feeds.includes("KR") ? "Kraken" : null;
  let cache = null; // { from, rows: [[t, close], ...] } oldest first

  async function getJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function closesFrom(start) {
    if (cache && cache.from <= start) return cache.rows.filter(r => r[0] >= start - DAY / 2);
    const rows = [];
    if (source === "Binance") {
      const pair = (c.tickers.BN || c.sym) + "USDT";
      for (let t = start, n = 0; t < Date.now() && n < 6; n++) {
        const k = await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=1d&startTime=${t}&limit=1000`);
        if (!k.length) break;
        k.forEach(x => rows.push([x[0], +x[4]]));
        t = k[k.length - 1][0] + DAY;
        if (k.length < 1000) break;
      }
    } else if (source === "Coinbase") {
      const prod = (c.tickers.CB || c.sym) + "-USD";
      for (let t = start, n = 0; t < Date.now() && n < 15; n++) {
        const end = Math.min(t + 299 * DAY, Date.now());
        const k = await getJson(`https://api.exchange.coinbase.com/products/${prod}/candles?granularity=86400&start=${new Date(t).toISOString()}&end=${new Date(end).toISOString()}`);
        k.slice().reverse().forEach(x => rows.push([x[0] * 1000, +x[4]]));
        t = end + DAY;
      }
      rows.sort((a, b) => a[0] - b[0]);
    } else if (source === "Kraken") {
      // Kraken returns the last 720 daily candles at most, whatever "since" says.
      const r = await getJson(`https://api.kraken.com/0/public/OHLC?pair=${(c.tickers.KR || c.sym)}USD&interval=1440&since=${Math.floor(start / 1000)}`);
      if (r.error && r.error.length) throw new Error(r.error[0]);
      const key = Object.keys(r.result).find(k => k !== "last");
      (r.result[key] || []).forEach(x => rows.push([x[0] * 1000, +x[4]]));
    }
    const done = rows.filter(r => day(r[0]) <= yesterday && r[1] > 0); // completed days only
    cache = { from: start, rows: done };
    return done;
  }

  function show(html) { out.innerHTML = html; }
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const amount = parseFloat(amtIn.value), iso = dateIn.value;
    if (!(amount > 0) || !iso) return show(`<p class="tm-msg">Enter an amount and a date.</p>`);
    if (iso > yesterday) return show(`<p class="tm-msg">Pick a date before today: the box uses completed daily closes.</p>`);
    if (!source) return show(`<p class="tm-msg">— No daily price history for ${c.sym} from Binance, Coinbase or Kraken.</p>`);
    show(`<p class="tm-msg">Fetching ${c.sym}'s daily closes from ${source}…</p>`);
    let rows;
    try { rows = await closesFrom(Date.parse(iso + "T00:00:00Z")); } catch (_) { return show(`<p class="tm-msg">— ${source} didn't answer. Try again in a minute.</p>`); }
    if (!rows.length) return show(`<p class="tm-msg">— No ${source} daily price for ${c.sym} on or after ${nice(iso)}.</p>`);
    const first = rows[0];
    if ((first[0] - Date.parse(iso + "T00:00:00Z")) / DAY > 3) {
      return show(`<p class="tm-msg">— ${source} has no ${c.sym} price for ${nice(iso)}. ${source === "Kraken" ? "Kraken's public daily history covers about the last two years" : "Its daily history there"} starts on ${nice(day(first[0]))}; try that date or later.</p>`);
    }
    if (!(c.price > 0) || !c.live) return show(`<p class="tm-msg">Waiting for the live ${c.sym} price…</p>`);
    const buy = first[1], units = amount / buy;
    const after = rows.slice(1);
    const lo = after.reduce((a, r) => (r[1] < a[1] ? r : a), first), hi = after.reduce((a, r) => (r[1] > a[1] ? r : a), first);
    const nowVal = units * c.price;
    const pct = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
    const chg = (nowVal / amount - 1) * 100;
    const usd = v => fmtPrice(v);
    show(`<p class="tm-line">${money(amount)} of ${c.sym} on ${nice(day(first[0]))} bought ${units.toPrecision(6).replace(/\.?0+$/, "")} ${c.sym} at the day's close of ${usd(buy)}.</p>
      <p class="tm-big">${money(nowVal)} <span class="${chg >= 0 ? "txt-up" : "txt-down"}">${pct(chg)}</span></p>
      <p class="tm-line">Worth that now at the live price of ${usd(c.price)}. Along the way it fell as low as ${money(units * lo[1])} (${nice(day(lo[0]))}, ${pct((lo[1] / buy - 1) * 100)}) and rose as high as ${money(units * hi[1])} (${nice(day(hi[0]))}, ${pct((hi[1] / buy - 1) * 100)}).</p>
      <p class="disclaimer">Daily closes (UTC) from ${source}${source === "Binance" ? " in USDT, treated as US dollars" : ""}. Ignores fees. Past prices, not a forecast.</p>`);
  });
})();
