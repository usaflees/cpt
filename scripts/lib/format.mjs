// Text and number formatting shared by the page builder (scripts/build-coin-pages.mjs) and the Bell Brief renderer
// (scripts/lib/bell-html.mjs, also bundled into the Cloudflare Worker in scripts/bell-worker/). Plain JavaScript only.

export const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// Same rules as fmtPrice/fmtCompact in assets/app.js (USD only).
export function usd(v) {
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (v >= 0.01) return "$" + v.toFixed(4);
  if (v >= 0.0001) return "$" + v.toFixed(6);
  // Tiny prices keep three significant digits (MOG at 8.1e-8 read "$0.00000008").
  if (!(v > 0) || !Number.isFinite(v)) return v === 0 ? "$0.00" : "—";
  return "$" + v.toFixed(Math.min(20, Math.max(8, 2 - Math.floor(Math.log10(v)))));
}

export const pctText = v => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
export const pctClass = v => (v === null || v === undefined ? "" : v >= 0 ? "chg-up" : "chg-down");
