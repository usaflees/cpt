#!/usr/bin/env node
// Quant SEO engine: builds the deployable site into dist/ (run by `npm run build`).
//
//   node scripts/build-seo-engine.mjs            fetch a market snapshot (CoinGecko → CoinPaprika → committed cache)
//   node scripts/build-seo-engine.mjs --offline  use data/market-snapshot-cache.json only (repeatable local builds)
//
// dist/ is a copy of the static site in the repo root plus what this script generates from the snapshot:
//   - a quantitative section on the coin pages of the top 50 assets (/coin/<sym>/; /coin/<name>/ already
//     redirects there, so each asset keeps exactly one indexable URL)
//   - /compare/<a>-vs-<b>/   25 curated comparisons          (content/quant-config.json "comparisons")
//   - /category/<sector>/    6 sector benchmark hubs with medians (content/quant-config.json "sectors")
//   - /api/v1/quant-snapshot.json and /data/crypto-quant-snapshot.csv (open data, CORS via public/_headers)
//   - sitemap lastmod from data/lastmod-ledger.json: a URL's date moves only on a ≥ 3% price move, a rank
//     change or a regime change; the URLs that moved are written to data/changed-urls.json for IndexNow
//   - _headers and _redirects = the root files plus public/_headers and public/_redirects
// Nothing in the repo root is modified except data/ (snapshot cache, ledger). Text rules: observational only,
// no advice wording (scripts/verify-seo-engine.mjs checks this and the rest of the output).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, cpSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { ROOT, loadRegistry } from "./lib/registry.mjs";
import { loadSnapshot } from "./lib/market-data.mjs";

const args = process.argv.slice(2);
if (args.some(a => a !== "--offline")) { console.error("usage: node scripts/build-seo-engine.mjs [--offline]"); process.exit(1); }

const SITE = "https://cryptopriceticker.com";
const DIST = ROOT + "dist/";
const LEDGER_PATH = ROOT + "data/lastmod-ledger.json";
const cfg = JSON.parse(readFileSync(ROOT + "content/quant-config.json", "utf8"));
const { coins } = loadRegistry();
const snap = await loadSnapshot(cfg.coingeckoIds, { offline: args.includes("--offline") });
const AS_OF = snap.fetchedAt;                                   // 2026-11-12T12:51:48Z
const AS_OF_TEXT = AS_OF.slice(0, 10) + " " + AS_OF.slice(11, 16) + " UTC";
const TIME = `<time datetime="${AS_OF}">${AS_OF_TEXT}</time>`;

// ---------- formatting (quant.js and verify-seo-engine.mjs use the same rules) ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const loc = (v, min, max) => v.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });
const usd = v => v == null ? "—" : "$" + (v >= 1000 ? loc(v, 2, 2) : v >= 1 ? loc(v, 2, 4) : loc(Number(v.toPrecision(4)), 0, 12));
const money = v => v == null ? "—" : v >= 0.01 ? "$" + loc(v, 2, 2) : usd(v); // amounts of money (not unit prices): cents
const big = v => v == null ? "—" : v >= 1e12 ? "$" + loc(v / 1e12, 2, 2) + "T" : v >= 1e9 ? "$" + loc(v / 1e9, 2, 2) + "B" : v >= 1e6 ? "$" + loc(v / 1e6, 2, 2) + "M" : usd(v);
const pc = v => v == null ? "—" : loc(v, 2, 2) + "%";
const spc = v => v == null ? "—" : (v >= 0 ? "+" : "") + loc(v, 2, 2) + "%";
const pp = v => v == null ? "—" : (v >= 0 ? "+" : "") + loc(v, 2, 2) + " pp";
const mx = v => v == null ? "—" : loc(v, 2, 2) + "x";
const qty = v => v == null ? "—" : loc(v, 0, 0);
const ratio = v => v == null ? "—" : loc(v, 2, 2);
const slugify = s => s.replace(/\s*\(formerly [^)]+\)/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const median = xs => { const a = xs.filter(v => v != null).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
const pill = v => v == null ? "—" : `<span class="chg-pill ${v >= 0 ? "chg-up" : "chg-down"}">${spc(v)}</span>`;

// ---------- metrics ----------
const REGIMES = {
  momentum: { label: "High-Velocity Momentum Expansion", rule: "24h change above +5% and turnover velocity above 10%" },
  drawdown: { label: "Extended Historical Drawdown & Mean-Reversion Zone", rule: "more than 60% below the all-time high" },
  overhang: { label: "Elevated FDV Supply Overhang", rule: "market cap below 0.55 of fully diluted valuation" },
  compression: { label: "Low-Volatility Range Compression", rule: "24h high-low spread under 3.5%" },
  mixed: { label: "Mixed Microstructure (no threshold regime active)", rule: "none of the four thresholds met" }
};
const turnoverClass = t => t > 12 ? "High Institutional/Speculative Velocity" : t >= 4 ? "Balanced Spot Liquidity" : "Low Orderbook Turnover";

const bySym = new Map(snap.assets.map(a => [a.sym, a]));
const universe = [];
for (const c of coins) {
  const a = bySym.get(c.sym);
  if (!a || c.sectors.includes("Stable")) continue;
  if ([a.price, a.mcap, a.vol, a.circ, a.ath, a.chg24, a.chg7].some(v => v == null) || a.vol <= 0) continue; // incomplete data: no page
  const name = c.name.replace(/\s*\(formerly [^)]+\)/, "");
  const basis = a.max || a.total || null, fdv = a.fdv || (basis ? a.price * basis : null);
  const m = {
    sym: c.sym, name, N: `${name} (${c.sym})`, slug: slugify(c.name), path: `/coin/${c.sym.toLowerCase()}/`, keys: c.sectors, logo: c.logo,
    rank: a.rank, price: a.price, mcap: a.mcap, vol: a.vol, fdv, chg24: a.chg24, chg7: a.chg7, high: a.high, low: a.low,
    ath: a.ath, athDate: a.athDate, circ: a.circ, basis, basisKind: a.max ? "maximum" : "total", spark: a.spark,
    turnover: a.vol / a.mcap * 100,
    drawdown: Math.max(0, (a.ath - a.price) / a.ath * 100), recovery: Math.max(1, a.ath / a.price),
    float: basis ? Math.min(100, a.circ / basis * 100) : null, mcFdv: fdv ? Math.min(1, a.mcap / fdv) : null,
    spread: a.high && a.low ? (a.high - a.low) / a.low * 100 : null
  };
  m.turnClass = turnoverClass(m.turnover);
  m.regimes = [
    m.chg24 > 5 && m.turnover > 10 && "momentum", m.drawdown > 60 && "drawdown",
    m.mcFdv != null && m.mcFdv < 0.55 && "overhang", m.spread != null && m.spread < 3.5 && "compression"
  ].filter(Boolean);
  m.regime = m.regimes[0] || "mixed";
  universe.push(m);
}
universe.sort((a, b) => b.mcap - a.mcap);
const U = new Map(universe.map(m => [m.sym, m]));
const BTC = U.get("BTC"), ETH = U.get("ETH");
if (!BTC || !ETH) throw new Error("Snapshot has no BTC or ETH: refusing to build");

const sectors = cfg.sectors.map(s => {
  const members = universe.filter(m => (s.keys || []).some(k => m.keys.includes(k)) || (s.symbols || []).includes(m.sym));
  const med = k => median(members.map(m => m[k]));
  const tally = {};
  members.forEach(m => { tally[m.regime] = (tally[m.regime] || 0) + 1; });
  return {
    ...s, path: `/category/${s.slug}/`, members, leader: members[0],
    mcap: members.reduce((t, m) => t + m.mcap, 0), vol: members.reduce((t, m) => t + m.vol, 0),
    med: { turnover: med("turnover"), drawdown: med("drawdown"), recovery: med("recovery"), float: med("float"), mcFdv: med("mcFdv"), chg24: med("chg24"), chg7: med("chg7"), spread: med("spread") },
    tally, dominant: Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
  };
}).filter(s => s.members.length >= 3);

const top = universe.slice(0, cfg.topN);
const topMed = { chg24: median(top.map(m => m.chg24)), chg7: median(top.map(m => m.chg7)) };
for (const m of universe) {
  // Primary sector: the first of the coin's registry sectors that has a hub, else an explicit membership.
  m.sector = m.keys.map(k => sectors.find(s => (s.keys || []).includes(k))).find(Boolean) || sectors.find(s => s.members.includes(m)) || null;
  const bench = m.sector ? m.sector.med : topMed;
  m.benchName = m.sector ? `${m.sector.name} sector median` : `median of the top ${top.length} assets`;
  m.alpha = {
    btc24: m.chg24 - BTC.chg24, btc7: m.chg7 - BTC.chg7, eth24: m.chg24 - ETH.chg24, eth7: m.chg7 - ETH.chg7,
    sec24: m.chg24 - bench.chg24, sec7: m.chg7 - bench.chg7
  };
  const leader = m.sector && m.sector.leader !== m ? m.sector.leader : m !== BTC ? BTC : null;
  m.parityTarget = leader;
}
// Price and multiple of asset a at asset b's market cap, and at b's FDV (a's full supply basis).
const parity = (a, b) => ({
  price: b.mcap / a.circ, mult: b.mcap / a.mcap,
  fdvPrice: a.basis && b.fdv ? b.fdv / a.basis : null, fdvMult: a.fdv && b.fdv ? b.fdv / a.fdv : null
});

