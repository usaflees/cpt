// Weekly market report: /market/ (one page, replaced each week) and /market/feed.xml (Atom, one entry per week).
// Called by scripts/build-coin-pages.mjs, so the weekly data refresh rebuilds it with the other pages.
//
// Everything is computed from content/coin-stats.json (daily closes): the week's best and worst performers,
// sector medians, new 52-week highs and lows. Sentences are fixed templates filled with those numbers, so
// there are no headlines and no AI text. Past weeks' summaries are kept in content/market-reports.json
// (newest first, at most KEEP weeks) so the feed and the page's archive can list them. Re-running the build
// on the same stats rewrites the same entry, so the output stays deterministic.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { ROOT } from "./registry.mjs";

const KEEP = 12;
const HISTORY = ROOT + "content/market-reports.json";
const median = xs => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
};
const round2 = v => Math.round(v * 100) / 100;
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

// One week's figures, as stored in the history file.
function computeWeek({ coins, stats, sectors, week }) {
  // Only coins whose stats end on the report date, so every figure covers the same seven days.
  const rows = coins.map(c => ({ c, st: stats[c.sym] })).filter(r => r.st && r.st.asOf === week && typeof r.st.change7d === "number");
  const risky = rows.filter(r => !r.c.sectors.includes("Stable"));
  const chg = sym => { const r = rows.find(x => x.c.sym === sym); return r ? r.st.change7d : null; };
  const byChange = [...risky].sort((a, b) => b.st.change7d - a.st.change7d || a.c.sym.localeCompare(b.c.sym));
  const pick = r => [r.c.sym, r.st.change7d];
  const weekStart = addDays(week, -6);
  const inWeek = d => d && d >= weekStart && d <= week;
  const sectorRows = sectors.filter(x => !x.keys.includes("Stable")).map(x => {
    const m = risky.filter(r => r.c.sectors.some(k => x.keys.includes(k)));
    return { slug: x.slug, name: x.name, n: m.length, med7d: m.length ? round2(median(m.map(r => r.st.change7d))) : null,
      med30d: m.length ? round2(median(m.map(r => r.st.change30d).filter(v => typeof v === "number"))) : null };
  }).filter(x => x.n >= 3).sort((a, b) => b.med7d - a.med7d || a.name.localeCompare(b.name));
  return {
    week,
    btc: chg("BTC"), eth: chg("ETH"),
    coins: risky.length,
    up: risky.filter(r => r.st.change7d > 0).length,
    down: risky.filter(r => r.st.change7d < 0).length,
    median: round2(median(risky.map(r => r.st.change7d))),
    gainers: byChange.slice(0, 10).map(pick),
    losers: byChange.slice(-10).reverse().map(pick),
    sectors: sectorRows,
    highs: risky.filter(r => inWeek(r.st.high52wDate) && r.st.historyDays >= 365).map(r => r.c.sym).sort(),
    lows: risky.filter(r => inWeek(r.st.low52wDate) && r.st.historyDays >= 365).map(r => r.c.sym).sort()
  };
}

// Read the history, put this week's figures first (replacing a same-date entry), write it back.
function updateHistory(current) {
  const hist = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, "utf8")) : { weeks: [] };
  const weeks = hist.weeks.filter(w => w.week !== current.week);
  if (weeks.length && weeks[0].week > current.week) return hist.weeks; // stats older than the last report: leave it
  const next = [current, ...weeks].slice(0, KEEP);
  writeFileSync(HISTORY, `{"weeks": [\n${next.map(x => JSON.stringify(x)).join(",\n")}\n]}\n`);
  return next;
}

