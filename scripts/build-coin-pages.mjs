#!/usr/bin/env node
// Generates the static, crawlable parts of the site from assets/coins.js:
//   coin/<sym>/index.html   one page per coin (live data is filled in by assets/app.js)
//   sitemap.xml             home + every coin page
//   _redirects              old tickers (e.g. /coin/ton/ → /coin/gram/)
//   convert/index.html      the crypto converter page
//   heatmap/index.html      the live market heatmap page
//   index.html              the "Live price pages" link list between the coin-index markers
//
//   node scripts/build-coin-pages.mjs
//
// Output is deterministic (dates come from CPT_COINS_UPDATED), so re-running without
// registry changes produces no diff. Coin pages for removed coins are deleted.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { ROOT, loadRegistry } from "./lib/registry.mjs";

const SITE = "https://cryptopriceticker.com";
const EXCHANGES = { CB: "Coinbase", BN: "Binance", KR: "Kraken" };
const PAIR = { CB: t => `${t}-USD`, BN: t => `${t}/USDT`, KR: t => `${t}/USD` };
const SECTOR_NAMES = {
  L1: "Layer 1", L2: "Layer 2", DePIN: "DePIN", AI: "AI", DeFi: "DeFi", RWA: "Real-world assets",
  Privacy: "Privacy", Gaming: "Gaming", Meme: "Memecoin", Stable: "Stablecoin"
};

const { coins, updated: registryUpdated } = loadRegistry();
const about = JSON.parse(readFileSync(ROOT + "content/coin-about.json", "utf8"));
// Per-coin performance figures from scripts/fetch-coin-stats.mjs (optional).
const statsFile = existsSync(ROOT + "content/coin-stats.json") ? JSON.parse(readFileSync(ROOT + "content/coin-stats.json", "utf8")) : { coins: {} };
const stats = statsFile.coins;
const updated = [registryUpdated, statsFile.updated].filter(Boolean).sort().pop();
// Hand- or agent-edited title/description/h1 per coin; validated by scripts/seo-lint.mjs.
const overrides = existsSync(ROOT + "content/seo-overrides.json") ? JSON.parse(readFileSync(ROOT + "content/seo-overrides.json", "utf8")) : {};
const byCap = [...coins].sort((a, b) => b.supply * b.price - a.supply * a.price);
const rankOf = new Map(byCap.map((c, i) => [c.sym, i + 1]));

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const slug = sym => sym.toLowerCase();
const url = sym => `${SITE}/coin/${slug(sym)}/`;
const longDate = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const list = items => (items.length > 1 ? items.slice(0, -1).join(", ") + " and " + items[items.length - 1] : items[0] || "");

// Same rules as fmtPrice/fmtCompact in assets/app.js (USD only).
function usd(v) {
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (v >= 0.01) return "$" + v.toFixed(4);
  if (v >= 0.0001) return "$" + v.toFixed(6);
  return "$" + v.toFixed(8);
}
function compact(v, prefix = "$") {
  if (v >= 1e12) return prefix + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return prefix + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return prefix + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return prefix + (v / 1e3).toFixed(1) + "K";
  return prefix + v.toFixed(2);
}

// Converter (filled live by assets/app.js; FIATS must match the list there).
const FIATS = [["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "British pound"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"],
  ["JPY", "Japanese yen"], ["INR", "Indian rupee"], ["CHF", "Swiss franc"], ["CNY", "Chinese yuan"], ["KRW", "South Korean won"],
  ["BRL", "Brazilian real"], ["MXN", "Mexican peso"], ["TRY", "Turkish lira"], ["ZAR", "South African rand"], ["NGN", "Nigerian naira"],
  ["PHP", "Philippine peso"], ["SGD", "Singapore dollar"], ["HKD", "Hong Kong dollar"], ["AED", "UAE dirham"], ["PLN", "Polish złoty"]];
