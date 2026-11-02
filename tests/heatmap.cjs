// Part of the QA suite (see tests/README.md). Usage: node tests/heatmap.cjs [base-url] [screenshot-dir]
const OUT = process.argv[3] || require('node:path').join(require('node:os').tmpdir(), 'cpt-qa');
require('node:fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8788';
(async () => {
  const browser = await chromium.launch();
  const issues = [];
  const run = async (vp, name) => {
    const page = await browser.newPage({ viewport: vp });
    page.on('console', m => { if (m.type() === 'error') issues.push(name + ' console: ' + m.text()); });
    page.on('pageerror', e => issues.push(name + ' pageerror: ' + e.message));
    await page.goto(BASE + '/heatmap/');
    await page.waitForFunction(() => /coins are up/.test(document.getElementById('hmSummary').textContent), null, { timeout: 20000 }).catch(() => issues.push(name + ' no summary'));
    await page.waitForTimeout(4000);
    const info = await page.evaluate(() => {
      const box = document.getElementById('heatmap').getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.hm-tile')];
      const area = tiles.reduce((t, e) => t + e.offsetWidth * e.offsetHeight, 0);
      const out = tiles.filter(e => { const r = e.getBoundingClientRect(); return r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1; }).length;
      const grey = tiles.filter(e => e.style.background.includes('55, 65, 81')).length;
      return { tiles: tiles.length, coverage: (area / (box.width * box.height)).toFixed(3), outside: out, grey, btc: document.getElementById('hm-BTC')?.getAttribute('aria-label'), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    console.log(name, JSON.stringify(info));
    console.log(name, 'summary:', await page.textContent('#hmSummary'));
    await page.screenshot({ path: `${OUT}/${name}-heatmap.png` });
    await page.click('[data-action=hm-group][data-group=sector]');
    await page.waitForTimeout(800);
    const g = await page.evaluate(() => ({ groups: document.querySelectorAll('.hm-group').length, labels: [...document.querySelectorAll('.hm-group-label')].map(e => e.textContent).join(','), tiles: document.querySelectorAll('.hm-tile').length, url: location.search }));
    console.log(name, 'by sector', JSON.stringify(g));
    await page.screenshot({ path: `${OUT}/${name}-heatmap-sector.png` });
    await page.click('[data-action=hm-stables]');
    await page.waitForTimeout(500);
    console.log(name, 'with stables, USDT tile:', !!(await page.$('#hm-USDT')));
    await page.click('#hm-ETH');
    await page.waitForLoadState();
    console.log(name, 'tile click ->', new URL(page.url()).pathname);
    await page.close();
  };
  await run({ width: 1366, height: 900 }, 'desktop');
  await run({ width: 390, height: 844 }, 'mobile');
  console.log('ISSUES (' + issues.length + '):', issues.join('\n')); process.exitCode = issues.length ? 1 : 0;
  await browser.close();
})();
