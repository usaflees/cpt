// Coin comparison pages, called from scripts/build-coin-pages.mjs:
//   compare/index.html           hub listing every pair
//   compare/<a>-vs-<b>/index.html one page per pair in content/compare-pairs.json
// Every figure comes from assets/coins.js and content/coin-stats.json (weekly data refresh),
// so the pages are rebuilt with the rest of the site and contain no hand-written prose.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { ROOT } from "./registry.mjs";

const MAX_PAIRS = 20; // docs/STRATEGY.md B6: curated, high-demand pairs only

// Validated pair list: [{ a, b, slug }] with coin objects. Unknown or duplicate pairs stop the build.
export function loadComparePairs(coins) {
  const path = ROOT + "content/compare-pairs.json";
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")).pairs || [];
  if (raw.length > MAX_PAIRS) throw new Error(`content/compare-pairs.json: ${raw.length} pairs (max ${MAX_PAIRS})`);
  const bySym = new Map(coins.map(c => [c.sym, c]));
  const seen = new Set();
  return raw.map(([x, y]) => {
    const a = bySym.get(x), b = bySym.get(y);
    if (!a || !b || x === y) throw new Error(`content/compare-pairs.json: unknown or invalid pair ${x}/${y}`);
    const key = [x, y].sort().join("/");
    if (seen.has(key)) throw new Error(`content/compare-pairs.json: duplicate pair ${x}/${y}`);
    seen.add(key);
    return { a, b, slug: `${x.toLowerCase()}-vs-${y.toLowerCase()}` };
  });
}

