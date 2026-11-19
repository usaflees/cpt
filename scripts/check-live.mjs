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
await check("/heatmap/", { headers: prodOnly, body: /id="heatmap"/ });
await check("/convert/", { headers: { "content-security-policy": /api\.coinbase\.com/, ...prodOnly }, body: /id="converter"/ });
await check("/sector/ai/", { headers: prodOnly, body: /<table/ });
await check("/sw.js");
await check("/embed/", { headers: { "x-robots-tag": /noindex/ } });
await check("/this-page-does-not-exist", { status: 404 });
await check("/coin/ton/", { status: 301, headers: { location: /\/coin\/gram\/$/ } });
await check("/robots.txt", { body: /Sitemap:/ });
// AdSense site verification and seller declaration (no ad code is loaded until the site is approved).
await check("/ads.txt", { body: /^google\.com, pub-3149203932367096, DIRECT, f08c47fec0942fa0\s*$/ });
await check("/", { body: /<meta name="google-adsense-account" content="ca-pub-3149203932367096"/ });
// Search and AI crawlers must get the page, not a block or a Cloudflare challenge (Bot Fight Mode, AI bot
// policies or a WAF rule could quietly stop indexing). The user agent is spoofed from this machine, so a pass
// doesn't prove Cloudflare's IP-verified crawlers get through, but a block or challenge here is always real.
const CRAWLERS = {
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot",
  "Claude-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  Slackbot: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"
};
for (const [bot, ua] of Object.entries(CRAWLERS)) {
  try {
    const res = await fetch(BASE + "/coin/btc/", { redirect: "manual", headers: { "user-agent": ua } });
    const mitigated = res.headers.get("cf-mitigated");
    if (res.status !== 200 || mitigated) problems.push(`/coin/btc/ as ${bot}: HTTP ${res.status}${mitigated ? `, cf-mitigated: ${mitigated}` : ""} (crawler blocked or challenged)`);
    else ok.push(`/coin/btc/ as ${bot}`);
  } catch (e) { problems.push(`/coin/btc/ as ${bot}: request failed (${e.message})`); }
}
// The repository's working files are not served (functions/_middleware.js + _routes.json); the site still is.
for (const path of ["/scripts/build-coin-pages.mjs", "/docs/STRATEGY.md", "/content/coin-stats.json", "/tests/run.sh", "/.claude/skills/ship/SKILL.md", "/.github/workflows/site-checks.yml", "/CLAUDE.md", "/README.md", "/SECURITY.md", "/.gitignore"]) {
  await check(path, { status: 404 });
}
await check("/llms.txt");
await check("/.well-known/security.txt");
// The pages.dev copy of production must stay out of search results (rule in _headers).
if (IS_PROD) {
  try {
    const r = await fetch("https://cryptopriceticker.pages.dev/", { redirect: "manual", headers: { "user-agent": "cryptopriceticker-check/1.0" } });
    if (!/noindex/.test(r.headers.get("x-robots-tag") || "")) problems.push("cryptopriceticker.pages.dev: no X-Robots-Tag noindex (duplicate of the site can be indexed)");
    else ok.push("pages.dev noindex");
  } catch (e) { problems.push(`cryptopriceticker.pages.dev: request failed (${e.message})`); }
}
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
