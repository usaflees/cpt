/* CryptoPriceTicker.com — "Where are the big orders waiting?" (coin pages).
 *
 * Reads the coin's public order books on the exchanges the page streams (Binance against USDT, Kraken and Coinbase
 * against USD), groups every resting order within 2% of the price into price bands about 0.1% wide, adds the
 * exchanges together (only as far from the price as every exchange's returned book reaches), and lists the three biggest bands on each side: the buy and sell "walls". It reads again
 * every 20 seconds (Coinbase, whose book is much bigger, every 2 minutes) while the box has been seen and the tab is
 * visible, and notes a wall that shrank by two thirds or more while the price stayed away from it: pulled before
 * it could trade. Only what the books showed while this page was open; nothing is stored. self.cptWalls is for tests.
 */
(function () {
  "use strict";
  // Price band width close to 0.1% of the price: 1, 2 or 5 times a power of ten.
  function width(mid) {
    const raw = mid * 0.001, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
    return +((f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p).toPrecision(1);
  }
  // books: { EX: { bids: [[p, s]], asks: [[p, s]] } } → per side a Map of band → { usd, ex: { EX: usd } }, counting
  // bids from lo up and asks up to hi.
  function bands(books, w, lo, hi) {
    const out = { bids: new Map(), asks: new Map() };
    for (const ex in books) for (const side of ["bids", "asks"]) for (const [ps, ss] of books[ex][side] || []) {
      const p = +ps, s = +ss;
      if (!(s > 0 && (side === "bids" ? p >= lo : p <= hi))) continue;
      const k = Math.floor(p / w + 1e-9), b = out[side].get(k) || { usd: 0, ex: {} };
      b.usd += p * s; b.ex[ex] = (b.ex[ex] || 0) + p * s;
      out[side].set(k, b);
    }
    return out;
  }
  // The n biggest bands of one side, each with how many times the side's median band it is.
  function top(map, n) {
    const all = [...map].map(([k, b]) => ({ k, ...b })), sizes = all.map(b => b.usd).sort((a, b) => a - b);
    const med = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
    return all.sort((a, b) => b.usd - a.usd).slice(0, n).map(b => ({ ...b, x: med ? b.usd / med : null }));
  }
  // Walls from the last read that lost two thirds of their size while their band was still inside what the books
  // reach, and while the price (lowest and highest seen since that read) stayed more than 0.25% away from them.
  function pulledOf(prev, now, w, lo, hi, pLo, pHi) {
    return prev.filter(p => {
      const a = p.k * w, z = (p.k + 1) * w;
      if (p.side === "bids" ? a < lo : z > hi) return false;
      const gap = p.side === "bids" ? pLo / z - 1 : 1 - pHi / a;
      return (now[p.side].get(p.k) || { usd: 0 }).usd < p.usd / 3 && gap * 100 > 0.25;
    });
  }
  self.cptWalls = { width, bands, top, pulledOf };

  const api = window.CPT;
  const box = document.getElementById("wallsOut");
  if (!api || api.MODE !== "coin" || !box) return;
  const { state, esc, tickerOf } = api;
  const c = state.coins.get(state.coinPageSym);
  if (!c) return;
  const KR = { BTC: "XBT", DOGE: "XDG" };
  const SRC = {
    BN: { name: "Binance", every: 20e3, url: t => `https://data-api.binance.vision/api/v3/depth?symbol=${t}USDT&limit=5000`, read: j => j },
    KR: {
      name: "Kraken", every: 20e3, url: t => `https://api.kraken.com/0/public/Depth?pair=${KR[t] || t}USD&count=500`,
      read: j => { if (!j.result || (j.error && j.error.length)) throw new Error("kraken"); return Object.values(j.result)[0]; }
    },
    CB: { name: "Coinbase", every: 120e3, url: t => `https://api.exchange.coinbase.com/products/${t}-USD/book?level=2`, read: j => j }
  };
  const feeds = c.feeds.filter(ex => SRC[ex]);
  if (!feeds.length) return;
  const PCT = 2, MAXAGE = 300e3, MINREACH = 0.3;
  let books = {}, read = {}, w = 0, seenSince, prev, events, hist, sampler, gen = 0, running = false, seen = false;
  const ctrls = new Set();

  async function get(ex) {
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 12000);
    ctrls.add(ctrl);
    try {
      const r = await fetch(SRC[ex].url(tickerOf(c, ex)), { signal: ctrl.signal });
      if (!r.ok) throw new Error(r.status);
      const b = SRC[ex].read(await r.json());
      if (!b || !b.bids?.length || !b.asks?.length) throw new Error("empty");
      // Keep only what the bands can use, so a big book doesn't stay in memory.
      const mid = (+b.bids[0][0] + +b.asks[0][0]) / 2, lo = mid * (1 - PCT / 100), hi = mid * (1 + PCT / 100);
      // How far from the price the returned book reaches on each side, up to PCT.
      const reach = (l, f) => Math.min(PCT, Math.abs(f(+l[l.length - 1][0]) * 100));
      return { mid, bids: b.bids.filter(l => +l[0] >= lo), asks: b.asks.filter(l => +l[0] <= hi), rb: reach(b.bids, p => 1 - p / mid), ra: reach(b.asks, p => p / mid - 1) };
    } finally { clearTimeout(tm); ctrls.delete(ctrl); }
  }

  const usd = v => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
  const px = v => `$${v.toLocaleString("en-US", { maximumSignificantDigits: 6 })}`;
  const clock = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const mmss = ms => `${Math.floor(ms / 60e3)}:${String(Math.floor(ms / 1e3) % 60).padStart(2, "0")}`;
  const names = ex => Object.entries(ex).sort((a, b) => b[1] - a[1]).map(([e]) => SRC[e].name).join(", ");
  const list = a => a.map(ex => SRC[ex].name).join(", ");

  async function tick(g) {
    const now = Date.now();
    // A failed read also waits its turn, so a slow Coinbase book isn't fetched every 20 s.
    await Promise.all(feeds.map(ex => (now - (read[ex] || 0) >= SRC[ex].every - 500)
      ? (read[ex] = now, get(ex).then(b => { if (g === gen) books[ex] = { ...b, t: Date.now() }; }, () => {})) : null));
    if (g !== gen) return;
    for (const ex in books) if (Date.now() - books[ex].t > MAXAGE) delete books[ex];
    draw();
    setTimeout(() => { if (g === gen) tick(g); }, 20e3);
  }

  function draw() {
    const live = Object.keys(books);
    if (!live.length) { box.innerHTML = `<p class="tm-msg">Couldn't read ${esc(c.sym)}'s order books just now. It tries again every 20 seconds.</p>`; return; }
    const mids = live.map(ex => books[ex].mid).sort((a, b) => a - b), mid = mids[Math.floor(mids.length / 2)];
    if (!w) w = width(mid);
    // Each side adds up the books that reach at least MINREACH, as far as the shortest of them reaches.
    const use = k => { const ok = live.filter(ex => books[ex][k] >= MINREACH); return ok.length ? ok : live; };
    const useB = use("rb"), useA = use("ra");
    const rb = Math.min(...useB.map(ex => books[ex].rb)), ra = Math.min(...useA.map(ex => books[ex].ra));
    const lo = mid * (1 - rb / 100), hi = mid * (1 + ra / 100), pick = l => Object.fromEntries(l.map(ex => [ex, books[ex]]));
    const b = { bids: bands(pick(useB), w, lo, Infinity).bids, asks: bands(pick(useA), w, 0, hi).asks };
    const now = Date.now(), walls = { bids: top(b.bids, 3), asks: top(b.asks, 3) };
    hist.push([now, mid]);
    // Each wall is checked against the lowest and highest price since the oldest book it was measured from.
    for (const p of prev) {
      if (!Object.keys(p.ex).every(ex => (p.side === "bids" ? useB : useA).includes(ex))) continue;
      const span = hist.filter(h => h[0] >= p.since).map(h => h[1]);
      if (pulledOf([p], b, w, lo, hi, Math.min(...span), Math.max(...span)).length) events.unshift({ t: now, side: p.side, k: p.k, usd: p.usd, ex: p.ex });
    }
    events = events.slice(0, 3);
    const since = x => Math.min(...Object.keys(x.ex).map(ex => books[ex].t));
    prev = [...walls.bids.map(x => ({ ...x, side: "bids", since: since(x) })), ...walls.asks.map(x => ({ ...x, side: "asks", since: since(x) }))];
    // "Seen for" keeps counting while a band stays among its side's ten biggest.
    const keep = new Set([...top(b.bids, 10).map(x => "bids" + x.k), ...top(b.asks, 10).map(x => "asks" + x.k)]);
    for (const k of Object.keys(seenSince)) if (!keep.has(k)) delete seenSince[k];
    keep.forEach(k => { seenSince[k] = seenSince[k] || now; });
    const row = (x, side) => {
      const a = x.k * w, z = (x.k + 1) * w, d = ((side === "bids" ? z : a) / mid - 1) * 100;
      return `<tr><th scope="row" class="col-left">${side === "bids" ? "Buy" : "Sell"}</th><td>${px(a)} to ${px(z)}</td><td>${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}%</td>
        <td>${usd(x.usd)}${x.x ? ` <span class="muted">(${x.x.toFixed(x.x < 10 ? 1 : 0)}×)</span>` : ""}</td><td>${esc(names(x.ex))}</td><td>${mmss(now - seenSince[side + x.k])}</td></tr>`;
    };
    const none = side => `<tr><th scope="row" class="col-left">${side}</th><td colspan="5" class="muted">No resting orders within reach.</td></tr>`;
    const pulled = events.map(e => `${usd(e.usd)} ${e.side === "bids" ? "buy" : "sell"} wall at ${px(e.k * w)} to ${px((e.k + 1) * w)} (${esc(names(e.ex))}), noticed at ${esc(clock(e.t))}`).join("; ");
    const ts = live.map(ex => books[ex].t), t0 = Math.min(...ts), t1 = Math.max(...ts);
    const left = live.length > Math.min(useB.length, useA.length) ? ` (a book that reaches less than ${MINREACH}% from the price on one side is left out of that side)` : "";
    box.innerHTML = `<div class="depth-scroll"><table class="history-table walls-table">
        <caption>Biggest ${esc(c.sym)} orders from ${rb.toFixed(1)}% below to ${ra.toFixed(1)}% above ${px(mid)}, in bands ${px(w)} wide; books read ${t1 - t0 > 5e3 ? `between ${esc(clock(t0))} and ` : "at "}${esc(clock(t1))}</caption>
        <thead><tr><th scope="col" class="col-left">Side</th><th scope="col">Price band</th><th scope="col">From price</th><th scope="col">Waiting</th><th scope="col">Exchanges</th><th scope="col">Seen for</th></tr></thead>
        <tbody>${walls.asks.length ? walls.asks.slice().reverse().map(x => row(x, "asks")).join("") : none("Sell")}${walls.bids.length ? walls.bids.map(x => row(x, "bids")).join("") : none("Buy")}</tbody></table></div>
      <p class="tm-line">${pulled ? `Pulled before the price got within 0.25%, while you've been watching: ${pulled}.` : "No wall has been pulled while you've been watching."}</p>
      <p class="tm-line">"Waiting" adds up resting orders on ${esc(list(live))}${left}; the number in brackets is how many times the side's typical band it is. "Seen for" counts from when this tab first saw the wall and restarts when you come back to it. Binance is in USDT, counted as dollars. Orders can be cancelled at any time, so a wall is not a promise; this is not a forecast.</p>`;
  }

  function start() {
    if (running) return;
    running = true;
    const g = ++gen;
    seenSince = {}; prev = []; events = []; hist = [];
    // The price every second from the page's live feed (last 5 minutes), so a wall the price traded through between
    // reads isn't called pulled.
    sampler = setInterval(() => { if (c.price > 0) hist.push([Date.now(), c.price]); while (hist.length && hist[0][0] < Date.now() - MAXAGE) hist.shift(); }, 1000);
    if (!Object.keys(books).length) box.innerHTML = `<p class="tm-msg">Reading ${esc(list(feeds))} order books…</p>`;
    tick(g);
  }
  function stop() { running = false; gen++; clearInterval(sampler); ctrls.forEach(x => x.abort()); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (seen) start(); });
  const go = () => { seen = true; if (!document.hidden) start(); };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" });
    io.observe(box);
  } else go();
})();
