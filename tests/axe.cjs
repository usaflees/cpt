// Accessibility scan (axe-core) of every page type in two themes. Needs axe-core:
//   npm i --no-save --prefix /tmp/cpt-axe axe-core@4.10.2 && AXE=/tmp/cpt-axe/node_modules/axe-core/axe.min.js node tests/axe.cjs
const fs = require('node:fs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8788';
let src = process.env.AXE;
try { src = src || require.resolve('axe-core/axe.min.js'); } catch (_) {}
if (!src || !fs.existsSync(src)) { console.log('axe: skipped (axe-core not installed; see the header of tests/axe.cjs)'); process.exit(0); }
const axe = fs.readFileSync(src, 'utf8');
const PAGES = ['/', '/coin/btc/', '/coin/shib/', '/sector/ai/', '/heatmap/', '/convert/', '/widgets/', '/about/', '/brand/', '/accessibility/', '/trust/', '/nope', '/embed/?coins=BTC&layout=single', '/embed/?coins=BTC,ETH,SOL&layout=grid'];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ bypassCSP: true }); let bad = 0;
  for (const theme of ['kali', 'light']) for (const path of PAGES) {
    const p = await ctx.newPage();
    await p.addInitScript(t => { try { localStorage.setItem('cpt_theme', t); } catch (_) {} }, theme);
    await p.goto(BASE + path); await p.waitForTimeout(3500);
    await p.addScriptTag({ content: axe });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => `${x.impact} ${x.id} (${x.nodes.length}): ${x.nodes[0].target}`));
    if (v.length) { bad += v.length; console.log(`${theme} ${path}:\n  ` + v.join('\n  ')); }
    await p.close();
  }
  console.log(`axe: ${bad} violation(s) across ${PAGES.length} pages x 2 themes`);
  process.exitCode = bad ? 1 : 0; await b.close();
})();