const RATE_COINS = ["BTC", "ETH", "SOL"]; // always streamed on coin pages
const num = v => +v.toPrecision(12);
function coinAmount(v, sym) {
  const digits = v >= 1000 ? 2 : v >= 1 ? 6 : Math.min(10, 5 - Math.floor(Math.log10(v)));
  return v.toLocaleString("en-US", { maximumFractionDigits: digits }) + " " + sym;
}
function converterHtml(coinList, from, to, seedOut) {
  const options = selected => `<optgroup label="Cryptocurrencies">${coinList.map(c => `<option value="${esc(c.sym)}"${c.sym === selected ? " selected" : ""}>${esc(c.sym)} · ${esc(shortName(c))}</option>`).join("")}</optgroup>` +
    `<optgroup label="Currencies">${FIATS.map(([f, n]) => `<option value="${f}"${f === selected ? " selected" : ""}>${f} · ${esc(n)}</option>`).join("")}</optgroup>`;
  return `<div class="converter is-stale" id="converter">
        <div class="conv-side">
          <label class="metric-label" for="cvA">Amount</label>
          <div class="conv-field"><input id="cvA" type="number" inputmode="decimal" step="any" min="0" value="1" />
          <select id="cvFrom" aria-label="Convert from">${options(from)}</select></div>
        </div>
        <button type="button" class="conv-swap" data-action="cv-swap" aria-label="Swap the two currencies">⇄</button>
        <div class="conv-side">
          <label class="metric-label" for="cvB">Converted to</label>
          <div class="conv-field"><input id="cvB" type="number" inputmode="decimal" step="any" min="0" value="${seedOut}" />
          <select id="cvTo" aria-label="Convert to">${options(to)}</select></div>
        </div>
        <p class="conv-rate"><strong id="cvRate" aria-live="polite">1 ${esc(from)} = ${seedOut ? usd(seedOut) : "…"}</strong> <span id="cvInverse"></span></p>
      </div>`;
}
function conversionTables(c) {
  const p = c.price, s = esc(c.sym);
  const amounts = p >= 1000 ? [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5, 10] : p >= 1 ? [1, 5, 10, 25, 50, 100, 500, 1000]
    : p >= 0.01 ? [10, 100, 500, 1000, 5000, 10000, 50000, 100000] : [10000, 100000, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11];
  const dollars = [1, 10, 50, 100, 500, 1000, 5000, 10000];
  const fwd = amounts.map(a => `<tr><td class="col-left">${a.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${s}</td><td data-cv-amt="${a}">${usd(num(a * p))}</td></tr>`).join("\n            ");
  const rev = dollars.map(d => `<tr><td class="col-left" data-cv-label="${d}">${d.toLocaleString("en-US")} USD</td><td data-cv-amt="${d}" data-cv-dir="rev">${coinAmount(d / p, s)}</td></tr>`).join("\n            ");
  return `<div class="conv-tables">
        <table class="history-table conv-table">
          <caption>${s} to <span data-cv-other>USD</span></caption>
          <thead><tr><th scope="col" class="col-left">${s}</th><th scope="col"><span data-cv-other>USD</span></th></tr></thead>
          <tbody>
            ${fwd}
          </tbody>
        </table>
        <table class="history-table conv-table">
          <caption><span data-cv-other>USD</span> to ${s}</caption>
          <thead><tr><th scope="col" class="col-left"><span data-cv-other>USD</span></th><th scope="col">${s}</th></tr></thead>
          <tbody>
            ${rev}
          </tbody>
        </table>
      </div>`;
}

const THEMES = [["kali", "Kali (dark blue)"], ["green", "Terminal green"], ["slate", "Slate"], ["oled", "Pure black"], ["light", "Light"]];
const themeButtons = THEMES.map(([t, label]) => `<button type="button" class="theme-btn" data-action="theme" data-theme-val="${t}" title="${label}"><span class="swatch sw-${t}"></span></button>`).join("");
const currencyButtons = [["USD", "$"], ["BTC", "₿"], ["ETH", "Ξ"], ["SOL", "◎"]]
  .map(([c, s]) => `<button type="button" class="btn-toggle" data-action="curr" data-curr="${c}" aria-label="Prices in ${c}">${s}</button>`).join("");

// Sector hubs (content/sectors.json) — a coin's breadcrumb points to the hub of its first sector.
const sectors = JSON.parse(readFileSync(ROOT + "content/sectors.json", "utf8"));
const sectorOf = key => sectors.find(x => x.keys.includes(key));
const sectorUrl = x => `${SITE}/sector/${x.slug}/`;

// Same header as index.html: brand, link home, live-feed status, currency and menu.
function topbar(withFeeds, withCurrency = withFeeds) {
  return `<header class="topbar">
    <a class="topbar-brand" href="/" aria-label="CryptoPriceTicker home"><span class="brand-logo" aria-hidden="true">⚡</span><span class="brand-word">CryptoPriceTicker</span></a>
    <a class="topbar-link" href="/">← All prices</a>
    <div class="topbar-actions">${withFeeds ? `
      <details class="pop live-pop">
        <summary aria-label="Live feed status"><span class="pulse-dot" aria-hidden="true"></span><span class="hide-mobile">Live</span></summary>
        <div class="pop-panel" role="group" aria-label="Exchange feeds">
          <p class="pop-title">Streaming from the exchanges</p>
          <p><span class="feed-badge" id="badgeCB">CB: INIT</span> Coinbase</p>
          <p><span class="feed-badge" id="badgeBN">BN: INIT</span> Binance</p>
          <p><span class="feed-badge" id="badgeKR">KR: INIT</span> Kraken</p>
        </div>
      </details>
` : ""}${withCurrency ? `
      <div class="btn-group" role="group" aria-label="Price currency">${currencyButtons}</div>` : ""}
      <details class="pop menu-pop">
        <summary aria-label="Menu">☰</summary>
        <div class="pop-panel menu-list">
          <p class="pop-title">Theme</p>
          <div class="theme-switcher" role="group" aria-label="Colour theme">${themeButtons}</div>
          <button type="button" class="menu-item" data-action="open-widget">🧩 Get a free website widget</button>
          <a class="menu-item" href="/widgets/">📐 Widget gallery &amp; docs</a>
          <a class="menu-item" href="/heatmap/">🟩 Market heatmap</a>
          <a class="menu-item" href="/convert/">🔁 Crypto converter</a>
          <a class="menu-item" href="/about/">ℹ️ About &amp; data sources</a>
        </div>
      </details>
    </div>
  </header>`;
}