// Where each coin stands over the year: cross-coin rankings of figures that the coin pages already state one coin
// at a time (distance from the 52-week high, largest fall, 30-day volatility, 90-day correlation with Bitcoin,
// stablecoin peg range). Current week only: not stored in the history file. Only coins whose stats end on the
// report date count, and the 52-week tables need a full year of data, so every row covers the same span.
const ROWS = 10;
function computeBoards({ coins, stats, week }) {
  const rows = coins.map(c => ({ c, st: stats[c.sym] })).filter(r => r.st && r.st.asOf === week);
  const risky = rows.filter(r => !r.c.sectors.includes("Stable"));
  const year = risky.filter(r => r.st.historyDays >= 365 && r.st.high52w > 0 && r.st.close > 0)
    .map(r => ({ ...r, below: (r.st.close / r.st.high52w - 1) * 100, regain: (r.st.high52w / r.st.close - 1) * 100 }));
  const by = (arr, f, dir = 1) => [...arr].sort((a, b) => dir * (f(a) - f(b)) || a.c.sym.localeCompare(b.c.sym));
  const num = k => risky.filter(r => typeof r.st[k] === "number");
  const corr = num("corrBtc90d").filter(r => r.c.sym !== "BTC");
  const vol = num("volatility30d");
  const fall = year.filter(r => typeof r.st.maxDrawdown1y === "number");
  const stable = rows.filter(r => r.c.sectors.includes("Stable") && r.st.historyDays >= 365 && r.st.low52w > 0)
    .map(r => ({ ...r, dev: Math.max(Math.abs(r.st.high52w - 1), Math.abs(1 - r.st.low52w)) * 100 }));
  return {
    yearCount: year.length,
    farthest: by(year, r => r.below).slice(0, ROWS),
    nearest: by(year, r => r.below, -1).slice(0, ROWS),
    fall: by(fall, r => r.st.maxDrawdown1y).slice(0, ROWS),
    independent: by(corr, r => r.st.corrBtc90d).slice(0, ROWS),
    corrCount: corr.length,
    medCorr: corr.length ? median(corr.map(r => r.st.corrBtc90d)) : null,
    calm: by(vol, r => r.st.volatility30d).slice(0, ROWS),
    wild: by(vol, r => r.st.volatility30d, -1).slice(0, ROWS),
    volCount: vol.length,
    stable: by(stable, r => r.dev, -1)
  };
}

