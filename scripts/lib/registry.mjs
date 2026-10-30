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
//
// To add a coin: add a line with sym/name/sectors (supply/price 0, feeds []), then run
//   node scripts/refresh-coins.mjs      (fills supply, seed price and verified feeds)
//   node scripts/build-coin-pages.mjs   (regenerates /coin/ pages, sitemap.xml, home-page coin links)
`;

const num = n => (n ? String(Number(n.toPrecision(6))) : "0");

export function writeRegistry(coins, updated) {
  const lines = coins.map(c =>
    `  { sym: ${JSON.stringify(c.sym)}, name: ${JSON.stringify(c.name)}, supply: ${num(c.supply)}, price: ${num(c.price)}, ` +
    `sectors: ${JSON.stringify(c.sectors)}, feeds: ${JSON.stringify(c.feeds)}` +
    (c.tickers ? `, tickers: ${JSON.stringify(c.tickers).replace(/"(\w+)":/g, "$1: ")}` : "") +
    (c.formerly ? `, formerly: ${JSON.stringify(c.formerly)}` : "") + " }"
  );
  const out = `${HEADER}var CPT_COINS_UPDATED = ${JSON.stringify(updated)};\nvar CPT_COINS = [\n${lines.join(",\n")}\n];\n`;
  writeFileSync(REGISTRY_PATH, out.replace(/","/g, '", "'));
}
