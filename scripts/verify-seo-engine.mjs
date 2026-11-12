#!/usr/bin/env node
// Checks the output of scripts/build-seo-engine.mjs in dist/ (run by `npm run verify`, after `npm run build`).
// Prints one line per check and exits 1 on any FAIL.
//
//   a) every engine page carries its data in static HTML: 6 derived metrics, scenario/parity tables, inline SVG
//   b) regime-branched prose: pages in different regimes differ by more than 40% (3-word shingles, with asset
//      names and numbers masked so only the wording is compared), and no advice wording anywhere
//   c) JSON-LD: Dataset + ExchangeRateSpecification + BreadcrumbList + WebPage, matching the visible text
//   d) head tags, links, sitemap, open data files, headers, widget size
import { readFileSync, existsSync, statSync } from "node:fs";
import { ROOT } from "./lib/registry.mjs";

if (process.argv.length > 2) { console.error("usage: node scripts/verify-seo-engine.mjs"); process.exit(1); }
const DIST = ROOT + "dist/", SITE = "https://cryptopriceticker.com";
if (!existsSync(DIST + "api/v1/quant-snapshot.json")) { console.error("dist/ not built: run npm run build first"); process.exit(1); }
const read = f => readFileSync(DIST + f, "utf8");
let failed = 0;
const check = (name, problems, note = "") => {
  if (problems.length) failed++;
  console.log(`${problems.length ? "FAIL" : "ok  "}  ${name}${note ? ` (${note})` : ""}`);
  problems.slice(0, 8).forEach(p => console.log("        " + p));
  if (problems.length > 8) console.log(`        … and ${problems.length - 8} more`);
};

const api = JSON.parse(read("api/v1/quant-snapshot.json"));
const sitemap = read("sitemap.xml");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(m => ({ path: m[1].replace(SITE, ""), lastmod: m[2] }));
const coinPages = api.assets.map(a => ({ kind: "coin", path: new URL(a.url).pathname, names: [[a.name, a.symbol]], a }));
const comparePages = locs.filter(l => l.path.startsWith("/compare/")).map(l => ({ kind: "compare", path: l.path }));
const categoryPages = locs.filter(l => l.path.startsWith("/category/")).map(l => ({ kind: "category", path: l.path }));
const pages = [...coinPages, ...comparePages, ...categoryPages];

const text = html => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const usd = v => "$" + (v >= 1000 ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v >= 1 ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : Number(v.toPrecision(4)).toLocaleString("en-US", { maximumFractionDigits: 12 }));
const ADVICE = /\b(deep value|good buy|undervalued|overvalued|buy|buying|sell|selling|cheap|bargain|opportunity|recommend\w*|should|must-have|bullish|bearish|guaranteed?|moon|price prediction|price target|will (rise|fall|reach|hit))\b/i;
const METRICS = [/turnover velocity/i, /ATH drawdown|all-time-high drawdown/i, /recovery multiplier/i, /supply float/i, /market cap \/ FDV/i, /alpha/i, /intraday (volatility )?spread/i, /parity/i];

