#!/usr/bin/env node
// Deterministic site checks — the gate every change (human or agent) must pass.
//
//   node scripts/seo-lint.mjs                 check the built site
//   node scripts/seo-lint.mjs --base main     also enforce the agent rules against a git base
//                                             (allowed files, experiment log, per-page cooldown)
//
// Exits 1 on any error; warnings are printed but don't fail.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, loadRegistry } from "./lib/registry.mjs";

const SITE = "https://cryptopriceticker.com";
const COOLDOWN_DAYS = 28;
const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);
const read = p => readFileSync(join(ROOT, p), "utf8");
const json = p => JSON.parse(read(p));
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");

// ---------- 1. Pages: titles, descriptions, H1, canonical, JSON-LD ----------
const { coins } = loadRegistry();
const sectorSlugs = JSON.parse(read("content/sectors.json")).map(x => x.slug);
const pages = ["index.html", "about/index.html", "widgets/index.html", ...sectorSlugs.map(x => `sector/${x}/index.html`),
  ...coins.map(c => `coin/${c.sym.toLowerCase()}/index.html`)];
const seen = { title: new Map(), description: new Map() };
for (const p of pages) {
  if (!existsSync(join(ROOT, p))) { err(`${p}: missing (run node scripts/build-coin-pages.mjs)`); continue; }
  const h = read(p);
  const title = decode((h.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
  const desc = decode((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "");
  const canon = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const expected = `${SITE}/${p.replace(/index\.html$/, "")}`;
  if (!title) err(`${p}: no <title>`);
  else if (title.length > 70) err(`${p}: title is ${title.length} chars (max 70): ${title}`);
  else if (title.length > 60) warn(`${p}: title is ${title.length} chars (may be truncated): ${title}`);
  if (/\$\s?\d/.test(title)) err(`${p}: title contains a price — prices go stale in search results`);
  if (!desc) err(`${p}: no meta description`);
  else if (desc.length > 170 || desc.length < 70) err(`${p}: description is ${desc.length} chars (want 70–170)`);
  for (const [k, v] of [["title", title], ["description", desc]]) {
    if (seen[k].has(v)) err(`${p}: duplicate ${k} (also on ${seen[k].get(v)})`); else seen[k].set(v, p);
  }
  if (canon !== expected) err(`${p}: canonical ${canon} ≠ ${expected}`);
  const h1s = (h.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) err(`${p}: ${h1s} <h1> elements (want 1)`);
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { err(`${p}: invalid JSON-LD (${e.message})`); }
  }
  if (!/<html lang="en"/.test(h)) err(`${p}: missing <html lang>`);
  if (/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/.test(h)) err(`${p}: inline <script> (blocked by the CSP in _headers)`);
  if (/\son[a-z]+="/i.test(h)) err(`${p}: inline event handler attribute (blocked by the CSP)`);
}

// ---------- 2. Internal links resolve ----------
const redirects = existsSync(join(ROOT, "_redirects"))
  ? new Set(read("_redirects").split("\n").filter(l => l.trim() && !l.startsWith("#")).map(l => l.split(/\s+/)[0])) : new Set();
const resolves = href => {
  const path = href.split(/[?#]/)[0];
  if (redirects.has(path)) return true;
  const f = join(ROOT, path);
  if (path.endsWith("/")) return existsSync(join(f, "index.html"));
  return existsSync(f) && statSync(f).isFile();
};
for (const p of [...pages, "404.html", "embed/index.html"]) {
  if (!existsSync(join(ROOT, p))) continue;
  for (const m of read(p).matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) if (!resolves(m[1])) err(`${p}: broken internal link ${m[1]}`);
}

// ---------- 3. Sitemap & robots ----------
const sitemap = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const pageUrls = new Set(pages.map(p => `${SITE}/${p.replace(/index\.html$/, "")}`));
for (const u of pageUrls) if (!sitemap.includes(u)) err(`sitemap.xml: missing ${u}`);
for (const u of sitemap) if (!pageUrls.has(u)) err(`sitemap.xml: lists ${u}, which isn't a known page`);
if (!/Sitemap: https:\/\/cryptopriceticker\.com\/sitemap\.xml/.test(read("robots.txt"))) err("robots.txt: no Sitemap line");
if (/^Disallow:\s*\/\s*$/m.test(read("robots.txt"))) err("robots.txt: blocks the whole site");

// ---------- 4. SEO overrides file (the agent's only content lever) ----------
const overrides = existsSync(join(ROOT, "content/seo-overrides.json")) ? json("content/seo-overrides.json") : {};
const LIMITS = { title: [20, 60], description: [70, 160], h1: [5, 80] };
const syms = new Set(coins.map(c => c.sym));
for (const [sym, o] of Object.entries(overrides)) {
  if (!syms.has(sym)) { err(`seo-overrides.json: unknown coin ${sym}`); continue; }
  for (const [k, v] of Object.entries(o)) {
    if (!LIMITS[k]) { err(`seo-overrides.json: ${sym}.${k} is not an allowed field (title, description, h1)`); continue; }
    if (typeof v !== "string") { err(`seo-overrides.json: ${sym}.${k} must be a string`); continue; }
    if (v.length < LIMITS[k][0] || v.length > LIMITS[k][1]) err(`seo-overrides.json: ${sym}.${k} is ${v.length} chars (want ${LIMITS[k].join("–")})`);
    if (/[<>{}`]|https?:|www\.|\bclick here\b/i.test(v)) err(`seo-overrides.json: ${sym}.${k} contains markup, a URL or disallowed text`);
    const coin = coins.find(c => c.sym === sym);
    if (k !== "description" && !v.includes(sym) && !v.toLowerCase().includes(coin.name.split(" (")[0].toLowerCase())) err(`seo-overrides.json: ${sym}.${k} must mention the coin`);
  }
}

// ---------- 5. Experiment log ----------
const experiments = existsSync(join(ROOT, "content/experiments.json")) ? json("content/experiments.json") : [];
const REQUIRED = ["id", "pages", "change", "hypothesis", "metric", "start", "evaluateOn", "status"];
for (const e of experiments) {
  for (const k of REQUIRED) if (!(k in e)) err(`experiments.json: ${e.id || "?"} is missing "${k}"`);
  if (e.start && e.evaluateOn && (Date.parse(e.evaluateOn) - Date.parse(e.start)) / 864e5 < 14) err(`experiments.json: ${e.id} evaluates less than 14 days after it starts`);
  if (!["running", "kept", "reverted", "inconclusive"].includes(e.status)) err(`experiments.json: ${e.id} has unknown status "${e.status}"`);
}

// ---------- 6. Agent rules against a git base (used for claude/seo-* branches and the weekly task) ----------
const baseIdx = process.argv.indexOf("--base");
if (baseIdx > 0) {
  const base = process.argv[baseIdx + 1];
  // Compare the working tree (committed + uncommitted) with the point where this branch left the base.
  const fork = execSync(`git merge-base ${base} HEAD`, { cwd: ROOT, encoding: "utf8" }).trim();
  const changed = execSync(`git diff --name-only ${fork}`, { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const FORBIDDEN = [/^_headers$/, /^_redirects$/, /^\.github\//, /^assets\/app\.(js|css)$/, /^assets\/theme-init\.js$/, /^scripts\//, /^CLAUDE\.md$/, /\.mcp\.json$/, /^content\/coin-about\.json$/];
  for (const f of changed) if (FORBIDDEN.some(r => r.test(f))) err(`agent rules: ${f} may not be changed by the automated loop (needs a human-authored PR)`);
  const before = (() => { try { return JSON.parse(execSync(`git show ${fork}:content/seo-overrides.json`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { return {}; } })();
  const touched = Object.keys({ ...before, ...overrides }).filter(s => JSON.stringify(before[s]) !== JSON.stringify(overrides[s]));
  if (touched.length > 2) err(`agent rules: ${touched.length} coins' overrides changed (max 2 per run): ${touched.join(", ")}`);
  const today = Date.now();
  for (const sym of touched) {
    const url = `/coin/${sym.toLowerCase()}/`;
    const exps = experiments.filter(e => e.pages?.includes(url)).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
    if (!exps.length) { err(`agent rules: override change for ${sym} has no entry in content/experiments.json`); continue; }
    const prior = exps.filter(e => (today - Date.parse(e.start)) / 864e5 > 2);
    if (prior.length && (today - Date.parse(prior[0].start)) / 864e5 < COOLDOWN_DAYS) err(`agent rules: ${sym} was last changed on ${prior[0].start}; cooldown is ${COOLDOWN_DAYS} days`);
  }
}

for (const w of warnings) console.log("warn  " + w);
for (const e of errors) console.log("ERROR " + e);
console.log(`\nseo-lint: ${pages.length} pages, ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