const shortName = c => c.name.replace(/\s*\(formerly [^)]+\)/, "");
const firstFit = (options, max) => options.find(o => o.length <= max) || options[options.length - 1];
const pctText = v => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const pctClass = v => (v === null || v === undefined ? "" : v >= 0 ? "chg-up" : "chg-down");
const monthName = ym => new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

// Plain, data-derived sentences (no generated prose): what the numbers say, with dates.
function performanceSummary(c, st) {
  const n = shortName(c);
  const parts = [];
  if (c.sectors.includes("Stable")) {
    parts.push(`Over the past ${st.historyDays >= 365 ? "year" : st.historyDays + " days"}, ${esc(n)} closed between ${usd(st.low52w)} and ${usd(st.high52w)} per day, a range of ${(((st.high52w - st.low52w) / st.low52w) * 100).toFixed(2)}% around its US-dollar peg.`);
  } else {
    if (st.change1y !== null) parts.push(`Over the past year, ${esc(n)} has ${st.change1y >= 0 ? "risen" : "fallen"} ${Math.abs(st.change1y).toFixed(1)}%.`);
    parts.push(`Its daily closes ranged from ${usd(st.low52w)} (${longDate(st.low52wDate)}) to ${usd(st.high52w)} (${longDate(st.high52wDate)})${st.historyDays < 365 ? ` over the ${st.historyDays} days of data available on ${st.source}` : " over the last 52 weeks"}.`);
    const fromHigh = ((st.close - st.high52w) / st.high52w) * 100;
    parts.push(`On ${longDate(st.asOf)} it closed at ${usd(st.close)}, ${Math.abs(fromHigh) < 0.5 ? "at its 52-week high" : `${Math.abs(fromHigh).toFixed(1)}% below that high`}, with 30-day annualized volatility of ${st.volatility30d}%.`);
  }
  return parts.join(" ");
}

function statsSection(c, st) {
  if (!st) return "";
  const s = esc(c.sym);
  const cell = (label, v) => `<div class="metric-box"><div class="metric-label">${label}</div><div class="metric-val"><span class="chg-pill ${pctClass(v)}">${pctText(v)}</span></div></div>`;
  const rows = st.monthly.slice().reverse().map(m =>
    `<tr><td class="col-left">${monthName(m.month)}</td><td>${usd(m.close)}</td><td><span class="chg-pill ${pctClass(m.change)}">${pctText(m.change)}</span></td></tr>`).join("\n          ");
  return `
    <section class="page-section" aria-labelledby="perf-h">
      <h2 id="perf-h">${s} price performance</h2>
      <p class="prose">${performanceSummary(c, st)}</p>
      <div class="stat-grid">
        ${cell("7 days", st.change7d)}
        ${cell("30 days", st.change30d)}
        ${cell("90 days", st.change90d)}
        ${cell("1 year", st.change1y)}
        <div class="metric-box"><div class="metric-label">52-week high</div><div class="metric-val">${usd(st.high52w)}</div><div class="metric-label">${longDate(st.high52wDate)}</div></div>
        <div class="metric-box"><div class="metric-label">52-week low</div><div class="metric-val">${usd(st.low52w)}</div><div class="metric-label">${longDate(st.low52wDate)}</div></div>
      </div>
      <h3 style="font-size:13px;margin:14px 0 8px">${s} monthly closing prices</h3>
      <div class="table-wrap">
        <table class="history-table">
          <caption class="sr-only">${esc(shortName(c))} month-end closing price in USD and monthly change</caption>
          <thead><tr><th scope="col" class="col-left">Month</th><th scope="col">Close (USD)</th><th scope="col">Change</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>
      </div>
      <p class="disclaimer" style="margin-top:8px">Daily closes (UTC) from ${st.source}, as of ${longDate(st.asOf)}. Updated weekly.</p>
    </section>`;
}

function relatedCoins(c) {
  const primary = c.sectors[0];
  const same = byCap.filter(o => o.sym !== c.sym && o.sectors.includes(primary)).slice(0, 8);
  const i = byCap.indexOf(c);
  const nearby = byCap.slice(Math.max(0, i - 3), i + 4).filter(o => o !== c);
  const top = byCap.filter(o => o.sym !== c.sym && !same.includes(o) && !nearby.includes(o)).slice(0, Math.max(4, 12 - same.length));
  return { primary, same, nearby, top };
}

