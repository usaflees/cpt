/* CryptoPriceTicker.com — "What would a big order cost?" (coin pages).
 *
 * On request, reads the coin's live public order books on each exchange the page streams (Coinbase and Kraken
 * against USD, Binance against USDT) and walks them for a market order of the visitor's size: the average fill
 * price, how far that is from the exchange's mid price (slippage), how many price levels it eats, and how much
 * is resting within 2% of the mid on that side. Measured from the books at the moment shown; exchange fees are
 * not included and nothing is stored. Without a book the row says so; nothing is estimated.
 * self.cptDepthFill is exposed for tests (tests/depth.cjs).
 */
(function () {
  "use strict";
  // Walk price levels ([[price, size], ...], best first) until `usd` worth is filled.
  function fill(levels, usd) {
    let cost = 0, qty = 0, n = 0;
    for (const [ps, ss] of levels) {
      const p = +ps, s = +ss;
      if (!(p > 0 && s > 0)) continue;
      n++;
      const take = Math.min(s, (usd - cost) / p);
      cost += take * p; qty += take;
      if (cost >= usd * (1 - 1e-9)) return { avg: cost / qty, n, full: true, cost };
    }
    return { avg: qty ? cost / qty : NaN, n, full: false, cost };
  }
  const within = (levels, mid, pct) => levels.reduce((t, [p, s]) => (Math.abs(+p / mid - 1) * 100 <= pct ? t + +p * +s : t), 0);
  self.cptDepthFill = fill;

  const api = window.CPT;
  const form = document.getElementById("depthForm");
  if (!api || api.MODE !== "coin" || !form) return;
  const { state, esc, tickerOf } = api;
  const c = state.coins.get(state.coinPageSym);
  if (!c) return;
  const out = document.getElementById("depthOut"), amtIn = document.getElementById("depthAmt"), sideIn = document.getElementById("depthSide");
  const KR_NAME = { BTC: "XBT", DOGE: "XDG" };
  const BOOKS = {
    CB: { name: "Coinbase", quote: "USD", url: t => `https://api.exchange.coinbase.com/products/${t}-USD/book?level=2`, read: j => j },
    BN: { name: "Binance", quote: "USDT", url: t => `https://data-api.binance.vision/api/v3/depth?symbol=${t}USDT&limit=1000`, read: j => j },
    KR: {
      name: "Kraken", quote: "USD", url: t => `https://api.kraken.com/0/public/Depth?pair=${KR_NAME[t] || t}USD&count=500`,
      read: j => { if (!j.result || (j.error && j.error.length)) throw new Error("kraken"); return Object.values(j.result)[0]; }
    }
  };
  const feeds = c.feeds.filter(ex => BOOKS[ex]);
  const money = (v, q) => `${q === "USD" ? "$" : ""}${v >= 1 ? v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 }) : v.toPrecision(4)}${q === "USD" ? "" : " " + q}`;
  const price = (v, q) => `${q === "USD" ? "$" : ""}${v.toLocaleString("en-US", { maximumSignificantDigits: 6 })}${q === "USD" ? "" : " " + q}`;
  const pct = v => `${v < 0.005 ? "<0.01" : v.toFixed(v < 1 ? 2 : 1)}%`;

  async function book(ex) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(BOOKS[ex].url(tickerOf(c, ex)), { signal: ctrl.signal });
      if (!r.ok) throw new Error(r.status);
      const b = BOOKS[ex].read(await r.json());
      if (!b || !b.bids?.length || !b.asks?.length) throw new Error("empty");
      return b;
    } finally { clearTimeout(timer); }
  }

  let busy = false;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const usd = +amtIn.value, buy = sideIn.value !== "sell";
    if (!(usd >= 1 && usd <= 1e9)) { out.innerHTML = `<p class="tm-msg">Enter an order size between $1 and $1,000,000,000.</p>`; return; }
    if (busy) return;
    busy = true;
    out.innerHTML = `<p class="tm-msg">Reading ${esc(feeds.map(ex => BOOKS[ex].name).join(", "))} order books…</p>`;
    const res = await Promise.all(feeds.map(ex => book(ex).then(b => {
      const bid = +b.bids[0][0], ask = +b.asks[0][0], mid = (bid + ask) / 2;
      const side = buy ? b.asks : b.bids, f = fill(side, usd);
      const slip = f.full ? (buy ? f.avg / mid - 1 : 1 - f.avg / mid) * 100 : null;
      return { ex, f, slip, spread: (ask - bid) / mid * 100, near: within(side, mid, 2) };
    }, () => ({ ex, err: true }))));
    busy = false;
    const ok = res.filter(r => !r.err && r.slip !== null).sort((a, b) => a.slip - b.slip);
    const rows = ok.concat(res.filter(r => r.err || r.slip === null)).map(r => {
      const B = BOOKS[r.ex];
      if (r.err) return `<tr><th scope="row" class="col-left">${B.name}</th><td colspan="4" class="muted">Couldn't read the order book just now.</td></tr>`;
      const best = r === ok[0] && ok.length > 1 ? ` <span class="depth-best">lowest cost</span>` : "";
      if (r.slip === null) return `<tr><th scope="row" class="col-left">${B.name}</th><td colspan="3" class="muted">Only ${money(r.f.cost, B.quote)} on the ${r.f.n} price levels the exchange returned: the book can't fill this order.</td><td>${money(r.near, B.quote)}</td></tr>`;
      return `<tr><th scope="row" class="col-left">${B.name}${best}</th><td>${price(r.f.avg, B.quote)}</td><td>${pct(r.slip)}</td><td>${r.f.n}</td><td>${money(r.near, B.quote)}</td></tr>`;
    }).join("");
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    out.innerHTML = `<div class="depth-scroll"><table class="history-table depth-table">
        <caption>A market ${buy ? "buy" : "sell"} of ${money(usd, "USD")} of ${esc(c.sym)}, order books read at ${esc(t)}</caption>
        <thead><tr><th scope="col" class="col-left">Exchange</th><th scope="col">Average fill</th><th scope="col">Cost vs mid price</th><th scope="col">Price levels</th><th scope="col">${buy ? "Asks" : "Bids"} within 2%</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="tm-line">Cost vs mid price is how much worse the average fill is than the middle of the best bid and ask (slippage plus half the spread). Exchange fees come on top. Binance trades against USDT, which is close to but not exactly $1. Books change every second; press again to re-read.</p>`;
  });
})();
