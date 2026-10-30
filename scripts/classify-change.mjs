#!/usr/bin/env node
// Decides whether the working tree's changes (vs a git base) are a pure data refresh that the weekly
// task may merge on its own, or something a human must review.
//
//   node scripts/classify-change.mjs main     → prints "data-only" (exit 0) or "needs-review: …" (exit 2)
import { execSync } from "node:child_process";
import vm from "node:vm";
import { ROOT, loadRegistry } from "./lib/registry.mjs";

const base = process.argv[2] || "main";
const fork = execSync(`git merge-base ${base} HEAD`, { cwd: ROOT, encoding: "utf8" }).trim();
const changed = execSync(`git diff --name-only ${fork}`, { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const untracked = execSync("git ls-files --others --exclude-standard", { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const reasons = [];

const DATA_FILES = [/^assets\/coins\.js$/, /^content\/coin-stats\.json$/, /^coin\/[a-z0-9]+\/index\.html$/, /^sector\/[a-z0-9-]+\/index\.html$/, /^convert\/index\.html$/, /^sitemap\.xml$/, /^index\.html$/];
for (const f of [...changed, ...untracked]) if (!DATA_FILES.some(r => r.test(f))) reasons.push(`${f} is not a data file`);

// Registry: only supply/price numbers may change — not the coin list, names, sectors, feeds or tickers.
if (changed.includes("assets/coins.js")) {
  const sandbox = {};
  vm.runInNewContext(execSync(`git show ${fork}:assets/coins.js`, { cwd: ROOT, encoding: "utf8" }), sandbox);
  const shape = list => JSON.stringify(list.map(({ supply, price, ...rest }) => rest));
  if (shape(sandbox.CPT_COINS) !== shape(loadRegistry().coins)) reasons.push("coin list, names, sectors, feeds or tickers changed in assets/coins.js");
}

// index.html: only the generated coin-index block may differ.
if (changed.includes("index.html")) {
  const strip = s => s.replace(/<!-- coin-index:start[\s\S]*?<!-- coin-index:end -->/, "");
  const before = execSync(`git show ${fork}:index.html`, { cwd: ROOT, encoding: "utf8" });
  const after = execSync("cat index.html", { cwd: ROOT, encoding: "utf8" });
  if (strip(before) !== strip(after)) reasons.push("index.html changed outside the generated coin list");
}

if (reasons.length) { console.log("needs-review: " + reasons.join("; ")); process.exit(2); }
console.log(changed.length ? "data-only" : "no-changes");