export function buildMarketReport(h) {
  const { SITE, esc, longDate, list, pctText, pctClass, usd, avatarHtml, topbar, slug, coins, stats, sectors, week } = h;
  if (!week) return null;
  const weeks = updateHistory(computeWeek({ coins, stats, sectors, week }));
  const w = weeks[0];
  const bySym = new Map(coins.map(c => [c.sym, c]));
  const name = sym => (bySym.get(sym)?.name || sym).replace(/\s*\(formerly [^)]+\)/, "");
  const coinLink = sym => `<a href="/coin/${slug(sym)}/">${esc(name(sym))} (${esc(sym)})</a>`;
  const moved = v => `${v >= 0 ? "rose" : "fell"} ${Math.abs(v).toFixed(1)}%`;
  const pageUrl = `${SITE}/market/`, feedUrl = `${SITE}/market/feed.xml`;

  // The summary sentences, shared by the page and the feed. `link` decides whether coin names are links.
  function summary(x, link) {
    const nm = sym => link ? coinLink(sym) : esc(name(sym));
    const s = [];
    const majors = [x.btc !== null && `Bitcoin ${moved(x.btc)}`, x.eth !== null && `Ethereum ${moved(x.eth)}`].filter(Boolean);
    s.push(`In the seven days to ${longDate(x.week)}${majors.length ? `, ${list(majors)}` : ""}.`);
    s.push(`Of the ${x.coins} coins tracked here (stablecoins excluded), ${x.up} rose and ${x.down} fell; the median coin ${moved(x.median)}.`);
    if (x.gainers.length) s.push(`The best performer was ${nm(x.gainers[0][0])}, which ${moved(x.gainers[0][1])}, and the worst was ${nm(x.losers[0][0])}, which ${moved(x.losers[0][1])}.`);
    if (x.sectors.length > 1) {
      const best = x.sectors[0], worst = x.sectors[x.sectors.length - 1];
      s.push(`By sector median, ${esc(best.name)} did best (${pctText(best.med7d)}) and ${esc(worst.name)} did worst (${pctText(worst.med7d)}).`);
    }
    const count = n => (n === 0 ? "none" : n === 1 ? "one coin" : `${n} coins`);
    s.push(x.highs.length || x.lows.length
      ? `Among coins with a full year of data, ${count(x.highs.length)} closed at a new 52-week high and ${count(x.lows.length)} at a new 52-week low.`
      : "No coin with a full year of data closed at a new 52-week high or low.");
    return s.join(" ");
  }

  const moverRows = arr => arr.map(([sym, v], i) => {
    const c = bySym.get(sym), st = stats[sym];
    return `<tr><td class="col-center muted">${i + 1}</td><td class="col-left"><a class="coin-cell" href="/coin/${slug(sym)}/">${avatarHtml(c)}<span class="coin-main"><span class="coin-name">${esc(name(sym))}</span><span class="coin-sym-row"><span class="coin-sym">${esc(sym)}</span></span></span></a></td><td>${usd(st.close)}</td><td><span class="chg-pill ${pctClass(v)}">${pctText(v)}</span></td><td class="hide-mobile"><span class="chg-pill ${pctClass(st.change30d)}">${pctText(st.change30d)}</span></td></tr>`;
  }).join("\n          ");
  const moverTable = (id, caption, arr) => `<div class="table-wrap">
        <table class="history-table sector-table" id="${id}">
          <caption class="sr-only">${caption}</caption>
          <thead><tr><th scope="col" class="col-center">#</th><th scope="col" class="col-left">Coin</th><th scope="col">Close (USD)</th><th scope="col">7d</th><th scope="col" class="hide-mobile">30d</th></tr></thead>
          <tbody>
          ${moverRows(arr)}
          </tbody>
        </table>
      </div>`;
  const sectorTable = `<div class="table-wrap">
        <table class="history-table">
          <caption class="sr-only">Median 7-day and 30-day change of the coins in each sector</caption>
          <thead><tr><th scope="col" class="col-left">Sector</th><th scope="col">Coins</th><th scope="col">Median 7d</th><th scope="col" class="hide-mobile">Median 30d</th></tr></thead>
          <tbody>
          ${w.sectors.map(x => `<tr><td class="col-left"><a href="/sector/${x.slug}/">${esc(x.name)}</a></td><td>${x.n}</td><td><span class="chg-pill ${pctClass(x.med7d)}">${pctText(x.med7d)}</span></td><td class="hide-mobile"><span class="chg-pill ${pctClass(x.med30d)}">${pctText(x.med30d)}</span></td></tr>`).join("\n          ")}
          </tbody>
        </table>
      </div>`;
  // A tile per coin: a long sentence of 50 names was hard to scan.
  const extremes = (label, syms) => syms.length
    ? `<h3>${label} (${syms.length})</h3>
      <div class="related-list">
          ${syms.map(sym => `<a href="/coin/${slug(sym)}/">${esc(sym)} <span>${esc(name(sym))}</span></a>`).join("\n          ")}
      </div>`
    : `<p><strong>${label}:</strong> none this week.</p>`;
  const archive = weeks.slice(1).map(x => `<li id="week-${x.week}"><strong>Week to ${longDate(x.week)}.</strong> ${summary(x, false)}</li>`).join("\n        ");

  // Year rankings (see computeBoards). Each table has its own id so people can link straight to it.
  const b = computeBoards({ coins, stats, week: w.week });
  const pct1 = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
  // Plain links, no logos: seven tables of logo cells would push the page past its HTML budget.
  const coinCell = c => `<td class="col-left"><a href="/coin/${slug(c.sym)}/">${esc(name(c.sym))}</a> <span class="muted">${esc(c.sym)}</span></td>`;
  const board = (id, caption, heads, arr, cells) => `<div class="table-wrap">
        <table class="history-table sector-table" id="${id}-table">
          <caption class="sr-only">${caption}</caption>
          <thead><tr><th scope="col" class="col-center">#</th><th scope="col" class="col-left">Coin</th>${heads.map(([t, hide]) => `<th scope="col"${hide ? ' class="hide-mobile"' : ""}>${t}</th>`).join("")}</tr></thead>
          <tbody>
          ${arr.map((r, i) => `<tr><td class="col-center muted">${i + 1}</td>${coinCell(r.c)}${cells(r).map(([v, hide]) => `<td${hide ? ' class="hide-mobile"' : ""}>${v}</td>`).join("")}</tr>`).join("\n          ")}
          </tbody>
        </table>
      </div>`;
  const pill = v => `<span class="chg-pill ${pctClass(v)}">${pctText(v)}</span>`;
  const boardSection = (id, h, intro, table) => `
    <section class="page-section" aria-labelledby="${id}-h" id="${id}">
      <h3 id="${id}-h"><a href="#${id}">${h}</a></h3>
      <p class="prose">${intro}</p>
      ${table}
    </section>`;
  const asOf = longDate(w.week);
  const boards = !b.yearCount ? "" : `
    <section class="page-section prose" aria-labelledby="year-h" id="year">
      <h2 id="year-h">Where each coin stands over the year</h2>
      <p>Rankings from daily closes to ${asOf}. The 52-week tables cover the ${b.yearCount} coins with a full year of data; the correlation and volatility tables cover every coin with those figures; stablecoins are listed separately. Each coin's own page has the full figures and dates. A fall of 50% needs a 100% rise to get back to where it started, so the last column shows the rise each coin would need to regain its 52-week high.</p>
    </section>
${boardSection("farthest-from-high", "Furthest below their 52-week high", `The coins whose ${asOf} close was furthest below their highest close of the past 52 weeks.`,
  board("farthest-from-high", "Coins furthest below their 52-week high, with the date of the high and the rise needed to regain it", [["Below high"], ["52-week high", true], ["Rise to regain"]], b.farthest,
    r => [[pill(r.below)], [`${usd(r.st.high52w)}<br><span class="muted">${longDate(r.st.high52wDate)}</span>`, true], [pct1(r.regain)]]))}
${boardSection("nearest-high", "Closest to their 52-week high", "The coins whose latest close was nearest their highest close of the past 52 weeks (0% means the latest close was the high).",
  board("nearest-high", "Coins closest to their 52-week high", [["Below high"], ["52-week high", true], ["1 year"]], b.nearest,
    r => [[pill(r.below)], [`${usd(r.st.high52w)}<br><span class="muted">${longDate(r.st.high52wDate)}</span>`, true], [pill(r.st.change1y)]]))}
${b.fall.length ? boardSection("largest-fall", "Largest fall within the year", "The biggest drop from one daily close to a later, lower daily close within the past 52 weeks, and when it happened.",
  board("largest-fall", "Coins with the largest fall between daily closes within the year", [["Largest fall"], ["From", true], ["To", true]], b.fall,
    r => [[pill(r.st.maxDrawdown1y)], [longDate(r.st.maxDrawdownFrom), true], [longDate(r.st.maxDrawdownTo), true]])) : ""}
${b.independent.length ? boardSection("least-tied-to-bitcoin", "Least tied to Bitcoin", `Correlation of each coin's daily moves with Bitcoin's over the last 90 days: 1 means moving in lockstep, 0 means no relation. The median across the ${b.corrCount} coins is ${b.medCorr.toFixed(2)}; these are the lowest.`,
  board("least-tied-to-bitcoin", "Coins whose daily moves had the lowest 90-day correlation with Bitcoin", [["Correlation"], ["30d", true]], b.independent,
    r => [[r.st.corrBtc90d.toFixed(2)], [pill(r.st.change30d), true]])) : ""}
${b.calm.length ? boardSection("calmest", "Calmest and wildest over 30 days", `Annualized volatility of daily moves over the last 30 days across ${b.volCount} coins: lower means steadier prices. The calmest ten first, then the wildest ten.`,
  board("calmest", "The ten coins with the lowest 30-day volatility", [["Volatility"], ["30d", true]], b.calm, r => [[`${r.st.volatility30d}%`], [pill(r.st.change30d), true]]) + "\n      " +
  board("wildest", "The ten coins with the highest 30-day volatility", [["Volatility"], ["30d", true]], b.wild, r => [[`${r.st.volatility30d}%`], [pill(r.st.change30d), true]])) : ""}
${b.stable.length ? boardSection("stablecoin-pegs", "Stablecoin peg check", "How far each US-dollar stablecoin's daily close strayed from $1.00 over the past 52 weeks, widest first.",
  board("stablecoin-pegs", "Lowest and highest daily close of each stablecoin over 52 weeks and the widest move away from one dollar", [["Lowest close"], ["Highest close"], ["Widest from $1"]], b.stable,
    r => [[`${usd(r.st.low52w)}<br><span class="muted">${longDate(r.st.low52wDate)}</span>`], [`${usd(r.st.high52w)}<br><span class="muted">${longDate(r.st.high52wDate)}</span>`], [`${r.dev.toFixed(2)}%`]])) : ""}`;

  const title = "Weekly Crypto Market Report: Biggest Movers and Sectors";
  const description = "Weekly crypto market report: the best and worst coins, sector medians and new 52-week highs and lows, from exchange daily closes. Updated every Monday.";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": pageUrl, url: pageUrl, name: title, description, dateModified: w.week, isPartOf: { "@id": `${SITE}/#website` } },
      // Each edition is a dated report with a named compiler (the byline under the H1): Google's Nov 2026 attribution
      // guidance asks for clear sourcing and authorship, and the dates are the edition's, never the build's.
      { "@type": "Article", "@id": `${pageUrl}#report`, mainEntityOfPage: { "@id": pageUrl }, headline: `Weekly crypto market report: the seven days to ${longDate(w.week)}`,
        description, image: `${SITE}/og-image.jpg`, datePublished: w.week, dateModified: w.week,
        author: { "@type": "Organization", "@id": `${SITE}/#org`, name: "CryptoPriceTicker.com", url: `${SITE}/` },
        publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "CryptoPriceTicker.com", url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/brand/mark-1024.png` } } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Live crypto prices", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Weekly market report", item: pageUrl }
      ] }
    ]
  };
  const page = `<!DOCTYPE html>
<!-- Generated by scripts/build-coin-pages.mjs (scripts/lib/market-report.mjs) — edit the generator, not this file. -->
<html lang="en" data-theme="neon">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${pageUrl}" />
  <link rel="alternate" type="application/atom+xml" title="CryptoPriceTicker weekly market report" href="/market/feed.xml" />
  <link rel="preload" href="/assets/app.css" as="style" />
  <meta name="theme-color" content="#0c0822" media="(prefers-color-scheme: dark)" />
  <meta name="theme-color" content="#f7f5ff" media="(prefers-color-scheme: light)" />
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${w.week}" />
  <meta property="og:site_name" content="CryptoPriceTicker.com" />
  <meta property="og:title" content="Weekly crypto market report" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${SITE}/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/theme-init.js"></script>
  <link rel="stylesheet" href="/assets/app.css" />
  <script src="/assets/coins.js" defer></script>
  <script src="/assets/app.js" defer></script>
  <script src="/assets/consent.js" defer></script>
</head>
<body data-page="market">
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(false)}

  <main class="container" id="main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Live crypto prices</a> › <span aria-current="page">Weekly market report</span></nav>
    <section class="hero" aria-labelledby="market-h" id="week-${w.week}">
      <h1 id="market-h" class="hero-title">Weekly crypto market report</h1>
      <p class="disclaimer">Week to <time datetime="${w.week}">${longDate(w.week)}</time> · Compiled by CryptoPriceTicker.com from exchange daily closes · <a href="/about/">How the data is collected</a></p>
      <p class="hero-sub">${summary(w, true)}</p>
      <p class="hero-actions"><a class="action-btn btn-accent" href="/">⚡ Live prices</a> <a class="action-btn" href="#year">📊 Year rankings</a></p>
      <details class="feed-sub">
        <summary class="action-btn">🔔 Get this report every week</summary>
        <div style="margin-top:10px;max-width:560px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-secondary);display:grid;gap:10px">
          <p>A new report comes out every Monday. Paste this feed address into a feed reader app (Feedly, Inoreader, NetNewsWire or any other) and each week's report shows up there.</p>
          <p style="display:flex;gap:8px"><input type="text" class="sync-input" style="flex:1;min-width:0;margin:0" id="feedUrl" readonly aria-label="Feed address" value="${feedUrl}" /><button type="button" class="action-btn btn-accent" data-action="copy" data-target="feedUrl" data-msg="📋 Feed address copied.">📋 Copy</button></p>
          <p>Or add it in one tap: <a href="https://feedly.com/i/subscription/feed%2F${encodeURIComponent(feedUrl)}" rel="noopener">Feedly</a> · <a href="https://www.inoreader.com/?add_feed=${encodeURIComponent(feedUrl)}" rel="noopener">Inoreader</a></p>
        </div>
      </details>
    </section>

    <section class="page-section" aria-labelledby="up-h">
      <h2 id="up-h">Top 10 by 7-day change</h2>
      ${moverTable("risers", "The ten coins with the largest 7-day change, excluding stablecoins", w.gainers)}
    </section>

    <section class="page-section" aria-labelledby="down-h">
      <h2 id="down-h">Bottom 10 by 7-day change</h2>
      ${moverTable("fallers", "The ten coins with the biggest 7-day falls (or smallest gains), excluding stablecoins", w.losers)}
    </section>

    <section class="page-section" aria-labelledby="sectors-h">
      <h2 id="sectors-h">Sectors this week</h2>
      <p class="prose">The median 7-day and 30-day change of the coins in each sector (sectors with at least three coins), best first. A coin can belong to more than one sector.</p>
      ${sectorTable}
    </section>

    <section class="page-section prose" aria-labelledby="ext-h">
      <h2 id="ext-h">New 52-week highs and lows</h2>
      <p>Coins with a full year of data whose daily close between ${longDate(addDays(w.week, -6))} and ${longDate(w.week)} was their highest or lowest of the last 52 weeks.</p>
      ${extremes("New highs", w.highs)}
      ${extremes("New lows", w.lows)}
    </section>