const staticProblems = [], headProblems = [], sentenceProblems = [], adviceProblems = [], ldProblems = [], linkProblems = [];
const prose = [];
for (const p of pages) {
  const file = p.path.slice(1) + "index.html";
  if (!existsSync(DIST + file)) { staticProblems.push(`${p.path}: file missing`); continue; }
  const html = read(file);
  const block = (html.match(/<section class="page-section q-block" id="quant"[\s\S]*?<\/section>/) || [""])[0];
  if (!block) { staticProblems.push(`${p.path}: no quant section`); continue; }

  // a) static data
  if (/<script/i.test(block)) staticProblems.push(`${p.path}: script inside the quant section`);
  METRICS.forEach(re => { if (!re.test(block)) staticProblems.push(`${p.path}: metric missing ${re}`); });
  if ((block.match(/<h2 /g) || []).length !== 6) staticProblems.push(`${p.path}: ${(block.match(/<h2 /g) || []).length} h2 headings, expected 6`);
  if ((block.match(/<table/g) || []).length < 5 || !/<thead>/.test(block) || !/<tbody>/.test(block)) staticProblems.push(`${p.path}: tables missing`);
  if (!/<svg[^>]*class="q-(spark|range)/.test(block) || !/<polyline/.test(block)) staticProblems.push(`${p.path}: inline SVG sparkline missing`);
  if (!/id="q-telemetry"/.test(html) || html.indexOf('id="q-telemetry"') < html.indexOf("<h1") || html.indexOf('id="q-telemetry"') > html.indexOf("<h2")) staticProblems.push(`${p.path}: telemetry box is not between the h1 and the first h2`);
  if (p.kind === "coin" && !/data-q-calc="scenario"[\s\S]*\$100<[\s\S]*\$1,000<[\s\S]*\$10,000</.test(block)) staticProblems.push(`${p.path}: scenario matrix missing`);
  if (p.kind === "compare" && (block.match(/data-q-calc="flip"/g) || []).length !== 2) staticProblems.push(`${p.path}: flippening calculator missing`);
  if (!/UTC/.test(block) || !/USD/.test(block)) staticProblems.push(`${p.path}: units missing`);

  // names that the first sentence under each heading must contain
  const h1 = text((html.match(/<h1[^>]*>[\s\S]*?<\/h1>/) || [""])[0]);
  const names = p.names || [...h1.matchAll(/([A-Za-z0-9&. ]+?) \(([A-Z0-9]+)\)/g)].map(m => [m[1].trim().replace(/^vs /, ""), m[2]]);
  const need = p.kind === "category" ? [text((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || ["", ""])[1]).match(/the (.+?) sector/)?.[1]] : names.flat();
  for (const m of block.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>\s*<(p|div)[^>]*>([\s\S]*?)<\/\2>/g)) {
    const first = text(m[3]).trim().split(/(?<=[a-z0-9)%x])\. (?=[A-Z])/)[0];
    if (/^(It|This|These|They|As shown|As above|The token|The coin)\b/.test(first)) sentenceProblems.push(`${p.path}: "${first.slice(0, 60)}…" starts with a pronoun`);
    if (p.kind === "category" ? !(need[0] && first.includes(need[0]) && /\([A-Z0-9]+\)/.test(first)) : !need.every(n => first.includes(n)))
      sentenceProblems.push(`${p.path}: first sentence under "${text(m[1]).trim().slice(0, 50)}" does not name the asset and ticker`);
  }

  // b) wording
  const visible = text((html.match(/<main[\s\S]*<\/main>/) || [""])[0]);
  const scope = p.kind === "coin" ? text(block) + " " + text((html.match(/<p class="q-telemetry"[\s\S]*?<\/p>/) || [""])[0]) : visible;
  const hit = scope.replace(/not (financial, investment or trading )?advice|not a forecast|not an offer/gi, "").match(ADVICE);
  if (hit) adviceProblems.push(`${p.path}: "${hit[0]}"`);
  if (p.kind === "coin") {
    let t = [...block.matchAll(/<(p class="prose"|h2|h3)[^>]*>([\s\S]*?)<\/(p|h2|h3)>/g)].map(m => text(m[2])).join(" ");
    const cut = t.indexOf("Every "); // the methodology section is the same on every page by design: compare the analysis only
    for (const [n, s] of p.names) t = t.split(`${n} (${s})`).join("ASSET").split(n).join("ASSET").replace(new RegExp(`\\b${s}\\b`, "g"), "SYM");
    t = t.replace(/[-+]?\$?\d[\d,.]*\s?(%|x|pp|[TBM]\b)?/g, "#").toLowerCase();
    const words = t.split(/\s+/).filter(Boolean), sh = new Set();
    for (let i = 0; i + 2 < words.length; i++) sh.add(words.slice(i, i + 3).join(" "));
    prose.push({ path: p.path, regime: p.a.regime, sh, words: text(block).split(/\s+/).length, cut });
  }

  // c) JSON-LD
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let graph = [];
  try { graph = scripts.flatMap(s => JSON.parse(s[1])["@graph"] || []); } catch (e) { ldProblems.push(`${p.path}: JSON-LD does not parse (${e.message})`); }
  const types = graph.map(n => n["@type"]);
  for (const t of ["WebPage", "BreadcrumbList", "Dataset", "ExchangeRateSpecification"]) if (!types.includes(t)) ldProblems.push(`${p.path}: no ${t}`);
  if (JSON.stringify(graph).includes("FinancialProduct")) ldProblems.push(`${p.path}: FinancialProduct present`);
  const ds = graph.find(n => n["@type"] === "Dataset"), wp = graph.find(n => n["@type"] === "WebPage");
  if (ds) {
    if (!ds.name || !ds.description || ds.description.length < 50 || ds.description.length > 5000) ldProblems.push(`${p.path}: Dataset name/description`);
    if (!Array.isArray(ds.variableMeasured) || ds.variableMeasured.length < 6) ldProblems.push(`${p.path}: Dataset variableMeasured`);
    const dl = (ds.distribution || []).filter(d => d["@type"] === "DataDownload").map(d => d.contentUrl);
    if (dl.length !== 2 || !dl.every(u => existsSync(DIST + u.replace(SITE + "/", "")))) ldProblems.push(`${p.path}: Dataset distribution`);
    if (!visible.includes("JSON") || !visible.includes("CSV")) ldProblems.push(`${p.path}: dataset downloads not visible`);
  }
  for (const r of graph.filter(n => n["@type"] === "ExchangeRateSpecification")) {
    const x = r.currentExchangeRate || {};
    if (!r.currency || x.priceCurrency !== "USD" || !(x.price > 0)) ldProblems.push(`${p.path}: ExchangeRateSpecification incomplete`);
    else if (!visible.includes(usd(x.price) + " USD")) ldProblems.push(`${p.path}: rate ${usd(x.price)} for ${r.currency} is not in the visible text`);
  }
  if (wp) {
    const img = wp.primaryImageOfPage && wp.primaryImageOfPage.url;
    const og = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1], tw = (html.match(/<meta name="twitter:image" content="([^"]+)"/) || [])[1];
    if (!img || img !== og || img !== tw || !existsSync(DIST + img.replace(SITE + "/", ""))) ldProblems.push(`${p.path}: primaryImageOfPage / og:image / twitter:image mismatch or file missing`);
  }
  const bc = graph.find(n => n["@type"] === "BreadcrumbList");
  if (bc && !bc.itemListElement.every(i => i.name && i.item && visible.includes(i.name))) ldProblems.push(`${p.path}: breadcrumb does not match the page`);

  // d) head and links
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (canonical !== SITE + p.path) headProblems.push(`${p.path}: canonical is ${canonical}`);
  if (!html.includes('content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"')) headProblems.push(`${p.path}: robots meta`);
  if (!html.includes('<link rel="alternate" type="application/json" href="/api/v1/quant-snapshot.json"')) headProblems.push(`${p.path}: alternate JSON link`);
  if (!html.includes("Download Open Quant Dataset:")) headProblems.push(`${p.path}: footer dataset links`);
  const title = text((html.match(/<title>([\s\S]*?)<\/title>/) || ["", ""])[1]), desc = (html.match(/<meta name="description" content="([^"]*)"/) || ["", ""])[1];
  if (title.length > 60 || desc.length > 160 || /\$\d|\b20\d\d\b/.test(title)) headProblems.push(`${p.path}: title/description length or a price/date in the title`);
  if ((html.match(/<h1/g) || []).length !== 1) headProblems.push(`${p.path}: h1 count`);
  if (/ on[a-z]+="/.test(block) || /<script(?![^>]*(src=|type="application\/ld\+json"))[^>]*>(?!\/\*theme\*\/)/.test(html)) headProblems.push(`${p.path}: inline script or handler (CSP)`);
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const t = m[1];
    if (!existsSync(DIST + t.slice(1)) && !existsSync(DIST + t.slice(1) + "index.html")) linkProblems.push(`${p.path}: broken link ${t}`);
  }
}
check("a) static HTML: 6 metrics, tables, scenario/parity matrices, inline SVG, telemetry box", staticProblems, `${pages.length} pages`);
check("a) first sentence under every h2/h3 names the asset and ticker", sentenceProblems);

