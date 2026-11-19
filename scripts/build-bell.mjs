#!/usr/bin/env node
// Bell Brief: the three official releases most likely to move crypto, published 5 minutes before the NYSE opening
// bell (9:25 ET) and 5 minutes after the close (16:05 ET, 13:05 on early-close days). Writes content/bell.json;
// scripts/build-coin-pages.mjs renders it into the home page. Run by .github/workflows/bell-brief.yml.
//
//   node scripts/build-bell.mjs                       publish the edition that is due (waits up to 20 min for its cutoff)
//   node scripts/build-bell.mjs --edition open|close  build that edition for the latest trading day now (by hand)
//   node scripts/build-bell.mjs --now <ISO time>      pretend the clock reads this (tests; no waiting)
//   node scripts/build-bell.mjs --dry                 print the edition, write nothing
// Exit codes: 0 edition written, 3 nothing due (or already published), 1 failure (the previous edition stays).
//
// Sources are U.S. federal agencies' press releases and statistical releases (public domain, 17 U.S.C. § 105):
// Federal Reserve Board, Bureau of Labor Statistics (CPI, jobs, PPI), Bureau of Economic Analysis, SEC, CFTC.
// Third-party headlines need a licence (DECISIONS 2026-11-08), so none are used. No AI text: titles are the
// agencies' own; the score is a fixed rule (below); the BTC move is measured on Coinbase from release to cutoff.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ROOT } from "./lib/registry.mjs";

const OUT = ROOT + "content/bell.json";
const UA = "CryptoPriceTicker.com bell-brief/1.0 (+https://cryptopriceticker.com/about/)";
const args = process.argv.slice(2);
const opt = { dry: false, edition: null, now: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--dry") opt.dry = true;
  else if (a === "--edition" && ["open", "close"].includes(args[i + 1])) opt.edition = args[++i];
  else if (a === "--now" && !isNaN(Date.parse(args[i + 1] || ""))) opt.now = new Date(args[++i]);
  else { console.error(`Unknown or incomplete argument: ${a}\nUsage: see the header of scripts/build-bell.mjs`); process.exit(2); }
}

// ---------- NYSE calendar (https://www.nyse.com/markets/hours-calendars, read 19 Nov 2026) ----------
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]); // 1:00 pm ET
const CALENDAR_END = "2027-12-31";

const TZ = "America/New_York";
const etParts = d => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
  .formatToParts(d).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
const etDate = d => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
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
const cutoffOf = (date, edition) => (edition === "open" ? etToUtc(date, 9, 25) : etToUtc(date, closeHour(date), 5));
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
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const published = new Set((previous?.editions || []).map(e => e.id));
let now = opt.now || new Date();
if (etDate(now) > CALENDAR_END) console.warn(`warning: the NYSE calendar in build-bell.mjs ends ${CALENDAR_END}; add the next year's holidays`);

function due(at) {
  const today = etDate(at);
  if (opt.edition) { let d = today; while (!isTradingDay(d) || cutoffOf(d, opt.edition) > at) d = prevTradingDay(d); return { date: d, edition: opt.edition }; }
  if (!isTradingDay(today)) return null;
  for (const e of ["close", "open"]) {
    const cut = cutoffOf(today, e), id = `${today}-${e}`;
    // Early runs wait for the cutoff (up to 20 minutes); late runs publish up to 4 hours after it.
    if (at >= new Date(cut - 20 * 60e3) && at < new Date(+cut + 4 * 3600e3) && !published.has(id) && !(e === "open" && published.has(`${today}-close`))) return { date: today, edition: e };
  }
  return null;
}
const job = due(now);
if (!job) { console.log(`bell: nothing due at ${now.toISOString()} (${etParts(now).hour}:${etParts(now).minute} ET)`); process.exit(3); }
const cutoff = cutoffOf(job.date, job.edition);
if (!opt.now && !opt.edition && now < cutoff) {
  console.log(`bell: waiting ${Math.round((cutoff - now) / 1000)} s for the ${job.edition} cutoff`);
  await new Promise(r => setTimeout(r, cutoff - now));
  now = new Date();
}
const windowStart = job.edition === "open" ? cutoffOf(prevTradingDay(job.date), "close") : cutoffOf(job.date, "open");

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
const MACRO = /\b(federal funds|fomc|federal open market|interest rate|monetary policy|inflation)\b/i;
// Fixed scoring rule, highest first; the page explains it. `base` is the release's own weight: releases under
// MIN_BASE (routine statistics, enforcement notices against individuals) never fill a slot, so a quiet session
// shows fewer than three items rather than padding.
const MIN_BASE = 3;
function baseOf(it) {
  const t = it.title;
  let base;
  if (it.feed === "fed") base = /Monetary Policy/i.test(it.topic) || MACRO.test(t) ? 10 : /Banking|Regulat|Supervis/i.test(it.topic) ? 4 : /Enforcement/i.test(it.topic) ? 1 : 3;
  else if (it.feed === "bls-cpi" || it.feed === "bls-jobs") base = 9;
  else if (it.feed === "bls-ppi") base = 7;
  else if (it.feed === "bea") base = /gross domestic product|\bGDP\b|personal income|outlays|\bPCE\b/i.test(t) ? 8 : /trade/i.test(t) ? 4 : 2;
  else if (it.feed === "sec") base = CRYPTO.test(t) ? 7 : /exchange-traded|\bETF\b/i.test(t) ? 5 : 3;
  else base = CRYPTO.test(t) || /prediction|event contract|24\/7/i.test(t) ? 6 : 3; // CFTC
  return base;
}
function score(it) {
  const t = it.title, base = baseOf(it);
  const crypto = CRYPTO.test(t) && it.feed !== "sec" && it.feed !== "cftc" ? 2 : 0; // SEC/CFTC already weigh crypto
  const inWindow = it.published > windowStart ? 3 : 0;
  const age = (cutoff - it.published) / 36e5;
  return Math.round((base + crypto + inWindow - age / 24) * 10) / 10;
}

