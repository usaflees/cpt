#!/usr/bin/env node
// Builds content/onchain.json: on-chain activity figures for the coin pages' "on-chain activity" section, from
// DefiLlama's free public API (no key; https://defillama.com/, figures are DefiLlama's, cited on every page).
//
//   node scripts/fetch-onchain.mjs        (no options; rewrites content/onchain.json)
//
// Two kinds of coin, set in NETWORKS and PROTOCOLS below (a coin not listed gets no section):
// - a network's own coin (ETH, SOL, ...): value locked in apps on that network now, its 30-day and 1-year change
//   and record high, stablecoins held on the network, and decentralized-exchange volume over 30 days;
// - a DeFi app's token (AAVE, UNI, ...): value locked in the app now, and fees and revenue over 30 days and a year.
// Networks are found in DefiLlama's chain list by CoinGecko id, so a renamed chain still matches.
//
// The file holds only numbers and ISO dates: nothing from an API response is printed into a page as text.
// If DefiLlama can't be reached the previous file is kept (exit 0 with a ⚠ note, so the weekly refresh goes on);
// a coin whose figures fail this week keeps last week's entry while it is under 28 days old, then drops out.
// Run it with the other fetchers before scripts/build-coin-pages.mjs (scripts/weekly-refresh.sh does).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ROOT, loadRegistry } from "./lib/registry.mjs";

if (process.argv.length > 2) { console.error("Unknown argument(s): " + process.argv.slice(2).join(" ") + "\nUsage: node scripts/fetch-onchain.mjs   (no options; rewrites content/onchain.json)"); process.exit(1); }

// Coin symbol → CoinGecko id of the network's gas token, as DefiLlama's /v2/chains lists it.
export const NETWORKS = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana", TRX: "tron", HYPE: "hyperliquid", ARB: "arbitrum",
  POL: "polygon-ecosystem-token", AVAX: "avalanche-2", SUI: "sui", OP: "optimism", XLM: "stellar", NEAR: "near",
  MNT: "mantle", STX: "blockstack", ADA: "cardano", GRAM: "the-open-network", APT: "aptos", STRK: "starknet",
  WLD: "worldcoin-wld", XRP: "ripple", RUNE: "thorchain", ALGO: "algorand", HBAR: "hedera-hashgraph", SEI: "sei-network",
  S: "sonic-3", ZK: "zksync", EGLD: "elrond-erd-2", INJ: "injective-protocol", IMX: "immutable-x", FLOW: "flow",
  ICP: "internet-computer", BCH: "bitcoin-cash", ZEC: "zcash", MANTA: "manta-network", FIL: "filecoin",
  METIS: "metis-token", IOTX: "iotex", DOGE: "dogecoin", VET: "vechain", BEAM: "beam-2", LTC: "litecoin",
  ATOM: "cosmos", TIA: "celestia", DOT: "polkadot", OKB: "okb", ETC: "ethereum-classic", ROSE: "oasis-network",
  TAO: "bittensor", KAS: "kaspa", HNT: "helium", AR: "arweave", ZEN: "zencash", THETA: "theta-token", FLUX: "zelcash"
};
// Coin symbol → DefiLlama protocol slug (checked against api.llama.fi/tvl/<slug> on 27 November 2026).
export const PROTOCOLS = {
  AAVE: "aave", UNI: "uniswap", LDO: "lido", SKY: "sky", PENDLE: "pendle", JUP: "jupiter", RAY: "raydium",
  AERO: "aerodrome", ENA: "ethena", ONDO: "ondo-finance", CRV: "curve-finance", SNX: "synthetix",
  COMP: "compound-finance", DYDX: "dydx", CAKE: "pancakeswap", MORPHO: "morpho", ASTER: "aster", LRC: "loopring",
  "1INCH": "1inch-network"
};