// b) uniqueness between regimes
const sim = (x, y) => { let n = 0; for (const s of x) if (y.has(s)) n++; return n / (x.size + y.size - n); };
const regimes = [...new Set(prose.map(p => p.regime))];
const uniq = [], within = [];
for (let i = 0; i < prose.length; i++) for (let j = i + 1; j < prose.length; j++) {
  const u = 1 - sim(prose[i].sh, prose[j].sh);
  (prose[i].regime === prose[j].regime ? within : uniq).push({ u, pair: `${prose[i].path} vs ${prose[j].path}` });
}
uniq.sort((a, b) => a.u - b.u);
const avg = a => a.length ? (a.reduce((t, x) => t + x.u, 0) / a.length * 100).toFixed(1) + "%" : "n/a";
check("b) wording differs by more than 40% between regimes (names and numbers masked)",
  uniq.length && uniq[0].u <= 0.4 ? [`${uniq[0].pair}: only ${(uniq[0].u * 100).toFixed(1)}% unique`] : [],
  uniq.length ? `${regimes.length} regimes in this snapshot; lowest ${(uniq[0].u * 100).toFixed(1)}%, mean ${avg(uniq)}; same-regime mean ${avg(within)}` : "only one regime in this snapshot");
check("b) no advice wording", adviceProblems);
check("c) JSON-LD: WebPage + BreadcrumbList + Dataset + ExchangeRateSpecification, matches visible text", ldProblems);
check("d) canonical, robots, alternate link, footer links, titles, CSP-safe markup", headProblems);
check("d) internal links resolve", [...new Set(linkProblems)]);