function coinPage(c) {
  const s = esc(c.sym);
  const name = esc(c.name);
  const mcap = c.price * c.supply * 1e6;
  const exNames = c.feeds.map(f => EXCHANGES[f]);
  const pairs = c.feeds.map(f => `${EXCHANGES[f]} (${PAIR[f](c.tickers?.[f] || c.sym)})`);
  const sectors = c.sectors.map(x => SECTOR_NAMES[x] || x);
  const { primary, same, nearby, top } = relatedCoins(c);
  const st = stats[c.sym];
  const o = overrides[c.sym] || {};
  const hub = sectorOf(c.sectors[0]);
  const n = shortName(c);
  // Titles skip the brand suffix: Google shows the site name separately, and ≤60 chars avoids truncation.
  const title = o.title || firstFit([
    `${n} (${c.sym}) Price: Live Chart & Market Cap`,
    `${n} (${c.sym}) Price & Live Chart`,
    `${n} (${c.sym}) Live Price`
  ], 60);
  const description = o.description || firstFit([
    `${n} (${c.sym}) price today in USD, live from ${list(exNames)}. 24h change, chart, market cap, 1-year performance and 52-week range.`,
    `${n} (${c.sym}) price today in USD, live from ${list(exNames)}. Chart, market cap and 1-year performance.`,
    `Live ${n} (${c.sym}) price in USD with chart, market cap and 1-year performance.`
  ], 160);
  const h1 = o.h1 || `${c.name} (${c.sym}) price`;
  const supplyText = c.supply >= 1000 ? compact(c.supply * 1e6, "") : (c.supply * 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const relatedLinks = arr => arr.map(o => `<a href="/coin/${slug(o.sym)}/">${esc(o.sym)} <span>${esc(o.name)}</span></a>`).join("\n          ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url(c.sym),
        url: url(c.sym),
        name: title,
        description,
        dateModified: updated,
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@type": "Thing", name: c.name, alternateName: c.sym }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
          ...(hub ? [{ "@type": "ListItem", position: 2, name: hub.name, item: sectorUrl(hub) }] : []),
          { "@type": "ListItem", position: hub ? 3 : 2, name: `${c.name} (${c.sym})`, item: url(c.sym) }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<!-- Generated by scripts/build-coin-pages.mjs from assets/coins.js — edit those, not this file. -->
<html lang="en" data-theme="kali">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url(c.sym)}" />
  <meta name="theme-color" content="#0a0e17" />
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preload" href="/assets/app.css" as="style" />
  <link rel="preconnect" href="https://data-api.binance.vision" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CryptoPriceTicker.com" />
  <meta property="og:title" content="${esc(`${c.name} (${c.sym}) live price`)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url(c.sym)}" />
  <meta property="og:image" content="${SITE}${existsSync(`${ROOT}og/${slug(c.sym)}.jpg`) ? `/og/${slug(c.sym)}.jpg` : "/og-image.png"}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/theme-init.js"></script>
  <link rel="stylesheet" href="/assets/app.css" />
  <script src="/assets/coins.js" defer></script>
  <script src="/assets/app.js" defer></script>
</head>
<body data-page="coin" data-sym="${s}">
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(true)}

  <main class="container" id="main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › ${hub ? `<a href="/sector/${hub.slug}/">${esc(hub.name)}</a> › ` : ""}<span aria-current="page">${name}</span></nav>

    <section class="coin-hero" aria-labelledby="coin-h">
      <div>
        <div class="coin-title"><span class="coin-avatar" aria-hidden="true">${esc(c.sym.slice(0, 4))}</span><h1 id="coin-h">${esc(h1)}</h1></div>
        <p class="hero-price is-stale" id="cpPrice">${usd(c.price)}</p>
        <div class="hero-meta">
          <span id="cpChange"><span class="chg-pill">—</span></span>
          <span class="tag-badge">#${rankOf.get(c.sym)}</span>
          ${c.sectors.map(x => `<span class="tag-badge">${esc(x)}</span>`).join(" ")}
          <span id="cpSource">Snapshot from ${longDate(updated)} — connecting to live feeds…</span>
        </div>
        <div class="hero-actions">
          <button type="button" class="action-btn" id="cpFav" data-action="toggle-fav" data-sym="${s}" aria-pressed="false">♡ Add to watchlist</button>
          <button type="button" class="action-btn btn-accent" data-action="open-widget" data-sym="${s}">🧩 Embed ${s} widget</button>
          <a class="action-btn" href="/">All prices →</a>
        </div>
      </div>
      <div>
        <div class="chart-box" id="cpChart"></div>
        <div class="chart-caption"><span id="cpChartNote">Loading chart…</span><span>${s}/USD</span></div>
      </div>
    </section>

    <div class="stat-grid">
      <div class="metric-box"><div class="metric-label">Market cap</div><div class="metric-val" id="cpMcap">${compact(mcap)}</div></div>
      <div class="metric-box"><div class="metric-label">24h volume (${c.feeds.join("+")})</div><div class="metric-val" id="cpVol">—</div></div>
      <div class="metric-box"><div class="metric-label">Circulating supply</div><div class="metric-val">${supplyText} ${s}</div></div>
      <div class="metric-box">
        <div class="metric-label">24h low / high</div>
        <div class="metric-val" style="font-size:11.5px"><span id="cpLow">—</span> – <span id="cpHigh">—</span></div>
        <div class="range-track" style="margin-top:5px"><div class="range-fill" id="cpRange" style="width:50%"></div></div>
      </div>
    </div>

    <section class="page-section" id="convert" aria-labelledby="conv-h">
      <h2 id="conv-h">Convert ${s} to USD</h2>
      ${converterHtml([c, ...RATE_COINS.filter(x => x !== c.sym).map(x => coins.find(o => o.sym === x))], c.sym, "USD", num(c.price))}
      ${conversionTables(c)}
      <p class="disclaimer">Uses the live ${s} price above. Currencies other than USD use Coinbase's reference exchange rates. <a href="/convert/?from=${slug(c.sym)}">Convert ${s} to any other coin →</a></p>
    </section>

    ${statsSection(c, st)}

    <section class="page-section" aria-labelledby="ex-h">
      <h2 id="ex-h">${s} price on each exchange</h2>
      <div id="coinDetail" style="display:flex;flex-direction:column;gap:12px"></div>
    </section>

    <section class="page-section prose" aria-labelledby="about-h">
      <h2 id="about-h">About ${name}</h2>
      <p>${esc(about[c.sym] || "")}</p>
      <h3>Where this ${s} price comes from</h3>
      <p>The price above updates live in your browser from ${list(pairs)}, and the badge shows which exchange reported the latest trade. Market cap is the live price × a circulating supply of about ${supplyText} ${s} (supply last updated ${longDate(updated)}). Prices on different exchanges can differ slightly; the table above shows each one and the spread between them.</p>
      ${c.formerly ? `<p>${name} previously traded under the ticker <strong>${esc(c.formerly)}</strong>; old ${esc(c.formerly)} links on this site redirect here.</p>` : ""}
      <p class="disclaimer">Not financial advice. Data comes from third-party exchanges and may be delayed or inaccurate.</p>
    </section>

    <nav class="page-section" aria-labelledby="rel-h">
      <h2 id="rel-h">More ${esc(SECTOR_NAMES[primary] || primary)} prices</h2>
      <div class="related-list">
          ${relatedLinks(same)}
      </div>
      <h3 style="font-size:13px;margin:14px 0 8px">Similar market cap</h3>
      <div class="related-list">
          ${relatedLinks(nearby)}
      </div>
      <h3 style="font-size:13px;margin:14px 0 8px">Top coins by market cap</h3>
      <div class="related-list">
          ${relatedLinks(top)}
      </div>
    </nav>
  </main>

  <footer class="container site-footer" style="padding-top:0">
    <span><a href="/">CryptoPriceTicker.com</a> — live multi-exchange crypto prices. No login, no ads. <a href="/about/">About &amp; methodology</a></span>
  </footer>
</body>
</html>
`;
}

// 1. Coin pages (and removal of pages for coins no longer in the registry)
const coinDir = ROOT + "coin/";
mkdirSync(coinDir, { recursive: true });
const keep = new Set(coins.map(c => slug(c.sym)));
for (const d of readdirSync(coinDir)) if (!keep.has(d)) rmSync(coinDir + d, { recursive: true, force: true });
for (const c of coins) {
  mkdirSync(coinDir + slug(c.sym), { recursive: true });
  writeFileSync(`${coinDir}${slug(c.sym)}/index.html`, coinPage(c));
}

// 1b. Sector hub pages
function sectorPage(x) {
  const members = byCap.filter(c => c.sectors.some(k => x.keys.includes(k)));
  const withStats = members.filter(c => stats[c.sym]);
  const median = arr => { const v = arr.filter(n => n !== null && n !== undefined).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const m30 = median(withStats.map(c => stats[c.sym].change30d));
  const m1y = median(withStats.map(c => stats[c.sym].change1y));
  const by30 = withStats.filter(c => stats[c.sym].change30d !== null).sort((a, b) => stats[b.sym].change30d - stats[a.sym].change30d);
  const totalCap = members.reduce((t, c) => t + c.price * c.supply * 1e6, 0);
  const asOf = withStats.map(c => stats[c.sym].asOf).sort().pop();
  const title = x.title;
  const description = `Live prices for ${members.length} ${x.noun} from Coinbase, Binance and Kraken, with 7-day, 30-day and 1-year performance and market caps.`;
  const summary = [
    `This page tracks ${members.length} ${esc(x.noun)} with a combined market cap of about ${compact(totalCap)}.`,
    m30 !== null ? `Over the last 30 days the median coin here ${m30 >= 0 ? "gained" : "lost"} ${Math.abs(m30).toFixed(1)}%${m1y !== null ? `, and over one year ${m1y >= 0 ? "gained" : "lost"} ${Math.abs(m1y).toFixed(1)}%` : ""}.` : "",
    by30.length > 1 ? `The best 30-day performer was ${esc(shortName(by30[0]))} (${pctText(stats[by30[0].sym].change30d)}) and the weakest was ${esc(shortName(by30[by30.length - 1]))} (${pctText(stats[by30[by30.length - 1].sym].change30d)}).` : ""
  ].filter(Boolean).join(" ");
  const rows = members.map((c, i) => {
    const st = stats[c.sym] || {};
    return `<tr>
            <td class="col-center muted">${i + 1}</td>
            <td class="col-left"><a class="coin-cell" href="/coin/${slug(c.sym)}/"><span class="coin-avatar" aria-hidden="true">${esc(c.sym.slice(0, 4))}</span><span class="coin-main"><span class="coin-name">${esc(c.name)}</span><span class="coin-sym-row"><span class="coin-sym">${esc(c.sym)}</span></span></span></a></td>
            <td>${st.close ? usd(st.close) : usd(c.price)}</td>
            <td><span class="chg-pill ${pctClass(st.change7d)}">${pctText(st.change7d)}</span></td>
            <td class="hide-mobile"><span class="chg-pill ${pctClass(st.change30d)}">${pctText(st.change30d)}</span></td>
            <td class="hide-mobile"><span class="chg-pill ${pctClass(st.change1y)}">${pctText(st.change1y)}</span></td>
            <td class="hide-mobile">${compact(c.price * c.supply * 1e6)}</td>
          </tr>`;
  }).join("\n          ");
  const others = sectors.filter(o => o !== x).map(o => `<a href="/sector/${o.slug}/">${esc(o.name)}</a>`).join("\n        ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": sectorUrl(x), url: sectorUrl(x), name: title, description, dateModified: updated, isPartOf: { "@id": `${SITE}/#website` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: x.name, item: sectorUrl(x) }
      ] }
    ]
  };
  return `<!DOCTYPE html>
<!-- Generated by scripts/build-coin-pages.mjs from content/sectors.json — edit those, not this file. -->
<html lang="en" data-theme="kali">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${sectorUrl(x)}" />
  <meta name="theme-color" content="#0a0e17" />
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CryptoPriceTicker.com" />
  <meta property="og:title" content="${esc(x.h1)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${sectorUrl(x)}" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/theme-init.js"></script>
  <link rel="stylesheet" href="/assets/app.css" />
  <script src="/assets/coins.js" defer></script>
  <script src="/assets/app.js" defer></script>
</head>
<body data-page="sector">
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(false)}

  <main class="container" id="main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <span aria-current="page">${esc(x.name)}</span></nav>
    <section class="hero" aria-labelledby="sector-h">
      <h1 id="sector-h" class="hero-title">${esc(x.h1)}</h1>
      <p class="hero-sub">${esc(x.intro)}</p>
      <p class="hero-actions"><a class="action-btn btn-accent" href="/?sector=${x.keys[0]}">⚡ Watch these ${members.length} coins live</a></p>
    </section>

    <section class="page-section" aria-labelledby="perf-h">
      <h2 id="perf-h">${esc(x.name)} performance</h2>
      <p class="prose">${summary}</p>
      <div class="table-wrap" style="margin-top:12px">
        <table class="history-table sector-table">
          <caption class="sr-only">${esc(x.name)} coins by market cap with daily-close performance</caption>
          <thead><tr><th scope="col" class="col-center">#</th><th scope="col" class="col-left">Coin</th><th scope="col">Price</th><th scope="col">7d</th><th scope="col" class="hide-mobile">30d</th><th scope="col" class="hide-mobile">1 year</th><th scope="col" class="hide-mobile">Market cap</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>
      </div>
      <p class="disclaimer" style="margin-top:8px">Daily closes (UTC) as of ${asOf ? longDate(asOf) : longDate(updated)}; updated weekly. Tap any coin for its live price.</p>
    </section>

    <nav class="page-section" aria-labelledby="more-h">
      <h2 id="more-h">Other sectors</h2>
      <div class="coin-index">
        ${others}
      </div>
    </nav>
  </main>

  <footer class="container site-footer" style="padding-top:0">
    <span><a href="/">CryptoPriceTicker.com</a> — live multi-exchange crypto prices. No login, no ads. <a href="/about/">About &amp; methodology</a></span>
    <p class="disclaimer">Not financial advice. Prices come from public exchange data and may be delayed or inaccurate.</p>
  </footer>
</body>
</html>
`;
}
const sectorDir = ROOT + "sector/";
mkdirSync(sectorDir, { recursive: true });
const keepSectors = new Set(sectors.map(x => x.slug));
for (const d of readdirSync(sectorDir)) if (!keepSectors.has(d)) rmSync(sectorDir + d, { recursive: true, force: true });
for (const x of sectors) {
  mkdirSync(sectorDir + x.slug, { recursive: true });
  writeFileSync(`${sectorDir}${x.slug}/index.html`, sectorPage(x));
}