const pairs = [];
for (const [x, y] of cfg.comparisons) {
  const a = U.get(x), b = U.get(y);
  if (a && b && pairs.length < cfg.maxComparisons) pairs.push({ a, b, slug: `${a.slug}-vs-${b.slug}`, path: `/compare/${a.slug}-vs-${b.slug}/` });
}

// ---------- lastmod ledger ----------
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, "utf8")) : { urls: {} };
const changed = [], seen = new Set();
function track(path, state) {
  seen.add(path);
  const old = ledger.urls[path];
  const moved = !old || !(old.price > 0) || Math.abs(state.price - old.price) / old.price >= 0.03 || old.rank !== state.rank || old.regime !== state.regime;
  if (moved && (!old || old.lastmod !== AS_OF)) { ledger.urls[path] = { ...state, price: Number(state.price.toPrecision(8)), lastmod: AS_OF }; changed.push(path); }
  return ledger.urls[path].lastmod;
}
const lastmod = new Map();
top.forEach(m => lastmod.set(m.path, track(m.path, { price: m.price, regime: m.regime, rank: m.rank })));
pairs.forEach(p => lastmod.set(p.path, track(p.path, { price: p.a.price / p.b.price, regime: `${p.a.regime}|${p.b.regime}`, rank: `${p.a.rank}-${p.b.rank}` })));
sectors.forEach(s => lastmod.set(s.path, track(s.path, { price: s.mcap, regime: s.dominant, rank: s.leader.sym })));
for (const k of Object.keys(ledger.urls)) if (!seen.has(k)) delete ledger.urls[k];

// ---------- copy the static site ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const SKIP = new Set(["node_modules", "dist", "scripts", "docs", "tests", "content", "functions", "public", "data", "package.json", "package-lock.json"]);
for (const f of readdirSync(ROOT)) {
  if ((f.startsWith(".") && f !== ".well-known") || SKIP.has(f) || /\.md$/i.test(f)) continue;
  cpSync(ROOT + f, DIST + f, { recursive: true });
}
const PUBLIC = ROOT + "public/";
for (const f of readdirSync(PUBLIC)) if (!["_headers", "_redirects"].includes(f)) cpSync(PUBLIC + f, DIST + f, { recursive: true });
const hashOf = f => createHash("sha256").update(readFileSync(DIST + f)).digest("hex").slice(0, 10);
const QCSS = `/assets/quant.css?v=${hashOf("assets/quant.css")}`, QJS = `/assets/quant.js?v=${hashOf("assets/quant.js")}`;
const read = f => readFileSync(DIST + f, "utf8");
const write = (f, s) => { mkdirSync((DIST + f).replace(/[^/]+$/, ""), { recursive: true }); writeFileSync(DIST + f, s); };
// Replace exactly one match or stop: a silent miss would ship a page without its head tags.
// "to" is literal text or a function: never a "$1" pattern, because prices such as $100 would be read as group references.
const sub = (html, re, to, what) => { if (!re.test(html)) throw new Error(`Template marker not found: ${what}`); return html.replace(re, typeof to === "function" ? to : () => to); };

