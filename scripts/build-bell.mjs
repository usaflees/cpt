#!/usr/bin/env node
// Bell Brief: the three official releases most likely to move crypto, published 5 minutes before the NYSE opening
// bell (9:25 ET) and 5 minutes after the close (16:05 ET, 13:05 on early-close days). Writes content/bell.json;
// scripts/build-coin-pages.mjs renders it into the home page. Run by .github/workflows/bell-brief.yml.
// The calendar, sources, scoring rule and edition are in scripts/lib/bell-core.mjs, shared with the Cloudflare
// cron Worker in scripts/bell-worker/ (which writes the same JSON to KV for the /bell endpoint).
//
//   node scripts/build-bell.mjs                       publish the edition that is due (waits up to 20 min for its cutoff)
//   node scripts/build-bell.mjs --edition open|close  build that edition for the latest trading day now (by hand)
//   node scripts/build-bell.mjs --now <ISO time>      pretend the clock reads this (tests; no waiting)
//   node scripts/build-bell.mjs --dry                 print the edition, write nothing
// The edition shown on the page is always the newest by cutoff, also after a manual rebuild of an older one.
// Exit codes: 0 edition written, 3 nothing due (or already published), 1 failure (the previous edition stays).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ROOT } from "./lib/registry.mjs";
import { CALENDAR_END, etDate, etParts, cutoffOf, dueEdition, buildEdition, withEdition } from "./lib/bell-core.mjs";

const OUT = ROOT + "content/bell.json";
const args = process.argv.slice(2);
const opt = { dry: false, edition: null, now: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--dry") opt.dry = true;
  else if (a === "--edition" && ["open", "close"].includes(args[i + 1])) opt.edition = args[++i];
  else if (a === "--now" && !isNaN(Date.parse(args[i + 1] || ""))) opt.now = new Date(args[++i]);
  else { console.error(`Unknown or incomplete argument: ${a}\nUsage: see the header of scripts/build-bell.mjs`); process.exit(2); }
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
let now = opt.now || new Date();
if (etDate(now) > CALENDAR_END) console.warn(`warning: the NYSE calendar in scripts/lib/bell-core.mjs ends ${CALENDAR_END}; add the next year's holidays`);

const job = dueEdition(now, previous, opt.edition);
if (!job) { console.log(`bell: nothing due at ${now.toISOString()} (${etParts(now).hour}:${etParts(now).minute} ET)`); process.exit(3); }
const cutoff = cutoffOf(job.date, job.edition);
if (!opt.now && !opt.edition && now < cutoff) {
  console.log(`bell: waiting ${Math.round((cutoff - now) / 1000)} s for the ${job.edition} cutoff`);
  await new Promise(r => setTimeout(r, cutoff - now));
  now = new Date();
}

let edition;
try { edition = await buildEdition(job, now, m => console.warn(m)); }
catch (e) { console.error(`bell: ${e.message}`); process.exit(1); }
const outJson = withEdition(previous, edition);
console.log(`bell: ${edition.id} (cutoff ${cutoff.toISOString()}):\n${edition.items.map((it, i) => `  ${i + 1}. [${it.score}] ${it.source}: ${it.title.slice(0, 90)} (BTC ${it.btcChange ?? "—"}%)`).join("\n")}`);
if (!opt.dry) writeFileSync(OUT, JSON.stringify(outJson, null, 1) + "\n");
process.exit(0);