// 1c. Converter page
function convertPage() {
  const pageUrl = `${SITE}/convert/`;
  const title = "Crypto Converter: Live Rates for Coins & 20 Currencies";
  const description = `Convert ${coins.length} cryptocurrencies to each other or to USD, EUR, GBP, INR and 16 more currencies at live exchange prices. Free, no sign-up.`;
  const btc = coins.find(c => c.sym === "BTC");
  const pairs = [["BTC", "USD"], ["ETH", "USD"], ["SOL", "USD"], ["XRP", "USD"], ["BTC", "EUR"], ["BTC", "GBP"], ["BTC", "INR"], ["ETH", "BTC"],
    ["SOL", "ETH"], ["USDT", "EUR"], ["DOGE", "USD"], ["USD", "BTC", 100], ["EUR", "ETH", 100]]
    .filter(([a, b]) => [a, b].every(x => FIATS.some(f => f[0] === x) || coins.some(c => c.sym === x)));
  const pairButtons = pairs.map(([a, b, amt]) => `<button type="button" class="chip" data-action="cv-pair" data-from="${a}" data-to="${b}" data-amount="${amt || 1}">${amt ? amt + " " : ""}${a} → ${b}</button>`).join("\n        ");
  const top = byCap.slice(0, 24).map(c => `<a href="/coin/${slug(c.sym)}/#convert">${esc(c.sym)} to USD</a>`).join("\n        ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebApplication", "@id": `${pageUrl}#app`, name: "CryptoPriceTicker crypto converter", url: pageUrl, description,
        applicationCategory: "FinanceApplication", operatingSystem: "Any", isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, isPartOf: { "@id": `${SITE}/#website` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Crypto converter", item: pageUrl }
      ] }
    ]
  };
  return `<!DOCTYPE html>
<!-- Generated by scripts/build-coin-pages.mjs — edit the generator, not this file. -->
<html lang="en" data-theme="kali">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${pageUrl}" />
  <meta name="theme-color" content="#0a0e17" />
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preload" href="/assets/app.css" as="style" />
  <link rel="preconnect" href="https://data-api.binance.vision" crossorigin />
  <link rel="preconnect" href="https://api.coinbase.com" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CryptoPriceTicker.com" />
  <meta property="og:title" content="Live crypto converter" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/theme-init.js"></script>
  <link rel="stylesheet" href="/assets/app.css" />
  <script src="/assets/coins.js" defer></script>
  <script src="/assets/app.js" defer></script>
</head>
<body data-page="convert">
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(true, false)}

  <main class="container" id="main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <span aria-current="page">Crypto converter</span></nav>
    <section class="hero" aria-labelledby="conv-h">
      <h1 id="conv-h" class="hero-title">Crypto converter</h1>
      <p class="hero-sub">Convert between ${coins.length} coins and 20 currencies at the live price from Coinbase, Binance and Kraken. Type in either box.</p>
    </section>

    <section class="page-section conv-page" aria-label="Converter">
      ${converterHtml(byCap, "BTC", "USD", num(btc.price))}
      <p class="pop-title" style="margin-top:14px">Popular conversions</p>
      <div class="chips conv-pairs">
        ${pairButtons}
      </div>
    </section>

    <section class="page-section prose" aria-labelledby="how-h">
      <h2 id="how-h">How the conversion works</h2>
      <p>Each coin's price is streamed live from the exchanges' public USD and USDT markets, and the result updates as new trades arrive. Converting one coin to another goes through its US dollar price, so 1 ETH in BTC is the ETH price divided by the BTC price.</p>
      <p>Currencies other than the US dollar use Coinbase's public reference exchange rates, refreshed every 15 minutes. Exchanges, banks and payment apps add their own fees and spreads, so the amount you actually receive will usually be a little lower.</p>
      <p>The converter remembers nothing: the address bar keeps the pair you picked, so you can bookmark or share it.</p>
      <p class="disclaimer">Not financial advice. Data comes from third-party exchanges and may be delayed or inaccurate.</p>
    </section>

    <nav class="page-section" aria-labelledby="pop-h">
      <h2 id="pop-h">Coin to US dollar converters</h2>
      <div class="coin-index">
        ${top}
      </div>
    </nav>
  </main>

  <footer class="container site-footer" style="padding-top:0">
    <span><a href="/">CryptoPriceTicker.com</a> — live multi-exchange crypto prices. No login, no ads. <a href="/about/">About &amp; methodology</a></span>
  </footer>
</body>
</html>
`;
}
mkdirSync(ROOT + "convert", { recursive: true });
writeFileSync(ROOT + "convert/index.html", convertPage());