${boards}
${archive ? `
    <section class="page-section prose" aria-labelledby="past-h">
      <h2 id="past-h">Earlier weeks</h2>
      <ul>
        ${archive}
      </ul>
    </section>
` : ""}
    <section class="page-section prose" aria-labelledby="how-h">
      <h2 id="how-h">How this report is made</h2>
      <p>Every Monday the site's data refresh downloads a year of daily closing prices (UTC) for each coin from Binance, Kraken or Coinbase and rebuilds this page from them. Changes compare the latest daily close with the close seven days earlier. Stablecoins are left out of the counts, the medians and the tables because they barely move. The report contains only these measured figures: no headlines, forecasts or opinions. Sources and methods are on the <a href="/about/">About page</a>; the <a href="/heatmap/">heatmap</a> shows the market live.</p>
      <p>Quoting a figure from this page? Please link to it and give the date; each table above has its own link (click its heading).</p>
      <p style="display:flex;gap:8px;max-width:640px"><input type="text" class="sync-input" style="flex:1;min-width:0;margin:0" id="citeText" readonly aria-label="Citation for this report" value="${esc(`CryptoPriceTicker.com, "Weekly crypto market report", daily closes to ${longDate(w.week)}, ${pageUrl}`)}" /><button type="button" class="action-btn" data-action="copy" data-target="citeText" data-msg="📋 Citation copied.">📋 Copy citation</button></p>
      <p class="disclaimer">Not financial advice. Prices come from public exchange data and may be delayed or inaccurate.</p>
    </section>
  </main>

  <footer class="container site-footer" style="padding-top:0">
    <span><img class="footer-mark" src="/brand/mark.svg" width="18" height="18" alt="" /><a href="/">CryptoPriceTicker.com</a> — live multi-exchange crypto prices. No login, no ads. <a href="https://github.com/usaflees/cpt">Public source code</a>, hosted on Cloudflare Pages. <a href="/heatmap/">Heatmap</a> · <a href="/market/">Weekly report</a> · <a href="/compare/">Compare coins</a> · <a href="/convert/">Converter</a> · <a href="/widgets/">Free widgets</a> · <a href="/about/">About &amp; methodology</a> · <a href="/brand/">Brand kit</a> · <a href="/accessibility/">Accessibility</a> · <a href="/trust/">Trust &amp; safety</a> · <button type="button" class="link-btn" data-consent-open>Cookie settings</button></span>
  </footer>