// ---------- shared page pieces ----------
const ROBOTS = `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`;
const ogImage = (file) => `${SITE}/${existsSync(DIST + file) ? file : "og-image.jpg"}`;
function headExtras(html, image) {
  html = sub(html, /<meta name="robots"[^>]*>/, ROBOTS, "robots");
  html = sub(html, /(<meta name="twitter:card"[^>]*>)/, m => `${m}\n  <meta name="twitter:image" content="${image}" />\n  <link rel="alternate" type="application/json" href="/api/v1/quant-snapshot.json" title="Open quant dataset (JSON)" />`, "twitter:card");
  return sub(html, /(<link rel="stylesheet" href="\/assets\/app\.css[^>]*>)/, m => `${m}\n  <link rel="stylesheet" href="${QCSS}" />\n  <script src="${QJS}" defer></script>`, "app.css");
}
const imageNode = url => ({ "@type": "ImageObject", url, width: 1200, height: 630 });
const downloads = [
  { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/v1/quant-snapshot.json` },
  { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/data/crypto-quant-snapshot.csv` }
];
const pv = (name, value, unitText) => ({ "@type": "PropertyValue", name, value: value == null ? "not available" : Number(value.toFixed(4)), unitText });
const variables = m => [
  pv("Spot turnover velocity", m.turnover, "%"), pv("ATH drawdown", m.drawdown, "%"), pv("ATH recovery multiplier", m.recovery, "x"),
  pv("Supply float", m.float, "%"), pv("Market cap / FDV ratio", m.mcFdv, "ratio"),
  pv("24h alpha vs Bitcoin", m.alpha.btc24, "percentage points"), pv("7d alpha vs Bitcoin", m.alpha.btc7, "percentage points"),
  pv("Intraday volatility spread", m.spread, "%"),
  ...(m !== BTC ? [pv("Bitcoin market cap parity multiplier", parity(m, BTC).mult, "x")] : [pv("Ethereum market cap parity multiplier", parity(m, ETH).mult, "x")])
];
const datasetNode = (url, name, description, vars) => ({
  "@type": "Dataset", "@id": url + "#dataset", name, description, url, isAccessibleForFree: true, dateModified: AS_OF, temporalCoverage: AS_OF,
  creator: { "@id": `${SITE}/#organization` }, variableMeasured: vars, distribution: downloads
});
const rateNode = (url, m) => ({
  "@type": "ExchangeRateSpecification", "@id": `${url}#rate-${m.sym.toLowerCase()}`, currency: m.sym,
  currentExchangeRate: { "@type": "UnitPriceSpecification", price: m.price, priceCurrency: "USD" }
});
const ld = graph => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;

function sparkline(m) {
  if (!m.spark) return `<p class="muted q-note">${esc(m.N)} 7-day sparkline: not provided by the ${esc(snap.source)} fallback source for this snapshot.</p>`;
  const lo = Math.min(...m.spark), hi = Math.max(...m.spark), W = 320, H = 64, n = m.spark.length - 1;
  const pts = m.spark.map((v, i) => `${(i / n * W).toFixed(1)},${(H - 4 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * (H - 8)).toFixed(1)}`).join(" ");
  const up = m.spark[n] >= m.spark[0];
  return `<figure class="q-fig"><svg class="q-spark ${up ? "q-up" : "q-down"}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(m.N)} 7-day price sparkline, low ${usd(lo)} USD, high ${usd(hi)} USD"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="${pts}"/></svg><figcaption>${esc(m.N)} 7-day price: low ${usd(lo)} USD, high ${usd(hi)} USD, change ${spc(m.chg7)}</figcaption></figure>`;
}
function rangeBar(m) {
  if (m.spread == null) return "";
  const pos = Math.max(0, Math.min(1, (m.price - m.low) / (m.high - m.low || 1))) * 300 + 10;
  return `<figure class="q-fig"><svg class="q-range" viewBox="0 0 320 24" width="320" height="24" role="img" aria-label="${esc(m.N)} 24h range: low ${usd(m.low)} USD, spot ${usd(m.price)} USD, high ${usd(m.high)} USD"><line x1="10" y1="12" x2="310" y2="12" stroke="currentColor" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/><circle cx="${pos.toFixed(1)}" cy="12" r="7" fill="currentColor"/></svg><figcaption>${esc(m.N)} 24h range: low ${usd(m.low)} USD · spot ${usd(m.price)} USD · high ${usd(m.high)} USD</figcaption></figure>`;
}
const table = (caption, head, rows) => `<div class="table-wrap q-table"><table class="history-table"><caption>${caption}</caption><thead><tr>${head.map((h, i) => `<th scope="col"${i ? "" : ' class="col-left"'}>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row" class="col-left">${c}</th>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const coinLink = m => `<a href="${m.path}">${esc(m.name)} (${m.sym})</a>`;

function methodology(subject, extra = "") {
  return `<p class="prose">Every ${subject} figure on this page is computed from a single market snapshot taken at ${TIME} from <a href="${snap.sourceUrl}" rel="noopener">${esc(snap.source)}</a>${snap.tier === 3 ? " (the most recent snapshot available to this build)" : ""}; the numbers are static until the next snapshot and the timestamp states their age.${extra}</p>
<ul class="prose q-formulas">
<li><strong>Spot turnover velocity (%)</strong> = 24h volume ÷ market cap × 100. Above 12%: High Institutional/Speculative Velocity; 4–12%: Balanced Spot Liquidity; below 4%: Low Orderbook Turnover.</li>
<li><strong>ATH drawdown (%)</strong> = (all-time high − spot) ÷ all-time high × 100; <strong>recovery multiplier (x)</strong> = all-time high ÷ spot.</li>
<li><strong>Supply float (%)</strong> = circulating supply ÷ maximum supply (total supply where no maximum exists) × 100; <strong>market cap / FDV</strong> = market cap ÷ fully diluted valuation.</li>
<li><strong>Benchmark alpha spread (pp)</strong> = asset return − benchmark return over 24h and 7d, against Bitcoin, Ethereum and the sector median.</li>
<li><strong>Intraday volatility spread (%)</strong> = (24h high − 24h low) ÷ 24h low × 100.</li>
<li><strong>Market cap parity price (USD)</strong> = target asset's market cap ÷ circulating supply; the FDV version divides the target's FDV by the full supply.</li>
</ul>
<p class="prose">Regimes are assigned in this order: ${Object.entries(REGIMES).map(([, r]) => `${r.label} (${r.rule})`).join("; ")}. Market data: ${esc(snap.source)} API; method references: Datar, Naik and Radcliffe (1998) for turnover as a liquidity measure and Parkinson (1980) for the high-low range.</p>
<p class="disclaimer">Non-advisory data disclaimer: these are arithmetic descriptions of public market data for information only. They are not financial, investment or trading advice, not a forecast and not an offer; scenario and parity figures are calculations, not expectations. Crypto assets are volatile and can lose all value. Full dataset: <a class="no-prerender" href="/api/v1/quant-snapshot.json">JSON</a> | <a class="no-prerender" href="/data/crypto-quant-snapshot.csv">CSV</a>.</p>`;
}

// ---------- regime branching: headings and commentary differ per regime ----------
const H2 = {
  momentum: [
    N => `What is the ${N} price as spot turnover velocity accelerates?`,
    N => `How much ground separates ${N} from its all-time high during this expansion?`,
    N => `Does the ${N} circulating float and FDV leave supply still to unlock?`,
    N => `How large is the ${N} 24h and 7d alpha over Bitcoin, Ethereum and its sector?`,
    N => `How wide did the ${N} intraday range stretch, and what orderbook regime is active?`,
    N => `How are these ${N} momentum metrics computed, and are they advice?`],
  drawdown: [
    N => `What are the ${N} spot price, market cap and turnover velocity inside its drawdown?`,
    N => `How deep is the ${N} all-time-high drawdown, and what multiplier reclaims the record?`,
    N => `What do ${N} circulating float and FDV dilution look like this far below the high?`,
    N => `Is ${N} ahead of or behind Bitcoin, Ethereum and its sector median over 24h and 7d?`,
    N => `What does the ${N} intraday volatility spread show in the mean-reversion zone?`,
    N => `Which formulas produce the ${N} drawdown figures, and is any of it financial advice?`],
  overhang: [
    N => `What is the ${N} price and market cap, and how much volume turns over against the float?`,
    N => `Where does ${N} trade relative to its all-time high, and what is the recovery multiple?`,
    N => `How large is the ${N} FDV supply overhang, and how much of the supply is circulating?`,
    N => `How does ${N} 24h and 7d performance compare with Bitcoin, Ethereum and the sector median?`,
    N => `How volatile was ${N} intraday, and which orderbook regime applies?`,
    N => `How is the ${N} FDV overhang measured, and is this investment advice?`],
  compression: [
    N => `What is the ${N} spot price, and how much liquidity turns over in a narrow range?`,
    N => `How far below its all-time high is ${N} while volatility is compressed?`,
    N => `What share of ${N} supply is in circulation, and what is the FDV dilution gap?`,
    N => `Is ${N} moving with or against Bitcoin, Ethereum and its sector over 24h and 7d?`,
    N => `How narrow is the ${N} 24h high-low spread, and what range regime does it mark?`,
    N => `How is the ${N} range-compression reading calculated, and is it advice?`],
  mixed: [
    N => `What are the ${N} spot price, market cap and liquidity turnover velocity right now?`,
    N => `How far is ${N} below its all-time high, and what multiplier reclaims it?`,
    N => `How much of the ${N} supply is circulating, and how large is the FDV dilution risk?`,
    N => `How did ${N} perform over 24h and 7d against Bitcoin, Ethereum and its sector median?`,
    N => `How wide is the ${N} intraday volatility spread, and which orderbook regime applies?`,
    N => `How are the ${N} quantitative metrics calculated, and is this financial advice?`]
};
// Commentary per regime for sections 1–5. f = pre-formatted strings for the asset.
const LENS = {
  momentum: [
    f => `The ${f.chg24} 24h move arrived with ${f.turn} of market cap changing hands, which is what places ${f.N} in the ${REGIMES.momentum.label} regime (${REGIMES.momentum.rule}). Volume of ${f.vol} USD against a ${f.mcap} USD capitalisation means the advance is being traded heavily, not carried by a thin orderbook.`,
    f => `A fast 24h advance shortens the distance to the record only slightly: the ${f.rec} multiple is measured from the new, higher spot price, and it moves down one-for-one with every further percentage gain.`,
    f => `Momentum readings describe the traded float only. With a market cap/FDV ratio of ${f.ratio}, ${f.unlocked} of the fully diluted ${f.sym} valuation is already circulating and exposed to the current turnover.`,
    f => `During an expansion the alpha spread separates asset-specific flow from a market-wide move: ${f.N} is ${f.secWord} its ${f.bench} by ${f.sec24abs} percentage points over 24h.`,
    f => `A wide spread paired with turnover above 10% is the signature of the momentum regime: price is travelling through the orderbook quickly and on volume.`],
  drawdown: [
    f => `Turnover of ${f.turn} is being recorded while ${f.N} trades ${f.dd} below its record, so the liquidity reading describes a market operating deep inside a historical drawdown, far from price-discovery highs.`,
    f => `A drawdown beyond 60% places ${f.N} in the ${REGIMES.drawdown.label} regime. The recovery multiplier is convex: at ${f.dd} below the high a ${f.rec} move is required, and each additional point of drawdown raises that multiple faster than the last.`,
    f => `Deep drawdowns coexist with very different supply profiles. For ${f.sym} the float is ${f.float} and the market cap/FDV ratio is ${f.ratio}, which shows how much of the decline has been absorbed by supply that already circulates.`,
    f => `Relative performance inside a drawdown shows whether the asset is still losing ground to benchmarks: ${f.N} is ${f.secWord} its ${f.bench} by ${f.sec24abs} percentage points over 24h and ${f.sec7abs} over 7d.`,
    f => `Range width in a drawdown regime indicates whether the decline is still active or has slowed into consolidation; the figure is descriptive and carries no directional meaning.`],
  overhang: [
    f => `The ${f.mcap} USD market cap covers only the circulating float. Fully diluted valuation is ${f.fdv} USD, so the ${f.turn} turnover figure is measured against ${f.ratio} of the eventual valuation base.`,
    f => `The all-time high of ${f.sym} was set against a smaller circulating supply than exists today, so reclaiming the ${f.ath} USD price would imply a larger market cap than at the original peak.`,
    f => `A market cap/FDV ratio below 0.55 places ${f.N} in the ${REGIMES.overhang.label} regime: ${f.locked} of the fully diluted supply is not yet circulating, and its release schedule adds supply independent of demand.`,
    f => `Alpha for an asset with scheduled supply growth reflects both market flow and emissions: ${f.N} is ${f.secWord} its ${f.bench} by ${f.sec24abs} percentage points over 24h.`,
    f => `With a thin float relative to total supply, intraday ranges can be amplified by comparatively small order flow; the spread is reported as measured.`],
  compression: [
    f => `${f.N} is trading inside a ${f.spread} high-low band, and ${f.turn} turnover in a band that narrow indicates volume rotating within a tight range without repricing the asset.`,
    f => `Compressed volatility leaves the ATH arithmetic nearly static from one snapshot to the next: the ${f.rec} multiple changes only as fast as the ${f.spread} daily range allows.`,
    f => `Supply metrics are the slow-moving inputs in a compressed market: float ${f.float} and market cap/FDV ${f.ratio} change with emissions and burns, not with the daily range.`,
    f => `In a narrow range the alpha spread is small in absolute terms: ${f.N} is ${f.secWord} its ${f.bench} by ${f.sec24abs} percentage points over 24h and ${f.sec7abs} over 7d.`,
    f => `A 24h spread under 3.5% places ${f.N} in the ${REGIMES.compression.label} regime, a state in which the high and low sit unusually close to the spot price.`],
  mixed: [
    f => `None of the four threshold regimes is active for ${f.N} at this snapshot; turnover of ${f.turn} falls in the "${f.turnClass}" bracket and is reported without a regime overlay.`,
    f => `At ${f.dd} below the high, ${f.N} is outside the 60% drawdown threshold, so the recovery multiple is reported as plain arithmetic.`,
    f => `With a market cap/FDV ratio of ${f.ratio}, ${f.N} is above the 0.55 overhang threshold; ${f.unlocked} of the fully diluted valuation is already in circulation.`,
    f => `Against its ${f.bench}, ${f.N} is ${f.secWord} by ${f.sec24abs} percentage points over 24h and ${f.sec7abs} over 7d.`,
    f => `The ${f.spread} range is wider than the 3.5% compression threshold and the 24h move is below the momentum threshold, so no volatility regime is flagged.`]
};

// ---------- coin page section ----------
function coinSections(m) {
  const N = esc(m.N), R = REGIMES[m.regime], h = H2[m.regime], lens = LENS[m.regime];
  const f = {
    N, sym: m.sym, chg24: spc(m.chg24), turn: pc(m.turnover), turnClass: m.turnClass, vol: big(m.vol), mcap: big(m.mcap), fdv: big(m.fdv),
    rec: mx(m.recovery), dd: pc(m.drawdown), ath: usd(m.ath), ratio: ratio(m.mcFdv), float: pc(m.float), spread: pc(m.spread),
    unlocked: m.mcFdv == null ? "an unreported share" : pc(m.mcFdv * 100), locked: m.mcFdv == null ? "an unreported share" : pc((1 - m.mcFdv) * 100),
    bench: m.benchName, secWord: m.alpha.sec24 >= 0 ? "ahead of" : "behind", sec24abs: loc(Math.abs(m.alpha.sec24), 2, 2), sec7abs: loc(Math.abs(m.alpha.sec7), 2, 2)
  };
  const ref = cfg.references[m.sym];
  const t = m.parityTarget, tp = t && parity(m, t);
  const scen = [
    ["-25% from spot", 0.75], ["Current spot", 1], ["0.5x ATH", m.ath * 0.5 / m.price], ["Full ATH reclaim", m.ath / m.price],
    [t ? `${t.name} (${t.sym}) market cap parity` : `Sector leader market cap parity (${m.sym} is the largest asset)`, tp ? tp.mult : null]
  ];
  const cell = (amt, k) => k == null ? "n/a" : money(amt * k);
  const matrix = `<div class="table-wrap q-table" data-q-calc="scenario" data-mults="${scen.map(s => s[1] == null ? "" : s[1].toPrecision(8)).join(",")}">
<table class="history-table"><caption>${N} capital scenario matrix: value in USD of an amount allocated at the ${usd(m.price)} USD spot price (${AS_OF_TEXT})</caption>
<thead><tr><th scope="col" class="col-left">Allocation (USD)</th>${scen.map(s => `<th scope="col">${esc(s[0])}</th>`).join("")}</tr></thead>
<tbody><tr><th scope="row" class="col-left">Implied ${m.sym} price (USD)</th>${scen.map(s => `<td>${s[1] == null ? "n/a" : usd(m.price * s[1])}</td>`).join("")}</tr>
<tr><th scope="row" class="col-left">Multiple of spot (x)</th>${scen.map(s => `<td>${s[1] == null ? "n/a" : mx(s[1])}</td>`).join("")}</tr>
${[100, 1000, 10000].map(a => `<tr><th scope="row" class="col-left">${usd(a).replace(".00", "")}</th>${scen.map(s => `<td>${cell(a, s[1])}</td>`).join("")}</tr>`).join("\n")}
<tr class="q-custom"><th scope="row" class="col-left"><label for="qAmt">Your amount (USD)</label> <input id="qAmt" class="q-input" type="number" inputmode="decimal" min="0" step="any" value="500" data-q-amount /></th>${scen.map((s, i) => `<td data-q-out="${i}">${cell(500, s[1])}</td>`).join("")}</tr>
</tbody></table>
<p class="q-slider"><label for="qRange">Position size slider (USD 100 – 100,000)</label> <input id="qRange" type="range" min="100" max="100000" step="100" value="500" data-q-range /></p></div>`;
  const parRows = [BTC, ETH, m.sector && m.sector.leader].filter((x, i, a) => x && x !== m && a.indexOf(x) === i).map(x => {
    const p = parity(m, x);
    return [`${esc(x.N)} — market cap ${big(x.mcap)} USD`, usd(p.price), mx(p.mult), p.fdvPrice == null ? "—" : usd(p.fdvPrice), mx(p.fdvMult)];
  });
  const p0 = parRows.length ? parity(m, m !== BTC ? BTC : ETH) : null, pT = m !== BTC ? BTC : ETH;
  const related = pairs.filter(p => p.a === m || p.b === m).map(p => `<a href="${p.path}">${esc(p.a.name)} vs ${esc(p.b.name)}</a>`);
  const also = m.regimes.slice(1).map(k => REGIMES[k].label);
  const athLine = m.drawdown < 0.005
    ? `${N} is trading at its all-time high of ${usd(m.ath)} USD (${m.athDate}), so the ATH drawdown is 0.00% and the recovery multiplier is 1.00x.`
    : `${N} trades ${pc(m.drawdown)} below its all-time high of ${usd(m.ath)} USD, set on ${m.athDate}, and needs a ${mx(m.recovery)} move from the ${usd(m.price)} USD spot price to reclaim that high.`;
  const supplyLine = m.basis
    ? `${N} has ${qty(m.circ)} ${m.sym} in circulation, a supply float of ${pc(m.float)} of its ${m.basisKind} supply of ${qty(m.basis)} ${m.sym}, and a market cap to fully diluted valuation (FDV) ratio of ${ratio(m.mcFdv)}.`
    : `${N} has ${qty(m.circ)} ${m.sym} in circulation; ${esc(snap.source)} reports no maximum or total supply for ${m.sym}, so the supply float and the market cap/FDV ratio are not computed.`;
  return `<section class="page-section q-block" id="quant" aria-label="${N} quantitative telemetry">
<p class="q-regime"><span class="tag-badge">Regime</span> ${N} microstructure regime at ${TIME}: <strong>${R.label}</strong> (${R.rule})${also.length ? `; the snapshot also meets: ${also.join(", ")}` : ""}.</p>
<h2 id="q-liquidity">${h[0](N)}</h2>
<p class="prose">${N} trades at ${usd(m.price)} USD as of ${TIME}, with a market cap of ${big(m.mcap)} USD (rank #${m.rank}) and 24h spot volume of ${big(m.vol)} USD, a spot turnover velocity of ${pc(m.turnover)} (${m.turnClass}). ${lens[0](f)} Turnover as a share of capitalisation is a standard liquidity measure in market-microstructure research (Datar, Naik and Radcliffe, 1998, <cite>Journal of Financial Markets</cite>).</p>
${sparkline(m)}
${table(`${N} spot price, market cap and liquidity (${AS_OF_TEXT})`, ["Metric", "Value", "Unit"], [
    ["Spot price", usd(m.price), "USD"], ["24h change", pill(m.chg24), "%"], ["7d change", pill(m.chg7), "%"], ["Market cap", big(m.mcap), "USD"],
    ["24h volume", big(m.vol), "USD"], ["Spot turnover velocity", pc(m.turnover), "% of market cap"], ["Turnover classification", m.turnClass, "class"], ["Snapshot time", AS_OF_TEXT, "UTC"]])}
<h2 id="q-ath">${h[1](N)}</h2>
<p class="prose">${athLine} ${lens[1](f)}</p>
<h3 id="q-scenarios">${N} ATH recovery and capital scenario matrix</h3>
<p class="prose">The ${N} scenario matrix converts $100, $1,000 and $10,000 allocated at the ${usd(m.price)} USD spot price into their USD value at five reference prices: 25% below spot, spot, half the all-time high, the full all-time high${t ? ` and the price at which ${m.sym} would match the ${big(t.mcap)} USD market cap of ${esc(t.N)}` : ""}. The rows are arithmetic, not expectations; type an amount or move the slider to compute any position size.</p>
${matrix}
<h2 id="q-supply">${h[2](N)}</h2>
<p class="prose">${supplyLine} ${m.mcFdv == null ? "" : lens[2](f)}${ref ? ` On the supply schedule of ${esc(m.name)}: ${esc(ref.fact)} (source: ${esc(ref.source)}).` : ` Fully diluted valuation is taken as reported by ${esc(snap.source)}, which multiplies price by maximum supply, or total supply where no maximum is defined.`}</p>
${table(`${N} supply float and FDV overhang (${AS_OF_TEXT})`, ["Metric", "Value", "Unit"], [
    ["Circulating supply", qty(m.circ), m.sym], [`${m.basisKind === "maximum" ? "Maximum" : "Total"} supply`, qty(m.basis), m.sym], ["Supply float", pc(m.float), "% of supply"],
    ["Market cap", big(m.mcap), "USD"], ["Fully diluted valuation (FDV)", big(m.fdv), "USD"], ["Market cap / FDV", ratio(m.mcFdv), "ratio"],
    ["Not yet circulating", m.mcFdv == null ? "—" : pc((1 - m.mcFdv) * 100), "% of FDV"]])}
${parRows.length ? `<h3 id="q-parity">${N} market cap parity price versus ${m !== BTC ? "Bitcoin and Ethereum" : "Ethereum"}</h3>
<p class="prose">${N} would trade at ${usd(p0.price)} USD, ${mx(p0.mult)} its current price, if its market cap equalled the ${big(pT.mcap)} USD market cap of ${esc(pT.N)} with today's circulating supply. The FDV columns apply the same calculation to fully diluted valuations and full supply.</p>
${table(`${N} market cap and FDV parity prices (${AS_OF_TEXT})`, ["Parity target", "Price at market cap parity (USD)", "Multiplier (x)", "Price at FDV parity (USD)", "FDV multiplier (x)"], parRows)}` : ""}
<h2 id="q-alpha">${h[3](N)}</h2>
<p class="prose">${N} returned ${spc(m.chg24)} over 24 hours and ${spc(m.chg7)} over 7 days, ${m !== BTC ? `a spread of ${pp(m.alpha.btc24)} and ${pp(m.alpha.btc7)} against Bitcoin (BTC)` : `a spread of ${pp(m.alpha.eth24)} and ${pp(m.alpha.eth7)} against Ethereum (ETH)`}. ${lens[3](f)}</p>
${table(`${N} benchmark alpha spread in percentage points (${AS_OF_TEXT})`, ["Benchmark", "Benchmark 24h (%)", `${m.sym} alpha 24h (pp)`, "Benchmark 7d (%)", `${m.sym} alpha 7d (pp)`], [
    ...(m !== BTC ? [["Bitcoin (BTC)", spc(BTC.chg24), pp(m.alpha.btc24), spc(BTC.chg7), pp(m.alpha.btc7)]] : []),
    ...(m !== ETH ? [["Ethereum (ETH)", spc(ETH.chg24), pp(m.alpha.eth24), spc(ETH.chg7), pp(m.alpha.eth7)]] : []),
    [m.sector ? `<a href="${m.sector.path}">${esc(m.sector.name)} sector median</a> (${m.sector.members.length} assets)` : esc(m.benchName), spc(m.chg24 - m.alpha.sec24), pp(m.alpha.sec24), spc(m.chg7 - m.alpha.sec7), pp(m.alpha.sec7)]])}
<h2 id="q-volatility">${h[4](N)}</h2>
<p class="prose">${m.spread == null
    ? `${N} has no 24h high and low in the ${esc(snap.source)} fallback data used for this snapshot, so the intraday volatility spread is not computed.`
    : `${N} ranged between ${usd(m.low)} and ${usd(m.high)} USD over the last 24 hours, an intraday volatility spread of ${pc(m.spread)} of the low. ${lens[4](f)} The high-low range is a recognised volatility estimator (Parkinson, 1980, <cite>Journal of Business</cite>).`}</p>
${rangeBar(m)}
${table(`${N} intraday range and regime (${AS_OF_TEXT})`, ["Metric", "Value", "Unit"], [
    ["24h low", usd(m.low), "USD"], ["24h high", usd(m.high), "USD"], ["Intraday volatility spread", pc(m.spread), "% of low"],
    ["Regime classification", R.label, "regime"], ["Regime rule met", R.rule, "rule"]])}
<h2 id="q-method">${h[5](N)}</h2>
${methodology(N)}
${related.length || m.sector ? `<p class="prose q-related">More ${N} data: ${[...related, m.sector ? `<a href="${m.sector.path}">${esc(m.sector.name)} sector benchmarks</a>` : ""].filter(Boolean).join(" · ")}</p>` : ""}
</section>`;
}
const telemetryLine = m => `<p class="q-telemetry" id="q-telemetry"><strong>${esc(m.N)} market telemetry, ${TIME}:</strong> spot price ${usd(m.price)} USD · 24h change ${spc(m.chg24)} · market cap ${big(m.mcap)} USD · spot turnover velocity ${pc(m.turnover)} · ATH recovery multiplier ${mx(m.recovery)}. <a href="#quant">Quant telemetry ↓</a></p>`;

// ---------- write coin pages ----------
for (const m of top) {
  const file = `coin/${m.sym.toLowerCase()}/index.html`, url = SITE + m.path;
  let html = read(file);
  const img = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || ogImage("og-image.jpg");
  html = headExtras(html, img);
  html = sub(html, /(<h1 id="coin-h">[^<]*<\/h1><\/div>)/, h => `${h}\n        ${telemetryLine(m)}`, "coin h1");
  html = sub(html, /(\n\s*<section class="flash-box")/, h => `\n\n    ${coinSections(m)}\n${h}`, "flash-box");
  html = sub(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_, json) => {
    const graph = JSON.parse(json)["@graph"], page = graph.find(n => n["@type"] === "WebPage");
    page.primaryImageOfPage = imageNode(img);
    page.dateModified = lastmod.get(m.path);
    page.mainEntity = { "@id": url + "#dataset" };
    graph.push(datasetNode(url, `${m.N} quantitative market telemetry`,
      `${m.N} spot price, market cap, spot turnover velocity, all-time-high drawdown and recovery multiplier, supply float and FDV overhang, alpha versus Bitcoin, Ethereum and the sector median, intraday volatility spread and market cap parity prices, snapshot of ${AS_OF_TEXT}.`, variables(m)), rateNode(url, m));
    return ld(graph);
  }, "ld+json");
  write(file, html);
}

// ---------- shell for new pages (taken from a generated sector page so header, menu and footer stay in sync) ----------
const SHELL = read("sector/layer-1/index.html");
function page({ path, title, description, ogTitle, image, graph, main }) {
  if (title.length > 60 || description.length > 160) throw new Error(`Title or description too long for ${path}: ${title.length}/${description.length}`);
  let html = SHELL;
  html = sub(html, /<!-- Generated by [^>]*-->/, "<!-- Generated by scripts/build-seo-engine.mjs from the market snapshot — do not edit. -->", "generated comment");
  html = sub(html, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, "title");
  html = sub(html, /<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(description)}"`, "description");
  html = sub(html, /<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${SITE}${path}"`, "canonical");
  html = sub(html, /<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(ogTitle)}"`, "og:title");
  html = sub(html, /<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${esc(description)}"`, "og:description");
  html = sub(html, /<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${SITE}${path}"`, "og:url");
  html = sub(html, /<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${image}"`, "og:image");
  html = sub(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => ld(graph), "ld+json");
  html = sub(html, /<body data-page="sector">/, `<body data-page="quant">`, "body");
  html = sub(html, /(<main class="container" id="main">)[\s\S]*?(<\/main>)/, (_, a, b) => `${a}\n${main}\n  ${b}`, "main");
  write(path.slice(1) + "index.html", headExtras(html, image));
}
const crumbs = (items) => `<nav class="breadcrumb" aria-label="Breadcrumb">${items.map(([name, href]) => href ? `<a href="${href}">${esc(name)}</a>` : `<span aria-current="page">${esc(name)}</span>`).join(" › ")}</nav>`;
const crumbNode = (url, items) => ({ "@type": "BreadcrumbList", "@id": url + "#breadcrumb", itemListElement: items.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + (href || new URL(url).pathname) })) });
const pageNode = (url, title, description, image, path) => ({
  "@type": "WebPage", "@id": url, url, name: title, description, dateModified: lastmod.get(path), isPartOf: { "@id": `${SITE}/#website` },
  primaryImageOfPage: imageNode(image), breadcrumb: { "@id": url + "#breadcrumb" }, mainEntity: { "@id": url + "#dataset" }
});
const flipCalc = (a, b, id) => `<div class="q-calc" data-q-calc="flip" data-circ="${a.circ}" data-price="${a.price}" data-target="${b.mcap}">
<label for="${id}">${esc(a.N)} at <output data-q-pct>100</output>% of the ${esc(b.N)} market cap (${big(b.mcap)} USD)</label>
<input id="${id}" type="range" min="1" max="300" step="1" value="100" data-q-range />
<p class="q-result">Implied ${a.sym} price: <strong data-q-price>${usd(b.mcap / a.circ)}</strong> USD · multiple of spot: <strong data-q-mult>${mx(b.mcap / a.mcap)}</strong></p></div>`;

// ---------- comparison pages ----------
for (const p of pairs) {
  const { a, b, path } = p, url = SITE + path, A = esc(a.N), B = esc(b.N);
  const title = `${a.name} vs ${b.name}: Market Cap & Flippening`, ogTitle = `${a.name} (${a.sym}) vs ${b.name} (${b.sym}): quant comparison`;
  const description = `${a.name} (${a.sym}) vs ${b.name} (${b.sym}): market cap parity price, FDV, turnover velocity, ATH recovery multiple, supply float and alpha, with a calculator.`.slice(0, 160);
  const image = ogImage(`og/compare-${p.slug}.jpg`);
  const ab = parity(a, b), ba = parity(b, a);
  const lead24 = a.chg24 >= b.chg24 ? a : b;
  const row = (label, fn, unit) => [label, fn(a), fn(b), unit];
  const others = pairs.filter(q => q !== p && (q.a === a || q.b === a || q.a === b || q.b === b)).slice(0, 8);
  const main = `    ${crumbs([["Live crypto prices", "/"], [`${a.name} vs ${b.name}`]])}
    <section class="hero" aria-labelledby="cmp-h">
      <h1 id="cmp-h" class="hero-title">${esc(a.name)} (${a.sym}) vs ${esc(b.name)} (${b.sym}): market cap, FDV and flippening price</h1>
      <div class="q-telemetry" id="q-telemetry"><strong>${A} vs ${B} market telemetry, ${TIME}:</strong>
        <ul>${[a, b].map(m => `<li>${coinLink(m)}: spot price ${usd(m.price)} USD · 24h change ${spc(m.chg24)} · market cap ${big(m.mcap)} USD · spot turnover velocity ${pc(m.turnover)} · ATH recovery multiplier ${mx(m.recovery)}</li>`).join("")}</ul>
        ${A} at the ${b.sym} market cap: ${usd(ab.price)} USD (${mx(ab.mult)}).</div>
    </section>
    <section class="page-section q-block" id="quant">
<h2 id="q-liquidity">What are the ${A} and ${B} spot prices, market caps and turnover velocities?</h2>
<p class="prose">${A} trades at ${usd(a.price)} USD with a ${big(a.mcap)} USD market cap and a spot turnover velocity of ${pc(a.turnover)} (${a.turnClass}), while ${B} trades at ${usd(b.price)} USD with a ${big(b.mcap)} USD market cap and ${pc(b.turnover)} turnover (${b.turnClass}), as of ${TIME}. The ${a.sym} market cap is ${mx(a.mcap / b.mcap)} the ${b.sym} market cap. Turnover as a share of capitalisation is a standard liquidity measure (Datar, Naik and Radcliffe, 1998, <cite>Journal of Financial Markets</cite>).</p>
<div class="q-pair">${sparkline(a)}${sparkline(b)}</div>
${table(`${A} vs ${B} comparison matrix (${AS_OF_TEXT})`, ["Metric", A, B, "Unit"], [
    row("Spot price", m => usd(m.price), "USD"), row("Market cap rank", m => "#" + m.rank, "rank"), row("Market cap", m => big(m.mcap), "USD"),
    row("Fully diluted valuation", m => big(m.fdv), "USD"), row("24h volume", m => big(m.vol), "USD"), row("Spot turnover velocity", m => pc(m.turnover), "%"),
    row("ATH drawdown", m => pc(m.drawdown), "%"), row("ATH recovery multiplier", m => mx(m.recovery), "x"), row("Supply float", m => pc(m.float), "%"),
    row("Market cap / FDV", m => ratio(m.mcFdv), "ratio"), row("24h change", m => pill(m.chg24), "%"), row("7d change", m => pill(m.chg7), "%"),
    row("Intraday volatility spread", m => pc(m.spread), "%"), row("Regime", m => REGIMES[m.regime].label, "regime")])}
<h2 id="q-ath">How far are ${A} and ${B} from their all-time highs, and what multiples reclaim them?</h2>
<p class="prose">${A} trades ${pc(a.drawdown)} below its all-time high of ${usd(a.ath)} USD (${a.athDate}) and needs a ${mx(a.recovery)} move to reclaim it; ${B} trades ${pc(b.drawdown)} below its high of ${usd(b.ath)} USD (${b.athDate}) and needs ${mx(b.recovery)}. ${a.drawdown > b.drawdown ? A : B} carries the deeper drawdown by ${loc(Math.abs(a.drawdown - b.drawdown), 2, 2)} percentage points.</p>
${table(`${A} vs ${B} all-time-high drawdown (${AS_OF_TEXT})`, ["Metric", A, B, "Unit"], [
    row("All-time high", m => usd(m.ath), "USD"), row("ATH date", m => m.athDate, "UTC date"), row("ATH drawdown", m => pc(m.drawdown), "%"),
    row("Recovery multiplier", m => mx(m.recovery), "x"), row("Price at 0.5x ATH", m => usd(m.ath / 2), "USD")])}
<h2 id="q-supply">How do ${A} and ${B} compare on circulating supply float, tokenomics and FDV dilution?</h2>
<p class="prose">${A} has a supply float of ${pc(a.float)} and a market cap/FDV ratio of ${ratio(a.mcFdv)}; ${B} has a float of ${pc(b.float)} and a ratio of ${ratio(b.mcFdv)}, as of ${AS_OF_TEXT}.${[a, b].map(m => cfg.references[m.sym] ? ` For ${esc(m.name)}, ${esc(cfg.references[m.sym].fact)} (source: ${esc(cfg.references[m.sym].source)}).` : "").join("")}</p>
${table(`${A} vs ${B} supply and dilution (${AS_OF_TEXT})`, ["Metric", A, B, "Unit"], [
    row("Circulating supply", m => qty(m.circ), "tokens"), row("Maximum or total supply", m => qty(m.basis), "tokens"), row("Supply float", m => pc(m.float), "%"),
    row("Market cap / FDV", m => ratio(m.mcFdv), "ratio"), row("Not yet circulating", m => m.mcFdv == null ? "—" : pc((1 - m.mcFdv) * 100), "% of FDV")])}
<h3 id="q-flippening">${A} vs ${B} market cap flippening and FDV parity calculator</h3>
<p class="prose">${A} would trade at ${usd(ab.price)} USD, ${mx(ab.mult)} its current price, if it reached the ${big(b.mcap)} USD market cap of ${B}; ${B} would trade at ${usd(ba.price)} USD, ${mx(ba.mult)} its current price, at the ${big(a.mcap)} USD market cap of ${a.sym}. The table is static; the sliders recompute the implied price for any share of the other asset's market cap.</p>
${table(`${A} vs ${B} flippening and FDV parity matrix (${AS_OF_TEXT})`, ["Scenario", "Implied price (USD)", "Multiplier (x)"], [
    [`${a.sym} at the ${b.sym} market cap`, usd(ab.price), mx(ab.mult)], [`${a.sym} at the ${b.sym} FDV`, usd(ab.fdvPrice), mx(ab.fdvMult)],
    [`${b.sym} at the ${a.sym} market cap`, usd(ba.price), mx(ba.mult)], [`${b.sym} at the ${a.sym} FDV`, usd(ba.fdvPrice), mx(ba.fdvMult)],
    [`${a.sym} at 50% of the ${b.sym} market cap`, usd(ab.price / 2), mx(ab.mult / 2)], [`${b.sym} at 50% of the ${a.sym} market cap`, usd(ba.price / 2), mx(ba.mult / 2)]])}
${flipCalc(a, b, "qFlipA")}
${flipCalc(b, a, "qFlipB")}
<h2 id="q-alpha">Which performed better over 24h and 7d, ${A} or ${B}, relative to Bitcoin, Ethereum and sector medians?</h2>
<p class="prose">${A} returned ${spc(a.chg24)} over 24 hours and ${spc(a.chg7)} over 7 days against ${spc(b.chg24)} and ${spc(b.chg7)} for ${B}, a 24h spread of ${loc(Math.abs(a.chg24 - b.chg24), 2, 2)} percentage points in favour of ${esc(lead24.N)} and a 7d spread of ${pp(a.chg7 - b.chg7)} for ${a.sym} over ${b.sym}.</p>
${table(`${A} vs ${B} benchmark alpha spread (${AS_OF_TEXT})`, ["Metric", A, B, "Unit"], [
    row("24h change", m => spc(m.chg24), "%"), row("7d change", m => spc(m.chg7), "%"),
    row("24h alpha vs Bitcoin (BTC)", m => m === BTC ? "benchmark" : pp(m.alpha.btc24), "pp"), row("7d alpha vs Bitcoin (BTC)", m => m === BTC ? "benchmark" : pp(m.alpha.btc7), "pp"),
    row("24h alpha vs Ethereum (ETH)", m => m === ETH ? "benchmark" : pp(m.alpha.eth24), "pp"), row("7d alpha vs Ethereum (ETH)", m => m === ETH ? "benchmark" : pp(m.alpha.eth7), "pp"),
    row("Sector benchmark", m => esc(m.benchName), "name"), row("24h alpha vs sector median", m => pp(m.alpha.sec24), "pp"), row("7d alpha vs sector median", m => pp(m.alpha.sec7), "pp")])}
<h2 id="q-volatility">How do the ${A} and ${B} intraday volatility spreads and orderbook regimes compare?</h2>
<p class="prose">${A} has a 24h high-low spread of ${pc(a.spread)} and is classified as ${REGIMES[a.regime].label}; ${B} has a spread of ${pc(b.spread)} and is classified as ${REGIMES[b.regime].label}, as of ${AS_OF_TEXT}. The high-low range is a recognised volatility estimator (Parkinson, 1980, <cite>Journal of Business</cite>).</p>
<div class="q-pair">${rangeBar(a)}${rangeBar(b)}</div>
${table(`${A} vs ${B} intraday range and regime (${AS_OF_TEXT})`, ["Metric", A, B, "Unit"], [
    row("24h low", m => usd(m.low), "USD"), row("24h high", m => usd(m.high), "USD"), row("Intraday volatility spread", m => pc(m.spread), "%"),
    row("Regime", m => REGIMES[m.regime].label, "regime"), row("Regime rule met", m => REGIMES[m.regime].rule, "rule")])}
<h2 id="q-method">How are the ${A} and ${B} comparison metrics calculated, and is this financial advice?</h2>
${methodology(`${A} and ${B}`)}
<p class="prose q-related">Live prices: ${coinLink(a)} · ${coinLink(b)}${others.length ? ` · Related comparisons: ${others.map(q => `<a href="${q.path}">${esc(q.a.name)} vs ${esc(q.b.name)}</a>`).join(" · ")}` : ""}</p>
    </section>`;
  page({
    path, title, description, ogTitle, image, main,
    graph: [pageNode(url, title, description, image, path), crumbNode(url, [["Live crypto prices", "/"], [`${a.name} vs ${b.name}`]]),
      datasetNode(url, `${a.N} vs ${b.N} quantitative comparison`,
        `Side-by-side market data for ${a.N} and ${b.N}: spot price, market cap, FDV, spot turnover velocity, all-time-high drawdown and recovery multiplier, supply float, alpha versus benchmarks, intraday volatility spread and market cap parity (flippening) prices, snapshot of ${AS_OF_TEXT}.`,
        [pv(`${a.sym} at ${b.sym} market cap: price`, ab.price, "USD"), pv(`${a.sym} at ${b.sym} market cap: multiplier`, ab.mult, "x"), ...variables(a).slice(0, 5).map(v => ({ ...v, name: `${a.sym} ${v.name}` })), ...variables(b).slice(0, 5).map(v => ({ ...v, name: `${b.sym} ${v.name}` }))]),
      rateNode(url, a), rateNode(url, b)]
  });
}

// ---------- sector hubs ----------
for (const s of sectors) {
  const url = SITE + s.path, S = esc(s.name), L = s.leader, LN = esc(L.N), n = s.members.length;
  const title = `${s.name} Crypto Sector: Quant Benchmarks`, ogTitle = `${s.name} crypto sector: median benchmarks`;
  const description = `${s.name} crypto sector benchmarks: median turnover velocity, ATH drawdown, supply float, FDV overhang, alpha vs Bitcoin and volatility across ${n} assets.`.slice(0, 160);
  const image = ogImage(`og/category-${s.slug}.jpg`);
  const cell = m => `<a href="${m.path}">${esc(m.name)}</a> <span class="muted">${m.sym}</span>`;
  const rows = fn => s.members.map(m => [cell(m), ...fn(m)]);
  const medRow = cells => [[`<strong>${S} sector median</strong>`, ...cells]];
  const tallyText = Object.entries(s.tally).sort((x, y) => y[1] - x[1]).map(([k, c]) => `${c} in ${REGIMES[k].label}`).join(", ");
  const cmp = pairs.filter(p => s.members.includes(p.a) && s.members.includes(p.b));
  const main = `    ${crumbs([["Live crypto prices", "/"], [`${s.name} sector benchmarks`]])}
    <section class="hero" aria-labelledby="cat-h">
      <h1 id="cat-h" class="hero-title">${S} crypto sector: quantitative benchmarks and medians</h1>
      <div class="q-telemetry" id="q-telemetry"><strong>${S} sector telemetry, ${TIME}:</strong> ${n} assets led by ${LN} at ${usd(L.price)} USD (24h ${spc(L.chg24)}) · sector market cap ${big(s.mcap)} USD · median spot turnover velocity ${pc(s.med.turnover)} · median ATH recovery multiplier ${mx(s.med.recovery)} · median 24h change ${spc(s.med.chg24)}.</div>
      <p class="hero-sub">The ${S} sector groups ${esc(s.about)}. Medians are used because one large asset (${LN} is ${pc(L.mcap / s.mcap * 100)} of the sector's market cap) would dominate an average.${s.legacy ? ` Live prices for this sector: <a href="/sector/${s.legacy}/">${S} live prices</a>.` : ""}</p>
    </section>
    <section class="page-section q-block" id="quant">
<h2 id="q-liquidity">What are the ${S} sector's market cap, spot prices and median liquidity turnover velocity?</h2>
<p class="prose">The ${S} sector, led by ${LN}, has a combined market cap of ${big(s.mcap)} USD and 24h spot volume of ${big(s.vol)} USD across ${n} tracked assets as of ${TIME}, with a median spot turnover velocity of ${pc(s.med.turnover)} (${turnoverClass(s.med.turnover)}). Turnover as a share of capitalisation is a standard liquidity measure (Datar, Naik and Radcliffe, 1998, <cite>Journal of Financial Markets</cite>).</p>
${sparkline(L)}
${table(`${S} sector: spot price, market cap and turnover velocity (${AS_OF_TEXT})`, ["Asset", "Price (USD)", "Market cap (USD)", "24h volume (USD)", "Turnover velocity (%)"],
    [...medRow(["—", "—", "—", pc(s.med.turnover)]), ...rows(m => [usd(m.price), big(m.mcap), big(m.vol), pc(m.turnover)])])}
<h2 id="q-ath">How deep is the median all-time-high drawdown in the ${S} sector, and what recovery multiplier does it imply?</h2>
<p class="prose">The median ${S} asset trades ${pc(s.med.drawdown)} below its all-time high and needs a ${mx(s.med.recovery)} move to reclaim it, compared with ${pc(L.drawdown)} and ${mx(L.recovery)} for sector leader ${LN}, as of ${AS_OF_TEXT}. ${s.members.filter(m => m.drawdown > 60).length} of the ${n} assets are more than 60% below their highs.</p>
${table(`${S} sector: ATH drawdown and recovery multiplier (${AS_OF_TEXT})`, ["Asset", "All-time high (USD)", "ATH drawdown (%)", "Recovery multiplier (x)"],
    [...medRow(["—", pc(s.med.drawdown), mx(s.med.recovery)]), ...rows(m => [usd(m.ath), pc(m.drawdown), mx(m.recovery)])])}
<h2 id="q-supply">What are the median circulating supply float and FDV dilution risk in the ${S} sector?</h2>
<p class="prose">The median ${S} asset has ${pc(s.med.float)} of its supply circulating and a market cap/FDV ratio of ${ratio(s.med.mcFdv)}, against ${pc(L.float)} and ${ratio(L.mcFdv)} for ${LN}, as of ${AS_OF_TEXT}. ${s.members.filter(m => m.mcFdv != null && m.mcFdv < 0.55).length} of the ${n} assets fall below the 0.55 ratio that marks an elevated FDV supply overhang.${cfg.references[L.sym] ? ` For ${esc(L.name)}, ${esc(cfg.references[L.sym].fact)} (source: ${esc(cfg.references[L.sym].source)}).` : ""}</p>
${table(`${S} sector: supply float and FDV overhang (${AS_OF_TEXT})`, ["Asset", "Supply float (%)", "Market cap / FDV (ratio)", "FDV (USD)", `Multiplier to ${L.sym} market cap (x)`],
    [...medRow([pc(s.med.float), ratio(s.med.mcFdv), "—", "—"]), ...rows(m => [pc(m.float), ratio(m.mcFdv), big(m.fdv), m === L ? "leader" : mx(L.mcap / m.mcap)])])}
<h2 id="q-alpha">How did the ${S} sector median perform over 24h and 7d against Bitcoin and Ethereum?</h2>
<p class="prose">The ${S} sector median, with ${LN} as its largest asset, returned ${spc(s.med.chg24)} over 24 hours and ${spc(s.med.chg7)} over 7 days, a spread of ${pp(s.med.chg24 - BTC.chg24)} and ${pp(s.med.chg7 - BTC.chg7)} against Bitcoin (BTC) and ${pp(s.med.chg24 - ETH.chg24)} and ${pp(s.med.chg7 - ETH.chg7)} against Ethereum (ETH), as of ${AS_OF_TEXT}.</p>
${table(`${S} sector: 24h and 7d alpha versus the sector median (${AS_OF_TEXT})`, ["Asset", "24h change (%)", "24h alpha vs sector median (pp)", "7d change (%)", "7d alpha vs sector median (pp)"],
    [...medRow([spc(s.med.chg24), "+0.00 pp", spc(s.med.chg7), "+0.00 pp"]), ...rows(m => [pill(m.chg24), pp(m.chg24 - s.med.chg24), pill(m.chg7), pp(m.chg7 - s.med.chg7)])])}
<h2 id="q-volatility">How wide is the median intraday volatility spread in the ${S} sector, and which orderbook regimes dominate?</h2>
<p class="prose">The median ${S} asset has a 24h high-low spread of ${pc(s.med.spread)}, against ${pc(L.spread)} for ${LN}, and the ${n} assets are distributed across regimes as follows: ${tallyText}, as of ${AS_OF_TEXT}. The high-low range is a recognised volatility estimator (Parkinson, 1980, <cite>Journal of Business</cite>).</p>
${rangeBar(L)}
${table(`${S} sector: intraday volatility spread and regime (${AS_OF_TEXT})`, ["Asset", "Intraday spread (%)", "Regime"],
    [...medRow([pc(s.med.spread), "—"]), ...rows(m => [pc(m.spread), REGIMES[m.regime].label])])}
<h2 id="q-method">How are the ${S} sector medians calculated, and is this financial advice?</h2>
${methodology(`${S} sector and ${LN}`, ` A sector median is the middle value of a metric across the ${n} member assets, each computed as below.`)}
<p class="prose q-related">Other sector benchmarks: ${sectors.filter(x => x !== s).map(x => `<a href="${x.path}">${esc(x.name)}</a>`).join(" · ")}${cmp.length ? ` · Comparisons in this sector: ${cmp.map(q => `<a href="${q.path}">${esc(q.a.name)} vs ${esc(q.b.name)}</a>`).join(" · ")}` : ""}</p>
    </section>`;
  page({
    path: s.path, title, description, ogTitle, image, main,
    graph: [pageNode(url, title, description, image, s.path), crumbNode(url, [["Live crypto prices", "/"], [`${s.name} sector benchmarks`]]),
      datasetNode(url, `${s.name} crypto sector quantitative benchmarks`,
        `Median spot turnover velocity, all-time-high drawdown, recovery multiplier, supply float, market cap/FDV ratio, 24h and 7d returns and intraday volatility spread across ${n} ${s.name} assets led by ${L.N}, snapshot of ${AS_OF_TEXT}.`,
        [pv("Median spot turnover velocity", s.med.turnover, "%"), pv("Median ATH drawdown", s.med.drawdown, "%"), pv("Median ATH recovery multiplier", s.med.recovery, "x"),
          pv("Median supply float", s.med.float, "%"), pv("Median market cap / FDV ratio", s.med.mcFdv, "ratio"), pv("Median 24h change", s.med.chg24, "%"),
          pv("Median 7d change", s.med.chg7, "%"), pv("Median intraday volatility spread", s.med.spread, "%")]),
      rateNode(url, L)]
  });
}

// ---------- open data ----------
const r4 = v => v == null ? null : Number(v.toPrecision(8));
const records = top.map(m => {
  const pb = m !== BTC ? parity(m, BTC) : null, pe = m !== ETH ? parity(m, ETH) : null;
  return {
    slug: m.slug, symbol: m.sym, name: m.name, rank: m.rank, url: SITE + m.path, sector: m.sector ? m.sector.slug : null,
    price_usd: m.price, change_24h_pct: r4(m.chg24), change_7d_pct: r4(m.chg7), market_cap_usd: m.mcap, fdv_usd: r4(m.fdv), volume_24h_usd: m.vol,
    turnover_velocity_pct: r4(m.turnover), turnover_class: m.turnClass,
    ath_usd: m.ath, ath_date: m.athDate, ath_drawdown_pct: r4(m.drawdown), ath_recovery_multiplier: r4(m.recovery),
    supply_float_pct: r4(m.float), mcap_fdv_ratio: r4(m.mcFdv),
    alpha_24h_vs_btc_pp: r4(m.alpha.btc24), alpha_7d_vs_btc_pp: r4(m.alpha.btc7), alpha_24h_vs_eth_pp: r4(m.alpha.eth24), alpha_7d_vs_eth_pp: r4(m.alpha.eth7),
    alpha_24h_vs_sector_pp: r4(m.alpha.sec24), alpha_7d_vs_sector_pp: r4(m.alpha.sec7),
    intraday_spread_pct: r4(m.spread),
    btc_parity_price_usd: pb && r4(pb.price), btc_parity_multiplier: pb && r4(pb.mult), eth_parity_price_usd: pe && r4(pe.price), eth_parity_multiplier: pe && r4(pe.mult),
    regime: REGIMES[m.regime].label
  };
});
write("api/v1/quant-snapshot.json", JSON.stringify({
  name: "CryptoPriceTicker.com open quant dataset", schema_version: 1, generated_at_utc: AS_OF, market_data_source: snap.source,
  documentation: `${SITE}/coin/btc/#q-method`, notice: "Informational market data, not financial advice. Attribution: CryptoPriceTicker.com.",
  count: records.length, assets: records
}, null, 1) + "\n");
const cols = Object.keys(records[0]);
const csvCell = v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
write("data/crypto-quant-snapshot.csv", ["snapshot_utc," + cols.join(","), ...records.map(r => AS_OF + "," + cols.map(c => csvCell(r[c])).join(","))].join("\n") + "\n");

// ---------- footer on every page, home Dataset, widget docs ----------
const FOOT = `<span class="q-open">Download Open Quant Dataset: <a class="no-prerender" href="/api/v1/quant-snapshot.json">JSON</a> | <a class="no-prerender" href="/data/crypto-quant-snapshot.csv">CSV</a> (top ${top.length} assets, 6 derived metrics, snapshot ${AS_OF_TEXT}) · Sector benchmarks: ${sectors.map(s => `<a href="${s.path}">${esc(s.name)}</a>`).join(" · ")}</span>`;
const htmlFiles = [];
(function walk(d) { for (const f of readdirSync(DIST + d)) { const p = d + f; if (statSync(DIST + p).isDirectory()) walk(p + "/"); else if (f.endsWith(".html")) htmlFiles.push(p); } })("");
for (const f of htmlFiles) {
  let html = read(f);
  if (!/<footer class="container site-footer"/.test(html)) continue;
  html = html.replace(/(<footer class="container site-footer"[^>]*>[\s\S]*?)(\n?\s*<\/footer>)/, (_, a, b) => `${a}\n    ${FOOT}${b}`);
  if (!html.includes(QCSS)) html = html.replace(/(<link rel="stylesheet" href="\/assets\/app\.css[^>]*>)/, m => `${m}\n  <link rel="stylesheet" href="${QCSS}" />`);
  if (f === "index.html") {
    html = sub(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_, json) => {
      const graph = JSON.parse(json)["@graph"];
      graph.push(datasetNode(SITE + "/", "CryptoPriceTicker.com open quant dataset",
        `Open quant dataset for the top ${top.length} crypto assets with 6 derived metrics per asset: spot turnover velocity, all-time-high drawdown and recovery multiplier, supply float and FDV overhang, benchmark alpha spread, intraday volatility spread and market cap parity prices. Snapshot ${AS_OF_TEXT}, free JSON and CSV downloads.`,
        ["Spot turnover velocity (%)", "ATH drawdown (%) and recovery multiplier (x)", "Supply float (%) and market cap / FDV ratio", "Benchmark alpha spread (percentage points)", "Intraday volatility spread (%)", "Market cap parity price (USD) and multiplier (x)"]));
      return ld(graph);
    }, "home ld+json");
    html = sub(html, /(<meta name="twitter:card"[^>]*>)/, m => `${m}\n  <link rel="alternate" type="application/json" href="/api/v1/quant-snapshot.json" title="Open quant dataset (JSON)" />`, "home twitter:card");
  }
  if (f === "widgets/index.html") {
    const demo = top[0];
    html = sub(html, /(\n\s*<\/main>)/, end => `
    <section class="page-section" aria-labelledby="qw-h">
      <h2 id="qw-h">Quant snapshot widget (script embed)</h2>
      <p class="prose">A dependency-free script under 4 KB that shows an asset's price, spot turnover velocity and ATH recovery multiplier from the open quant dataset, refreshed with every snapshot. Use any ticker from the dataset in <code>data-coin</code>; <code>data-theme="light"</code> switches to a light card.</p>
      <pre class="q-code"><code>&lt;div class="cpt-quant" data-coin="${demo.sym}"&gt;&lt;/div&gt;
&lt;script async src="${SITE}/widget.js"&gt;&lt;/script&gt;</code></pre>
      <div class="cpt-quant" data-coin="${demo.sym}"></div>
      <script async src="/widget.js"></script>
      <p class="disclaimer">The widget's only link is the credit "Data via CryptoPriceTicker.com", pointing at the asset's page.</p>
    </section>${end}`, "widgets main");
  }
  write(f, html);
}

// ---------- sitemap, headers, redirects ----------
const stamp = (xml, path, date) => xml.replace(new RegExp(`(<loc>${SITE}${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc><lastmod>)([^<]+)`), (_, pre, old) => pre + (date.slice(0, 10) >= old ? date : old));
const urlLine = path => `  <url><loc>${SITE}${path}</loc><lastmod>${lastmod.get(path)}</lastmod></url>`;
const quantUrls = [...sectors.map(s => s.path), ...pairs.map(p => p.path)];
for (const f of ["sitemap.xml", "sitemap-coins.xml"]) {
  let xml = read(f);
  top.forEach(m => { xml = stamp(xml, m.path, lastmod.get(m.path)); });
  if (f === "sitemap.xml") xml = sub(xml, /<\/urlset>/, quantUrls.map(urlLine).join("\n") + "\n</urlset>", "urlset");
  write(f, xml);
}
write("sitemap-quant.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${quantUrls.map(urlLine).join("\n")}\n</urlset>\n`);
write("robots.txt", read("robots.txt").replace(/\n*$/, `\nSitemap: ${SITE}/sitemap-quant.xml\n`));

write("llms.txt", read("llms.txt").replace(/\n*$/, `

## Quant data (snapshot every 2 hours, static HTML)
- [Open quant dataset, JSON](${SITE}/api/v1/quant-snapshot.json) and [CSV](${SITE}/data/crypto-quant-snapshot.csv): top ${top.length} assets with spot turnover velocity, ATH drawdown and recovery multiplier, supply float and market cap/FDV, alpha vs Bitcoin, Ethereum and sector median, intraday volatility spread, market cap parity prices. CORS enabled; attribution: CryptoPriceTicker.com
- Sector benchmarks (medians): ${sectors.map(s => `[${s.name}](${SITE}${s.path})`).join(", ")}
- Comparisons with market cap parity ("flippening") prices: ${pairs.map(p => `[${p.a.name} vs ${p.b.name}](${SITE}${p.path})`).join(", ")}
- The coin pages of the top ${top.length} assets carry the same metrics with a scenario matrix, for example [Bitcoin](${SITE}/coin/btc/#quant). Figures are descriptive market data, not advice.
`));

const appCss = (SHELL.match(/href="(\/assets\/app\.css[^"]*)"/) || [])[1];
write("_headers", read("_headers").replace(/\n*$/, "\n\n") + readFileSync(PUBLIC + "_headers", "utf8").replaceAll("{{APP_CSS}}", appCss).replaceAll("{{QUANT_CSS}}", QCSS));
const reverse = pairs.flatMap(p => { const r = `/compare/${p.b.slug}-vs-${p.a.slug}`; return [`${r} ${p.path} 301`, `${r}/ ${p.path} 301`]; });
write("_redirects", read("_redirects").replace(/\n*$/, "\n") + readFileSync(PUBLIC + "_redirects", "utf8").replace(/\n*$/, "\n") +
  "# Generated by scripts/build-seo-engine.mjs: reversed comparison names.\n" + reverse.join("\n") + "\n");

mkdirSync(ROOT + "data", { recursive: true });
writeFileSync(LEDGER_PATH, `{"_readme":"Sitemap lastmod state for scripts/build-seo-engine.mjs: a URL's lastmod moves only on a 3% price move, a rank change or a regime change.","urls":{\n` +
  Object.keys(ledger.urls).sort().map(k => `${JSON.stringify(k)}:${JSON.stringify(ledger.urls[k])}`).join(",\n") + "\n}}\n");
writeFileSync(ROOT + "data/changed-urls.json", JSON.stringify({ generatedAt: AS_OF, urls: changed.map(p => SITE + p) }, null, 1) + "\n");

const tally = {};
top.forEach(m => { tally[m.regime] = (tally[m.regime] || 0) + 1; });
console.log(`Built dist/: ${top.length} coin pages with quant sections, ${pairs.length} comparisons, ${sectors.length} sector hubs, ${htmlFiles.length + 0} HTML files`);
console.log(`Snapshot ${AS_OF_TEXT} via ${snap.source} (tier ${snap.tier}); regimes: ${Object.entries(tally).map(([k, c]) => `${k} ${c}`).join(", ")}`);
console.log(`lastmod changed for ${changed.length} of ${seen.size} tracked URLs (data/changed-urls.json)`);
