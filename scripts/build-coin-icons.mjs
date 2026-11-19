#!/usr/bin/env node
// Builds coin-icons/<sym>.svg (self-hosted coin logos) from open-source icon packs, and marks
// each coin that got one with `logo: true` in assets/coins.js (plus `mono: "light" | "dark"` when
// the logo is a single white or black mark). Coins without a logo keep the text badge, so a
// missing icon never breaks a page.
//
// Sources (fetched with npm pack into a scratch folder you pass in, never committed):
//   @web3icons/core      MIT    tokens + network (chain) logos
//   @token-icons/core    MIT    older release of the same project; fills a few gaps
//   cryptocurrency-icons CC0    public domain
//
//   mkdir /tmp/icons && cd /tmp/icons && npm pack @web3icons/core @token-icons/core cryptocurrency-icons
//   for f in *.tgz; do mkdir "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done
//   node scripts/build-coin-icons.mjs /tmp/icons
//   node scripts/build-coin-pages.mjs
//
//   node scripts/build-coin-icons.mjs --tones   only re-reads the logos already in coin-icons/ and
//                                               rewrites the `mono` marks (no icon packs needed)
//
// Every icon is shrunk with svgo (npx, not a dependency). A logo whose vector file is still over
// MAX_BYTES (very detailed artwork such as DOGE or PEPE) is rasterized once in Chromium to a
// 64 px WebP wrapped in an SVG, so every logo keeps the same /coin-icons/<sym>.svg URL.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { ROOT, loadRegistry, writeRegistry, logoTone } from "./lib/registry.mjs";

const OUT = join(ROOT, "coin-icons");
// Single-tone marks: recorded in the registry so pages can flip them where they would vanish.
const markTones = coins => {
  const mono = [];
  for (const c of coins) {
    const f = join(OUT, `${c.sym.toLowerCase()}.svg`);
    const tone = c.logo && existsSync(f) ? logoTone(readFileSync(f, "utf8")) : null;
    if (tone) { c.mono = tone; mono.push(`${c.sym} (${tone})`); } else delete c.mono;
  }
  return mono;
};
if (process.argv[2] === "--tones" && process.argv.length === 3) {
  const { coins, updated } = loadRegistry();
  const mono = markTones(coins);
  writeRegistry(coins, updated);
  console.log(`${mono.length} single-tone logos: ${mono.join(", ")}`);
  process.exit(0);
}
const SRC = process.argv[2];
if (process.argv.length !== 3 || !SRC || !existsSync(SRC)) { console.error("usage: node scripts/build-coin-icons.mjs <folder with unpacked icon packages> | --tones"); process.exit(1); }
const MAX_BYTES = 6000;

const dirOf = prefix => { const d = readdirSync(SRC).find(n => n.startsWith(prefix) && !n.endsWith(".tgz")); return d && join(SRC, d, "package"); };
const w3 = dirOf("web3icons-core-"), ti = dirOf("token-icons-core-"), cc = dirOf("cryptocurrency-icons-");

// web3icons ships each SVG as a JS module: `var X = '<svg…>'; export { X as default }`
const fromModule = file => {
  const box = {};
  vm.runInNewContext(readFileSync(file, "utf8").replace(/export\s*\{[^}]*\}\s*;?/, "").replace(/^var (\w+) =/m, "box.svg ="), { box });
  return box.svg;
};
const tryRead = (...cands) => { for (const [kind, f] of cands) if (f && existsSync(f)) return kind === "module" ? fromModule(f) : readFileSync(f, "utf8"); return null; };

// Chain logos that are the coin's own mark (same project, same artwork).
const NETWORK = { HYPE: "hyper-evm", S: "sonic", WLD: "world", MANTA: "manta-pacific", ZK: "zksync", INJ: "injective",
  ARB: "arbitrum-one", APT: "aptos", BEAM: "beam", GRAM: "ton" };
