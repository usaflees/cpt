/* CryptoPriceTicker.com — home page extras: exchange price gaps and Market TV.
 *
 * Reads the live prices assets/app.js streams (window.CPT; app.js calls window.CPT_HOME(dirty) on each flush).
 *
 *   Exchange price gaps  the same coin's latest price on Coinbase, Binance and Kraken, widest gap first. Only
 *                        quotes from the last 60 s count. Binance trades against USDT, so its prices are
 *                        converted at Coinbase's live USDT-USD price; without it the gap shows "—". Gaps ignore
 *                        fees and transfer times; the section says so.
 *   Market TV            /?tv=1 or the menu button: the watchlist as large live tiles for a spare screen. Keeps
 *                        the screen awake while visible (Screen Wake Lock), Esc or "Exit" returns to the page.
 */
(function () {
  "use strict";
  const api = window.CPT;
  if (!api || api.MODE !== "home") return;
  const { state, fmtPrice, esc, coinUrl, getRate, currSymbol } = api;
  // Gap prices need enough digits to show the gap: 4 significant digits below one cent.
  const gapPrice = usd => { const r = getRate(); if (!r) return "—"; const v = usd / r; return v >= 0.01 ? fmtPrice(usd) : currSymbol() + v.toFixed(Math.min(14, 3 - Math.floor(Math.log10(v)))); };
  const $ = id => document.getElementById(id);
  const EX = { CB: "Coinbase", BN: "Binance", KR: "Kraken" };
  const FRESH_MS = 60e3;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Exchange price gaps ---------------- */
  const gapList = $("gapList");
  function usdQuotes(c, now) {
    const usdt = state.coins.get("USDT");
    const usdtUsd = usdt && usdt.exAt && now - (usdt.exAt.CB || 0) < 10 * 60e3 ? usdt.exPrices.CB : null;
    const out = [];
    for (const ex of ["CB", "BN", "KR"]) {
      const p = c.exPrices[ex], at = c.exAt && c.exAt[ex];
      if (!(p > 0) || !at || now - at > FRESH_MS) continue;
      if (ex === "BN") { if (usdtUsd > 0) out.push([ex, p * usdtUsd]); } else out.push([ex, p]);
    }
    return out;
  }
  function drawGaps() {
    if (!gapList || document.hidden) return;
    const now = Date.now();
    const rows = [];
    state.coins.forEach(c => {
      if (c.sectors.includes("Stable") || !c.hasPage) return;
      const q = usdQuotes(c, now);
      if (q.length < 2) return;
      q.sort((a, b) => a[1] - b[1]);
      const lo = q[0], hi = q[q.length - 1];
      rows.push({ c, lo, hi, pct: (hi[1] / lo[1] - 1) * 100 });
    });
    rows.sort((a, b) => b.pct - a.pct);
    const top = rows.slice(0, 8);
    if (!top.length) return; // keep the placeholders until two exchanges have reported
    const max = Math.max(top[0].pct, 0.05);
    gapList.innerHTML = top.map(r => `<li class="gap-row">
        <a class="gap-sym" href="${coinUrl(r.c.sym)}">${esc(r.c.sym)}</a>
        <span class="gap-mid"><span class="gap-bar" style="width:${Math.max(2, (r.pct / max) * 100).toFixed(1)}%"></span>
          <span class="gap-where">cheapest ${EX[r.lo[0]]} ${gapPrice(r.lo[1])} · dearest ${EX[r.hi[0]]} ${gapPrice(r.hi[1])}</span></span>
        <span class="gap-pct">${r.pct.toFixed(2)}%</span>
      </li>`).join("");
    const t = $("gapTime");
    if (t) t.textContent = new Date().toLocaleTimeString();
  }
  if (gapList) { setInterval(drawGaps, 2000); setTimeout(drawGaps, 1500); }

  /* ---------------- Market TV ---------------- */
  let tv = null, wake = null, tvQueued = false;
  function tvCoins() {
    const w = Array.from(state.watchlist).filter(s => state.coins.has(s));
    const order = state.order.filter(s => w.includes(s)).concat(w.filter(s => !state.order.includes(s)));
    const list = order.length ? order : ["BTC", "ETH", "SOL"];
    return list.slice(0, 9).map(s => state.coins.get(s));
  }
  async function keepAwake() {
    try { if ("wakeLock" in navigator && !document.hidden && tv) wake = await navigator.wakeLock.request("screen"); } catch (_) { wake = null; }
  }
  function tile(c) {
    const s = esc(c.sym);
    return `<a class="tv-tile" href="${coinUrl(c.sym)}"><span class="tv-sym">${s}<small>${esc(c.name)}</small></span>
      <span class="tv-price" id="tvp-${s}">${fmtPrice(c.price)}</span><span class="tv-chg" id="tvc-${s}"></span></a>`;
  }
  function drawTv() {
    tvQueued = false;
    if (!tv) return;
    tvCoins().forEach(c => {
      const p = $(`tvp-${c.sym}`), ch = $(`tvc-${c.sym}`);
      if (!p) return;
      p.textContent = fmtPrice(c.price);
      ch.textContent = c.live ? `${c.change24h >= 0 ? "▲ +" : "▼ −"}${Math.abs(c.change24h).toFixed(2)}%` : "—";
      ch.className = "tv-chg " + (!c.live ? "" : c.change24h >= 0 ? "txt-up" : "txt-down");
    });
    const movers = Array.from(state.coins.values()).filter(c => c.live && c.hasPage && !c.sectors.includes("Stable"))
      .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 12);
    const tape = $("tvTape");
    if (tape && movers.length) tape.textContent = movers.map(c => `${c.sym} ${c.change24h >= 0 ? "+" : "−"}${Math.abs(c.change24h).toFixed(1)}%`).join("   ·   ");
  }
  function clock() { const el = $("tvClock"); if (el) el.textContent = new Date().toLocaleTimeString(); }
  let clockTimer = 0;
  function openTv(fromClick) {
    if (tv) return;
    tv = document.createElement("div");
    tv.className = "tv-board";
    tv.id = "tvBoard";
    tv.setAttribute("role", "region");
    tv.setAttribute("aria-label", "Market TV: live prices for your watchlist");
    const coins = tvCoins();
    tv.innerHTML = `<div class="tv-top"><span class="tv-brand">CryptoPriceTicker · live</span><span class="tv-clock" id="tvClock"></span>
        <button type="button" class="action-btn" id="tvFull">⛶ Full screen</button><button type="button" class="action-btn" id="tvExit">Exit TV (Esc)</button></div>
      <div class="tv-grid tv-n${Math.min(coins.length, 9)}">${coins.map(tile).join("")}</div>
      <p class="tv-tape" id="tvTape" aria-hidden="true">Connecting to the exchanges…</p>`;
    document.body.appendChild(tv);
    document.documentElement.classList.add("tv-on");
    $("tvExit").addEventListener("click", closeTv);
    $("tvFull").addEventListener("click", () => { const r = document.documentElement.requestFullscreen; if (r) document.documentElement.requestFullscreen().catch(() => {}); });
    if (!document.documentElement.requestFullscreen) $("tvFull").hidden = true;
    if (fromClick && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    keepAwake();
    clock(); clockTimer = setInterval(clock, 1000);
    drawTv();
    $("tvExit").focus();
    const u = new URL(location.href); u.searchParams.set("tv", "1"); history.replaceState(null, "", u);
  }
  function closeTv() {
    if (!tv) return;
    tv.remove(); tv = null;
    document.documentElement.classList.remove("tv-on");
    clearInterval(clockTimer);
    if (wake) { wake.release().catch(() => {}); wake = null; }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    const u = new URL(location.href); u.searchParams.delete("tv"); history.replaceState(null, "", u.pathname + (u.search || ""));
    const back = document.querySelector(".menu-pop summary"); if (back) back.focus();
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && tv) closeTv(); });
  document.addEventListener("visibilitychange", () => { if (tv && !document.hidden) keepAwake(); });
  const btn = $("tvBtn");
  if (btn) btn.addEventListener("click", () => { const m = btn.closest("details"); if (m) m.open = false; openTv(true); });
  if (new URLSearchParams(location.search).get("tv") === "1") openTv(false);

  // Live updates from app.js: TV tiles at most twice a second.
  window.CPT_HOME = () => { if (tv && !tvQueued) { tvQueued = true; setTimeout(drawTv, reduce ? 1000 : 500); } };
})();
