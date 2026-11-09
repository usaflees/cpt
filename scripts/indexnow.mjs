#!/usr/bin/env node
// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver, …) which pages changed.
// Google does not use IndexNow; it reads sitemap.xml.
//
//   node scripts/indexnow.mjs <git-ref>      pages whose content changed since <git-ref>, plus deleted pages
//   node scripts/indexnow.mjs <git-ref> --dry   list them without sending
//   node scripts/indexnow.mjs --all          every URL in sitemap.xml (only after big changes)
//
// IndexNow asks sites not to resubmit unchanged URLs, so prefer the <git-ref> form. "Changed" ignores
// asset version stamps (?v=…) and the inlined theme script: a CSS/JS release alone sends nothing.
// Runs automatically after every push to main (.github/workflows/site-checks.yml, job "indexnow").
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { ROOT } from "./lib/registry.mjs";

const SITE = "https://cryptopriceticker.com";
const keyFile = readdirSync(ROOT).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("IndexNow key file (<32 hex chars>.txt) not found in the repo root");
const key = keyFile.slice(0, -4);

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const arg = args.filter(a => a !== "--dry")[0];
if (!arg || args.length > (dry ? 2 : 1) || (arg.startsWith("--") && arg !== "--all")) {
  console.error("usage: node scripts/indexnow.mjs <git-ref> [--dry] | --all"); process.exit(1);
}
const git = cmd => execSync(cmd, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
// Same normalisation as the sitemap lastmod logic in build-coin-pages.mjs.
const norm = html => html.replace(/\?v=[0-9a-f]+/g, "").replace(/<script>\/\*theme\*\/[\s\S]*?<\/script>/g, "");
let urls;
if (arg === "--all") {
  urls = [...readFileSync(ROOT + "sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
} else {
  const rows = git(`git diff --name-status --no-renames ${arg} HEAD`).split("\n").filter(Boolean).map(l => l.split("\t"));
  urls = rows.filter(([, f]) => /(^|\/)index\.html$/.test(f) && !f.startsWith("embed/") && !f.startsWith("docs/"))
    .filter(([st, f]) => st !== "M" || norm(git(`git show ${arg}:${f}`)) !== norm(readFileSync(ROOT + f, "utf8")))
    .map(([, f]) => `${SITE}/${f.replace(/index\.html$/, "")}`);
}
if (!urls.length) { console.log("IndexNow: nothing changed, nothing sent."); process.exit(0); }
if (dry) { console.log(`IndexNow (dry run): would send ${urls.length} URL(s)\n` + urls.join("\n")); process.exit(0); }

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "cryptopriceticker.com", key, keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(0, 10000) })
});
console.log(`IndexNow: HTTP ${res.status} for ${urls.length} URL(s)`);
process.exit(res.ok ? 0 : 1);
