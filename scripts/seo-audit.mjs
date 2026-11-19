#!/usr/bin/env node
// Deep SEO audit of every page in sitemap.xml, as the HTML a crawler receives (no JavaScript). It reports; it never
// fails a build (scripts/seo-lint.mjs is the gate). Run it before an SEO pass and again after, and compare.
//
//   node scripts/seo-audit.mjs            summary: one line per check with the worst examples
//   node scripts/seo-audit.mjs --pages    also a table of every page: words, unique words, links in/out, issues
//
// What it looks at, per page: visible words outside header/footer and how many are unique to the page (templated
// coin pages are the scaled-content risk), title/H1/description agreement, heading order, image alt text and
// sizes, link anchor text, inbound internal links (orphans), Open Graph and Twitter tags, JSON-LD types and
// required fields, breadcrumb markup vs the visible breadcrumb, stray "undefined"/"NaN"/"TODO" text, and the
// brand facts AI answers need (that the site is live, privacy-first, and who runs it).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/registry.mjs";

const args = process.argv.slice(2);
if (args.some(a => a !== "--pages")) { console.error(`Unknown argument(s): ${args.join(" ")}\nUsage: see the header of scripts/seo-audit.mjs`); process.exit(2); }
const SITE = "https://cryptopriceticker.com";
const urls = [...readFileSync(join(ROOT, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const fileOf = u => join(ROOT, u.slice(SITE.length).replace(/^\//, ""), "index.html");
const decode = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const strip = h => decode(h.replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? decode(m[1]) : null; };
const words = t => t.toLowerCase().match(/[a-z0-9$€£¥.,%+−-]+/g) || [];

const pages = urls.map(u => {
  const f = fileOf(u);
  if (!existsSync(f)) return { url: u, missing: true };
  const html = readFileSync(f, "utf8");
  const main = (html.match(/<main\b[\s\S]*<\/main>/) || [html])[0];
  return { url: u, path: u.slice(SITE.length) || "/", html, main, text: strip(main) };
});

const issues = new Map(); // check → [{ page, detail }]
const flag = (check, page, detail = "") => { if (!issues.has(check)) issues.set(check, []); issues.get(check).push({ page, detail }); };
const family = p => p.path.startsWith("/coin/") ? "coin" : p.path.startsWith("/sector/") ? "sector" : "page";

// Inbound internal links across the whole site (orphans and weakly linked pages).
const inbound = new Map(pages.map(p => [p.path, 0]));
for (const p of pages) {
  if (p.missing) continue;
  const seen = new Set();
  for (const m of p.html.matchAll(/<a\b[^>]*\shref="([^"#?]*)/g)) {
    let h = m[1]; if (h.startsWith(SITE)) h = h.slice(SITE.length) || "/";
    if (!h.startsWith("/") || h === p.path || seen.has(h)) continue;
    seen.add(h); if (inbound.has(h)) inbound.set(h, inbound.get(h) + 1);
  }
}

// Word sets per family, to measure how much of each page's text is its own.
const shingles = t => { const w = words(t), s = new Set(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s; };
const fam = {};
for (const p of pages) if (!p.missing) { p.sh = shingles(p.text); (fam[family(p)] ||= []).push(p); }
for (const list of Object.values(fam)) {
  const count = new Map();
  for (const p of list) for (const s of p.sh) count.set(s, (count.get(s) || 0) + 1);
  for (const p of list) {
    const own = [...p.sh].filter(s => count.get(s) <= Math.max(1, Math.floor(list.length * 0.1))).length;
    p.unique = p.sh.size ? own / p.sh.size : 0;
  }
}

for (const p of pages) {
  if (p.missing) { flag("page in sitemap has no file", p.url); continue; }
  const { html, main, text, path } = p;
  const head = (html.match(/<head>[\s\S]*<\/head>/) || [""])[0];
  const title = decode((head.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
  const desc = attr((head.match(/<meta name="description"[^>]*>/) || [""])[0], "content") || "";
  const h1 = strip((main.match(/<h1\b[\s\S]*?<\/h1>/) || [""])[0]);
  p.words = words(text).length;

  // Content depth
  if (family(p) === "coin" && p.words < 450) flag("coin page under 450 visible words (static HTML)", path, `${p.words}`);
  if (family(p) !== "coin" && p.words < 250) flag("page under 250 visible words (static HTML)", path, `${p.words}`);
  if (family(p) !== "page" && p.unique < 0.35) flag("under 35% of the page's 3-word phrases are its own (template-heavy)", path, `${Math.round(p.unique * 100)}%`);

  // Title / H1 / description agreement
  const key = s => words(s).filter(w => w.length > 3);
  const h1k = key(h1);
  if (h1k.length && !h1k.some(w => key(title).includes(w))) flag("H1 and title share no word", path, `${h1} | ${title}`);
  if (desc && h1k.length && !h1k.some(w => key(desc).includes(w))) flag("description doesn't mention the H1 topic", path, h1);
  if (title.length < 30) flag("title under 30 characters (room for a descriptor)", path, title);

  // Headings
  const levels = [...main.matchAll(/<h([1-6])\b/g)].map(m => +m[1]);
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { flag("heading level skipped", path, `h${levels[i - 1]} → h${levels[i]}`); break; }
  const h2s = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(m => strip(m[1]));
  const dupH2 = h2s.filter((t, i) => h2s.indexOf(t) !== i);
  if (dupH2.length) flag("duplicate H2 text on one page", path, dupH2[0]);

  // Images
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const t = m[0];
    if (attr(t, "alt") === null) flag("img without alt attribute", path, attr(t, "src"));
    if (!attr(t, "width") || !attr(t, "height")) flag("img without width/height (layout shift)", path, attr(t, "src"));
  }

  // Links
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const a = `<a${m[1]}>`, label = (attr(a, "aria-label") || strip(m[2])).trim();
    if (!label && !/<img\b[^>]*alt="[^"]+"/.test(m[2])) flag("link with no text or accessible name", path, attr(a, "href"));
    else if (/^(here|click here|read more|more|link|this|→|↗)$/i.test(label)) flag("generic link text", path, `"${label}" → ${attr(a, "href")}`);
    if (attr(a, "target") === "_blank" && !/noopener|noreferrer/.test(attr(a, "rel") || "")) flag("target=_blank without rel=noopener", path, attr(a, "href"));
  }

  // Social and structured data
  for (const prop of ["og:title", "og:description", "og:image", "og:url", "og:type"]) if (!head.includes(`property="${prop}"`)) flag(`missing ${prop}`, path);
  if (!head.includes('name="twitter:card"')) flag("missing twitter:card", path);
  const ogUrl = attr((head.match(/<meta property="og:url"[^>]*>/) || [""])[0], "content");
  if (ogUrl && ogUrl !== p.url) flag("og:url differs from the canonical URL", path, ogUrl);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
  const nodes = blocks.flatMap(b => b["@graph"] || [b]);
  const types = nodes.map(n => n["@type"]).flat();
  if (!types.length) flag("no JSON-LD", path);
  const crumbs = nodes.find(n => n["@type"] === "BreadcrumbList");
  const visibleCrumb = /class="breadcrumb"/.test(main);
  if (visibleCrumb && !crumbs) flag("visible breadcrumb without BreadcrumbList markup", path);
  if (crumbs) for (const [i, it] of (crumbs.itemListElement || []).entries()) {
    if (it.position !== i + 1) flag("BreadcrumbList positions out of order", path);
    if (!it.name) flag("BreadcrumbList item without name", path);
  }
  for (const n of nodes) if (n["@type"] === "Organization") {
    if (!n.logo) flag("Organization without logo", path);
    if (!n.description) flag("Organization without description (who/what the site is, for AI answers)", path);
  }

  // Stray template text
  const stray = text.match(/\b(undefined|NaN|null|TODO|FIXME|lorem ipsum|\[object Object\])\b/);
  if (stray) flag("stray template text in the static HTML", path, stray[0]);
  if (/\s{2,}[.,]/.test(text)) flag("space before punctuation", path);

  // Internal linking
  if (path !== "/" && inbound.get(path) < 3) flag("fewer than 3 pages link here", path, `${inbound.get(path)}`);
}

// Brand facts an AI answer needs, read from the home page and /about/ (the pages Google indexes first).
const home = pages.find(p => p.path === "/"), about = pages.find(p => p.path === "/about/");
const brandText = `${home ? strip(home.html) : ""} ${about ? strip(about.html) : ""}`.toLowerCase();
for (const [label, re] of [["says the site is live/active today", /\b(is live|live since|relaunched|back online|active)\b/],
  ["says it is privacy-first / private", /privacy[- ]first|private by design|privacy-focused/],
  ["says when it launched or relaunched", /(launched|relaunched|since) (in )?(october |oct\.? )?20\d\d/],
  ["names who runs it", /(run|built|made|maintained|operated) by|owner/]])
  if (!re.test(brandText)) flag("brand fact missing on home + /about/", "/", label);

// Report
const order = [...issues.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`seo-audit: ${pages.length} pages from sitemap.xml (static HTML, no JavaScript)`);
const avg = (k, f) => { const l = pages.filter(p => !p.missing && family(p) === f); return l.length ? Math.round(l.reduce((t, p) => t + p[k], 0) / l.length * (k === "unique" ? 100 : 1)) : 0; };
for (const f of ["page", "sector", "coin"]) console.log(`  ${f} pages: ${pages.filter(p => !p.missing && family(p) === f).length}, avg ${avg("words", f)} visible words, avg ${avg("unique", f)}% own phrases (vs same family)`);
for (const [check, list] of order) {
  const ex = list.slice(0, 4).map(i => `${i.page}${i.detail ? ` (${String(i.detail).slice(0, 70)})` : ""}`).join("; ");
  console.log(`- ${check}: ${list.length} — ${ex}${list.length > 4 ? "; …" : ""}`);
}
if (!order.length) console.log("- no findings");
if (args.includes("--pages")) {
  console.log("\npath | words | own% | inbound");
  for (const p of pages.filter(x => !x.missing)) console.log(`${p.path} | ${p.words} | ${Math.round(p.unique * 100) || "-"} | ${inbound.get(p.path)}`);
}
console.log(`seo-audit: ${order.reduce((t, [, l]) => t + l.length, 0)} finding(s) in ${order.length} check(s)`);