// h: helpers and data from build-coin-pages.mjs (one source for formatting and the page chrome).
export function comparePages(pairs, h) {
  const { SITE, coins, stats, rankOf, updated, esc, usd, compact, pctText, pctClass, longDate, shortName, avatarHtml, topbar, corrWord, firstFit, sectorNames } = h;
  const pageUrl = p => `${SITE}/compare/${p.slug}/`;
  const hubUrl = `${SITE}/compare/`;
  const mcap = c => c.price * c.supply * 1e6;
  const isStable = c => c.sectors.includes("Stable");
  const monthName = ym => new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const sig = v => v.toLocaleString("en-US", { maximumSignificantDigits: v >= 1000 ? 7 : 4 });
  const pts = v => Math.abs(v).toFixed(1);
  const times = v => (v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US"));
  const rose = v => (v >= 0 ? "rose" : "fell");
  // "1 BTC = 34.4 ETH": always state the dearer coin in units of the cheaper one.
  const ratio = (a, pa, b, pb) => (pa >= pb ? `1 ${esc(a.sym)} = ${sig(pa / pb)} ${esc(b.sym)}` : `1 ${esc(b.sym)} = ${sig(pb / pa)} ${esc(a.sym)}`);
  const asOfOf = (sa, sb) => [sa?.asOf, sb?.asOf].filter(Boolean).sort()[0] || updated;

  function summary(a, b, sa, sb) {
    const na = esc(shortName(a)), nb = esc(shortName(b));
    const out = [];
    const ma = mcap(a), mb = mcap(b);
    const big = ma >= mb ? [na, ma, nb, mb] : [nb, mb, na, ma];
    out.push(`${big[0]}'s market cap of about ${compact(big[1])} is ${times(big[1] / big[3])} times ${big[2]}'s (${compact(big[3])}); they rank #${rankOf.get(a.sym)} and #${rankOf.get(b.sym)} of the ${coins.length} coins tracked here.`);
    if (!sa || !sb) return out.join(" ");
    if (isStable(a) && isStable(b)) {
      const band = s => (((s.high52w - s.low52w) / s.low52w) * 100).toFixed(2);
      out.push(`Both are US-dollar stablecoins. Over the past year ${na} closed between ${usd(sa.low52w)} and ${usd(sa.high52w)} per day (a ${band(sa)}% range) and ${nb} between ${usd(sb.low52w)} and ${usd(sb.high52w)} (${band(sb)}%).`);
      out.push(`Their largest falls between daily closes within the year were ${pts(sa.maxDrawdown1y)}% and ${pts(sb.maxDrawdown1y)}%.`);
      return out.join(" ");
    }
    if (sa.change1y != null && sb.change1y != null) {
      const gap = sa.change1y - sb.change1y;
      out.push(`Over the past year ${na} ${rose(sa.change1y)} ${pts(sa.change1y)}% and ${nb} ${rose(sb.change1y)} ${pts(sb.change1y)}%, a gap of ${pts(gap)} percentage points in ${gap >= 0 ? na : nb}'s favour.`);
    }
    const [hi, lo] = sa.volatility30d >= sb.volatility30d ? [[na, sa], [nb, sb]] : [[nb, sb], [na, sa]];
    out.push(`${hi[0]} was the more volatile of the two over the last 30 days (${hi[1].volatility30d}% annualized against ${lo[1].volatility30d}%).`);
    if (typeof sa.maxDrawdown1y === "number" && typeof sb.maxDrawdown1y === "number")
      out.push(`Within the year, ${na}'s largest fall between daily closes was ${pts(sa.maxDrawdown1y)}% and ${nb}'s was ${pts(sb.maxDrawdown1y)}%.`);
    const fromHigh = s => ((s.close - s.high52w) / s.high52w) * 100;
    out.push(`On ${longDate(asOfOf(sa, sb))} ${na} was ${pts(fromHigh(sa))}% below its 52-week high and ${nb} ${pts(fromHigh(sb))}% below its own.`);
    const months = commonMonths(sa, sb).filter(m => m.ca != null && m.cb != null && m.month < asOfOf(sa, sb).slice(0, 7));
    if (months.length >= 3) {
      const wins = months.filter(m => m.ca > m.cb).length;
      out.push(`In ${wins} of the last ${months.length} complete months, ${na} did better than ${nb}.`);
    }
    const corr = (c, s) => (c.sym === "BTC" ? null : typeof s.corrBtc90d === "number" ? s.corrBtc90d : null);
    if (a.sym === "BTC" || b.sym === "BTC") {
      const [o, so] = a.sym === "BTC" ? [b, sb] : [a, sa];
      const r = corr(o, so);
      if (r !== null) out.push(`Over the last 90 days the daily moves of ${esc(shortName(o))} and Bitcoin had a correlation of ${r.toFixed(2)} (${corrWord(r)}; 1 would mean moving in lockstep).`);
    } else {
      const ra = corr(a, sa), rb = corr(b, sb);
      if (ra !== null && rb !== null) out.push(`Measured against Bitcoin's daily moves over 90 days, ${na} had a correlation of ${ra.toFixed(2)} and ${nb} ${rb.toFixed(2)}.`);
    }
    return out.join(" ");
  }

  function commonMonths(sa, sb) {
    const mb = new Map((sb?.monthly || []).map(m => [m.month, m]));
    return (sa?.monthly || []).filter(m => mb.has(m.month)).map(m => ({ month: m.month, a: m.close, b: mb.get(m.month).close, ca: m.change, cb: mb.get(m.month).change }));
  }

  const chrome = ({ title, description, canonical, jsonLd, body }) => `<!DOCTYPE html>
<!-- Generated by scripts/build-coin-pages.mjs (scripts/lib/compare-pages.mjs) from content/compare-pairs.json — edit those, not this file. -->
<html lang="en" data-theme="neon">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="preload" href="/assets/app.css" as="style" />
  <meta name="theme-color" content="#0c0822" media="(prefers-color-scheme: dark)" />
  <meta name="theme-color" content="#f7f5ff" media="(prefers-color-scheme: light)" />
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CryptoPriceTicker.com" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/theme-init.js"></script>
  <link rel="stylesheet" href="/assets/app.css" />
  <script src="/assets/coins.js" defer></script>
  <script src="/assets/app.js" defer></script>
  <script src="/assets/consent.js" defer></script>
</head>
<body data-page="compare">
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(false)}

  <main class="container" id="main">
${body}
  </main>

  <footer class="container site-footer" style="padding-top:0">
    <span><img class="footer-mark" src="/brand/mark.svg" width="18" height="18" alt="" /><a href="/">CryptoPriceTicker.com</a> — live multi-exchange crypto prices. No login, no ads. <a href="https://github.com/usaflees/cpt">Public source code</a>, hosted on Cloudflare Pages. <a href="/heatmap/">Heatmap</a> · <a href="/market/">Weekly report</a> · <a href="/compare/">Compare coins</a> · <a href="/convert/">Converter</a> · <a href="/widgets/">Free widgets</a> · <a href="/about/">About &amp; methodology</a> · <a href="/brand/">Brand kit</a> · <a href="/accessibility/">Accessibility</a> · <a href="/trust/">Trust &amp; safety</a> · <button type="button" class="link-btn" data-consent-open>Cookie settings</button></span>
    <p class="disclaimer">Not financial advice. Prices come from public exchange data and may be delayed or inaccurate.</p>
  </footer>
</body>
</html>
`;

  const pairLinks = list => list.map(p => `<a href="/compare/${p.slug}/">${esc(p.a.sym)} vs ${esc(p.b.sym)} <span>${esc(shortName(p.a))} vs ${esc(shortName(p.b))}</span></a>`).join("\n          ");

  function pairPage(p) {
    const { a, b } = p;
    const sa = stats[a.sym], sb = stats[b.sym];
    const na = shortName(a), nb = shortName(b);
    const A = esc(a.sym), B = esc(b.sym);
    const title = firstFit([`${na} vs ${nb}: ${a.sym} vs ${b.sym} Price Comparison`, `${na} vs ${nb} (${a.sym} vs ${b.sym}) Compared`, `${a.sym} vs ${b.sym}: Price & Performance Compared`], 60);
    const description = firstFit([
      `${na} (${a.sym}) vs ${nb} (${b.sym}) side by side: market cap, 1-year performance, volatility, 52-week range and monthly closes from daily exchange data.`,
      `${na} vs ${nb} side by side: market cap, 1-year performance, volatility, 52-week range and monthly closes.`,
      `${a.sym} vs ${b.sym} side by side: market cap, performance, volatility and monthly closes.`
    ], 160);
    const asOf = asOfOf(sa, sb);
    const when = `<time datetime="${asOf}">${longDate(asOf)}</time>`;
    const pa = sa ? sa.close : a.price, pb = sb ? sb.close : b.price;
    const source = sa && sb ? (sa.source === sb.source ? sa.source : `${sa.source} and ${sb.source}`) : "exchange";
    const row = (label, fa, fb) => `<tr><th scope="row" class="col-left">${label}</th><td>${fa}</td><td>${fb}</td></tr>`;
    const pill = v => `<span class="chg-pill ${pctClass(v)}">${pctText(v)}</span>`;
    const num = (s, k, f) => (s && typeof s[k] === "number" ? f(s[k]) : "—");
    const supplyText = c => (c.supply >= 1000 ? compact(c.supply * 1e6, "") : (c.supply * 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })) + " " + esc(c.sym);
    const corrCell = (c, s) => (c.sym === "BTC" ? "1.00 (itself)" : num(s, "corrBtc90d", v => v.toFixed(2)));
    const fromHigh = s => (s ? `${pts(((s.close - s.high52w) / s.high52w) * 100)}%` : "—");
    const sectorText = c => c.sectors.map(k => esc(sectorNames[k] || k)).join(", ");
    const rows = [
      row("Price (daily close)", usd(pa), usd(pb)),
      row("Market cap", compact(mcap(a)), compact(mcap(b))),
      row("Market-cap rank", `#${rankOf.get(a.sym)}`, `#${rankOf.get(b.sym)}`),
      row("Circulating supply", supplyText(a), supplyText(b)),
      row("7 days", pill(sa?.change7d), pill(sb?.change7d)),
      row("30 days", pill(sa?.change30d), pill(sb?.change30d)),
      row("90 days", pill(sa?.change90d), pill(sb?.change90d)),
      row("1 year", pill(sa?.change1y), pill(sb?.change1y)),
      row("52-week high", sa ? `${usd(sa.high52w)}<br><span class="muted">${longDate(sa.high52wDate)}</span>` : "—", sb ? `${usd(sb.high52w)}<br><span class="muted">${longDate(sb.high52wDate)}</span>` : "—"),
      row("52-week low", sa ? `${usd(sa.low52w)}<br><span class="muted">${longDate(sa.low52wDate)}</span>` : "—", sb ? `${usd(sb.low52w)}<br><span class="muted">${longDate(sb.low52wDate)}</span>` : "—"),
      row("Below 52-week high", fromHigh(sa), fromHigh(sb)),
      row("30-day volatility (annualized)", num(sa, "volatility30d", v => v + "%"), num(sb, "volatility30d", v => v + "%")),
      row("Largest fall within the year", num(sa, "maxDrawdown1y", v => pts(v) + "%"), num(sb, "maxDrawdown1y", v => pts(v) + "%")),
      row("Correlation with BTC (90 days)", corrCell(a, sa), corrCell(b, sb)),
      row("Sector", sectorText(a), sectorText(b))
    ].join("\n            ");
    const months = commonMonths(sa, sb).slice().reverse();
    const better = m => (m.ca == null || m.cb == null ? "—" : m.ca > m.cb ? A : m.cb > m.ca ? B : "Tie");
    const monthRows = months.map(m => `<tr><td class="col-left">${monthName(m.month)}</td><td>${usd(m.a)}</td><td>${usd(m.b)}</td><td>${ratio(a, m.a, b, m.b)}</td><td>${better(m)}</td></tr>`).join("\n          ");
    const others = pairs.filter(o => o !== p && (o.a === a || o.b === a || o.a === b || o.b === b));
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", "@id": pageUrl(p), url: pageUrl(p), name: title, description, dateModified: updated, isPartOf: { "@id": `${SITE}/#website` },
          about: [{ "@type": "Thing", name: a.name, alternateName: a.sym }, { "@type": "Thing", name: b.name, alternateName: b.sym }] },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Coin comparisons", item: hubUrl },
          { "@type": "ListItem", position: 3, name: `${a.sym} vs ${b.sym}`, item: pageUrl(p) }
        ] }
      ]
    };
    const body = `    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <a href="/compare/">Coin comparisons</a> › <span aria-current="page">${A} vs ${B}</span></nav>
    <section class="hero" aria-labelledby="cmp-h">
      <div class="coin-title">${avatarHtml(a, true)}${avatarHtml(b, true)}<h1 id="cmp-h" class="hero-title">${esc(na)} vs ${esc(nb)} (${A} vs ${B})</h1></div>
      <p class="hero-facts">As of ${when} (${esc(source)} daily close): ${esc(na)} closed at ${usd(pa)} and ${esc(nb)} at ${usd(pb)}, so ${ratio(a, pa, b, pb)}.</p>
      <p class="hero-actions"><a class="action-btn btn-accent" href="/coin/${a.sym.toLowerCase()}/">⚡ Live ${A} price</a> <a class="action-btn btn-accent" href="/coin/${b.sym.toLowerCase()}/">⚡ Live ${B} price</a> <a class="action-btn" href="/convert/?from=${a.sym.toLowerCase()}&amp;to=${b.sym.toLowerCase()}">🔁 Convert ${A} to ${B}</a></p>
    </section>

    <section class="page-section" aria-labelledby="sum-h">
      <h2 id="sum-h">${A} vs ${B}: what the numbers show</h2>
      <p class="prose">${summary(a, b, sa, sb)}</p>
    </section>

    <section class="page-section" aria-labelledby="tbl-h">
      <h2 id="tbl-h">${A} and ${B} side by side</h2>
      <div class="table-wrap">
        <table class="history-table compare-table">
          <caption class="sr-only">${esc(na)} and ${esc(nb)} compared: price, market cap, performance, range, volatility and correlation</caption>
          <thead><tr><th scope="col" class="col-left">Measure</th><th scope="col">${esc(na)} (${A})</th><th scope="col">${esc(nb)} (${B})</th></tr></thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <p class="disclaimer" style="margin-top:8px">Daily closes (UTC) from ${esc(source)}, as of ${longDate(asOf)}. Market cap uses the snapshot price × circulating supply. Updated weekly.</p>
    </section>
${months.length ? `
    <section class="page-section" aria-labelledby="mon-h">
      <h2 id="mon-h">${A} and ${B} monthly closing prices</h2>
      <div class="table-wrap">
        <table class="history-table">
          <caption class="sr-only">Month-end closing prices of ${esc(na)} and ${esc(nb)} in USD, the exchange rate between them, and which did better that month</caption>
          <thead><tr><th scope="col" class="col-left">Month</th><th scope="col">${A} close</th><th scope="col">${B} close</th><th scope="col">Rate</th><th scope="col">Better month</th></tr></thead>
          <tbody>
          ${monthRows}
          </tbody>
        </table>
      </div>
      <p class="disclaimer" style="margin-top:8px">“Better month” compares each coin's change over that calendar month; the latest month may still be running.</p>
    </section>
