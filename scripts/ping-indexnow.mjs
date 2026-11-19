#!/usr/bin/env node
// Sends IndexNow the URLs whose sitemap lastmod moved in the last `npm run build`
// (data/changed-urls.json, written by scripts/build-seo-engine.mjs: a ≥ 3% price move, a rank change or a
// regime change). Unchanged URLs are never resubmitted. Google does not use IndexNow; it reads the sitemap.
//
//   node scripts/ping-indexnow.mjs            send the changed URLs
//   node scripts/ping-indexnow.mjs --dry      list them without sending
//   node scripts/ping-indexnow.mjs --all      every URL in the ledger (once, after the first deploy of new pages)
// Used by .github/workflows/seo-data-pipeline.yml after a successful deploy. The git-diff based
// scripts/indexnow.mjs still covers hand-made page changes.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { ROOT } from "./lib/registry.mjs";

const SITE = "https://cryptopriceticker.com";
const args = process.argv.slice(2);
if (args.some(a => !["--dry", "--all"].includes(a))) { console.error("usage: node scripts/ping-indexnow.mjs [--dry] [--all]"); process.exit(1); }
const keyFile = readdirSync(ROOT).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("IndexNow key file (<32 hex chars>.txt) not found in the repo root");

let urls;
if (args.includes("--all")) {
  urls = Object.keys(JSON.parse(readFileSync(ROOT + "data/lastmod-ledger.json", "utf8")).urls).map(p => SITE + p);
} else {
  const file = ROOT + "data/changed-urls.json";
  if (!existsSync(file)) { console.error("data/changed-urls.json not found: run npm run build first"); process.exit(1); }
  urls = JSON.parse(readFileSync(file, "utf8")).urls;
}
urls = urls.filter(u => u.startsWith(SITE + "/"));
if (!urls.length) { console.log("IndexNow: no lastmod changed, nothing sent."); process.exit(0); }
if (args.includes("--dry")) { console.log(`IndexNow (dry run): would send ${urls.length} URL(s)\n` + urls.join("\n")); process.exit(0); }

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "cryptopriceticker.com", key: keyFile.slice(0, -4), keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(0, 10000) })
});
console.log(`IndexNow: HTTP ${res.status} for ${urls.length} URL(s)`);
process.exit(res.ok ? 0 : 1);
