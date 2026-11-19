/* CryptoPriceTicker.com — Coin Race (/race/).
 *
 * Two to six coins race from a start line the visitor picks: 24 hours ago, 1 hour ago, or the moment
 * they press "Start now". Each lane shows the coin's % change since that start line, from the live
 * exchange prices assets/app.js streams (window.CPT). The race is a link (?c=btc,eth&from=24h), so it
 * can be sent to someone else. Measured numbers only: a lane shows "—" until its coin's live price
 * and start price are known; nothing here forecasts anything.
 *
 *   24h  start price = live price / (1 + 24h change), from the exchanges' rolling 24-hour figures
 *   1h   start price = open of the Binance 1-minute candle one hour ago (coins without a Binance
 *        market show "—" for this start line)
 *   now  start price = the first live price after "Start now"
 */
(function () {
  "use strict";
  const api = window.CPT;
  if (!api || api.MODE !== "race") return;
  const { state, fmtPrice, esc, coinUrl, showToast, avatar } = api;
  const $ = id => document.getElementById(id);
  const lanesEl = $("raceLanes");
  if (!lanesEl) return;

  const MIN = 2, MAX = 6;
  const DEFAULT = ["BTC", "ETH", "SOL", "XRP", "DOGE"];
  const FROMS = { "24h": "24 hours ago", "1h": "1 hour ago", now: "the moment you pressed Start" };
  const q = new URLSearchParams(location.search);
  const valid = s => state.coins.has(s);
  let syms = (q.get("c") || "").toUpperCase().split(",").map(s => s.trim()).filter(valid);
  syms = Array.from(new Set(syms)).slice(0, MAX);
  if (syms.length < MIN) syms = DEFAULT.filter(valid);
  let from = FROMS[q.get("from")] ? q.get("from") : "24h";
  let ref = new Map();     // sym -> start price
  let hourReq = 0;         // bumps to ignore stale 1-hour requests
  let t0 = Date.now();
  let leader = null, leadChanges = 0;

  function syncUrl() {
    // Built by hand so the commas stay readable in a pasted link (URLSearchParams writes %2C).
    history.replaceState(null, "", "?c=" + syms.map(s => encodeURIComponent(s.toLowerCase())).join(",") + (from !== "24h" ? "&from=" + from : ""));
  }

  // Start prices ------------------------------------------------------------
  function loadHourAgo() {
    const req = ++hourReq;
    const start = Date.now() - 3600e3;
    syms.forEach(s => {
      const c = state.coins.get(s);
      if (!c.feeds.includes("BN")) return;
      const pair = (c.tickers.BN || s) + "USDT";
      fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=1m&startTime=${start}&limit=1`)
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(k => { if (req === hourReq && k[0] && +k[0][1] > 0) { ref.set(s, +k[0][1]); schedule(); } })
        .catch(() => {});
    });
  }
  function setStart(f) {
    from = f;
    ref = new Map();
    t0 = Date.now();
    leader = null; leadChanges = 0;
    if (from === "1h") loadHourAgo();
    document.querySelectorAll("[data-race-from]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.raceFrom === from)));
    $("raceFromLabel").textContent = FROMS[from];
    syncUrl();
    renderLanes();
  }
  function startPrice(c) {
    if (!c.live) return null;
    if (from === "24h") return c.change24h > -100 ? c.price / (1 + c.change24h / 100) : null;
    if (from === "now" && !ref.has(c.sym)) ref.set(c.sym, c.price);
    return ref.get(c.sym) || null;
  }

  // Lanes -------------------------------------------------------------------
  function renderLanes() {
    lanesEl.innerHTML = syms.map(s => {
      const c = state.coins.get(s), e = esc(s);
      return `<li class="race-lane" id="rl-${e}">
        <span class="race-place" id="rp-${e}">—</span>
        <a class="race-coin" href="${coinUrl(s)}">${avatar(s, "sm")}<span><strong>${e}</strong><small>${esc(c.name)}</small></span></a>
        <span class="race-track" aria-hidden="true"><span class="race-bar" id="rb-${e}"></span></span>
        <span class="race-pct" id="rc-${e}">—</span>
        <span class="race-price" id="rq-${e}">—</span>
        <button type="button" class="race-remove" data-race-remove="${e}" aria-label="Remove ${e} from the race"${syms.length <= MIN ? " disabled" : ""}>×</button>
      </li>`;
    }).join("");
    fillAdd();
    draw();
  }
  const NICE = [0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500];
  function draw() {
    const rows = syms.map(s => {
      const c = state.coins.get(s), p0 = startPrice(c);
      return { s, c, pct: p0 ? (c.price / p0 - 1) * 100 : null };
    });
    const known = rows.filter(r => r.pct !== null);
    const top = Math.max(0, ...known.map(r => Math.abs(r.pct))) * 1.1;
    const scale = NICE.find(n => n >= top) || NICE[NICE.length - 1];
    const order = known.slice().sort((a, b) => b.pct - a.pct);
    rows.forEach(r => {
      const e = r.s, bar = $(`rb-${e}`);
      if (!bar) return;
      $(`rq-${e}`).textContent = r.c.live ? fmtPrice(r.c.price) : "—";
      const pctEl = $(`rc-${e}`), lane = $(`rl-${e}`);
      if (r.pct === null) {
        pctEl.textContent = "—"; pctEl.className = "race-pct";
        bar.style.cssText = "width:0";
        $(`rp-${e}`).textContent = "—";
        lane.classList.remove("is-lead");
        return;
      }
      const w = Math.min(50, Math.abs(r.pct) / scale * 50);
      bar.style.cssText = `left:${r.pct >= 0 ? 50 : 50 - w}%;width:${Math.max(0.4, w)}%`;
      bar.className = "race-bar " + (r.pct >= 0 ? "up" : "down");
      pctEl.textContent = (r.pct >= 0 ? "+" : "−") + Math.abs(r.pct).toFixed(2) + "%";
      pctEl.className = "race-pct " + (r.pct >= 0 ? "up" : "down");
      const place = order.indexOf(r) + 1;
      $(`rp-${e}`).textContent = place + (["st", "nd", "rd"][place - 1] || "th");
      lane.classList.toggle("is-lead", place === 1 && known.length > 1);
    });
    $("raceScale").textContent = `±${scale}%`;
    if (order.length > 1 && order[0].s !== leader) {
      if (leader) leadChanges++;
      leader = order[0].s;
    }
    $("raceLeader").textContent = order.length > 1 ? `${order[0].s} leads by ${(order[0].pct - order[1].pct).toFixed(2)} points` : "Waiting for live prices…";
    $("raceChanges").textContent = String(leadChanges);
  }
  let queued = false, last = 0;
  function schedule() {
    if (queued) return;
    queued = true;
    const wait = Math.max(0, 300 - (Date.now() - last));
    setTimeout(() => requestAnimationFrame(() => { queued = false; last = Date.now(); draw(); }), wait);
  }
  function tickClock() {
    const s = Math.floor((Date.now() - t0) / 1000);
    $("raceClock").textContent = from === "now" ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : FROMS[from].replace(" ago", "");
  }

  // Picker ------------------------------------------------------------------
  function fillAdd() {
    const sel = $("raceAdd");
    const all = Array.from(state.coins.values()).filter(c => !syms.includes(c.sym)).sort((a, b) => a.rank - b.rank);
    sel.innerHTML = `<option value="">${syms.length >= MAX ? "Six coins is the limit" : "Add a coin…"}</option>` +
      all.map(c => `<option value="${esc(c.sym)}">${esc(c.sym)} · ${esc(c.name)}</option>`).join("");
    sel.disabled = syms.length >= MAX;
  }
  $("raceAdd").addEventListener("change", e => {
    const s = e.target.value;
    if (!valid(s) || syms.includes(s) || syms.length >= MAX) return;
    syms.push(s);
    if (from === "now") ref.delete(s); // joins from its first live price
    if (from === "1h") loadHourAgo();
    syncUrl(); renderLanes();
  });
  lanesEl.addEventListener("click", e => {
    const b = e.target.closest("[data-race-remove]");
    if (!b || syms.length <= MIN) return;
    syms = syms.filter(s => s !== b.dataset.raceRemove);
    syncUrl(); renderLanes();
  });
  document.querySelectorAll("[data-race-from]").forEach(b => b.addEventListener("click", () => setStart(b.dataset.raceFrom)));
  $("raceShare").addEventListener("click", () => {
    const url = location.href, title = `Coin race: ${syms.join(" vs ")}`;
    if (navigator.share) { navigator.share({ title, url }).catch(() => {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => showToast("🔗 Race link copied."), () => showToast(url));
  });

  // Live updates from app.js (flush passes the symbols that changed).
  window.CPT_RACE = dirty => { if (dirty.some(s => syms.includes(s))) schedule(); };
  setInterval(tickClock, 1000);
  setStart(from);
  tickClock();
})();
