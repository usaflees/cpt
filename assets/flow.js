/* CryptoPriceTicker.com — "Who's buying and who's selling right now?" (coin pages).
 *
 * Counts each trade on the exchanges the page streams (Coinbase and Kraken against USD, Binance against USDT) by the
 * side that crossed the spread: a buyer taking an ask, or a seller hitting a bid. Each exchange's last 1,000 trades
 * come over its public REST API, then new ones arrive on its public trade stream. A window (1, 5 or 15 minutes) only
 * counts an exchange once its trades cover the whole window; until then the row says it is still filling. Runs while
 * the box has been seen and the tab is visible; stores nothing. self.cptFlow is for tests.
 */
(function () {
  "use strict";
  // Taker side per exchange: true when the buyer crossed the spread.
  const SIDE = {
    CB: s => s === "sell", // Coinbase reports the maker's side
    KR: s => s === "b" || s === "buy", // Kraken reports the taker's side
    BN: m => !m // Binance: m is true when the buyer was the maker
  };
  // Totals for one window from per-exchange trade lists ([[t, usd, buy], ...]) and coverage starts.
  function tally(trades, cover, now, ms) {
    const from = now - ms, out = { buy: 0, sell: 0, ex: {}, big: null };
    for (const ex in trades) {
      if (!(cover[ex] <= from)) continue;
      let b = 0, s = 0;
      for (const [t, usd, buy, px] of trades[ex]) {
        if (t < from || t > now) continue;
        if (buy) b += usd; else s += usd;
        if (!out.big || usd > out.big.usd) out.big = { ex, t, usd, buy, px };
      }
      out.ex[ex] = { buy: b, sell: s };
      out.buy += b; out.sell += s;
    }
    return out;
  }
  self.cptFlow = { SIDE, tally };

  const api = window.CPT;
  const box = document.getElementById("flowOut");
  if (!api || api.MODE !== "coin" || !box || !("WebSocket" in window)) return;
  const { state, esc, tickerOf } = api;
  const c = state.coins.get(state.coinPageSym);
  if (!c) return;
  const NAME = { CB: "Coinbase", KR: "Kraken", BN: "Binance" };
  const KR_REST = { BTC: "XBT", DOGE: "XDG" };
  const feeds = c.feeds.filter(ex => NAME[ex]);
  if (!feeds.length) return;
  // Arrived from a price alert (notify() in app.js): say so above the box and bring it into view.
  // The # is dropped once read, so a reload, bookmark or shared link doesn't repeat it.
  const fromAlert = () => {
    if (location.hash !== "#from-alert") return;
    history.replaceState(null, "", location.pathname + location.search);
    if (!document.querySelector(".flow-alert")) box.insertAdjacentHTML("beforebegin", `<p class="tm-line flow-alert" role="status">You opened this page from a ${esc(c.sym)} alert. Below: who has been buying and who has been selling over the last few minutes.</p>`);
    requestAnimationFrame(() => box.parentElement.scrollIntoView({ block: "start" }));
  };
  fromAlert();
  addEventListener("hashchange", fromAlert);
  const WINDOWS = [[60e3, "1 minute"], [300e3, "5 minutes"], [900e3, "15 minutes"]];
  const KEEP = 900e3, CAP = 60000;
  let trades, ids, cover, socks, timer, running = false, gen = 0; // gen: the run a socket or fetch is for

  function add(ex, id, t, px, qty, buy) {
    if (!(px > 0 && qty > 0 && t > 0) || ids[ex].has(id)) return;
    ids[ex].add(id);
    trades[ex].push([t, px * qty, buy, px]);
  }
  function prune(now) {
    for (const ex in trades) {
      const l = trades[ex];
      let i = 0;
      while (i < l.length && l[i][0] < now - KEEP) i++;
      const over = l.length - i - CAP;
      if (over > 0) { i += over; cover[ex] = Math.max(cover[ex], l[i][0]); } // dropped trades inside the window
      if (i) l.splice(0, i);
      if (ids[ex].size > 5000) ids[ex].clear(); // ids only drop the overlap between the REST list and the stream
    }
  }
  async function get(url) {
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 12000);
    try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(tm); }
  }
  // Recent trades over REST; coverage starts at the oldest one. Without them, coverage starts when the stream opens.
  async function seed(ex, g) {
    const T = tickerOf(c, ex);
    let oldest = Infinity;
    try {
      if (ex === "CB") {
        const l = await get(`https://api.exchange.coinbase.com/products/${T}-USD/trades?limit=1000`);
        if (g !== gen) return; // a fetch from a run that has since stopped
        for (const x of l) {
          const t = Date.parse(x.time); oldest = Math.min(oldest, t);
          add(ex, x.trade_id, t, +x.price, +x.size, SIDE.CB(x.side));
        }
      } else if (ex === "KR") {
        const j = await get(`https://api.kraken.com/0/public/Trades?pair=${KR_REST[T] || T}USD&count=1000`);
        if (g !== gen) return;
        if (j.error && j.error.length) throw new Error("kraken");
        const key = Object.keys(j.result || {}).find(k => k !== "last");
        for (const x of j.result[key] || []) {
          const t = Math.round(x[2] * 1000); oldest = Math.min(oldest, t);
          add(ex, x[6], t, +x[0], +x[1], SIDE.KR(x[3]));
        }
      } else {
        const l = await get(`https://data-api.binance.vision/api/v3/aggTrades?symbol=${T}USDT&limit=1000`);
        if (g !== gen) return;
        for (const x of l) {
          oldest = Math.min(oldest, x.T);
          add(ex, x.a, x.T, +x.p, +x.q, SIDE.BN(x.m));
        }
      }
    } catch (e) { /* stream-only coverage */ }
    if (g !== gen) return;
    trades[ex].sort((a, b) => a[0] - b[0]);
    if (oldest < cover[ex] && cover[ex] !== Infinity) cover[ex] = oldest;
  }
  function stream(ex, first, g) {
    const T = tickerOf(c, ex);
    const url = ex === "CB" ? "wss://ws-feed.exchange.coinbase.com" : ex === "KR" ? "wss://ws.kraken.com/v2"
      : `wss://data-stream.binance.vision/stream?streams=${T.toLowerCase()}usdt@aggTrade`;
    const ws = new WebSocket(url);
    socks[ex] = ws;
    let live = false;
    // Counting starts once the exchange confirms the subscription (or sends a trade); the recent trades are fetched
    // then, so the REST list and the stream overlap.
    const goLive = () => {
      if (live || g !== gen) return;
      live = true;
      if (cover[ex] === Infinity) cover[ex] = Date.now();
      if (first) setTimeout(() => { if (g === gen) seed(ex, g).then(() => { if (g === gen) render(); }); }, 800);
    };
    ws.onopen = () => {
      if (g !== gen) return ws.close();
      if (ex === "CB") ws.send(JSON.stringify({ type: "subscribe", product_ids: [T + "-USD"], channels: ["matches"] }));
      if (ex === "KR") ws.send(JSON.stringify({ method: "subscribe", params: { channel: "trade", symbol: [T + "/USD"], snapshot: false } }));
      if (ex === "BN") goLive(); // the stream URL is the subscription
    };
    ws.onmessage = e => {
      if (g !== gen) return;
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (ex === "CB" ? m.type === "subscriptions" || m.type === "match" : ex === "KR" && ((m.method === "subscribe" && m.success) || m.channel === "trade")) goLive();
      if (ex === "CB" && m.type === "match") add(ex, m.trade_id, Date.parse(m.time), +m.price, +m.size, SIDE.CB(m.side));
      else if (ex === "KR" && m.channel === "trade" && Array.isArray(m.data)) m.data.forEach(d => add(ex, d.trade_id, Date.parse(d.timestamp), +d.price, +d.qty, SIDE.KR(d.side)));
      else if (ex === "BN" && m.data && m.data.e === "aggTrade") add(ex, m.data.a, m.data.T, +m.data.p, +m.data.q, SIDE.BN(m.data.m));
    };
    ws.onclose = () => {
      if (g !== gen || socks[ex] !== ws) return;
      // A gap breaks the count: coverage restarts when the stream is back.
      cover[ex] = Infinity;
      setTimeout(() => { if (g === gen) stream(ex, false, g); }, 3000);
    };
  }

  const usd = v => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;
  const share = (b, s) => (b + s ? Math.round(b / (b + s) * 100) : null);
  const clock = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const mmss = ms => `${Math.floor(ms / 60e3)}:${String(Math.floor(ms / 1e3) % 60).padStart(2, "0")}`;

  function render() {
    const now = Date.now();
    prune(now);
    const first = Math.min(...feeds.map(ex => cover[ex]));
    const rows = WINDOWS.map(([ms, label]) => {
      const r = tally(trades, cover, now, ms), n = Object.keys(r.ex).length;
      if (!n) return `<tr><th scope="row" class="col-left">Last ${label}</th><td colspan="3" class="muted">Still filling: ${first < now ? mmss(Math.min(now - first, ms)) : "0:00"} of ${mmss(ms)} collected</td></tr>`;
      const p = share(r.buy, r.sell);
      const part = n < feeds.length ? ` <span class="muted">(${Object.keys(r.ex).map(ex => NAME[ex]).join(", ")})</span>` : "";
      return `<tr><th scope="row" class="col-left">Last ${label}${part}</th><td>${usd(r.buy)}</td><td>${usd(r.sell)}</td>
        <td><span class="flow-bar" role="img" aria-label="${p === null ? "No trades" : p + "% bought"}"><i style="width:${p === null ? 0 : p}%"></i></span> ${p === null ? "—" : p + "%"}</td></tr>`;
    }).join("");
    const five = tally(trades, cover, now, 300e3);
    const per = Object.entries(five.ex).map(([ex, v]) => `${NAME[ex]} ${share(v.buy, v.sell) ?? "—"}${share(v.buy, v.sell) === null ? "" : "%"}`).join(", ");
    const [bigMs, bigLabel] = WINDOWS.slice().reverse().find(([ms]) => Object.keys(tally(trades, cover, now, ms).ex).length) || [];
    const bigT = bigMs && tally(trades, cover, now, bigMs), big = bigT && bigT.big;
    const bigEx = bigT && Object.keys(bigT.ex).length < feeds.length ? ` on ${Object.keys(bigT.ex).map(ex => NAME[ex]).join(" and ")}` : "";
    box.innerHTML = `<div class="depth-scroll"><table class="history-table flow-table">
        <caption>${esc(c.sym)} trades by the side that crossed the spread, updated ${esc(clock(now))}</caption>
        <thead><tr><th scope="col" class="col-left">Window</th><th scope="col">Bought</th><th scope="col">Sold</th><th scope="col">Buyers' share</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="tm-line">${per ? `Buyers' share over 5 minutes by exchange: ${esc(per)}.` : `Collecting trades from ${esc(feeds.map(ex => NAME[ex]).join(", "))}…`}${big ? ` Biggest trade in the last ${bigLabel}${bigEx}: ${usd(big.usd)} ${big.buy ? "bought" : "sold"} on ${NAME[big.ex]} at ${esc(clock(big.t))}.` : ""}</p>
      <p class="tm-line">"Bought" is volume where a buyer took the lowest ask, "sold" is volume where a seller hit the highest bid. Binance trades are in USDT, counted as dollars. A share above 50% means buyers were paying up; it is a count of past trades, not a forecast.</p>`;
  }

  function start() {
    if (running) return;
    running = true;
    const g = ++gen;
    trades = {}; ids = {}; cover = {}; socks = {};
    feeds.forEach(ex => { trades[ex] = []; ids[ex] = new Set(); cover[ex] = Infinity; stream(ex, true, g); });
    render();
    timer = setInterval(render, 2000);
  }
  function stop() {
    running = false;
    gen++; // late timers, fetches and socket events from this run now do nothing
    clearInterval(timer);
    Object.values(socks || {}).forEach(ws => { try { ws.close(); } catch (_) {} });
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (seen) start(); });
  let seen = false;
  const go = () => { seen = true; if (!document.hidden) start(); };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" });
    io.observe(box);
  } else go();
})();
