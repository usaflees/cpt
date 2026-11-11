// Shared helpers for reading/writing assets/coins.js (the coin registry).
// assets/coins.js is a plain browser script (`var CPT_COINS = [...]`), so Node
// evaluates it in a sandbox instead of importing it.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const REGISTRY_PATH = ROOT + "assets/coins.js";

export function loadRegistry() {
  const sandbox = {};
  vm.runInNewContext(readFileSync(REGISTRY_PATH, "utf8"), sandbox);
  return { coins: sandbox.CPT_COINS, updated: sandbox.CPT_COINS_UPDATED };
}

const HEADER = `// CryptoPriceTicker.com — coin registry (single source of truth for the table, widgets and /coin/ pages).
//
//   sym      ticker symbol (also the /coin/<sym>/ URL, lower-cased)
//   name     display name
//   supply   circulating supply in millions (market cap = live price × supply)
//   price    USD seed price, shown only until the first live tick arrives
//   sectors  any of: L1 L2 DePIN AI DeFi RWA Privacy Gaming Meme Stable
//   feeds    exchanges with a live USD/USDT market: CB = Coinbase, BN = Binance, KR = Kraken
//   tickers  (optional) exchange-specific ticker when it differs from sym, e.g. { CB: "TON" }
//   formerly (optional) previous ticker; old watchlists/portfolios and /coin/<old>/ links are migrated
//   logo     (generated) true when coin-icons/<sym>.svg exists; set by scripts/build-coin-icons.mjs
//   mono     (generated) "light" or "dark" when that logo is a single white or black mark, so the
//            page can flip it on a background of the same tone (see .mono-light / .mono-dark in app.css)
//
// To add a coin: add a line with sym/name/sectors (supply/price 0, feeds []), then run
//   node scripts/refresh-coins.mjs      (fills supply, seed price and verified feeds)
//   node scripts/build-coin-pages.mjs   (regenerates /coin/ pages, sitemap.xml, home-page coin links)
`;

// "light" / "dark" when every colour in a vector logo is near-white / near-black, otherwise null.
// Such a mark disappears on a background of its own tone (white XRP on the Light theme, black
// Stellar on the dark themes). Rasterized logos (detailed artwork) are never single-tone.
export function logoTone(svg) {
  if (/<image\b/.test(svg)) return null;
  const hex = [...svg.matchAll(/(?:fill|stroke|stop-color)="#([0-9a-f]{3}|[0-9a-f]{6})"/gi)].map(m => m[1]);
  // Anything this can't read (named colours, rgb(), styles, a shape with no fill) means "don't touch".
  const other = [...svg.matchAll(/(?:fill|stroke|stop-color)="([^"#][^"]*)"/gi)].map(m => m[1]).filter(v => v !== "none" && !v.startsWith("url("));
  if (!hex.length || other.length || /style=|<style/.test(svg)) return null;
  const luma = h => {
    const [r, g, b] = (h.length === 3 ? [...h].map(ch => ch + ch) : h.match(/../g)).map(x => parseInt(x, 16));
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  const l = hex.map(luma);
  return l.every(v => v > 0.82) ? "light" : l.every(v => v < 0.12) ? "dark" : null;
}

const num = n => (n ? String(Number(n.toPrecision(6))) : "0");

export function writeRegistry(coins, updated) {
  const lines = coins.map(c =>
    `  { sym: ${JSON.stringify(c.sym)}, name: ${JSON.stringify(c.name)}, supply: ${num(c.supply)}, price: ${num(c.price)}, ` +
    `sectors: ${JSON.stringify(c.sectors)}, feeds: ${JSON.stringify(c.feeds)}` +
    (c.tickers ? `, tickers: ${JSON.stringify(c.tickers).replace(/"(\w+)":/g, "$1: ")}` : "") +
    (c.formerly ? `, formerly: ${JSON.stringify(c.formerly)}` : "") +
    (c.logo ? ", logo: true" : "") + (c.logo && c.mono ? `, mono: ${JSON.stringify(c.mono)}` : "") + " }"
  );
  const out = `${HEADER}var CPT_COINS_UPDATED = ${JSON.stringify(updated)};\nvar CPT_COINS = [\n${lines.join(",\n")}\n];\n`;
  writeFileSync(REGISTRY_PATH, out.replace(/","/g, '", "'));
}
