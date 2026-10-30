#!/usr/bin/env node
// Generates the static, crawlable parts of the site from assets/coins.js:
//   coin/<sym>/index.html   one page per coin (live data is filled in by assets/app.js)
//   sitemap.xml             home + every coin page
//   _redirects              old tickers (e.g. /coin/ton/ → /coin/gram/)
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

const themeButtons = ["kali", "green", "slate", "oled", "light"]
  .map(t => `<button type="button" class="theme-btn" data-action="theme" data-theme-val="${t}">${t.toUpperCase()}</button>`).join("\n          ");
const currencyButtons = [["USD", "$"], ["BTC", "₿"], ["ETH", "Ξ"], ["SOL", "◎"]]
  .map(([c, s]) => `<button type="button" class="btn-toggle" data-action="curr" data-curr="${c}">${c} ${s}</button>`).join("");

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
          { "@type": "ListItem", position: 2, name: `${c.name} (${c.sym})`, item: url(c.sym) }
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
  <meta property="og:image" content="${SITE}/og-image.png" />
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
  <header class="site-bar">
    <a class="brand" href="/"><span class="brand-logo" aria-hidden="true">⚡</span> CryptoPriceTicker.com</a>
    <div class="site-bar-controls">
      <span class="feed-badge" id="badgeCB">CB: INIT</span>
      <span class="feed-badge" id="badgeBN">BN: INIT</span>
      <span class="feed-badge" id="badgeKR">KR: INIT</span>
      <div class="btn-group" role="group" aria-label="Price currency">${currencyButtons}</div>
      <div class="theme-switcher" role="group" aria-label="Colour theme">
          ${themeButtons}
      </div>
    </div>
  </header>

  <main class="container" id="main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <span aria-current="page">${name}</span></nav>

    <section class="coin-hero" aria-labelledby="coin-h">
      <div>
        <h1 id="coin-h"><span class="coin-avatar" aria-hidden="true">${esc(c.sym.slice(0, 4))}</span> ${esc(h1)}</h1>
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

// 2. Sitemap
const urls = [`${SITE}/`, `${SITE}/about/`, ...byCap.map(c => url(c.sym))];
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

console.log(`Built ${coins.length} coin pages, sitemap.xml (${urls.length} URLs), _redirects (${redirects.length} rules) and the home-page coin list.`);
if (!existsSync(ROOT + "og-image.png")) console.warn("⚠ og-image.png is missing");
