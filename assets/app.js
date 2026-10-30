/* CryptoPriceTicker.com — live multi-exchange ticker.
 *
 * One script, three modes (chosen by <body data-page> and ?embed=1):
 *   home   index.html — full table, movers, portfolio, widget builder
 *   coin   /coin/<sym>/ — one coin: live hero, 24h chart, exchange spread, order-book depth
 *   embed  /embed/ (or legacy /?embed=1) — the iframe widget other sites embed
 *
 * Needs assets/coins.js (CPT_COINS) loaded first. No dependencies, no inline handlers
 * (everything is wired through data-action attributes so the CSP can forbid inline JS).
 */
(function () {
  "use strict";

  const SITE = "https://cryptopriceticker.com";
  const THEMES = ["kali", "green", "slate", "oled", "light"];
  const CURRENCIES = ["USD", "BTC", "ETH", "SOL"];
  const LAYOUTS = ["marquee", "grid", "single"];
  const RATE_COINS = ["BTC", "ETH", "SOL"]; // always streamed so non-USD currencies work
  const BINANCE_REST = "https://data-api.binance.vision/api/v3";
  const BINANCE_WS = "wss://data-stream.binance.vision/stream?streams=";
  const COINBASE_WS = "wss://ws-feed.exchange.coinbase.com";
  const KRAKEN_WS = "wss://ws.kraken.com/v2";
  const STALE_MS = 2 * 3600e3; // Binance's 24h snapshot still lists delisted pairs with frozen prices
  const DEFAULT_WATCHLIST = ["BTC", "ETH", "SOL", "TAO"];
  const DEFAULT_WIDGET_COINS = "BTC,ETH,SOL,TAO,RENDER,XMR,KAS,SUI";

  const params = new URLSearchParams(location.search);
  const PAGE = document.body.dataset.page || "home";
  const IS_EMBED = PAGE === "embed" || params.get("embed") === "1";
  const MODE = IS_EMBED ? "embed" : PAGE;
  const $ = id => document.getElementById(id);

  /* ------------------------------------------------------------------
   * Storage (throws in some third-party iframes and private modes)
   * ------------------------------------------------------------------ */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (_) { return fallback; }
    },
    json(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (_) { return fallback; }
    },
    set(key, value) {
      if (IS_EMBED) return;
      try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch (_) {}
    }
  };

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const coinUrl = sym => `/coin/${sym.toLowerCase()}/`;

  /* ------------------------------------------------------------------
   * Coin registry → state
   * ------------------------------------------------------------------ */
  const REGISTRY = window.CPT_COINS || [];
  const RENAMED = {}; // old ticker → current ticker (e.g. TON → GRAM)
  REGISTRY.forEach(c => { if (c.formerly) RENAMED[c.formerly] = c.sym; });
  const renamed = sym => RENAMED[sym] || sym;

  const state = {
    coins: new Map(),
    currency: "USD",
    theme: "kali",
    compact: store.get("cpt_compact") === "1",
    sector: "ALL",
    search: "",
    sortBy: "rank",
    sortAsc: true,
    moverMode: "gainers",
    pinnedSym: renamed(store.get("cpt_pin", "")),
    watchlist: new Set(store.json("cpt_watch", DEFAULT_WATCHLIST).map(renamed)),
    bag: migrateKeys(store.json("cpt_bag", {})),
    alerts: migrateKeys(store.json("cpt_alerts", {})),
    tickCount: 0,
    dirty: new Set(),
    activeModalSym: null,
    widgetModalOpen: false,
    coinPageSym: (document.body.dataset.sym || "").toUpperCase(),
    embed: {
      layout: pick(params.get("layout"), LAYOUTS, "marquee"),
      coins: (params.get("coins") || DEFAULT_WIDGET_COINS).split(",").map(s => renamed(s.trim().toUpperCase())).filter(Boolean).slice(0, 24)
    }
  };

  function migrateKeys(obj) {
    const out = {};
    if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) out[renamed(k)] = v;
    return out;
  }

  REGISTRY.forEach((c, idx) => {
    state.coins.set(c.sym, {
      sym: c.sym,
      name: c.name,
      supply: c.supply * 1e6,
      price: c.price,
      change24h: 0,
      low24h: c.price,
      high24h: c.price,
      mcap: c.price * c.supply * 1e6,
      vol24h: 0,
      exVol: { CB: 0, BN: 0, KR: 0 },
      liq: 0,
      sectors: c.sectors,
      feeds: c.feeds,
      tickers: c.tickers || {},
      history: [],
      rank: idx + 1,
      exPrices: { CB: null, BN: null, KR: null },
      lastSource: "BOOT",
      live: false,
      hasPage: true
    });
  });

  // Exchange ticker → registry symbol, per exchange (most are identical; e.g. CB "TON" → "GRAM").
  const exToSym = { CB: new Map(), BN: new Map(), KR: new Map() };
  const tickerOf = (c, ex) => c.tickers[ex] || c.sym;
  state.coins.forEach(c => c.feeds.forEach(ex => exToSym[ex].set(tickerOf(c, ex), c.sym)));

  /* ------------------------------------------------------------------
   * URL parameters: sync links, legacy widget links, embed config
   * ------------------------------------------------------------------ */
  state.currency = pick((params.get("curr") || (IS_EMBED ? "" : store.get("cpt_curr", ""))).toUpperCase(), CURRENCIES, "USD");
  state.theme = pick((params.get("theme") || (IS_EMBED ? "" : store.get("cpt_theme", ""))).toLowerCase(), THEMES, "kali");

  if (MODE === "home") {
    // Deep links (/?coin=BTC, and /?w=BTC from older widgets) go to the coin page and never touch the
    // visitor's own watchlist. Sync links always carry both w= and b= and replace the saved portfolio.
    const deep = renamed((params.get("coin") || (!params.has("b") ? params.get("w") || "" : "")).toUpperCase());
    if (deep && !deep.includes(",") && state.coins.has(deep)) {
      location.replace(coinUrl(deep));
      return;
    }
    if (params.has("w") && params.has("b")) {
      const w = params.get("w").split(",").map(s => renamed(s.trim().toUpperCase())).filter(s => state.coins.has(s));
      const b = {};
      params.get("b").split(",").forEach(pair => {
        const [sym, qty] = pair.split(":");
        const s = renamed((sym || "").trim().toUpperCase());
        if (state.coins.has(s) && parseFloat(qty) > 0) b[s] = parseFloat(qty);
      });
      state.watchlist = new Set(w);
      state.bag = b;
      store.set("cpt_watch", w);
      store.set("cpt_bag", b);
      history.replaceState(null, "", location.pathname); // keep the private link out of the address bar
      setTimeout(() => showToast("💾 Watchlist and bag loaded from your sync link."), 300);
    }
  }

  if (IS_EMBED) {
    document.body.classList.add("is-embed");
    $("metaRobots")?.setAttribute("content", "noindex, indexifembedded");
  }

  /* ------------------------------------------------------------------
   * Formatting
   * ------------------------------------------------------------------ */
  function getRate(curr = state.currency) {
    if (curr === "USD") return 1;
    return state.coins.get(curr)?.price || 1;
  }
  const currSymbol = (curr = state.currency) => ({ BTC: "₿", ETH: "Ξ", SOL: "◎" }[curr] || "$");

  function fmtPrice(usd, curr) {
    if (usd === null || usd === undefined || isNaN(usd)) return "—";
    const val = usd / getRate(curr);
    const sym = currSymbol(curr);
    if (val === 0) return sym + "0.00";
    if (val >= 1000) return sym + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (val >= 1) return sym + val.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    if (val >= 0.01) return sym + val.toFixed(4);
    if (val >= 0.0001) return sym + val.toFixed(6);
    return sym + val.toFixed(8);
  }

  function fmtCompact(usd, curr) {
    if (!usd || isNaN(usd)) return "—";
    const val = usd / getRate(curr);
    const sym = currSymbol(curr);
    if (val >= 1e12) return sym + (val / 1e12).toFixed(2) + "T";
    if (val >= 1e9) return sym + (val / 1e9).toFixed(2) + "B";
    if (val >= 1e6) return sym + (val / 1e6).toFixed(2) + "M";
    if (val >= 1e3) return sym + (val / 1e3).toFixed(1) + "K";
    return sym + val.toFixed(2);
  }

  const fmtChange = c => (c.live ? `${c.change24h >= 0 ? "+" : ""}${c.change24h.toFixed(2)}%` : "—");
  const chgClass = c => (!c.live ? "" : c.change24h >= 0 ? "chg-up" : "chg-down");
  const chgPill = (c, style = "") => `<span class="chg-pill ${chgClass(c)}"${style ? ` style="${style}"` : ""}>${fmtChange(c)}</span>`;
  const rangePct = c => Math.max(2, Math.min(98, ((c.price - c.low24h) / ((c.high24h - c.low24h) || 1)) * 100));

  function buildSparkline(history, isUp, w = 88, h = 24, opts = {}) {
    if (!history || history.length < 2) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="var(--border)" stroke-dasharray="3 3"/></svg>`;
    }
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = max - min || 1;
    const pts = history.map((v, i) => {
      const x = ((i / (history.length - 1)) * w).toFixed(1);
      const y = (h - 3 - ((v - min) / span) * (h - 6)).toFixed(1);
      return `${x},${y}`;
    }).join(" ");
    const stroke = isUp ? "var(--up)" : "var(--down)";
    const size = opts.fluid ? `preserveAspectRatio="none"` : `width="${w}" height="${h}"`;
    return `<svg ${size} viewBox="0 0 ${w} ${h}" ${opts.label ? `role="img" aria-label="${esc(opts.label)}"` : `aria-hidden="true"`}><polyline fill="none" stroke="${stroke}" stroke-width="${opts.fluid ? 1.5 : 1.75}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/></svg>`;
  }

  /* ------------------------------------------------------------------
   * Embed widget markup (used by /embed/ and the live preview)
   * ------------------------------------------------------------------ */
  function buildWidgetMarkup(cfg) {
    const picked = cfg.coins.map(s => state.coins.get(s)).filter(Boolean);
    if (!picked.length) picked.push(state.coins.get("BTC"));
    const curr = cfg.curr || state.currency;
    const link = c => (c.hasPage ? SITE + coinUrl(c.sym) : SITE + "/");

    if (cfg.layout === "marquee") {
      const items = picked.map(c => `<a href="${link(c)}" target="_blank" rel="noopener" class="tape-item">
          <span class="tape-sym">${esc(c.sym)}</span>
          <span class="tape-price" data-wg-price="${esc(c.sym)}">${fmtPrice(c.price, curr)}</span>
          <span data-wg-chg="${esc(c.sym)}">${chgPill(c, "padding:1px 5px;font-size:10.5px")}</span>
        </a>`).join("");
      return `<div class="embed-marquee-bar">
          <div class="ticker-tape-wrap" style="border:none;flex:1;background:transparent">
            <div class="ticker-tape" style="animation-duration:28s">${items}<span aria-hidden="true" style="display:contents">${items}</span></div>
          </div>
          <a href="${SITE}/" target="_blank" rel="noopener" class="embed-brand-dock">⚡ CryptoPriceTicker.com</a>
        </div>`;
    }

    if (cfg.layout === "single") {
      const c = picked[0];
      return `<div class="embed-single-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="coin-avatar" style="width:34px;height:34px;font-size:12px">${esc(c.sym.slice(0, 4))}</div>
              <div>
                <div style="display:flex;align-items:center;gap:6px">
                  <strong style="font-size:15px;font-family:var(--font-mono)">${esc(c.sym)}</strong>
                  <span style="color:var(--text-muted);font-size:12px">${esc(c.name)}</span>
                  <span class="tag-badge">#${c.rank}</span>
                </div>
                <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px">
                  <span style="font-family:var(--font-mono);font-size:18px;font-weight:800" data-wg-price="${esc(c.sym)}">${fmtPrice(c.price, curr)}</span>
                  <span data-wg-chg="${esc(c.sym)}">${chgPill(c)}</span>
                </div>
              </div>
            </div>
            <div data-wg-spark="${esc(c.sym)}">${buildSparkline(c.history, c.change24h >= 0, 120, 34)}</div>
          </div>
          <div class="bento-metrics" style="grid-template-columns:repeat(3,1fr)">
            <div class="metric-box"><div class="metric-label">Market Cap</div><div class="metric-val" style="font-size:12px">${fmtCompact(c.mcap, curr)}</div></div>
            <div class="metric-box"><div class="metric-label">24h Volume</div><div class="metric-val" style="font-size:12px">${fmtCompact(c.vol24h, curr)}</div></div>
            <div class="metric-box"><div class="metric-label">24h Low / High</div><div class="range-track" style="margin-top:5px"><div class="range-fill" style="width:${rangePct(c).toFixed(0)}%"></div></div></div>
          </div>
          <div class="embed-footer-bar" style="border-radius:4px">
            <span>⚡ Live exchange feed</span>
            <a href="${link(c)}" target="_blank" rel="noopener">CryptoPriceTicker.com ↗</a>
          </div>
        </div>`;
    }

    const cards = picked.slice(0, 8).map(c => `<a href="${link(c)}" target="_blank" rel="noopener" class="embed-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-family:var(--font-mono);font-size:12.5px">${esc(c.sym)}</strong>
            <span data-wg-chg="${esc(c.sym)}">${chgPill(c, "font-size:10px;padding:1px 5px")}</span>
          </div>
          <div style="font-family:var(--font-mono);font-size:14px;font-weight:800" data-wg-price="${esc(c.sym)}">${fmtPrice(c.price, curr)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
            <span style="font-size:10px;color:var(--text-muted)">MCap ${fmtCompact(c.mcap, curr)}</span>
            <span data-wg-spark="${esc(c.sym)}">${buildSparkline(c.history, c.change24h >= 0, 56, 18)}</span>
          </div>
        </a>`).join("");
    return `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-primary)">
        <div class="embed-grid-wrap">${cards}</div>
        <div class="embed-footer-bar">
          <span>⚡ Live multi-exchange prices</span>
          <a href="${SITE}/" target="_blank" rel="noopener">CryptoPriceTicker.com ↗</a>
        </div>
      </div>`;
  }

  function renderEmbed() {
    const root = $("embedWidgetRoot");
    if (root) root.innerHTML = buildWidgetMarkup({ layout: state.embed.layout, coins: state.embed.coins, curr: state.currency });
  }

  // Patch live values inside a rendered widget (embed page and builder preview).
  function patchWidget(scope, sym, curr) {
    const c = state.coins.get(sym);
    scope.querySelectorAll(`[data-wg-price="${sym}"]`).forEach(el => {
      el.textContent = fmtPrice(c.price, curr);
      flash(el, c.lastDir);
    });
    scope.querySelectorAll(`[data-wg-chg="${sym}"]`).forEach(el => { el.innerHTML = chgPill(c, el.firstElementChild?.getAttribute("style") || ""); });
    scope.querySelectorAll(`[data-wg-spark="${sym}"]`).forEach(el => {
      const svg = el.querySelector("svg");
      el.innerHTML = buildSparkline(c.history, c.change24h >= 0, +svg.getAttribute("width"), +svg.getAttribute("height"));
    });
  }

  /* ------------------------------------------------------------------
   * Home: ranking, filtering, table
   * ------------------------------------------------------------------ */
  const SECTOR_KEYS = ["L1", "L2", "DePIN", "AI", "DeFi", "Privacy", "Gaming", "Meme", "Stable"];
  const inSector = (c, sector) => c.sectors.includes(sector) || (sector === "DeFi" && c.sectors.includes("RWA"));

  function recomputeRanks() {
    const all = Array.from(state.coins.values()).sort((a, b) => b.mcap - a.mcap);
    all.forEach((c, i) => { c.rank = i + 1; });
    return all;
  }

  function updateCounts(all) {
    const counts = { ALL: all.length, WATCH: 0, BAG: 0 };
    SECTOR_KEYS.forEach(k => { counts[k] = 0; });
    all.forEach(c => {
      if (state.watchlist.has(c.sym)) counts.WATCH++;
      if (state.bag[c.sym] > 0) counts.BAG++;
      SECTOR_KEYS.forEach(k => { if (inSector(c, k)) counts[k]++; });
    });
    Object.entries(counts).forEach(([k, v]) => { const el = $(`cnt-${k}`); if (el) el.textContent = v; });
    $("assetCountTop").textContent = all.length;
  }

  function filteredSorted() {
    const all = recomputeRanks();
    updateCounts(all);
    const q = state.search.trim().toLowerCase();
    const list = all.filter(c => {
      if (state.sector === "WATCH" && !state.watchlist.has(c.sym)) return false;
      if (state.sector === "BAG" && !(state.bag[c.sym] > 0)) return false;
      if (SECTOR_KEYS.includes(state.sector) && !inSector(c, state.sector)) return false;
      if (q) return c.sym.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.sectors.some(s => s.toLowerCase().includes(q));
      return true;
    });
    const dir = state.sortAsc ? 1 : -1;
    const pos = c => (c.price - c.low24h) / ((c.high24h - c.low24h) || 1);
    const key = {
      rank: c => c.rank, price: c => c.price, change24h: c => c.change24h, rangePos: pos,
      mcap: c => c.mcap, vol24h: c => c.vol24h, liq: c => c.liq, bagVal: c => (state.bag[c.sym] || 0) * c.price
    }[state.sortBy];
    list.sort((a, b) => (state.sortBy === "name" ? a.name.localeCompare(b.name) : key(a) - key(b)) * dir);
    return list;
  }

  function rowHtml(c) {
    const s = esc(c.sym);
    const isFav = state.watchlist.has(c.sym);
    const isPin = state.pinnedSym === c.sym;
    const hasAlert = Boolean(state.alerts[c.sym]);
    const bagUsd = (state.bag[c.sym] || 0) * c.price;
    const badges = c.sectors.map(x => `<span class="tag-badge">${esc(x)}</span>`).join("");
    const ident = `<div class="coin-avatar" aria-hidden="true">${esc(c.sym.slice(0, 4))}</div>
              <div class="coin-main">
                <div class="coin-sym-row">
                  <span class="coin-sym">${s}</span>
                  ${badges}
                  <span class="ex-badge" id="src-${s}" title="Last price source">${c.lastSource}</span>
                </div>
                <span class="coin-name">${esc(c.name)}</span>
              </div>`;
    const coinCell = c.hasPage
      ? `<a class="coin-cell" href="${coinUrl(c.sym)}">${ident}</a>`
      : `<button type="button" class="coin-cell" data-action="open-coin" data-sym="${s}">${ident}</button>`;
    return `<tr id="row-${s}">
          <td class="col-center" style="color:var(--text-muted)">${c.rank}</td>
          <td class="col-center">
            <button type="button" class="icon-btn ${isFav ? "active-fav" : ""}" data-action="toggle-fav" data-sym="${s}" aria-pressed="${isFav}" aria-label="${isFav ? "Remove" : "Add"} ${s} ${isFav ? "from" : "to"} watchlist" title="Watchlist">♥</button>
            <button type="button" class="icon-btn ${isPin ? "active-pin" : ""}" data-action="toggle-pin" data-sym="${s}" aria-pressed="${isPin}" aria-label="Pin ${s} price to browser tab" title="Pin live price to browser tab">📌</button>
            <button type="button" class="icon-btn ${hasAlert ? "active-alert" : ""}" data-action="open-coin" data-sym="${s}" aria-label="${s} price alert and exchange spread" title="Price alert / spread inspector">🔔</button>
          </td>
          <td class="col-left">${coinCell}</td>
          <td id="price-${s}" class="${c.live ? "" : "is-stale"}" style="font-weight:700">${fmtPrice(c.price)}</td>
          <td id="chg-${s}">${chgPill(c)}</td>
          <td class="col-center hide-mobile" id="spark-${s}">${buildSparkline(c.history, c.change24h >= 0)}</td>
          <td class="col-center hide-mobile" id="range-${s}">${rangeHtml(c)}</td>
          <td id="mcap-${s}">${fmtCompact(c.mcap)}</td>
          <td class="hide-mobile" id="vol-${s}" style="color:var(--text-secondary)">${fmtCompact(c.vol24h)}</td>
          <td class="hide-mobile" id="liq-${s}" style="color:var(--accent)">${fmtCompact(c.liq)}</td>
          <td>
            <div class="bag-cell">
              <input type="number" step="any" min="0" class="bag-input" placeholder="0.00" value="${state.bag[c.sym] || ""}" data-sym="${s}" aria-label="${s} quantity held" />
              <span class="bag-val" id="bagval-${s}">${bagUsd > 0 ? fmtPrice(bagUsd) : ""}</span>
            </div>
          </td>
        </tr>`;
  }

  const rangeHtml = c => `<div class="range-wrap" title="24h low / high">
              <div class="range-labels"><span>${fmtPrice(c.low24h)}</span><span>${fmtPrice(c.high24h)}</span></div>
              <div class="range-track"><div class="range-fill" style="width:${rangePct(c).toFixed(0)}%"></div></div>
            </div>`;

  function renderTable() {
    const list = filteredSorted();
    $("showingCount").textContent = list.length;
    $("tableBody").innerHTML = list.map(rowHtml).join("") ||
      `<tr><td colspan="11" class="col-center" style="padding:20px;color:var(--text-muted)">No coins match this filter.</td></tr>`;
    document.querySelectorAll("th[data-sort]").forEach(th => {
      const col = th.getAttribute("data-sort");
      th.setAttribute("aria-sort", col === state.sortBy ? (state.sortAsc ? "ascending" : "descending") : "none");
    });
    updateSummary();
    renderTape();
  }

  function updateSummary() {
    let mcap = 0, vol = 0, liq = 0, bagTotal = 0, bagPnl = 0;
    state.coins.forEach(c => {
      mcap += c.mcap || 0;
      vol += c.vol24h || 0;
      liq += c.liq || 0;
      const qty = state.bag[c.sym] || 0;
      if (qty > 0) {
        bagTotal += qty * c.price;
        bagPnl += qty * c.price * (c.change24h / 100);
      }
    });
    $("globalMcap").textContent = fmtCompact(mcap);
    $("globalVol").textContent = fmtCompact(vol);
    $("globalLiq").textContent = fmtCompact(liq);
    $("lastUpdateClock").textContent = new Date().toLocaleTimeString();
    $("bagTotalVal").textContent = fmtPrice(bagTotal);
    const pct = bagTotal > 0 ? (bagPnl / bagTotal) * 100 : 0;
    const sign = bagPnl >= 0 ? "+" : "-";
    const pnlEl = $("bagPnlVal");
    pnlEl.textContent = `${sign}${fmtPrice(Math.abs(bagPnl))} (${sign}${Math.abs(pct).toFixed(2)}%)`;
    pnlEl.style.color = bagPnl >= 0 ? "var(--up)" : "var(--down)";
    $("watchlistCountVal").textContent = `${state.watchlist.size} / ${Object.keys(state.alerts).length} 🔔`;

    const movers = Array.from(state.coins.values())
      .filter(c => c.live && !c.sectors.includes("Stable"))
      .sort((a, b) => (state.moverMode === "gainers" ? b.change24h - a.change24h : a.change24h - b.change24h))
      .slice(0, 3);
    $("moversList").innerHTML = movers.length ? movers.map(m => {
      const inner = `<span><strong>${esc(m.sym)}</strong> <span style="color:var(--text-muted);font-size:11px">${esc(m.name)}</span></span>
          <span>${fmtPrice(m.price)} <strong style="color:${m.change24h >= 0 ? "var(--up)" : "var(--down)"}">${fmtChange(m)}</strong></span>`;
      return m.hasPage
        ? `<a class="mover-row" href="${coinUrl(m.sym)}">${inner}</a>`
        : `<button type="button" class="mover-row" style="width:100%" data-action="open-coin" data-sym="${esc(m.sym)}">${inner}</button>`;
    }).join("") : `<div class="mover-row" style="color:var(--text-muted)">Waiting for live prices…</div>`;
  }

  // The tape repeats the top coins twice for a seamless loop; it is decorative (the table has the same
  // data), so it is hidden from screen readers and its links are skipped by Tab.
  function renderTape() {
    const top = Array.from(state.coins.values()).filter(c => c.hasPage).sort((a, b) => a.rank - b.rank).slice(0, 16);
    const html = top.map(c => `<a class="tape-item" href="${coinUrl(c.sym)}" tabindex="-1">
          <span class="tape-sym">${esc(c.sym)}</span>
          <span class="tape-price" data-tape="${esc(c.sym)}">${fmtPrice(c.price)}</span>
          <span data-tape-chg="${esc(c.sym)}" style="color:${c.change24h >= 0 ? "var(--up)" : "var(--down)"}">${c.live ? (c.change24h >= 0 ? "▲ " : "▼ ") + Math.abs(c.change24h).toFixed(2) + "%" : ""}</span>
        </a>`).join("");
    $("tickerTape").innerHTML = html + html;
  }

  /* ------------------------------------------------------------------
   * Live updates
   * ------------------------------------------------------------------ */
  function applyTick(sym, price, source, o = {}) {
    const c = state.coins.get(sym);
    if (!c || !(price > 0)) return;
    const prev = c.price;
    c.price = price;
    c.lastSource = source;
    c.exPrices[source] = price;
    if (o.change24h !== undefined && isFinite(o.change24h)) c.change24h = o.change24h;
    if (o.high24h > 0) c.high24h = Math.max(o.high24h, price);
    if (o.low24h > 0) c.low24h = Math.min(o.low24h, price);
    if (!c.live) { c.high24h = Math.max(c.high24h, price); c.low24h = Math.min(c.low24h, price); }
    if (price > c.high24h) c.high24h = price;
    if (price < c.low24h) c.low24h = price;
    if (o.quoteVol > 0) {
      // Volume = sum of the tracked exchanges' USD/USDT markets (Coinbase + Binance + Kraken).
      c.exVol[source] = o.quoteVol;
      c.vol24h = c.exVol.CB + c.exVol.BN + c.exVol.KR;
      c.liq = c.vol24h * 0.065; // rough estimate, labelled as such in the UI
    }
    c.mcap = c.price * c.supply;
    const wasLive = c.live;
    c.live = true;
    if (prev !== price || !wasLive) {
      if (prev !== price) c.lastDir = price > prev ? "up" : "down";
      c.history.push(price);
      if (c.history.length > 40) c.history.shift();
      state.tickCount++;
      state.dirty.add(sym);
      if (MODE !== "embed" && wasLive) checkAlert(c, prev, price);
    }
  }

  function flash(el, dir) {
    el.classList.remove("tick-up", "tick-down");
    void el.offsetWidth;
    el.classList.add(dir === "up" ? "tick-up" : "tick-down");
  }

  function flush() {
    if (!state.dirty.size || document.hidden) return;
    const dirty = Array.from(state.dirty);
    state.dirty.clear();

    if (MODE === "embed") {
      dirty.forEach(sym => patchWidget(document, sym, state.currency));
      return;
    }

    if (MODE === "coin") {
      if (dirty.includes(state.coinPageSym) || dirty.some(s => RATE_COINS.includes(s))) updateCoinPage();
    }

    if (MODE === "home") {
      $("tickCounter").textContent = state.tickCount.toLocaleString();
      dirty.forEach(sym => {
        const c = state.coins.get(sym);
        const priceEl = $(`price-${sym}`);
        if (!priceEl) return;
        priceEl.textContent = fmtPrice(c.price);
        priceEl.classList.remove("is-stale");
        flash(priceEl, c.lastDir);
        $(`src-${sym}`).textContent = c.lastSource;
        $(`chg-${sym}`).innerHTML = chgPill(c);
        $(`spark-${sym}`).innerHTML = buildSparkline(c.history, c.change24h >= 0);
        $(`range-${sym}`).innerHTML = rangeHtml(c);
        $(`mcap-${sym}`).textContent = fmtCompact(c.mcap);
        $(`vol-${sym}`).textContent = fmtCompact(c.vol24h);
        $(`liq-${sym}`).textContent = fmtCompact(c.liq);
        if (state.bag[sym] > 0) $(`bagval-${sym}`).textContent = fmtPrice(state.bag[sym] * c.price);
        document.querySelectorAll(`[data-tape="${sym}"]`).forEach(el => { el.textContent = fmtPrice(c.price); });
      });
      updateSummary();
    }

    if (state.widgetModalOpen) {
      const stage = $("wgPreviewStage");
      const curr = $("wgCurr").value;
      dirty.forEach(sym => patchWidget(stage, sym, curr));
    }
    if (state.activeModalSym && dirty.includes(state.activeModalSym)) updateCoinDetail(state.activeModalSym, "md");
  }

  // Timer-driven (not requestAnimationFrame) so the pinned tab title keeps updating in background tabs.
  setInterval(() => { flush(); updateTabTitle(); }, 200);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && MODE === "home") renderTable(); });

  const CANONICAL_TITLE = document.title;
  let lastTitle = "";
  function updateTabTitle() {
    if (MODE !== "home") return;
    const pinned = state.pinnedSym && state.coins.get(state.pinnedSym);
    const title = pinned ? `${pinned.sym} ${fmtPrice(pinned.price)} ${pinned.change24h >= 0 ? "▲" : "▼"} | CryptoPriceTicker.com` : CANONICAL_TITLE;
    if (title !== lastTitle) { document.title = title; lastTitle = title; }
  }

  /* ------------------------------------------------------------------
   * Data feeds — each subscribes only to the coins the current page shows
   * ------------------------------------------------------------------ */
  function activeSymbols() {
    if (MODE === "home") return Array.from(state.coins.keys());
    // Widgets have a fixed currency, so they only need its rate coin; coin pages can switch currency.
    const rates = MODE === "coin" ? RATE_COINS : state.currency === "USD" ? [] : [state.currency];
    const base = MODE === "coin" ? [state.coinPageSym] : state.embed.coins;
    return Array.from(new Set(base.concat(rates))).filter(s => state.coins.has(s));
  }
  const onExchange = (ex, syms) => syms.map(s => state.coins.get(s)).filter(c => c.feeds.includes(ex));

  function setBadge(ex, text, online) {
    const el = $(`badge${ex}`);
    if (!el) return;
    el.textContent = `${ex}: ${text}`;
    el.classList.toggle("online", online);
  }

  // Reconnect with capped exponential backoff; reset after a healthy connection.
  function keepAlive(ex, connect) {
    let delay = 2000;
    const open = () => {
      let ws;
      try { ws = connect(); } catch (_) { return; }
      ws.addEventListener("open", () => { delay = 2000; setBadge(ex, "LIVE", true); });
      ws.addEventListener("close", () => {
        setBadge(ex, "RETRY", false);
        setTimeout(open, delay);
        delay = Math.min(delay * 2, 60000);
      });
    };
    open();
  }

  function binanceTick(t, symbolKey) {
    const sym = exToSym.BN.get(t[symbolKey].slice(0, -4));
    if (!sym) return;
    const close = +(t.c ?? t.lastPrice);
    const open = +(t.o ?? t.openPrice);
    applyTick(sym, close, "BN", {
      change24h: open > 0 ? ((close - open) / open) * 100 : undefined,
      high24h: +(t.h ?? t.highPrice),
      low24h: +(t.l ?? t.lowPrice),
      quoteVol: +(t.q ?? t.quoteVolume)
    });
  }

  async function bootstrapBinance(syms) {
    const pairs = onExchange("BN", syms).map(c => tickerOf(c, "BN") + "USDT");
    if (!pairs.length) return;
    try {
      const res = await fetch(`${BINANCE_REST}/ticker/24hr?type=MINI&symbols=${encodeURIComponent(JSON.stringify(pairs))}`);
      if (!res.ok) throw new Error(res.status);
      const now = Date.now();
      (await res.json()).forEach(t => { if (now - t.closeTime < STALE_MS) binanceTick(t, "symbol"); });
      flush();
      if (MODE === "home") renderTable();
      if (MODE === "embed") renderEmbed();
    } catch (_) { /* the WebSocket snapshot fills in shortly */ }
  }

  let binanceSocket = null;
  function connectBinance(syms) {
    const streams = onExchange("BN", syms).map(c => tickerOf(c, "BN").toLowerCase() + "usdt@miniTicker");
    if (!streams.length) return;
    keepAlive("BN", () => {
      const ws = new WebSocket(BINANCE_WS + streams.concat(extraBinanceStreams).join("/"));
      ws.onmessage = ev => {
        try { const msg = JSON.parse(ev.data); if (msg.data && msg.data.s) binanceTick(msg.data, "s"); } catch (_) {}
      };
      binanceSocket = ws;
      return ws;
    });
  }
  const extraBinanceStreams = []; // pairs added via "Load more pairs"

  function connectCoinbase(syms) {
    const ids = onExchange("CB", syms).map(c => tickerOf(c, "CB") + "-USD");
    if (!ids.length) return;
    keepAlive("CB", () => {
      const ws = new WebSocket(COINBASE_WS);
      // ticker_batch (one update per product every 5s) instead of every trade: Binance already ticks each second.
      ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", product_ids: ids, channels: ["ticker_batch"] }));
      ws.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type !== "ticker" || !m.price) return;
          const sym = exToSym.CB.get(m.product_id.slice(0, -4));
          if (!sym) return;
          const p = +m.price;
          const open = +m.open_24h;
          applyTick(sym, p, "CB", {
            change24h: open > 0 ? ((p - open) / open) * 100 : undefined,
            high24h: +m.high_24h,
            low24h: +m.low_24h,
            quoteVol: +m.volume_24h * p
          });
        } catch (_) {}
      };
      return ws;
    });
  }

  // On the home page Kraken streams only the coins Binance doesn't cover; other coins are added
  // on demand when their spread inspector opens (krakenAdd).
  const krakenSubs = new Set();
  let krakenSocket = null;
  function krakenAdd(sym) {
    const c = state.coins.get(sym);
    if (!c || !c.feeds.includes("KR") || krakenSubs.has(sym)) return;
    krakenSubs.add(sym);
    if (!krakenSocket) return connectKraken([]);
    if (krakenSocket.readyState === 1) {
      krakenSocket.send(JSON.stringify({ method: "subscribe", params: { channel: "ticker", symbol: [tickerOf(c, "KR") + "/USD"] } }));
    }
  }

  function connectKraken(syms) {
    onExchange("KR", syms).filter(c => MODE !== "home" || !c.feeds.includes("BN")).forEach(c => krakenSubs.add(c.sym));
    if (!krakenSubs.size) return;
    keepAlive("KR", () => {
      const ws = new WebSocket(KRAKEN_WS);
      const symbols = () => Array.from(krakenSubs, s => tickerOf(state.coins.get(s), "KR") + "/USD");
      ws.onopen = () => ws.send(JSON.stringify({ method: "subscribe", params: { channel: "ticker", symbol: symbols() } }));
      krakenSocket = ws;
      ws.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data);
          if (m.channel !== "ticker" || !Array.isArray(m.data)) return;
          m.data.forEach(d => {
            const sym = exToSym.KR.get(d.symbol.split("/")[0]);
            if (sym && d.last) applyTick(sym, +d.last, "KR", { change24h: +d.change_pct, high24h: +d.high, low24h: +d.low, quoteVol: +d.volume * (+d.vwap || +d.last) });
          });
        } catch (_) {}
      };
      return ws;
    });
  }

  function startFeeds() {
    const syms = activeSymbols();
    bootstrapBinance(syms);
    connectBinance(syms);
    connectCoinbase(syms);
    connectKraken(syms);
  }

  /* ------------------------------------------------------------------
   * Coin detail: exchange prices, spread, depth, alert (modal + coin page)
   * ------------------------------------------------------------------ */
  function coinDetailHtml(sym, p) {
    const c = state.coins.get(sym);
    const s = esc(sym);
    const ex = (key, label) => `<div class="metric-box"><div class="metric-label">${label}</div><div class="metric-val" id="${p}-${key}">—</div></div>`;
    return `
      <div class="bento-metrics">${ex("CB", "Coinbase (USD)")}${ex("BN", "Binance (USDT)")}${ex("KR", "Kraken (USD)")}</div>
      <div class="bento-metrics">
        <div class="metric-box"><div class="metric-label">Cross-exchange spread</div><div class="metric-val" id="${p}-spread" style="color:var(--accent)">—</div></div>
        <div class="metric-box"><div class="metric-label">24h volume / market cap</div><div class="metric-val" id="${p}-turnover">—</div></div>
        <div class="metric-box"><div class="metric-label">Order-book depth ±2%</div><div class="metric-val" id="${p}-depth" title="Measured from the Binance order book">${c.feeds.includes("BN") ? "…" : "n/a"}</div></div>
      </div>
      <div style="background:var(--bg-primary);border:1px solid var(--border);padding:10px;border-radius:6px">
        <label class="metric-label" for="${p}-alert" style="display:block;margin-bottom:6px">🔔 Price alert (USD) — stored only in this browser; the page must stay open</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="number" step="any" min="0" id="${p}-alert" class="bag-input" style="flex:1;min-width:140px;text-align:left;padding:6px 8px"
            placeholder="e.g. ${(c.price * 1.05).toPrecision(5)}" value="${state.alerts[sym] || ""}" />
          <button type="button" class="action-btn" data-action="save-alert" data-sym="${s}" data-input="${p}-alert">Save alert</button>
          <button type="button" class="action-btn" data-action="clear-alert" data-sym="${s}" id="${p}-clear" ${state.alerts[sym] ? "" : "hidden"}>Clear</button>
        </div>
      </div>`;
  }

  function updateCoinDetail(sym, p) {
    const c = state.coins.get(sym);
    if (!c || !$(`${p}-CB`)) return;
    ["CB", "BN", "KR"].forEach(ex => {
      $(`${p}-${ex}`).textContent = c.exPrices[ex] ? fmtPrice(c.exPrices[ex]) : c.feeds.includes(ex) ? "…" : "not listed";
    });
    const valid = Object.values(c.exPrices).filter(v => v > 0);
    $(`${p}-spread`).textContent = valid.length >= 2 ? (((Math.max(...valid) - Math.min(...valid)) / Math.min(...valid)) * 100).toFixed(3) + "%" : "single feed";
    $(`${p}-turnover`).textContent = c.mcap > 0 && c.vol24h > 0 ? ((c.vol24h / c.mcap) * 100).toFixed(2) + "%" : "—";
  }

  // Real ±2% depth from Binance's order book (one REST call, only when a coin is opened).
  async function loadDepth(sym, p) {
    const c = state.coins.get(sym);
    const el = $(`${p}-depth`);
    if (!c.feeds.includes("BN") || !el) return;
    try {
      const res = await fetch(`${BINANCE_REST}/depth?symbol=${tickerOf(c, "BN")}USDT&limit=1000`);
      if (!res.ok) throw new Error(res.status);
      const book = await res.json();
      const mid = (+book.bids[0][0] + +book.asks[0][0]) / 2;
      const sum = (side, ok) => side.reduce((t, [px, qty]) => (ok(+px) ? t + px * qty : t), 0);
      const bid = sum(book.bids, px => px >= mid * 0.98);
      const ask = sum(book.asks, px => px <= mid * 1.02);
      el.textContent = fmtCompact(bid + ask);
      el.title = `Binance ${tickerOf(c, "BN")}/USDT: ${fmtCompact(bid)} bids within −2%, ${fmtCompact(ask)} asks within +2% of mid`;
    } catch (_) { el.textContent = "—"; }
  }

  function ensureModals() {
    if ($("coinModal")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="modal-backdrop" id="syncModal" role="dialog" aria-modal="true" aria-labelledby="syncTitle">
        <div class="modal-card">
          <div class="modal-head"><h2 id="syncTitle" style="font-size:15px">💾 Sync watchlist &amp; bag (no account)</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <p style="color:var(--text-secondary);font-size:12.5px">Open this link on another device to copy your watchlist and bag quantities there. Anyone with the link can see them, so keep it private.</p>
          <input type="text" class="sync-input" id="syncUrlInput" readonly aria-label="Sync link" />
          <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="action-btn btn-accent" data-action="copy" data-target="syncUrlInput" data-msg="📋 Sync link copied.">📋 Copy sync link</button></div>
        </div>
      </div>
      <div class="modal-backdrop" id="coinModal" role="dialog" aria-modal="true" aria-labelledby="modalCoinTitle">
        <div class="modal-card">
          <div class="modal-head"><h2 id="modalCoinTitle" style="font-size:15px"></h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div id="modalCoinBody" style="display:flex;flex-direction:column;gap:12px"></div>
        </div>
      </div>
      <div class="modal-backdrop" id="widgetModal" role="dialog" aria-modal="true" aria-labelledby="widgetTitle">
        <div class="modal-card modal-wide">
          <div class="modal-head"><h2 id="widgetTitle" style="font-size:15px">🧩 Free live crypto ticker widget</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <p style="color:var(--text-secondary);font-size:12.5px;margin-bottom:12px">Add a live, ad-free price ticker to your blog, docs or portal. Pick a layout, coins and theme, then paste the snippet into your HTML.</p>
          <div class="form-grid">
            <div class="form-group"><label for="wgLayout">1. Layout</label>
              <select id="wgLayout" class="form-select">
                <option value="marquee">Scrolling ticker bar (full width × 54px)</option>
                <option value="grid">Coin cards grid (× 225px)</option>
                <option value="single">Single coin card (× 180px)</option>
              </select></div>
            <div class="form-group"><label for="wgTheme">2. Theme</label>
              <select id="wgTheme" class="form-select">
                <option value="kali">Kali cyber blue (dark)</option><option value="green">Terminal green</option>
                <option value="slate">Slate</option><option value="oled">Pure black OLED</option><option value="light">Light</option>
              </select></div>
            <div class="form-group"><label for="wgCoins">3. Coins (comma-separated tickers)</label>
              <input type="text" id="wgCoins" class="form-input" value="${DEFAULT_WIDGET_COINS}" />
              <div class="preset-chips">
                <button type="button" class="preset-chip" data-action="wg-preset" data-preset="BTC,ETH,SOL,XRP,BNB,DOGE,ADA,HYPE">Majors</button>
                <button type="button" class="preset-chip" data-action="wg-preset" data-preset="RENDER,TAO,HNT,FIL,AKT,AR,THETA,IOTX">📡 DePIN</button>
                <button type="button" class="preset-chip" data-action="wg-preset" data-preset="TAO,FET,NEAR,RENDER,ICP,VIRTUAL,WLD,ARKM">🧠 AI</button>
                <button type="button" class="preset-chip" data-action="wg-preset" data-preset="XMR,ZEC,DASH,ROSE,ZEN">🛡️ Privacy</button>
                <button type="button" class="preset-chip" data-action="wg-preset" data-preset="WATCHLIST">❤️ My watchlist</button>
              </div></div>
            <div class="form-group"><label for="wgCurr">4. Currency &amp; credit link</label>
              <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:6px">
                <select id="wgCurr" class="form-select"><option value="USD">USD ($)</option><option value="BTC">BTC (₿)</option><option value="ETH">ETH (Ξ)</option><option value="SOL">SOL (◎)</option></select>
                <select id="wgAnchor" class="form-select" aria-label="Credit link text">
                  <option value="Live prices by CryptoPriceTicker.com">Live prices by CryptoPriceTicker.com</option>
                  <option value="Powered by CryptoPriceTicker.com">Powered by CryptoPriceTicker.com</option>
                  <option value="CryptoPriceTicker.com">CryptoPriceTicker.com</option>
                </select>
              </div></div>
          </div>
          <div class="form-group" style="margin-bottom:6px"><span class="metric-label">Live preview</span></div>
          <div class="widget-preview-stage" id="wgPreviewStage"></div>
          <div class="form-group"><label for="wgEmbedCode">HTML snippet (responsive iframe + credit link)</label><textarea id="wgEmbedCode" class="code-textarea" readonly></textarea></div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">⚡ No scripts on your page • lazy-loaded iframe • free</span>
            <div style="display:flex;gap:8px">
              <a class="action-btn" id="wgOpenStandalone" href="/embed/" target="_blank" rel="noopener">↗ Open widget</a>
              <button type="button" class="action-btn btn-accent" data-action="copy" data-target="wgEmbedCode" data-msg="📋 Widget snippet copied.">📋 Copy HTML</button>
            </div>
          </div>
        </div>
      </div>
      <div class="toast-container" id="toastContainer" role="status" aria-live="polite"></div>`;
    document.body.append(...wrap.children);
    ["wgLayout", "wgTheme", "wgCurr", "wgAnchor", "wgCoins"].forEach(id => $(id).addEventListener("input", updateWidgetBuilder));
  }

  let modalOpener = null;
  function openModal(id) {
    ensureModals();
    modalOpener = document.activeElement;
    const m = $(id);
    m.classList.add("open");
    (m.querySelector("input:not([readonly]), select, textarea, button:not([data-close])") || m.querySelector("button")).focus();
  }
  function closeModals() {
    document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
    state.activeModalSym = null;
    state.widgetModalOpen = false;
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
    modalOpener = null;
  }

  function openCoinModal(sym) {
    const c = state.coins.get(sym);
    if (!c) return;
    ensureModals();
    state.activeModalSym = sym;
    $("modalCoinTitle").textContent = `${c.sym} — ${c.name} (#${c.rank})`;
    $("modalCoinBody").innerHTML = coinDetailHtml(sym, "md") + `
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
        ${c.hasPage ? `<a class="action-btn" href="${coinUrl(sym)}">Open ${esc(sym)} page →</a>` : ""}
        <button type="button" class="action-btn btn-accent" data-action="open-widget" data-sym="${esc(sym)}">🧩 Embed ${esc(sym)} widget</button>
      </div>`;
    updateCoinDetail(sym, "md");
    loadDepth(sym, "md");
    krakenAdd(sym);
    openModal("coinModal");
  }

  /* ------------------------------------------------------------------
   * Alerts, toasts, sound
   * ------------------------------------------------------------------ */
  function saveAlert(sym, inputId) {
    const val = parseFloat($(inputId).value);
    if (!(val > 0)) return showToast("Enter a target price above 0.");
    state.alerts[sym] = val;
    store.set("cpt_alerts", state.alerts);
    showToast(`🔔 Alert set: ${sym} at $${val}`);
    refreshAlertUi(sym);
  }
  function clearAlert(sym) {
    delete state.alerts[sym];
    store.set("cpt_alerts", state.alerts);
    refreshAlertUi(sym);
  }
  function refreshAlertUi(sym) {
    ["md", "cp"].forEach(p => {
      const clear = $(`${p}-clear`);
      if (clear) clear.hidden = !state.alerts[sym];
      const input = $(`${p}-alert`);
      if (input && document.activeElement !== input) input.value = state.alerts[sym] || "";
    });
    if (MODE === "home") renderTable();
  }

  function checkAlert(c, oldPrice, newPrice) {
    const target = state.alerts[c.sym];
    if (!target) return;
    if ((oldPrice < target && newPrice >= target) || (oldPrice > target && newPrice <= target)) {
      delete state.alerts[c.sym];
      store.set("cpt_alerts", state.alerts);
      beep();
      showToast(`🚨 ${c.sym} crossed $${target} (now ${fmtPrice(newPrice, "USD")})`);
      refreshAlertUi(c.sym);
    }
  }

  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (_) {}
  }

  function showToast(msg) {
    ensureModals();
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = msg;
    $("toastContainer").appendChild(div);
    setTimeout(() => div.remove(), 4500);
  }

  async function copyFrom(id, msg) {
    const el = $(id);
    try {
      await navigator.clipboard.writeText(el.value);
    } catch (_) {
      el.select();
      try { document.execCommand("copy"); } catch (__) { return showToast("Copy failed — select the text and copy it manually."); }
    }
    showToast(msg);
  }

  /* ------------------------------------------------------------------
   * Widget builder
   * ------------------------------------------------------------------ */
  function openWidgetModal(sym) {
    ensureModals();
    if (sym) { $("wgLayout").value = "single"; $("wgCoins").value = sym; }
    $("wgCurr").value = state.currency;
    $("wgTheme").value = state.theme;
    state.widgetModalOpen = true;
    state.activeModalSym = null;
    document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
    updateWidgetBuilder();
    openModal("widgetModal");
  }

  function updateWidgetBuilder() {
    const layout = $("wgLayout").value;
    const theme = $("wgTheme").value;
    const curr = $("wgCurr").value;
    const anchor = $("wgAnchor").value;
    let coins = $("wgCoins").value.split(",").map(s => renamed(s.trim().toUpperCase())).filter(s => state.coins.get(s)?.hasPage);
    if (!coins.length) coins = ["BTC", "ETH", "SOL", "TAO"];

    const stage = $("wgPreviewStage");
    stage.setAttribute("data-theme", theme);
    stage.innerHTML = buildWidgetMarkup({ layout, coins, curr });

    const height = { marquee: 54, grid: 225, single: 180 }[layout];
    const embedUrl = `${SITE}/embed/?layout=${layout}&coins=${encodeURIComponent(coins.join(","))}&theme=${theme}&curr=${curr}`;
    // Brand-only credit text: Google treats keyword-rich links inside distributed widgets as link spam.
    const href = layout === "single" ? SITE + coinUrl(coins[0]) : SITE + "/";
    const title = layout === "single" ? `Live ${coins[0]} price` : "Live crypto prices";
    $("wgEmbedCode").value = `<!-- CryptoPriceTicker.com live price widget -->
<div class="cpt-widget-embed" style="width:100%;max-width:100%;overflow:hidden;border-radius:8px;font-family:sans-serif;">
  <iframe src="${embedUrl}" width="100%" height="${height}" style="border:0;display:block;width:100%;height:${height}px;" loading="lazy" title="${title} — CryptoPriceTicker.com"></iframe>
  <div style="text-align:right;font-size:11px;padding:3px 4px;opacity:0.85;">
    <a href="${href}" target="_blank" rel="noopener" style="color:#38bdf8;text-decoration:none;font-weight:600;">${anchor}</a>
  </div>
</div>
<!-- End CryptoPriceTicker.com widget -->`;
    $("wgOpenStandalone").href = embedUrl;
  }

  /* ------------------------------------------------------------------
   * "Load more pairs": add liquid Binance USDT pairs outside the registry
   * ------------------------------------------------------------------ */
  async function expandPairs(btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Fetching liquid Binance pairs…";
    try {
      const res = await fetch(`${BINANCE_REST}/ticker/24hr`);
      if (!res.ok) throw new Error(res.status);
      const now = Date.now();
      const pairs = (await res.json())
        .filter(t => t.symbol.endsWith("USDT") && now - t.closeTime < STALE_MS && +t.quoteVolume > 4e6)
        .map(t => ({ t, sym: t.symbol.slice(0, -4) }))
        .filter(({ sym }) => /^[A-Z0-9]{2,12}$/.test(sym) && !/(UP|DOWN|BEAR|BULL)$/.test(sym) && !exToSym.BN.has(sym) && !state.coins.has(sym))
        .sort((a, b) => b.t.quoteVolume - a.t.quoteVolume)
        .slice(0, 110);
      pairs.forEach(({ t, sym }) => {
        const price = +t.lastPrice;
        const vol = +t.quoteVolume;
        state.coins.set(sym, {
          sym, name: `${sym} (Binance pair)`, supply: (vol * 14.5) / price, price,
          change24h: +t.priceChangePercent, low24h: +t.lowPrice || price, high24h: +t.highPrice || price,
          mcap: vol * 14.5, vol24h: vol, exVol: { CB: 0, BN: vol, KR: 0 }, liq: vol * 0.065,
          sectors: [], feeds: ["BN"], tickers: {}, history: [price], rank: state.coins.size + 1,
          exPrices: { CB: null, BN: price, KR: null }, lastSource: "BN", live: true, hasPage: false, estimated: true
        });
        exToSym.BN.set(sym, sym);
        extraBinanceStreams.push(sym.toLowerCase() + "usdt@miniTicker");
      });
      if (binanceSocket && binanceSocket.readyState === 1 && pairs.length) {
        binanceSocket.send(JSON.stringify({ method: "SUBSCRIBE", params: pairs.map(p => p.sym.toLowerCase() + "usdt@miniTicker"), id: Date.now() }));
      }
      renderTable();
      btn.textContent = `✅ Tracking ${state.coins.size} assets`;
      showToast(`Added ${pairs.length} Binance pairs (market cap for these is a rough estimate).`);
    } catch (_) {
      btn.disabled = false;
      btn.textContent = "⚠️ Couldn't load pairs — retry";
    }
  }

  /* ------------------------------------------------------------------
   * Coin page (/coin/<sym>/)
   * ------------------------------------------------------------------ */
  function updateCoinPage() {
    const c = state.coins.get(state.coinPageSym);
    if (!c) return;
    const price = $("cpPrice");
    if (c.live && price.textContent !== fmtPrice(c.price)) flash(price, c.lastDir);
    price.textContent = fmtPrice(c.price);
    price.classList.toggle("is-stale", !c.live);
    $("cpChange").innerHTML = chgPill(c);
    $("cpSource").textContent = c.live ? `Last tick: ${{ CB: "Coinbase", BN: "Binance", KR: "Kraken" }[c.lastSource]} · ${new Date().toLocaleTimeString()}` : "Connecting to exchanges…";
    $("cpLow").textContent = fmtPrice(c.low24h);
    $("cpHigh").textContent = fmtPrice(c.high24h);
    $("cpMcap").textContent = fmtCompact(c.mcap);
    $("cpVol").textContent = fmtCompact(c.vol24h);
    $("cpRange").style.width = rangePct(c).toFixed(0) + "%";
    if (!chartLoaded) $("cpChart").innerHTML = buildSparkline(c.history, c.change24h >= 0, 600, 140, { fluid: true, label: `${c.name} live price ticks` });
    updateCoinDetail(c.sym, "cp");
  }

  let chartLoaded = false;
  async function loadCoinChart() {
    const c = state.coins.get(state.coinPageSym);
    if (!c.feeds.includes("BN")) { $("cpChartNote").textContent = "Live ticks since you opened this page"; return; }
    try {
      const res = await fetch(`${BINANCE_REST}/uiKlines?symbol=${tickerOf(c, "BN")}USDT&interval=15m&limit=96`);
      if (!res.ok) throw new Error(res.status);
      const closes = (await res.json()).map(k => +k[4]);
      if (closes.length < 2) throw new Error("empty");
      chartLoaded = true;
      $("cpChart").innerHTML = buildSparkline(closes, closes[closes.length - 1] >= closes[0], 600, 140, { fluid: true, label: `${c.name} price, last 24 hours` });
      $("cpChartNote").textContent = "Last 24h · 15-min closes · Binance";
    } catch (_) { $("cpChartNote").textContent = "Live ticks since you opened this page"; }
  }

  function initCoinPage() {
    const c = state.coins.get(state.coinPageSym);
    if (!c) return;
    $("coinDetail").innerHTML = coinDetailHtml(c.sym, "cp");
    syncFavButton();
    updateCoinPage();
    loadCoinChart();
    loadDepth(c.sym, "cp");
  }

  function syncFavButton() {
    const btn = $("cpFav");
    if (!btn) return;
    const fav = state.watchlist.has(state.coinPageSym);
    btn.setAttribute("aria-pressed", fav);
    btn.textContent = fav ? "♥ In watchlist" : "♡ Add to watchlist";
  }

  /* ------------------------------------------------------------------
   * Shared controls: theme, currency, events
   * ------------------------------------------------------------------ */
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    store.set("cpt_theme", t);
    document.querySelectorAll("[data-theme-val]").forEach(b => {
      const on = b.getAttribute("data-theme-val") === t;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  }

  function applyCurrency(curr) {
    state.currency = curr;
    store.set("cpt_curr", curr);
    document.querySelectorAll("[data-curr]").forEach(b => {
      const on = b.getAttribute("data-curr") === curr;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  }

  function rerender() {
    if (MODE === "home") renderTable();
    if (MODE === "coin") updateCoinPage();
    if (MODE === "embed") renderEmbed();
  }

  const actions = {
    "toggle-fav"(el) {
      const sym = el.dataset.sym;
      if (state.watchlist.has(sym)) state.watchlist.delete(sym); else state.watchlist.add(sym);
      store.set("cpt_watch", Array.from(state.watchlist));
      if (MODE === "home") renderTable(); else syncFavButton();
    },
    "toggle-pin"(el) {
      state.pinnedSym = state.pinnedSym === el.dataset.sym ? "" : el.dataset.sym;
      store.set("cpt_pin", state.pinnedSym);
      renderTable();
      if (state.pinnedSym) showToast(`📌 ${state.pinnedSym} live price pinned to this tab's title.`);
    },
    "open-coin": el => openCoinModal(el.dataset.sym),
    "open-widget": el => openWidgetModal(el.dataset.sym),
    "save-alert": el => saveAlert(el.dataset.sym, el.dataset.input),
    "clear-alert": el => clearAlert(el.dataset.sym),
    theme: el => applyTheme(el.getAttribute("data-theme-val")),
    curr(el) { applyCurrency(el.getAttribute("data-curr")); rerender(); },
    sector(el) {
      state.sector = el.dataset.sector;
      document.querySelectorAll("[data-action=sector]").forEach(p => {
        p.classList.toggle("active", p === el);
        p.setAttribute("aria-pressed", p === el);
      });
      renderTable();
    },
    sort(el) {
      const col = el.closest("th").dataset.sort;
      if (state.sortBy === col) state.sortAsc = !state.sortAsc;
      else { state.sortBy = col; state.sortAsc = col === "rank" || col === "name"; }
      renderTable();
    },
    movers(el) {
      state.moverMode = el.dataset.mode;
      document.querySelectorAll("[data-action=movers]").forEach(b => {
        b.classList.toggle("active", b === el);
        b.setAttribute("aria-pressed", b === el);
      });
      updateSummary();
    },
    "reset-bag"() {
      state.bag = {};
      store.set("cpt_bag", {});
      renderTable();
      showToast("💼 Bag quantities cleared.");
    },
    density() {
      state.compact = !state.compact;
      store.set("cpt_compact", state.compact ? "1" : "0");
      $("cryptoTable").classList.toggle("compact-mode", state.compact);
      $("densityBtn").setAttribute("aria-pressed", state.compact);
    },
    csv() {
      const q = v => `"${String(v).replace(/"/g, '""')}"`;
      const rows = [["Rank", "Symbol", "Name", "Price_USD", "Change_24h_Pct", "Market_Cap_USD", "Volume_24h_USD", "Est_Liquidity_2Pct_USD", "Bag_Qty"]];
      filteredSorted().forEach(c => rows.push([c.rank, q(c.sym), q(c.name), c.price, c.live ? c.change24h.toFixed(2) : "", Math.round(c.mcap), Math.round(c.vol24h), Math.round(c.liq), state.bag[c.sym] || 0]));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" }));
      a.download = `cryptopriceticker-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast("📥 Exported the current table to CSV.");
    },
    sync() {
      ensureModals();
      const w = Array.from(state.watchlist).join(",");
      const b = Object.entries(state.bag).map(([k, v]) => `${k}:${v}`).join(",");
      $("syncUrlInput").value = `${location.origin}/?w=${encodeURIComponent(w)}&b=${encodeURIComponent(b)}`;
      openModal("syncModal");
    },
    copy: el => copyFrom(el.dataset.target, el.dataset.msg),
    "wg-preset"(el) {
      const preset = el.dataset.preset;
      $("wgCoins").value = preset === "WATCHLIST" ? (state.watchlist.size ? Array.from(state.watchlist) : ["BTC", "ETH", "SOL"]).join(",") : preset;
      updateWidgetBuilder();
    },
    expand: el => expandPairs(el)
  };

  document.addEventListener("click", e => {
    const backdrop = e.target.classList?.contains("modal-backdrop");
    if (backdrop || e.target.closest("[data-close]")) return closeModals();
    const el = e.target.closest("[data-action]");
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  });

  document.addEventListener("change", e => {
    const input = e.target.closest(".bag-input[data-sym]");
    if (!input) return;
    const sym = input.dataset.sym;
    const qty = parseFloat(input.value);
    if (qty > 0) state.bag[sym] = qty; else delete state.bag[sym];
    store.set("cpt_bag", state.bag);
    if (MODE === "home") renderTable();
  });

  document.addEventListener("keydown", e => {
    const search = $("searchInput");
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === "/" && search && !typing) {
      e.preventDefault();
      search.focus();
    } else if (e.key === "Escape" && document.querySelector(".modal-backdrop.open")) {
      closeModals();
    }
  });

  /* ------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------ */
  applyTheme(state.theme);
  applyCurrency(state.currency);
  if ($("registryDate") && window.CPT_COINS_UPDATED) $("registryDate").textContent = "on " + window.CPT_COINS_UPDATED;

  if (MODE === "embed") {
    recomputeRanks();
    renderEmbed();
  } else if (MODE === "home") {
    let searchTimer;
    $("searchInput").addEventListener("input", e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = e.target.value; renderTable(); }, 120);
    });
    $("cryptoTable").classList.toggle("compact-mode", state.compact);
    $("densityBtn").setAttribute("aria-pressed", state.compact);
    renderTable();
  } else if (MODE === "coin") {
    recomputeRanks();
    initCoinPage();
  }

  if (MODE === "home" || MODE === "coin" || MODE === "embed") startFeeds();
})();
