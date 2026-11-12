#!/usr/bin/env node
// Renders the 1200×630 social-share images for the comparison pages (og/compare-<a>-vs-<b>.jpg) and the
// sector benchmark hubs (og/category-<slug>.jpg) that scripts/build-seo-engine.mjs generates.
// Images contain no prices, so rerun only when content/quant-config.json gains a comparison or sector.
//
//   node scripts/build-quant-og.cjs          (needs Playwright + Chromium installed)
// A page whose image is missing falls back to /og-image.jpg.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

if (process.argv.length > 2) { console.error("usage: node scripts/build-quant-og.cjs"); process.exit(1); }
const ROOT = path.join(__dirname, "..");
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "assets/coins.js"), "utf8"), sandbox);
const bySym = new Map(sandbox.CPT_COINS.map(c => [c.sym, c]));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "content/quant-config.json"), "utf8"));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clean = n => n.replace(/\s*\(formerly [^)]+\)/, "");
const slugify = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const brand = fs.readFileSync(path.join(ROOT, "brand/mark-glow.svg"), "utf8").replace("<svg ", '<svg width="68" height="68" ');
const logoOf = c => {
  const f = path.join(ROOT, "coin-icons", c.sym.toLowerCase() + ".svg");
  return c.logo && fs.existsSync(f) ? "data:image/svg+xml;base64," + fs.readFileSync(f).toString("base64") : null;
};
const badge = c => `<div style="width:138px;height:138px;border-radius:50%;padding:5px;box-sizing:border-box;flex-shrink:0;background:linear-gradient(45deg,#ff3fd8,#9b5cff 50%,#22e8ff);box-shadow:0 0 34px rgba(155,92,255,.65)">
  <div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 50% 35%,#2b1366,#120a2e 70%);display:flex;align-items:center;justify-content:center;font-family:'DejaVu Sans Mono',monospace;font-weight:800;font-size:${c.sym.length > 4 ? 30 : 40}px;color:#ffc63a">${logoOf(c) ? `<img src="${logoOf(c)}" width="84" height="84" style="filter:drop-shadow(0 0 2px rgba(255,255,255,.5))">` : esc(c.sym.slice(0, 6))}</div></div>`;
// Same frame as the coin cards (scripts/build-og-images.cjs): brand palette, no prices.
const frame = (top, line, tags) => `<!DOCTYPE html><html><body style="margin:0">
<div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 76px;position:relative;overflow:hidden;
  background:radial-gradient(760px 460px at 92% -8%,rgba(155,92,255,.42),transparent 62%),radial-gradient(620px 420px at -6% 112%,rgba(255,63,216,.22),transparent 60%),
  linear-gradient(rgba(34,232,255,.06) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,rgba(34,232,255,.06) 1px,transparent 1px) 0 0/48px 48px,#08051c;
  font-family:'DejaVu Sans',Arial,sans-serif;color:#f4f0ff">
  ${top}
  <div style="font-size:36px;font-weight:700;margin-top:52px;line-height:1.3">${line}</div>
  <div style="display:flex;gap:12px;margin-top:28px">${tags.map(t => `<span style="font-size:24px;font-weight:700;padding:8px 18px;border-radius:999px;background:rgba(43,19,102,.65);border:2px solid rgba(155,92,255,.55);color:#e9ddff">${esc(t)}</span>`).join("")}</div>
  <div style="position:absolute;left:76px;right:76px;bottom:54px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">${brand}<span style="font-size:32px;font-weight:800">CryptoPriceTicker<span style="color:#ffc63a">.com</span></span></div>
    <span style="font-size:24px;color:#b9a8e8;font-family:'DejaVu Sans Mono',monospace">open quant dataset</span>
  </div>
</div></body></html>`;
const compareCard = (a, b) => frame(
  `<div style="display:flex;align-items:center;gap:26px">${badge(a)}<div style="font-size:54px;font-weight:800;color:#22e8ff">vs</div>${badge(b)}
    <div style="margin-left:14px"><div style="font-size:${(clean(a.name) + clean(b.name)).length > 22 ? 44 : 56}px;font-weight:800;letter-spacing:-1.5px;line-height:1.08;max-width:640px">${esc(clean(a.name))} vs ${esc(clean(b.name))}</div>
    <div style="font-size:32px;color:#b9a8e8;font-family:'DejaVu Sans Mono',monospace;margin-top:10px">${esc(a.sym)} · ${esc(b.sym)}</div></div></div>`,
  "Market cap parity price, FDV, turnover velocity<br>and all-time-high recovery multiple, side by side.", ["Flippening calculator", "Comparison matrix"]);
const sectorCard = (s, members) => frame(
  `<div style="display:flex;align-items:center;gap:22px">${members.slice(0, 3).map(badge).join("")}
    <div style="margin-left:14px"><div style="font-size:${s.name.length > 14 ? 48 : 62}px;font-weight:800;letter-spacing:-1.5px;line-height:1.05">${esc(s.name)}</div>
    <div style="font-size:32px;color:#b9a8e8;font-family:'DejaVu Sans Mono',monospace;margin-top:10px">crypto sector <span style="color:#22e8ff">benchmarks</span></div></div></div>`,
  "Sector medians: turnover velocity, ATH drawdown,<br>supply float, FDV overhang and alpha vs Bitcoin.", ["Median benchmarks", "Per-asset tables"]);

(async () => {
  const outDir = path.join(ROOT, "og");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const shot = async (html, name) => { await page.setContent(html); await page.screenshot({ path: path.join(outDir, name), type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: 1200, height: 630 } }); };
  let n = 0;
  for (const [x, y] of cfg.comparisons) {
    const a = bySym.get(x), b = bySym.get(y);
    if (a && b) { await shot(compareCard(a, b), `compare-${slugify(a.name)}-vs-${slugify(b.name)}.jpg`); n++; }
  }
  for (const s of cfg.sectors) {
    const members = sandbox.CPT_COINS.filter(c => !c.sectors.includes("Stable") && ((s.keys || []).some(k => c.sectors.includes(k)) || (s.symbols || []).includes(c.sym)));
    await shot(sectorCard(s, members), `category-${s.slug}.jpg`); n++;
  }
  await browser.close();
  console.log(`Rendered ${n} images into og/`);
})();