// 1d. Heatmap page
function heatmapPage() {
  const pageUrl = `${SITE}/heatmap/`;
  const title = "Crypto Heatmap: Live Market Map of the Top 100 Coins";
  const description = "See the whole crypto market at a glance: every coin sized by market cap and coloured by its live 24-hour price change, grouped by sector if you like.";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": pageUrl, url: pageUrl, name: title, description, isPartOf: { "@id": `${SITE}/#website` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Crypto heatmap", item: pageUrl }
      ] }
    ]
  };
  const sectorLinks = sectors.map(x => `<a href="/sector/${x.slug}/">${esc(x.name)}</a>`).join("\n        ");
  return `<!DOCTYPE html>
<!-- Generated by scripts/build-coin-pages.mjs — edit the generator, not this file. -->
<html lang="en" data-theme="kali">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${pageUrl}" />
  <meta name="theme-color" content="#0a0e17" />
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preload" href="/assets/app.css" as="style" />
  <link rel="preconnect" href="https://data-api.binance.vision" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CryptoPriceTicker.com" />
  <meta property="og:title" content="Live crypto heatmap" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${SITE}${existsSync(ROOT + "og/heatmap.jpg") ? "/og/heatmap.jpg" : "/og-image.png"}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/theme-init.js"></script>
  <link rel="stylesheet" href="/assets/app.css" />
  <script src="/assets/coins.js" defer></script>
  <script src="/assets/app.js" defer></script>
</head>
<body data-page="heatmap">
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(true, false)}

  <main class="container" id="main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <span aria-current="page">Crypto heatmap</span></nav>
    <section class="hm-head" aria-labelledby="hm-h">
      <div>
        <h1 id="hm-h" class="hero-title">Crypto heatmap</h1>
        <p class="hero-sub">Each box is a coin: bigger means a larger market cap, green is up and red is down over 24 hours. Live from Coinbase, Binance and Kraken.</p>
      </div>
      <div class="hm-controls">
        <div class="seg" role="group" aria-label="Layout">
          <button type="button" class="seg-btn" data-action="hm-group" data-group="all" aria-pressed="true">All coins</button>
          <button type="button" class="seg-btn" data-action="hm-group" data-group="sector" aria-pressed="false">By sector</button>
        </div>
        <div class="seg" role="group" aria-label="Box size">
          <button type="button" class="seg-btn" data-action="hm-size" data-size="balanced" aria-pressed="true">Balanced</button>
          <button type="button" class="seg-btn" data-action="hm-size" data-size="cap" aria-pressed="false">True market cap</button>
        </div>
        <button type="button" class="seg-btn hm-toggle" data-action="hm-stables" aria-pressed="false">Include stablecoins</button>
      </div>
    </section>
    <p class="hm-summary" id="hmSummary" aria-live="polite">Connecting to the exchanges…</p>
    <div class="hm-box" id="heatmap" role="group" aria-label="Crypto heatmap: coins sized by market cap and coloured by 24-hour change"></div>
    <div class="hm-legend" aria-hidden="true"><span>−8%</span><span class="hm-scale"></span><span>+8%</span></div>

    <section class="page-section prose" aria-labelledby="read-h">
      <h2 id="read-h">How to read the heatmap</h2>
      <p>Bigger boxes mean a larger market cap (live price × circulating supply). By default the map is “balanced”: box area follows the square root of market cap, so smaller coins stay readable while the order is unchanged. Choose “True market cap” to make every area exactly proportional, which shows how much of the market Bitcoin really is. The colour shows the price change over the last 24 hours, from deep red at −8% or worse through grey to deep green at +8% or better. Stablecoins are hidden by default because they barely move; switch them on to see their share of the market.</p>
      <p>“By sector” groups coins by their main category, which makes it easy to spot when a whole sector, such as AI tokens or memecoins, moves together. Tap any box for that coin's live price page.</p>
      <p class="disclaimer">Not financial advice. Prices come from public exchange data and may be delayed or inaccurate.</p>
    </section>

    <nav class="page-section" aria-labelledby="sec-h">
      <h2 id="sec-h">Sector performance tables</h2>
      <div class="coin-index">
        ${sectorLinks}
      </div>
    </nav>
  </main>

  <footer class="container site-footer" style="padding-top:0">
    <span><a href="/">CryptoPriceTicker.com</a> — live multi-exchange crypto prices. No login, no ads. <a href="/about/">About &amp; methodology</a></span>
  </footer>
</body>
</html>
`;
}
mkdirSync(ROOT + "heatmap", { recursive: true });
writeFileSync(ROOT + "heatmap/index.html", heatmapPage());

