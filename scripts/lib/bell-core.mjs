// Bell Brief core: the NYSE calendar, which edition is due, the sources, the fixed scoring rule and the edition
// itself. Shared by scripts/build-bell.mjs (GitHub Actions, writes content/bell.json) and scripts/bell-worker/
// (Cloudflare cron Worker, writes the same JSON to KV). No Node or Workers APIs here: only fetch and Intl.
//
// Sources are U.S. federal agencies' press releases and statistical releases (public domain, 17 U.S.C. § 105):
// Federal Reserve Board, Bureau of Labor Statistics (CPI, jobs, PPI), Bureau of Economic Analysis, SEC, CFTC.
// Third-party headlines need a licence (DECISIONS 2026-11-08), so none are used. No AI text: titles are the
// agencies' own; the score is a fixed rule (below); the BTC move is measured on Coinbase from release to cutoff.

const UA = "CryptoPriceTicker.com bell-brief/1.0 (+https://cryptopriceticker.com/about/)";

// ---------- NYSE calendar (https://www.nyse.com/markets/hours-calendars, read 19 Nov 2026) ----------
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]); // 1:00 pm ET
export const CALENDAR_END = "2027-12-31";

const TZ = "America/New_York";
export const etParts = d => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
  .formatToParts(d).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
export const etDate = d => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
// The UTC instant of hh:mm New York time on an ET calendar date (handles daylight saving).
function etToUtc(date, hh, mm) {
  const [y, m, d] = date.split("-").map(Number);
  let t = Date.UTC(y, m - 1, d, hh, mm);
  for (let k = 0; k < 2; k++) { const p = etParts(new Date(t)); t += (hh * 60 + mm - (+p.hour * 60 + +p.minute)) * 60e3 + (Date.UTC(y, m - 1, d) - Date.UTC(+p.year, +p.month - 1, +p.day)); }
  return new Date(t);
}
const addDays = (date, n) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const isTradingDay = date => { const wd = new Date(date + "T12:00:00Z").getUTCDay(); return wd !== 0 && wd !== 6 && !HOLIDAYS.has(date); };
const closeHour = date => (EARLY_CLOSE.has(date) ? 13 : 16);
export const cutoffOf = (date, edition) => (edition === "open" ? etToUtc(date, 9, 25) : etToUtc(date, closeHour(date), 5));
const prevTradingDay = date => { let d = addDays(date, -1); while (!isTradingDay(d)) d = addDays(d, -1); return d; };
// The next n bells (editions) after `from`, for the page's countdown.
function upcoming(from, n) {
  const out = []; let d = etDate(from);
  for (let i = 0; out.length < n && i < 30; i++, d = addDays(d, 1)) {
    if (!isTradingDay(d)) continue;
    for (const e of ["open", "close"]) { const t = cutoffOf(d, e); if (t > from) out.push({ edition: e, date: d, at: t.toISOString(), early: e === "close" && EARLY_CLOSE.has(d) }); }
  }
  return out.slice(0, n);
}

// ---------- Which edition is due ----------
// `previous` is the last published JSON (or null); `edition` forces "open" or "close" for the latest trading day.
export function dueEdition(at, previous, edition = null) {
  const published = new Set((previous?.editions || []).map(e => e.id));
  const today = etDate(at);
  if (edition) { let d = today; while (!isTradingDay(d) || cutoffOf(d, edition) > at) d = prevTradingDay(d); return { date: d, edition }; }
  if (!isTradingDay(today)) return null;
  for (const e of ["close", "open"]) {
    const cut = cutoffOf(today, e), id = `${today}-${e}`;
    // Early runs wait for the cutoff (up to 20 minutes); late runs publish up to 4 hours after it.
    if (at >= new Date(cut - 20 * 60e3) && at < new Date(+cut + 4 * 3600e3) && !published.has(id) && !(e === "open" && published.has(`${today}-close`))) return { date: today, edition: e };
  }
  return null;
}