const items = [], failures = [];
await Promise.all(FEEDS.map(async f => {
  try {
    const xml = await fetchText(f.url);
    for (const raw of xml.match(/<item\b[\s\S]*?<\/item>/g) || []) {
      const title = tag(raw, "title"), link = tag(raw, "link"), published = parseDate(tag(raw, "pubDate") || tag(raw, "dc:date"));
      if (!title || !/^https:\/\//.test(link) || !published) continue;
      items.push({ feed: f.id, source: f.name, topic: f.topic || tag(raw, "category") || "", title, link, published });
    }
  } catch (e) { failures.push(`${f.name} (${f.id}): ${e.message}`); }
}));
if (failures.length) console.warn(`bell: feeds that failed: ${failures.join("; ")}`);
if (failures.length > 3) { console.error("bell: too many sources failed; keeping the previous edition"); process.exit(1); }

const pool = items.filter(it => it.published <= cutoff && it.published > new Date(cutoff - 4 * 864e5));
const seen = new Set();
const ranked = pool.filter(it => baseOf(it) >= MIN_BASE).map(it => ({ ...it, score: score(it) })).sort((a, b) => b.score - a.score || b.published - a.published)
  .filter(it => !seen.has(it.link) && seen.add(it.link)).slice(0, 3);
if (!items.length) { console.error("bell: no releases parsed from any source; keeping the previous edition"); process.exit(1); }

// ---------- BTC from each release to the cutoff (Coinbase BTC-USD candles) ----------
async function btcBetween(from, to) {
  const span = (to - from) / 6e4;
  const g = span <= 290 ? 60 : span <= 290 * 15 ? 900 : 3600;
  const start = new Date(Math.floor(from / (g * 1000)) * g * 1000), url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${g}&start=${start.toISOString()}&end=${to.toISOString()}`;
  const rows = JSON.parse(await fetchText(url)); // [time, low, high, open, close, volume], newest first
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const oldest = rows[rows.length - 1], newest = rows[0];
  return { from: oldest[3], to: newest[4] };
}
let btcAtCutoff = null;
for (const it of ranked) {
  try {
    const m = await btcBetween(it.published, cutoff);
    if (m) { it.btcChange = Math.round(((m.to - m.from) / m.from) * 10000) / 100; btcAtCutoff = m.to; }
  } catch (e) { console.warn(`bell: BTC move for "${it.title.slice(0, 40)}…" unavailable (${e.message})`); }
}

// ---------- Write ----------
const edition = {
  id: `${job.date}-${job.edition}`, edition: job.edition, date: job.date, cutoff: cutoff.toISOString(), generated: now.toISOString(),
  windowStart: windowStart.toISOString(), earlyClose: job.edition === "close" && EARLY_CLOSE.has(job.date), btcAtCutoff,
  items: ranked.map(({ feed, source, topic, title, link, published, score, btcChange }) => ({ feed, source, topic, title, link, published: published.toISOString(), score, btcChange: btcChange ?? null })),
  sourcesFailed: failures.map(f => f.split(" (")[0]),
};
const editions = [edition, ...(previous?.editions || []).filter(e => e.id !== edition.id)].slice(0, 6);
const outJson = { updated: edition.generated, next: upcoming(cutoff, 6), editions };
console.log(`bell: ${edition.id} (cutoff ${cutoff.toISOString()}):\n${edition.items.map((it, i) => `  ${i + 1}. [${it.score}] ${it.source}: ${it.title.slice(0, 90)} (BTC ${it.btcChange ?? "—"}%)`).join("\n")}`);
if (!opt.dry) writeFileSync(OUT, JSON.stringify(outJson, null, 1) + "\n");
process.exit(0);
