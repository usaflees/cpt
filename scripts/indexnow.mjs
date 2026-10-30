#!/usr/bin/env node
// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver, …) which pages changed.
// Google does not use IndexNow; it reads sitemap.xml.
//
//   node scripts/indexnow.mjs <git-ref>      pages whose generated HTML changed since <git-ref>
//   node scripts/indexnow.mjs --all          every URL in sitemap.xml (only after big changes)
//
// IndexNow asks sites not to resubmit unchanged URLs, so prefer the <git-ref> form.
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { ROOT } from "./lib/registry.mjs";

const SITE = "https://cryptopriceticker.com";
const keyFile = readdirSync(ROOT).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("IndexNow key file (<32 hex chars>.txt) not found in the repo root");
const key = keyFile.slice(0, -4);

const arg = process.argv[2];
if (!arg) { console.error("usage: node scripts/indexnow.mjs <git-ref> | --all"); process.exit(1); }
let urls;
if (arg === "--all") {
  urls = [...readFileSync(ROOT + "sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
} else {
  urls = execSync(`git diff --name-only ${arg} HEAD`, { cwd: ROOT, encoding: "utf8" }).split("\n")
    .filter(f => /(^|\/)index\.html$/.test(f) && !f.startsWith("embed/"))
    .map(f => `${SITE}/${f.replace(/index\.html$/, "")}`);
}
if (!urls.length) { console.log("IndexNow: nothing changed, nothing sent."); process.exit(0); }

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "cryptopriceticker.com", key, keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(0, 10000) })
});
console.log(`IndexNow: HTTP ${res.status} for ${urls.length} URL(s)`);
process.exit(res.ok ? 0 : 1);