</body>
</html>
`;

  const xml = s => esc(s).replace(/'/g, "&#39;");
  const stamp = x => `${x.week}T23:59:59Z`;
  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>CryptoPriceTicker weekly market report</title>
  <subtitle>The week's best and worst performing coins, sector medians and new 52-week highs and lows, computed from exchange daily closes.</subtitle>
  <id>${feedUrl}</id>
  <link rel="self" type="application/atom+xml" href="${feedUrl}" />
  <link rel="alternate" type="text/html" href="${pageUrl}" />
  <updated>${stamp(w)}</updated>
  <author><name>CryptoPriceTicker.com</name><uri>${SITE}/</uri></author>
  <icon>${SITE}/favicon.svg</icon>
${weeks.map(x => `  <entry>
    <title>Crypto market report: week to ${xml(longDate(x.week))}</title>
    <id>tag:cryptopriceticker.com,${x.week.slice(0, 4)}:market/${x.week}</id>
    <link rel="alternate" type="text/html" href="${pageUrl}#week-${x.week}" />
    <published>${stamp(x)}</published>
    <updated>${stamp(x)}</updated>
    <summary type="text">${xml(summary(x, false).replace(/&amp;/g, "&"))}</summary>
  </entry>`).join("\n")}
</feed>
`;
  mkdirSync(ROOT + "market", { recursive: true });
  writeFileSync(ROOT + "market/index.html", page);
  writeFileSync(ROOT + "market/feed.xml", feed);
  return w;
}