// d) site-level files
const site = [];
if (api.count !== api.assets.length || api.assets.length > 50 || api.assets.length < 40) site.push(`quant-snapshot.json has ${api.assets.length} assets`);
const need = ["turnover_velocity_pct", "ath_drawdown_pct", "ath_recovery_multiplier", "supply_float_pct", "mcap_fdv_ratio", "alpha_24h_vs_btc_pp", "alpha_7d_vs_sector_pp", "intraday_spread_pct", "btc_parity_price_usd", "eth_parity_multiplier"];
need.forEach(k => { if (!(k in api.assets[0])) site.push(`quant-snapshot.json lacks ${k}`); });
const csv = read("data/crypto-quant-snapshot.csv").trim().split("\n");
if (csv.length !== api.assets.length + 1 || !need.every(k => csv[0].split(",").includes(k))) site.push("CSV rows or columns do not match the JSON");
if (new Set(locs.map(l => l.path)).size !== locs.length) site.push("sitemap.xml has duplicate URLs");
if (!locs.every(l => /^\d{4}-\d\d-\d\d(T\d\d:\d\d:\d\dZ)?$/.test(l.lastmod))) site.push("sitemap.xml has an invalid lastmod");
if (new Set(locs.map(l => l.lastmod)).size < 2) site.push("every sitemap lastmod is identical");
if (comparePages.length > 25 || comparePages.length < 20 || categoryPages.length !== 6) site.push(`${comparePages.length} comparisons, ${categoryPages.length} sector hubs`);
const ledger = JSON.parse(readFileSync(ROOT + "data/lastmod-ledger.json", "utf8")).urls;
for (const l of locs) if (ledger[l.path] && l.lastmod.slice(0, 10) < ledger[l.path].lastmod.slice(0, 10)) site.push(`${l.path}: sitemap lastmod older than the ledger`);
for (const p of pages) if (!ledger[p.path]) site.push(`${p.path}: not in the ledger`);
const headers = read("_headers");
for (const s of ["/api/*", "/data/*", "/widget.js", "Access-Control-Allow-Origin: *", "stale-while-revalidate=3600", "rel=preload; as=style", "X-Content-Type-Options: nosniff", "Referrer-Policy: strict-origin-when-cross-origin", "Content-Security-Policy"]) if (!headers.includes(s)) site.push(`_headers lacks ${s}`);
if (/\{\{/.test(headers)) site.push("_headers has an unfilled placeholder");
for (const m of headers.matchAll(/Link: <(\/assets\/[^>?]+)\?v=([0-9a-f]+)>/g)) if (!existsSync(DIST + m[1].slice(1))) site.push(`_headers preloads a missing file ${m[1]}`);
if ((headers.match(/^\S/gm) || []).filter(l => !l.startsWith("#")).length > 100) site.push("_headers has more than 100 rules");
if (statSync(DIST + "widget.js").size >= 4096) site.push("widget.js is 4 KB or larger");
if (!/Data via CryptoPriceTicker\.com/.test(read("widget.js")) || !/rel = "noopener"/.test(read("widget.js"))) site.push("widget credit link");
if (!/Sitemap: .*sitemap\.xml/.test(read("robots.txt"))) site.push("robots.txt sitemap line");
for (const f of ["scripts", "docs", "tests", "content", "package.json", "CLAUDE.md"]) if (existsSync(DIST + f)) site.push(`dist/ contains ${f}`);
check("d) open data, sitemap + ledger, _headers, widget, robots", site, `${locs.length} sitemap URLs, widget ${statSync(DIST + "widget.js").size} bytes`);

const words = prose.map(p => p.words).sort((a, b) => a - b);
console.log(`\nQuant section size: median ${words[words.length >> 1]} words per coin page; regimes: ${regimes.join(", ")}`);
console.log(failed ? `VERIFY FAILED (${failed} check${failed > 1 ? "s" : ""})` : "VERIFY PASSED");
process.exit(failed ? 1 : 0);