// ---------- Sources ----------
const FEEDS = [
  { id: "fed", name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { id: "bls-cpi", name: "Bureau of Labor Statistics", url: "https://www.bls.gov/feed/cpi.rss", topic: "Consumer prices (CPI)" },
  { id: "bls-jobs", name: "Bureau of Labor Statistics", url: "https://www.bls.gov/feed/empsit.rss", topic: "Jobs report" },
  { id: "bls-ppi", name: "Bureau of Labor Statistics", url: "https://www.bls.gov/feed/ppi.rss", topic: "Producer prices (PPI)" },
  { id: "bea", name: "Bureau of Economic Analysis", url: "https://apps.bea.gov/rss/rss.xml" },
  { id: "sec", name: "SEC", url: "https://www.sec.gov/news/pressreleases.rss" },
  { id: "cftc", name: "CFTC", url: "https://www.cftc.gov/RSS/RSSGP/rssgp.xml" },
];
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tag = (item, t) => { const m = item.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ""; };
// "EST"/"EDT" aren't reliably parsed; replace them with offsets.
const parseDate = s => { const v = Date.parse(s.replace(/\bEDT\b/, "-0400").replace(/\bEST\b/, "-0500")); return isNaN(v) ? null : new Date(v); };

async function fetchText(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.text();
      if (res.status < 500) throw new Error(`HTTP ${res.status}`);
    } catch (e) { if (attempt) throw e; }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("no response");
}

const CRYPTO = /\b(crypto|bitcoin|digital asset|stablecoin|blockchain|tokeni[sz]|ether(eum)?|defi|virtual currenc)/i;
// Enforcement actions (charges, suits, settlements, judgments, bars): only crypto-related ones can fill a slot.
const ENFORCEMENT = /\b(charg(es|ed)|sues|sued|settles?|settlement|judgment|obtains|bars?|barred|fraud|scheme|ponzi|indict|sentenc|penalt)/i;
const MACRO = /\b(federal funds|fomc|federal open market|interest rate|monetary policy|inflation)\b/i;
// Fixed scoring rule, highest first; the page explains it (keep the "How the Bell Brief is chosen" text in
// scripts/lib/bell-html.mjs in step). `base` is the release's own weight; releases under MIN_BASE never fill a
// slot, so a quiet session shows fewer than three items rather than padding:
//   10 Fed monetary policy · 9 CPI, jobs report · 8 GDP, PCE/personal income · 7 PPI, crypto-related SEC action ·
//   6 crypto/prediction-market/24-7 CFTC action · 5 SEC ETF news · 4 Fed banking regulation, trade data ·
//   below the bar: other SEC/CFTC/Fed releases, routine statistics, enforcement not involving crypto, bank applications.
const MIN_BASE = 4;
function baseOf(it) {
  const t = it.title;
  let base;
  if (it.feed === "fed") base = /Monetary Policy/i.test(it.topic) || MACRO.test(t) ? 10 : /\bapplications?\b|\bapproval\b/i.test(t) || /Enforcement/i.test(it.topic) ? 1 : /Banking|Regulat|Supervis/i.test(it.topic) ? 4 : 3;
  else if (it.feed === "bls-cpi" || it.feed === "bls-jobs") base = 9;
  else if (it.feed === "bls-ppi") base = 7;
  else if (it.feed === "bea") base = /gross domestic product|\bGDP\b|personal income|outlays|\bPCE\b/i.test(t) ? 8 : /trade/i.test(t) ? 4 : 2;
  else if (it.feed === "sec") base = CRYPTO.test(t) ? 7 : ENFORCEMENT.test(t) ? 1 : /exchange-traded|\bETF\b/i.test(t) ? 5 : 3;
  else base = CRYPTO.test(t) || /prediction|event contract|24\/7/i.test(t) ? 6 : ENFORCEMENT.test(t) ? 1 : 3; // CFTC
  return base;
}

// A release links only to its own agency's site: the feed's domain or a subdomain of it (www.bea.gov for apps.bea.gov),
// over https. A feed that was tampered with or misconfigured can't put a link to anywhere else on the home page.
function onAgencySite(link, feedUrl) {
  try {
    const u = new URL(link), domain = new URL(feedUrl).hostname.split(".").slice(-2).join(".");
    return u.protocol === "https:" && !u.username && !u.password && (u.hostname === domain || u.hostname.endsWith("." + domain));
  } catch { return false; }
}
// Coinbase candle values are written into the page (data-btc): accept only finite positive numbers.
const price = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

