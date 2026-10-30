#!/usr/bin/env node
// Audits the live production site (or any deployment) over HTTP.
//
//   node scripts/check-live.mjs                          checks https://cryptopriceticker.com
//   node scripts/check-live.mjs https://<id>.cryptopriceticker.pages.dev   checks a preview
//
// Exits 1 if anything a visitor or search engine would notice is broken.
import { loadRegistry } from "./lib/registry.mjs";

const BASE = (process.argv[2] || "https://cryptopriceticker.com").replace(/\/$/, "");
const IS_PROD = BASE === "https://cryptopriceticker.com";
const problems = [];
const ok = [];

async function check(path, { status = 200, headers = {}, body } = {}) {
  let res;
  try { res = await fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "cryptopriceticker-check/1.0" } }); }
  catch (e) { problems.push(`${path}: request failed (${e.message})`); return null; }
  if (res.status !== status) problems.push(`${path}: HTTP ${res.status} (expected ${status})`);
  for (const [h, re] of Object.entries(headers)) {
    const v = res.headers.get(h) || "";
    if (!re.test(v)) problems.push(`${path}: header ${h} = "${v}" doesn't match ${re}`);
  }
  const text = status === 200 ? await res.text() : "";
  if (body && !body.test(text)) problems.push(`${path}: body doesn't match ${body}`);
  if (res.status === status) ok.push(path);
  return text;
}

const { coins } = loadRegistry();
const sample = [coins[0], ...coins.sort(() => Math.random() - 0.5).slice(0, 5)];
const prodOnly = IS_PROD ? { "x-robots-tag": /^(?!.*noindex)/ } : {};

await check("/", { headers: { "content-security-policy": /default-src 'self'/, ...prodOnly }, body: /<h1/ });
for (const c of sample) await check(`/coin/${c.sym.toLowerCase()}/`, { headers: prodOnly, body: new RegExp(`data-sym="${c.sym}"`) });
await check("/about/", { headers: prodOnly });
await check("/widgets/", { headers: prodOnly });
await check("/convert/", { headers: { "content-security-policy": /api\.coinbase\.com/, ...prodOnly }, body: /id="converter"/ });
await check("/sector/ai/", { headers: prodOnly, body: /<table/ });
await check("/sw.js");
await check("/embed/", { headers: { "x-robots-tag": /noindex/ } });
await check("/this-page-does-not-exist", { status: 404 });
await check("/coin/ton/", { status: 301, headers: { location: /\/coin\/gram\/$/ } });
await check("/robots.txt", { body: /Sitemap:/ });
await check("/assets/app.js");
const sitemap = await check("/sitemap.xml", { body: /<urlset/ });
if (sitemap) {
  const n = (sitemap.match(/<loc>/g) || []).length;
  const expected = (sitemap.match(/\/coin\//g) || []).length === coins.length && (sitemap.match(/\/sector\//g) || []).length >= 1;
  if (!expected) problems.push(`/sitemap.xml: ${n} URLs; expected all ${coins.length} coin pages and the sector pages`);
}

console.log(`${BASE}: ${ok.length} checks passed, ${problems.length} problem(s)`);
for (const p of problems) console.log("PROBLEM " + p);
process.exit(problems.length ? 1 : 0);