const OUT = ROOT + "content/onchain.json";
const DAY = 86400e3;
const KEEP_DAYS = 28;
const API = "https://api.llama.fi", STABLES = "https://stablecoins.llama.fi";
const unmatched = []; // NETWORKS ids with no chain in DefiLlama's list (no TVL tracked, or the id changed)
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  await sleep(250); // DefiLlama asks clients to go easy; about 150 requests a week at this pace.
  const res = await fetch(url, { headers: { "user-agent": "cryptopriceticker-onchain/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// A finite, non-negative number rounded to whole dollars, or null.
const money = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
const pct = (now, then) => (now > 0 && then > 0 ? +(((now - then) / then) * 100).toFixed(2) : null);
const isoDay = t => new Date(t).toISOString().slice(0, 10);
const prune = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

// Daily [{ date: unixSeconds, tvl }] → figures. Ignores today's partial point.
export function chainTvlFigures(points) {
  const today = Math.floor(Date.now() / DAY) * DAY;
  const days = points.filter(p => p && p.date * 1000 < today && money(p.tvl) !== null);
  if (days.length < 31) return null;
  const last = days[days.length - 1];
  const back = n => (days.length > n ? days[days.length - 1 - n].tvl : null);
  const ath = days.reduce((a, p) => (p.tvl > a.tvl ? p : a), days[0]);
  return {
    asOf: isoDay(last.date * 1000), tvl: money(last.tvl), tvlChange30d: pct(last.tvl, back(30)), tvlChange1y: pct(last.tvl, back(365)),
    tvlAth: money(ath.tvl), tvlAthDate: isoDay(ath.date * 1000), historyStart: isoDay(days[0].date * 1000)
  };
}

async function network(gecko, chains, stables) {
  const matches = chains.filter(c => c && c.gecko_id === gecko).sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  if (!matches.length) { unmatched.push(gecko); return null; }
  const name = matches[0].name;
  const hist = chainTvlFigures(await getJson(`${API}/v2/historicalChainTvl/${encodeURIComponent(name)}`));
  if (!hist) return null;
  const st = stables.find(s => s && s.name === name);
  let dex30d = null, dexChange30d = null;
  try {
    const d = await getJson(`${API}/overview/dexs/${encodeURIComponent(name)}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`);
    dex30d = money(d.total30d);
    dexChange30d = dex30d && typeof d.change_30dover30d === "number" && Number.isFinite(d.change_30dover30d) ? +d.change_30dover30d.toFixed(2) : null;
  } catch { /* many networks have no DEX tracked: leave it out */ }
  return prune({ kind: "network", ...hist, stablecoins: money(st?.totalCirculatingUSD?.peggedUSD), dex30d, dexChange30d });
}

async function protocol(slug) {
  const tvl = money(await getJson(`${API}/tvl/${encodeURIComponent(slug)}`));
  const out = { kind: "protocol", asOf: isoDay(Date.now() - DAY), tvl };
  for (const [key, type] of [["fees", "dailyFees"], ["revenue", "dailyRevenue"]]) {
    try {
      const f = await getJson(`${API}/summary/fees/${encodeURIComponent(slug)}?dataType=${type}`);
      out[`${key}30d`] = money(f.total30d);
      out[`${key}1y`] = money(f.total1y);
    } catch { /* not every app reports fees or revenue */ }
  }
  const e = prune(out);
  return Object.keys(e).length > 2 ? e : null;
}

async function main() {
  const coins = new Set(loadRegistry().coins.map(c => c.sym));
  const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).coins || {} : {};
  let chains, stables;
  try {
    chains = await getJson(`${API}/v2/chains`);
    stables = await getJson(`${STABLES}/stablecoinchains`);
    if (!Array.isArray(chains) || !Array.isArray(stables)) throw new Error("unexpected response shape");
  } catch (err) {
    console.log(`⚠ onchain: DefiLlama unreachable (${err.message}); kept the previous content/onchain.json`);
    return;
  }
  const result = {}, failed = [];
  const jobs = [...Object.entries(NETWORKS).map(([s, g]) => [s, () => network(g, chains, stables)]),
    ...Object.entries(PROTOCOLS).map(([s, slug]) => [s, () => protocol(slug)])].filter(([s]) => coins.has(s));
  for (const [sym, run] of jobs) {
    let entry = null;
    try { entry = await run(); } catch (err) { failed.push(`${sym} (${err.message.split(" ")[0]})`); }
    if (!entry && before[sym] && Date.now() - Date.parse(before[sym].asOf) < KEEP_DAYS * DAY) entry = before[sym];
    if (entry) result[sym] = entry;
  }
  if (Object.keys(result).length < Object.keys(before).length / 2) {
    console.log(`⚠ onchain: only ${Object.keys(result).length} coins this week (was ${Object.keys(before).length}); kept the previous content/onchain.json`);
    return;
  }
  const updated = Object.values(result).map(e => e.asOf).sort().pop() || isoDay(Date.now());
  const body = Object.keys(result).sort().map(s => `  ${JSON.stringify(s)}: ${JSON.stringify(result[s])}`).join(",\n");
  writeFileSync(OUT, `{\n "updated": ${JSON.stringify(updated)},\n "source": "DefiLlama",\n "coins": {\n${body}\n }\n}\n`);
  if (failed.length) console.log(`⚠ onchain: no figures this week for ${failed.join(", ")}`);
  if (unmatched.length) console.log(`onchain: not in DefiLlama's chain list: ${unmatched.join(", ")}`);
  console.log(`onchain: ${Object.keys(result).length} coins (${Object.values(result).filter(e => e.kind === "network").length} networks, ${Object.values(result).filter(e => e.kind === "protocol").length} apps), as of ${updated}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(err => { console.error(err); process.exit(1); });