// Builds the edition for `job` ({ date, edition }) at time `now`. `log` receives warnings. Throws when too many
// sources failed or nothing was parsed, so the previous edition stays.
export async function buildEdition(job, now, log = () => {}) {
  const cutoff = cutoffOf(job.date, job.edition);
  const windowStart = job.edition === "open" ? cutoffOf(prevTradingDay(job.date), "close") : cutoffOf(job.date, "open");
  const score = it => {
    const t = it.title, base = baseOf(it);
    const crypto = CRYPTO.test(t) && it.feed !== "sec" && it.feed !== "cftc" ? 2 : 0; // SEC/CFTC already weigh crypto
    const inWindow = it.published > windowStart ? 3 : 0;
    const age = (cutoff - it.published) / 36e5;
    return Math.round((base + crypto + inWindow - age / 24) * 10) / 10;
  };

  const items = [], failures = [];
  await Promise.all(FEEDS.map(async f => {
    try {
      const xml = await fetchText(f.url);
      let n = 0;
      // RSS <item> (Fed, BEA, SEC, CFTC) or Atom <entry> (BLS: <updated>, <link href="…">).
      for (const raw of xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/g) || []) {
        const title = tag(raw, "title");
        const link = tag(raw, "link") || decode((raw.match(/<link\b[^>]*\bhref="([^"]+)"/) || [])[1] || "");
        const published = parseDate(tag(raw, "pubDate") || tag(raw, "dc:date") || tag(raw, "published") || tag(raw, "updated"));
        if (!title || !published || !onAgencySite(link, f.url)) continue;
        items.push({ feed: f.id, source: f.name, topic: f.topic || tag(raw, "category") || "", title, link, published });
        n++;
      }
      if (!n) throw new Error("no items parsed");
    } catch (e) { failures.push(`${f.name} (${f.id}): ${e.message}`); }
  }));
  if (failures.length) log(`bell: feeds that failed: ${failures.join("; ")}`);
  if (failures.length > 3) throw new Error("too many sources failed; keeping the previous edition");

  const pool = items.filter(it => it.published <= cutoff && it.published > new Date(cutoff - 4 * 864e5));
  const seen = new Set();
  const ranked = pool.filter(it => baseOf(it) >= MIN_BASE).map(it => ({ ...it, score: score(it) })).sort((a, b) => b.score - a.score || b.published - a.published)
    .filter(it => !seen.has(it.link) && seen.add(it.link)).slice(0, 3);
  if (!items.length) throw new Error("no releases parsed from any source; keeping the previous edition");

  // ---------- BTC from each release to the cutoff (Coinbase BTC-USD candles) ----------
  // One-minute candles at both ends: the open of the minute the release came out, and the close of the minute that
  // ends at the cutoff (the price at the bell). Coinbase keys candles by their start time.
  async function minute(t) {
    const start = new Date(Math.floor(t / 60e3) * 60e3 - 4 * 60e3), end = new Date(Math.floor(t / 60e3) * 60e3 + 60e3);
    const rows = JSON.parse(await fetchText(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start=${start.toISOString()}&end=${end.toISOString()}`));
    return Array.isArray(rows) ? rows : []; // [time, low, high, open, close, volume], newest first
  }
  async function priceAtOpenOf(t) { // open of the minute containing t (or the nearest earlier traded minute)
    const m = Math.floor(t / 60e3) * 60, row = (await minute(t)).find(r => r[0] <= m);
    return row ? price(row[0] === m ? row[3] : row[4]) : null;
  }
  async function priceAt(t) { // close of the minute ending at t
    const m = Math.floor(t / 60e3) * 60 - 60, row = (await minute(t - 60e3)).find(r => r[0] <= m);
    return row ? price(row[4]) : null;
  }
  let btcAtCutoff = null;
  try { btcAtCutoff = await priceAt(+cutoff); } catch (e) { log(`bell: BTC at the cutoff unavailable (${e.message})`); }
  for (const it of ranked) {
    try {
      const p0 = btcAtCutoff ? await priceAtOpenOf(+it.published) : null;
      if (p0) it.btcChange = Math.round(((btcAtCutoff - p0) / p0) * 10000) / 100;
    } catch (e) { log(`bell: BTC at "${it.title.slice(0, 40)}…" unavailable (${e.message})`); }
  }

  return {
    id: `${job.date}-${job.edition}`, edition: job.edition, date: job.date, cutoff: cutoff.toISOString(), generated: now.toISOString(),
    windowStart: windowStart.toISOString(), earlyClose: job.edition === "close" && EARLY_CLOSE.has(job.date), btcAtCutoff,
    items: ranked.map(({ feed, source, topic, title, link, published, score, btcChange }) => ({ feed, source, topic, title, link, published: published.toISOString(), score, btcChange: btcChange ?? null })),
    sourcesFailed: failures.map(f => f.split(" (")[0]),
  };
}

// The published JSON: the new edition plus up to five earlier ones, newest cutoff first (also after a manual
// rebuild of an older edition), and the next six bells for the page's countdown.
export function withEdition(previous, edition) {
  const editions = [edition, ...(previous?.editions || []).filter(e => e.id !== edition.id)].sort((a, b) => b.cutoff.localeCompare(a.cutoff)).slice(0, 6);
  return { updated: edition.generated, next: upcoming(new Date(edition.cutoff), 6), editions };
}
