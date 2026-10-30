#!/usr/bin/env node
// Renders a 1200×630 social-share image per coin into og/<sym>.jpg (used by the coin pages'
// og:image). Images contain no prices, so they only need rebuilding when coins are added or renamed.
//
//   node scripts/build-og-images.cjs          (needs Playwright + Chromium installed)
// Then run node scripts/build-coin-pages.mjs so the pages point at the new images.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "assets/coins.js"), "utf8"), sandbox);
const coins = sandbox.CPT_COINS;
const SECTOR_NAMES = { L1: "Layer 1", L2: "Layer 2", DePIN: "DePIN", AI: "AI", DeFi: "DeFi", RWA: "Real-world assets", Privacy: "Privacy", Gaming: "Gaming", Meme: "Memecoin", Stable: "Stablecoin" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const logo = fs.readFileSync(path.join(ROOT, "favicon.svg"), "utf8").replace("<svg ", '<svg width="64" height="64" ');

const card = c => `<!DOCTYPE html><html><body style="margin:0">
<div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 76px;position:relative;overflow:hidden;
  background:radial-gradient(900px 500px at 90% -10%,rgba(56,189,248,.28),transparent 60%),#0a0e17;
  font-family:'DejaVu Sans',Arial,sans-serif;color:#f1f5f9">
  <div style="display:flex;align-items:center;gap:30px">
    <div style="width:132px;height:132px;border-radius:50%;background:#111827;border:3px solid #38bdf8;display:flex;align-items:center;justify-content:center;
      font-family:'DejaVu Sans Mono',monospace;font-weight:800;font-size:${c.sym.length > 4 ? 30 : 40}px;color:#38bdf8">${esc(c.sym.slice(0, 6))}</div>
    <div>
      <div style="font-size:${c.name.length > 26 ? 44 : 62}px;font-weight:800;letter-spacing:-1.5px;line-height:1.05;max-width:880px">${esc(c.name.replace(/\s*\(formerly [^)]+\)/, ""))}</div>
      <div style="font-size:34px;color:#94a3b8;font-family:'DejaVu Sans Mono',monospace;margin-top:10px">${esc(c.sym)} · live price</div>
    </div>
  </div>
  <div style="font-size:38px;font-weight:700;margin-top:64px;line-height:1.3">Live price, 7-day trend, 52-week range<br>and price history, straight from the exchanges.</div>
  <div style="display:flex;gap:12px;margin-top:30px">${c.sectors.map(s => `<span style="font-size:24px;font-weight:700;padding:8px 18px;border-radius:999px;background:#111827;border:2px solid #1e293b;color:#38bdf8">${esc(SECTOR_NAMES[s] || s)}</span>`).join("")}</div>
  <div style="position:absolute;left:76px;right:76px;bottom:54px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">${logo}<span style="font-size:32px;font-weight:800">CryptoPriceTicker<span style="color:#38bdf8">.com</span></span></div>
    <span style="font-size:24px;color:#94a3b8;font-family:'DejaVu Sans Mono',monospace">Coinbase · Binance · Kraken</span>
  </div>
</div></body></html>`;

(async () => {
  const outDir = path.join(ROOT, "og");
  fs.mkdirSync(outDir, { recursive: true });
  const keep = new Set(coins.map(c => c.sym.toLowerCase() + ".jpg"));
  for (const f of fs.readdirSync(outDir)) if (!keep.has(f)) fs.unlinkSync(path.join(outDir, f));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const c of coins) {
    await page.setContent(card(c));
    await page.screenshot({ path: path.join(outDir, c.sym.toLowerCase() + ".jpg"), type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  }
  await browser.close();
  console.log(`Rendered ${coins.length} images into og/`);
})();
