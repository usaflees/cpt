#!/usr/bin/env node
// Copies the files the live site serves into <outdir>, for the public mirror repository
// (.github/workflows/publish-public.yml; DECISIONS 2026-11-23). The working files stay out: everything
// _routes.json sends to the 404 middleware (scripts, docs, content, tests, .claude, .github, functions,
// CLAUDE.md, README.md, SECURITY.md, .gitignore), plus _routes.json, .gitattributes, _headers and _redirects. So the mirror holds
// exactly what a visitor's browser can already download, and nothing about how it is built.
// Only files tracked by git are copied. Writes a README.md of its own. Installs nothing, needs no network.
// Usage: node scripts/build-public-mirror.mjs <outdir>   (outdir must not exist yet)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith("-")) {
  console.error("usage: node scripts/build-public-mirror.mjs <outdir>");
  process.exit(2);
}
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const OUT = resolve(args[0]);
if (existsSync(OUT)) { console.error(`${OUT} already exists`); process.exit(2); }
if (OUT === ROOT || OUT.startsWith(ROOT + "/")) { console.error("outdir must be outside the repository"); process.exit(2); }

// Hidden paths come from the same list the live site uses, so the two can't drift apart.
const routes = JSON.parse(readFileSync(join(ROOT, "_routes.json"), "utf8"));
// _headers and _redirects are Cloudflare settings, not files a browser can download.
const hidden = new Set(["/_routes.json", "/.gitattributes", "/_headers", "/_redirects"]);
for (const p of routes.include || []) hidden.add(p.replace(/\/\*$/, "").toLowerCase());
const isHidden = file => {
  const p = "/" + file.toLowerCase();
  for (const h of hidden) if (p === h || p.startsWith(h + "/")) return true;
  return false;
};

const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
let copied = 0;
for (const f of files) {
  if (isHidden(f)) continue;
  const to = join(OUT, f);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(ROOT, f), to);
  copied++;
}

writeFileSync(join(OUT, "README.md"), `# CryptoPriceTicker.com

The files that [cryptopriceticker.com](https://cryptopriceticker.com/) serves: every page, script, stylesheet
and image a visitor's browser downloads, published here within a day of each change. Compare them with what
your browser receives (View source) to check that the site does what its [Trust page](https://cryptopriceticker.com/trust/)
says.

Prices load in your browser straight from the public Coinbase, Binance and Kraken feeds. The site has no
accounts, no payments and no wallet connections, and it is hosted on Cloudflare Pages.

Spotted a wrong price, figure or description, or a copy of the site at another address? Please open an issue.
`);

console.log(`public mirror: ${copied} files copied to ${OUT}, ${files.length - copied} working files left out`);
