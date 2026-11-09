/* CryptoPriceTicker.com — Newsflash and move alerts.
 *
 * Original, data-only flashes computed in the browser from the live exchange prices the page already
 * streams (assets/app.js exposes them as window.CPT). No headlines, no AI text, no server: every flash
 * is a measured fact with its time, so nothing here can be wrong in a way the numbers don't show.
 *
 *   home  Newsflash list (#flashList), move-alert settings (#moveAlertForm) and alert history (#alertLog);
 *         Coinbase listings: at most every 6 h this browser fetches Coinbase Exchange's public product list
 *         (~25 KB) and compares its USD markets with the copy saved last time (new, delisted, launching)
 *   coin  Flashes for the page's coin plus a "versus the market" line (#flashMarket) from Binance's
 *         24h tickers for the largest coins (one request, refreshed every 5 minutes)
 *
 * Detection runs every 15 s on samples of the live prices (browsers slow timers in background tabs to
 * about once a minute; the alert history marks alerts that fired while the tab was in the background).
 */
(function () {
  "use strict";
  const api = window.CPT;
  if (!api || (api.MODE !== "home" && api.MODE !== "coin")) return;
  const { state, MODE, esc, coinUrl, store } = api;
  const $ = id => document.getElementById(id);
  const list = $("flashList");
  if (!list) return;

  const SAMPLE_MS = 15e3;
  const KEEP_MS = 65 * 60e3;
  const COOLDOWN_MS = 30 * 60e3;
  const ITEM_TTL_MS = 12 * 3600e3;
  const MAX_ITEMS = 25;
  const PAGE_SYM = MODE === "coin" ? state.coinPageSym : null;
  const usd = v => api.fmtPrice(v, "USD");
  const pct = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
  const clock = t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isStable = c => (c.sectors || []).includes("Stable");

  const samples = new Map(); // sym → [[time, price], …], oldest first
  const highs = new Map();   // sym → { hi, lo } 24h range when we started watching, then each new break
  const lastFired = new Map(); // event key → time (cooldowns)
  let items = (store.json("cpt_flash", []) || []).filter(i => i && Date.now() - i.t < ITEM_TTL_MS);
  let snapshotDone = false;

  function save() { store.set("cpt_flash", items.slice(0, MAX_ITEMS)); }

  function add(kind, sym, html, key) {
    const now = Date.now();
    if (key) {
      if (now - (lastFired.get(key) || 0) < COOLDOWN_MS) return false;
      lastFired.set(key, now);
    }
    items.unshift({ t: now, kind, sym, html });
    items = items.slice(0, MAX_ITEMS);
    save();
    render();
    return true;
  }

  const TAGS = { move: "Move", market: "Market", high: "24h high", low: "24h low", snapshot: "Snapshot", listing: "Listing" };
  function render() {
    const shown = PAGE_SYM ? items.filter(i => i.sym === PAGE_SYM || i.kind === "market") : items;
    if (!shown.length) {
      list.innerHTML = `<li class="flash-empty">${PAGE_SYM ? `Watching ${esc(PAGE_SYM)} for sharp moves and new 24-hour highs or lows while this page is open.` : "Watching every coin for sharp moves against the market and new 24-hour highs or lows. Nothing unusual yet."}</li>`;
      return;
    }
    list.innerHTML = shown.slice(0, PAGE_SYM ? 5 : 8).map(i =>
      `<li class="flash-item flash-${i.kind}"><time datetime="${new Date(i.t).toISOString()}">${clock(i.t)}</time><span class="flash-tag">${TAGS[i.kind] || ""}</span><span class="flash-text">${i.html}</span></li>`).join("");
  }
  const link = c => (c.hasPage ? `<a href="${coinUrl(c.sym)}">${esc(c.sym)}</a>` : esc(c.sym));

  // Price change over the last `ms` from our own samples, or null until we have that much history.
  function changeOver(sym, ms, now) {
    const arr = samples.get(sym);
    if (!arr || arr.length < 2 || now - arr[0][0] < ms * 0.9) return null;
    // Baseline: the last sample taken at or before the start of the window (samples are oldest first).
    let start = arr[0];
    for (const s of arr) { if (s[0] <= now - ms) start = s; else break; }
    const cur = arr[arr.length - 1][1];
    return ((cur - start[1]) / start[1]) * 100;
  }
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function watched() {
    return Array.from(state.coins.values()).filter(c => c.live && c.hasPage && !isStable(c) && (!PAGE_SYM || c.sym === PAGE_SYM || c.rank <= 20));
  }

  function sample() {
    const now = Date.now();
    const coins = watched();
    coins.forEach(c => {
      const arr = samples.get(c.sym) || [];
      arr.push([now, c.price]);
      while (arr.length && now - arr[0][0] > KEEP_MS) arr.shift();
      samples.set(c.sym, arr);
    });
    if (MODE === "home" && !snapshotDone) snapshot(coins);
    detect(coins, now);
    checkMoveAlerts(coins, now);
  }

  // One opening line from the 24h figures the exchanges report, once enough coins are live.
  function snapshot(coins) {
    const withChange = coins.filter(c => c.change24h);
    if (withChange.length < 40) return;
    snapshotDone = true;
    if (items.some(i => i.kind === "snapshot" && Date.now() - i.t < 3600e3)) return;
    const up = withChange.filter(c => c.change24h > 0).length;
    const sorted = withChange.slice().sort((a, b) => b.change24h - a.change24h);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const btc = state.coins.get("BTC");
    add("snapshot", null, `Over 24 hours, ${up} of ${withChange.length} coins are up. Biggest gain ${link(best)} ${pct(best.change24h)}, biggest fall ${link(worst)} ${pct(worst.change24h)}${btc && btc.live ? `; ${link(btc)} ${pct(btc.change24h)} at ${usd(btc.price)}` : ""}.`);
  }

  function detect(coins, now) {
    // Market move: the median of the 20 largest coins over 15 minutes.
    const top = coins.filter(c => c.rank <= 20);
    const enough = top.length >= 10; // coin pages stream only a few coins: no market reference there
    const mkt15 = enough ? median(top.map(c => changeOver(c.sym, 15 * 60e3, now)).filter(v => v !== null)) : null;
    const mkt60 = enough ? median(top.map(c => changeOver(c.sym, 60 * 60e3, now)).filter(v => v !== null)) : null;
    if (MODE === "home" && mkt15 !== null && Math.abs(mkt15) >= 1) {
      const btc = state.coins.get("BTC");
      const b15 = btc ? changeOver("BTC", 15 * 60e3, now) : null;
      add("market", null, `Market-wide move: the median of the 20 largest coins is ${pct(mkt15)} in 15 minutes${b15 !== null ? ` (${link(btc)} ${pct(b15)})` : ""}.`, `mkt-${mkt15 > 0 ? "up" : "down"}`);
    }
    coins.forEach(c => {
      if (PAGE_SYM && c.sym !== PAGE_SYM) return;
      // Sharp move against the market: bigger thresholds for smaller coins, which move more.
      for (const [mins, small, large] of [[15, 3, 1.5], [60, 6, 3]]) {
        const ch = changeOver(c.sym, mins * 60e3, now);
        const thr = c.rank <= 10 ? large : small;
        if (ch === null || Math.abs(ch) < thr) continue;
        const ref = mins === 15 ? mkt15 : mkt60;
        if (ref !== null && Math.abs(ch - ref) < thr / 2) continue; // moving with the market: covered above
        if (add("move", c.sym, `${link(c)} ${pct(ch)} in ${mins} minutes to ${usd(c.price)}${ref !== null ? ` <span class="muted">(market ${pct(ref)})</span>` : ""}.`, `mv-${c.sym}-${ch > 0 ? "up" : "down"}`)) break;
      }
      // New 24h high or low, measured against the range when we started watching.
      const r = highs.get(c.sym);
      if (!r) { highs.set(c.sym, { hi: c.high24h, lo: c.low24h, since: now }); return; }
      if (now - r.since < 2 * 60e3 || c.rank > 50) return;
      if (c.price > r.hi * 1.001) {
        add("high", c.sym, `${link(c)} set a new 24-hour high at ${usd(c.price)} (previous ${usd(r.hi)}).`, `hi-${c.sym}`);
        r.hi = c.price;
      } else if (c.price < r.lo * 0.999) {
        add("low", c.sym, `${link(c)} fell to a new 24-hour low at ${usd(c.price)} (previous ${usd(r.lo)}).`, `lo-${c.sym}`);
        r.lo = c.price;
      }
    });
  }

  /* ---------------- Move alerts: "X% within N minutes", for the watchlist or every coin ---------------- */
  const form = $("moveAlertForm");
  let rule = Object.assign({ pct: 0, mins: 15, scope: "watch" }, store.json("cpt_movealert", {}));
  const alertFired = new Map();
  if (form) {
    form.elements.maPct.value = String(rule.pct);
    form.elements.maMins.value = String(rule.mins);
    form.elements.maScope.value = rule.scope;
    form.addEventListener("change", () => {
      rule = { pct: +form.elements.maPct.value || 0, mins: +form.elements.maMins.value || 15, scope: form.elements.maScope.value === "all" ? "all" : "watch" };
      store.set("cpt_movealert", rule);
      const st = $("moveAlertStatus");
      if (st) st.textContent = rule.pct ? `On: ${rule.pct}% within ${rule.mins} min, ${rule.scope === "all" ? "every coin" : "your watchlist"}. Works while this site is open in a tab or the pop-out.` : "Off.";
      if (rule.pct && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    });
    form.dispatchEvent(new Event("change"));
  }
  function checkMoveAlerts(coins, now) {
    if (!rule.pct || MODE !== "home") return;
    coins.forEach(c => {
      if (rule.scope === "watch" && !state.watchlist.has(c.sym)) return;
      const ch = changeOver(c.sym, rule.mins * 60e3, now);
      if (ch === null || Math.abs(ch) < rule.pct) return;
      const key = `${c.sym}-${ch > 0 ? "up" : "down"}`;
      if (now - (alertFired.get(key) || 0) < rule.mins * 60e3) return;
      alertFired.set(key, now);
      const msg = `${c.sym} ${pct(ch)} in ${rule.mins} min, now ${usd(c.price)}`;
      api.beep();
      api.showToast(`🚨 ${msg}`);
      api.notify(msg, `${c.name} moved ${pct(ch)} within ${rule.mins} minutes.`, `move-${c.sym}`);
      api.bumpAppBadge();
      logAlert(msg, c.sym);
    });
  }

  /* ---------------- Alert history (this browser only), with a note when a background tab may have delayed it ---------------- */
  function logAlert(msg, sym) {
    const log = (store.json("cpt_alertlog", []) || []).slice(0, 19);
    log.unshift({ t: Date.now(), msg, sym, hidden: document.hidden });
    store.set("cpt_alertlog", log);
    renderLog();
  }
  api.logAlert = logAlert;
  function renderLog() {
    const el = $("alertLog");
    if (!el) return;
    const log = store.json("cpt_alertlog", []) || [];
    el.innerHTML = log.length
      ? log.slice(0, 8).map(e => `<li><time datetime="${new Date(e.t).toISOString()}">${new Date(e.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time> ${esc(e.msg)}${e.hidden ? ` <span class="muted">(tab in the background: browsers check about once a minute there, so this can be up to a minute late)</span>` : ""}</li>`).join("")
      : `<li class="muted">No alerts yet. Price alerts (the ⋯ button on any coin) and move alerts are listed here.</li>`;
  }

  /* ---------------- Coin page: this coin versus the market over 24 hours ---------------- */
  async function marketLine() {
    const el = $("flashMarket");
    const c = state.coins.get(PAGE_SYM);
    if (!el || !c) return;
    const peers = Array.from(state.coins.values()).filter(x => x.hasPage && !isStable(x) && x.feeds.includes("BN")).sort((a, b) => a.rank - b.rank).slice(0, 15);
    if (!peers.some(p => p.sym === c.sym) && c.feeds.includes("BN")) peers.push(c);
    const pair = x => (x.tickers.BN || x.sym) + "USDT";
    try {
      const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?type=MINI&symbols=${encodeURIComponent(JSON.stringify(peers.map(pair)))}`);
      if (!res.ok) throw new Error(res.status);
      const rows = await res.json();
      const chg = new Map(rows.map(r => [r.symbol, ((+r.lastPrice - +r.openPrice) / +r.openPrice) * 100]));
      const others = peers.filter(p => p.sym !== c.sym).map(p => chg.get(pair(p))).filter(v => isFinite(v));
      const mine = c.feeds.includes("BN") && isFinite(chg.get(pair(c))) ? chg.get(pair(c)) : c.change24h;
      const mkt = median(others);
      if (mkt === null || !isFinite(mine) || isStable(c)) { el.textContent = ""; return; }
      const gap = mine - mkt;
      const verdict = Math.abs(gap) < Math.max(1, Math.abs(mkt) * 0.5) ? "moving with the market" : gap > 0 ? "outperforming the market" : "underperforming the market";
      el.innerHTML = `<strong>${esc(c.sym)} vs the market, 24h:</strong> ${esc(c.sym)} ${pct(mine)}; the median of the ${others.length} largest coins ${pct(mkt)}. ${esc(c.name)} is ${verdict}. <span class="muted">Binance USDT markets, as of ${clock(Date.now())}.</span>`;
    } catch (_) {
      el.textContent = "";
    }
  }

  /* ---------------- Coinbase listings: compare the public product list with this browser's last copy ---------------- */
  async function coinbaseListings() {
    const saved = store.json("cpt_cbprod", null);
    if (saved && Date.now() - saved.t < 6 * 3600e3) return;
    let products;
    try {
      const res = await fetch("https://api.exchange.coinbase.com/products");
      if (!res.ok) return;
      products = await res.json();
    } catch (_) { return; }
    if (!Array.isArray(products) || products.length < 100) return;
    const usd = products.filter(p => p.quote_currency === "USD");
    const online = usd.filter(p => p.status === "online" && !p.trading_disabled && !p.auction_mode).map(p => p.base_currency);
    const auction = usd.filter(p => p.status === "online" && p.auction_mode).map(p => p.base_currency);
    const name = b => { const c = state.coins.get(b); return c ? link(c) : esc(b); };
    const since = saved ? ` <span class="muted">(since this browser last checked, ${new Date(saved.t).toLocaleDateString([], { month: "short", day: "numeric" })})</span>` : "";
    auction.filter(b => !(saved && saved.auction.includes(b))).forEach(b =>
      add("listing", b, `Coinbase is launching ${name(b)}-USD: the market is open for orders in auction mode before full trading.${since}`, `cb-auc-${b}`));
    if (saved) {
      const before = new Set(saved.online);
      const now = new Set(online);
      online.filter(b => !before.has(b)).slice(0, 5).forEach(b => add("listing", b, `Coinbase listed ${name(b)}: ${esc(b)}-USD is now trading.${since}`, `cb-new-${b}`));
      saved.online.filter(b => !now.has(b) && !auction.includes(b)).slice(0, 5).forEach(b => add("listing", b, `Coinbase stopped trading ${name(b)}-USD (delisted or suspended).${since}`, `cb-off-${b}`));
    }
    store.set("cpt_cbprod", { t: Date.now(), online, auction });
  }

  render();
  renderLog();
  setInterval(sample, SAMPLE_MS);
  setTimeout(sample, 5e3);
  if (MODE === "coin") { setTimeout(marketLine, 2e3); setInterval(marketLine, 5 * 60e3); }
  if (MODE === "home") setTimeout(coinbaseListings, 8e3);
})();
