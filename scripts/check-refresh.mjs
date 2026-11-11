#!/usr/bin/env node
// Guard for the unattended data refresh (.github/workflows/data-refresh.yml): fails when the new
// content/coin-stats.json looks degraded compared with a git base, e.g. because an exchange API
// refused the runner and many coins silently fell back to another exchange or lost their stats.
//
//   node scripts/check-refresh.mjs <git-base>      e.g. origin/main
//
// Exit 0: looks like a normal weekly refresh. Exit 1: don't publish; a human should look.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { ROOT } from "./lib/registry.mjs";

const base = process.argv[2];
if (!base || process.argv.length > 3) { console.error("Usage: node scripts/check-refresh.mjs <git-base>"); process.exit(1); }

const before = JSON.parse(execSync(`git show ${base}:content/coin-stats.json`, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 })).coins;
const after = JSON.parse(readFileSync(ROOT + "content/coin-stats.json", "utf8")).coins;
const problems = [];

const lost = Object.keys(before).filter(s => !after[s]);
if (lost.length > 2) problems.push(`${lost.length} coins lost their stats: ${lost.join(", ")}`);

const moved = Object.keys(before).filter(s => after[s] && after[s].source !== before[s].source);
if (moved.length > 10) problems.push(`${moved.length} coins changed source exchange (an API may be blocked): ${moved.slice(0, 15).join(", ")}`);

const shorter = Object.keys(before).filter(s => after[s] && after[s].historyDays < before[s].historyDays - 30);
if (shorter.length > 10) problems.push(`${shorter.length} coins have over 30 fewer days of history`);

const stale = Object.keys(after).filter(s => after[s].asOf && before[s]?.asOf && after[s].asOf < before[s].asOf);
if (stale.length) problems.push(`${stale.length} coins have older data than before: ${stale.slice(0, 15).join(", ")}`);

// The stats file is written from outside API responses and its values are printed into every coin page:
// allow only numbers, dates and plain exchange names, so nothing in it can ever be markup or script.
const odd = [];
(function walk(v, path) {
  if (typeof v === "string") { if (!/^[A-Za-z0-9 .:+-]{1,32}$/.test(v)) odd.push(path); }
  else if (typeof v === "number") { if (!Number.isFinite(v)) odd.push(path); }
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (!/^[A-Za-z0-9]+$/.test(k)) odd.push(`${path}.<key>`); else walk(x, `${path}.${k}`); }
  else if (v !== null && typeof v !== "boolean") odd.push(path);
})(JSON.parse(readFileSync(ROOT + "content/coin-stats.json", "utf8")), "stats");
if (odd.length) problems.push(`${odd.length} values are not a number, a date or a plain name: ${odd.slice(0, 5).join(", ")}`);

if (problems.length) { console.log("check-refresh: FAILED\n- " + problems.join("\n- ")); process.exit(1); }
console.log(`check-refresh: ok (${Object.keys(after).length} coins; ${moved.length} changed source, ${lost.length} lost)`);