// The token packs file a different project under these tickers (checked by eye on a contact
// sheet), so the chain logo is used first.
const NETWORK_FIRST = new Set(["ARB", "APT", "BEAM", "GRAM"]);
// No correct logo in any pack: the token art under these tickers belongs to another project
// (Skycoin, not Sky/Maker; not Bittensor's tau). They keep the text badge.
const EXCLUDE = new Set(["SKY", "TAO"]);
// Old ticker used by a pack for the same, rebranded project.
const ALIAS = { RENDER: "RNDR" };

const source = sym => {
  if (EXCLUDE.has(sym)) return null;
  const t = ALIAS[sym] || sym;
  const net = ["module", w3 && NETWORK[sym] && join(w3, "dist/svgs/networks/branded", `${NETWORK[sym]}.svg.js`)];
  if (NETWORK_FIRST.has(sym)) return tryRead(net);
  return tryRead(
    ["module", w3 && join(w3, "dist/svgs/tokens/branded", `${t}.svg.js`)],
    ["file", ti && join(ti, "dist/svgs/tokens/branded", `${t}.svg`)],
    ["file", cc && join(cc, "svg/color", `${t.toLowerCase()}.svg`)],
    net,
  );
};

const { coins, updated } = loadRegistry();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, ".raw");
mkdirSync(tmp);
const got = new Set(), skipped = [];
for (const c of coins) {
  const svg = source(c.sym);
  if (!svg) continue;
  // Strip pack-specific classes and fixed sizes; the page sets the size.
  writeFileSync(join(tmp, `${c.sym.toLowerCase()}.svg`), svg.replace(/\sclass="web3icons"/, "").replace(/\s(width|height)="\d+"/g, ""));
}
execFileSync("npx", ["--yes", "svgo@4", "--quiet", "--multipass", "-f", tmp, "-o", OUT], { stdio: "inherit" });
rmSync(tmp, { recursive: true });
const heavy = [];
for (const f of readdirSync(OUT)) {
  const size = readFileSync(join(OUT, f)).length, sym = f.replace(/\.svg$/, "").toUpperCase();
  if (size > MAX_BYTES) heavy.push(f); else got.add(sym);
}
if (heavy.length) {
  const { chromium } = createRequire(import.meta.url)("playwright"); // pre-installed with Chromium; not a dependency
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const f of heavy) {
    const src = "data:image/svg+xml;base64," + readFileSync(join(OUT, f)).toString("base64");
    const webp = await page.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode();
      const cv = document.createElement("canvas"); cv.width = cv.height = 64;
      cv.getContext("2d").drawImage(img, 0, 0, 64, 64);
      return cv.toDataURL("image/webp", 0.9);
    }, src);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="${webp}"/></svg>`;
    const sym = f.replace(/\.svg$/, "").toUpperCase();
    if (svg.length > MAX_BYTES) { rmSync(join(OUT, f)); skipped.push(`${sym} (${svg.length} B as WebP)`); continue; }
    writeFileSync(join(OUT, f), svg);
    got.add(sym);
  }
  await browser.close();
}
for (const c of coins) { if (got.has(c.sym)) c.logo = true; else delete c.logo; }
const mono = markTones(coins);
writeRegistry(coins, updated);
writeFileSync(join(OUT, "LICENSES.md"), `# Coin logos

Each logo is the trademark of its project and is shown only to identify the coin.

The SVG files come from open-source icon packs and were optimized with svgo:

- [@web3icons/core](https://github.com/0xa3k5/web3icons): MIT License, Copyright (c) 0xa3k5
- [@token-icons/core](https://github.com/0xa3k5/token-icons): MIT License, Copyright (c) 0xa3k5
- [cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons): CC0 1.0 (public domain)

MIT License: Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions: The above copyright notice
and this permission notice shall be included in all copies or substantial portions of the
Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`);
console.log(`${got.size} of ${coins.length} coins have a logo in coin-icons/.` + (heavy.length ? ` Rasterized (detailed artwork): ${heavy.join(", ")}.` : "") + (skipped.length ? ` Skipped as too large: ${skipped.join(", ")}` : "") + ` Single-tone: ${mono.join(", ") || "none"}.`);