// 2. Sitemap
const urls = [`${SITE}/`, `${SITE}/heatmap/`, `${SITE}/convert/`, `${SITE}/about/`, `${SITE}/widgets/`, ...sectors.map(sectorUrl), ...byCap.map(c => url(c.sym))];
writeFileSync(ROOT + "sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${updated}</lastmod></url>`).join("\n")}
</urlset>
`);

// 3. Redirects for renamed tickers (Cloudflare Pages _redirects syntax)
const redirects = coins.filter(c => c.formerly).flatMap(c => [
  `/coin/${slug(c.formerly)} /coin/${slug(c.sym)}/ 301`,
  `/coin/${slug(c.formerly)}/ /coin/${slug(c.sym)}/ 301`
]);
writeFileSync(ROOT + "_redirects", `# Generated by scripts/build-coin-pages.mjs — renamed tickers keep their old links working.
# Docs: https://developers.cloudflare.com/pages/configuration/redirects/
/coin / 301
/coin/ / 301
${redirects.join("\n")}
`);

// 4. Coin link list on the home page
const indexPath = ROOT + "index.html";
const html = readFileSync(indexPath, "utf8");
const start = html.indexOf("<!-- coin-index:start");
const end = html.indexOf("<!-- coin-index:end -->");
if (start < 0 || end < 0) throw new Error("coin-index markers not found in index.html");
const startLineEnd = html.indexOf("\n", start) + 1;
const links = byCap.map(c => `          <a href="/coin/${slug(c.sym)}/">${esc(c.name)} (${esc(c.sym)})</a>`).join("\n");
writeFileSync(indexPath, html.slice(0, startLineEnd) + links + "\n" + html.slice(end));

console.log(`Built ${coins.length} coin pages, ${sectors.length} sector pages, the converter and heatmap, sitemap.xml (${urls.length} URLs), _redirects (${redirects.length} rules) and the home-page coin list.`);
if (!existsSync(ROOT + "og-image.png")) console.warn("⚠ og-image.png is missing");