` : ""}
    <nav class="page-section" aria-labelledby="more-h">
      <h2 id="more-h">More comparisons</h2>
      <div class="related-list">
          ${pairLinks(others.length ? others : pairs.filter(o => o !== p).slice(0, 6))}
      </div>
      <p style="margin-top:10px"><a href="/compare/">All ${pairs.length} coin comparisons →</a></p>
    </nav>`;
    return chrome({ title, description, canonical: pageUrl(p), jsonLd, body });
  }

  function hubPage() {
    const title = "Crypto Comparisons: Coins Side by Side";
    const description = `${pairs.length} side-by-side crypto comparisons such as Bitcoin vs Ethereum: market cap, 1-year performance, volatility and monthly closes from daily data.`;
    const asOf = Object.values(stats).map(s => s.asOf).filter(Boolean).sort().pop() || updated;
    const rows = pairs.map(p => {
      const sa = stats[p.a.sym], sb = stats[p.b.sym];
      return `<tr>
            <td class="col-left"><a href="/compare/${p.slug}/">${esc(shortName(p.a))} vs ${esc(shortName(p.b))}</a></td>
            <td>${esc(p.a.sym)} <span class="chg-pill ${pctClass(sa?.change1y)}">${pctText(sa?.change1y)}</span></td>
            <td>${esc(p.b.sym)} <span class="chg-pill ${pctClass(sb?.change1y)}">${pctText(sb?.change1y)}</span></td>
            <td class="hide-mobile">${times(Math.max(mcap(p.a), mcap(p.b)) / Math.min(mcap(p.a), mcap(p.b)))}×</td>
          </tr>`;
    }).join("\n          ");
    // Widest and narrowest 1-year gap between the two coins of a pair (stablecoin pairs excluded).
    const gaps = pairs.filter(p => !isStable(p.a) && stats[p.a.sym]?.change1y != null && stats[p.b.sym]?.change1y != null)
      .map(p => { const ca = stats[p.a.sym].change1y, cb = stats[p.b.sym].change1y; return { p, gap: Math.abs(ca - cb), lead: ca >= cb ? p.a : p.b }; })
      .sort((x, y) => y.gap - x.gap);
    const gapText = g => `${esc(shortName(g.p.a))} vs ${esc(shortName(g.p.b))} (${pts(g.gap)} points, in ${esc(shortName(g.lead))}'s favour)`;
    const withBtc = gaps.filter(g => g.p.a.sym === "BTC" || g.p.b.sym === "BTC"), btcAhead = withBtc.filter(g => g.lead.sym === "BTC").length;
    const btcText = !withBtc.length ? "" : btcAhead === withBtc.length ? `Bitcoin did better than the other coin in all ${withBtc.length} pairs that include it.` : `Bitcoin did better in ${btcAhead} of the ${withBtc.length} pairs that include it.`;
    const hubSummary = gaps.length >= 2 ? `<p class="prose">Over the past year, the widest performance gap among these pairs was ${gapText(gaps[0])} and the narrowest was ${gapText(gaps[gaps.length - 1])}. ${btcText}</p>` : "";
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", "@id": hubUrl, url: hubUrl, name: title, description, dateModified: updated, isPartOf: { "@id": `${SITE}/#website` } },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Coin comparisons", item: hubUrl }
        ] }
      ]
    };
    const body = `    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <span aria-current="page">Coin comparisons</span></nav>
    <section class="hero" aria-labelledby="hub-h">
      <h1 id="hub-h" class="hero-title">Crypto comparisons: coins side by side</h1>
      <p class="hero-sub">Each page puts two coins next to each other using the same daily exchange closes as their price pages: market cap, performance over 7 days to 1 year, 52-week range, volatility, largest fall and month-by-month closes.</p>
    </section>

    <section class="page-section" aria-labelledby="list-h">
      <h2 id="list-h">All ${pairs.length} comparisons</h2>
      ${hubSummary}
      <div class="table-wrap">
        <table class="history-table">
          <caption class="sr-only">Coin comparisons with each coin's 1-year change and how many times larger the bigger market cap is</caption>
          <thead><tr><th scope="col" class="col-left">Comparison</th><th scope="col">1 year</th><th scope="col">1 year</th><th scope="col" class="hide-mobile">Market-cap multiple</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>
      </div>
      <p class="disclaimer" style="margin-top:8px">Daily closes (UTC) as of ${longDate(asOf)}; updated weekly.</p>
    </section>`;
    return chrome({ title, description, canonical: hubUrl, jsonLd, body });
  }

  return {
    // Writes compare/ and removes pages for pairs no longer listed. Returns the sitemap URLs.
    write() {
      const dir = ROOT + "compare/";
      if (!pairs.length) { rmSync(dir, { recursive: true, force: true }); return []; }
      mkdirSync(dir, { recursive: true });
      const keep = new Set(pairs.map(p => p.slug));
      for (const d of readdirSync(dir, { withFileTypes: true })) if (d.isDirectory() && !keep.has(d.name)) rmSync(dir + d.name, { recursive: true, force: true });
      writeFileSync(dir + "index.html", hubPage());
      for (const p of pairs) {
        mkdirSync(dir + p.slug, { recursive: true });
        writeFileSync(`${dir}${p.slug}/index.html`, pairPage(p));
      }
      return [hubUrl, ...pairs.map(pageUrl)];
    },
    // _redirects rules: the reversed order (/compare/eth-vs-btc/) goes to the canonical page.
    redirects: () => pairs.flatMap(p => {
      const rev = `/compare/${p.b.sym.toLowerCase()}-vs-${p.a.sym.toLowerCase()}`;
      return [`${rev} /compare/${p.slug}/ 301`, `${rev}/ /compare/${p.slug}/ 301`];
    })
  };
}

// "Compare BTC" links for a coin page's related section ("" when the coin is in no pair).
export function compareLinksHtml(pairs, sym, esc, shortName) {
  const mine = pairs.filter(p => p.a.sym === sym || p.b.sym === sym);
  if (!mine.length) return "";
  return `
      <h3>Compare ${esc(sym)}</h3>
      <div class="related-list">
          ${mine.map(p => { const o = p.a.sym === sym ? p.b : p.a; return `<a href="/compare/${p.slug}/">vs ${esc(o.sym)} <span>${esc(shortName(o))}</span></a>`; }).join("\n          ")}
      </div>`;
}
