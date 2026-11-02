// Part of the QA suite (see tests/README.md). Usage: node tests/smoke.cjs [base-url] [screenshot-dir]
const OUT = process.argv[3] || require('node:path').join(require('node:os').tmpdir(), 'cpt-qa');
require('node:fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
(async () => {
  const b = await chromium.launch(); const issues = [];
  const watch = (p, label) => {
    p.on('console', m => { if (m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) issues.push(`${label}: ${m.text().slice(0, 160)}`); });
    p.on('pageerror', e => issues.push(`${label}: PAGEERROR ${e.message}`));
  };
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); watch(p, 'home');
  await p.goto(B + '/'); await p.waitForFunction(() => document.querySelectorAll('#tableBody tr').length >= 50); await p.click('#showAllBtn'); await p.waitForFunction(() => document.querySelectorAll('#tableBody tr').length > 100); await p.waitForTimeout(12000);
  console.log('HOME', JSON.stringify(await p.evaluate(() => ({
    rows: document.querySelectorAll('#tableBody tr').length,
    badges: ['CB', 'BN', 'KR'].map(x => document.getElementById('badge' + x).textContent),
    stillBoot: [...document.querySelectorAll('.ex-badge')].filter(e => e.textContent === '…').map(e => e.id.slice(4)),
    sparks7d: [...document.querySelectorAll('[id^="chg7-"]')].filter(e => e.textContent.trim() !== '—').length,
    movers: document.querySelectorAll('.mover-card:not(.skeleton)').length,
    stats: ['globalMcap', 'globalVol', 'btcDom'].map(i => document.getElementById(i).textContent),
    h1: document.querySelector('h1').textContent,
    unlabeled: [...document.querySelectorAll('button')].filter(x => !x.textContent.trim() && !x.getAttribute('aria-label') && !x.title).length,
  }))));
  await p.click('#row-BTC .more-btn'); await p.fill('#md-alert', '123456'); await p.waitForTimeout(2000);
  console.log('alert input kept:', await p.inputValue('#md-alert'), '| depth', await p.textContent('#md-depth'));
  await p.fill('#md-hold', '0.5'); await p.press('#md-hold', 'Tab'); await p.waitForTimeout(300);
  await p.click('#md-actions [data-action="toggle-pin"]'); await p.waitForTimeout(300);
  console.log('quick view: holdings', await p.evaluate(() => localStorage.getItem('cpt_bag')), '| pin', await p.evaluate(() => localStorage.getItem('cpt_pin')), '| title', await p.title());
  await p.keyboard.press('Escape');
  console.log('focus back on:', await p.evaluate(() => document.activeElement.className));
  await p.click('[data-sector="BAG"]'); await p.waitForTimeout(300);
  console.log('My bag tab: rows', await p.evaluate(() => document.querySelectorAll('#tableBody tr[data-sym]').length), '| banner visible', await p.isVisible('#bagBanner'), '| holdings col visible', await p.isVisible('#row-BTC .col-bag'));
  await p.click('[data-sector="ALL"]');
  await p.focus('th[data-sort="change7d"] button'); await p.keyboard.press('Enter');
  console.log('sort by 7d:', await p.getAttribute('th[data-sort="change7d"]', 'aria-sort'));
  await p.click('.menu-pop summary'); await p.click('.menu-list [data-action="open-widget"]'); await p.waitForTimeout(500);
  const snip = await p.inputValue('#wgEmbedCode'); console.log('widget builder:', snip.match(/>([^<]+)<\/a>/)[1], '| menu closed:', !(await p.evaluate(() => document.querySelector('.menu-pop').open)));
  await p.keyboard.press('Escape');
  await p.goto(B + '/?sector=AI'); await p.waitForTimeout(1500);
  console.log('?sector=AI preselect:', await p.evaluate(() => document.querySelector('.chip.active').dataset.sector), await p.evaluate(() => document.querySelectorAll('#tableBody tr[data-sym]').length), 'rows');
  console.log('service worker:', await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));
  for (const path of ['/coin/btc/', '/coin/gram/', '/sector/ai/', '/sector/stablecoins/', '/widgets/', '/about/']) {
    const q = await ctx.newPage(); watch(q, path); await q.goto(B + path); await q.waitForTimeout(path.startsWith('/coin') ? 6000 : 2500);
    const r = await q.evaluate(() => ({ h1: document.querySelector('h1').textContent.trim().slice(0, 50), price: document.getElementById('cpPrice')?.textContent, rows: document.querySelectorAll('table tbody tr').length, crumbs: [...document.querySelectorAll('.breadcrumb a')].map(a => a.textContent).join(' › ') }));
    console.log(path, JSON.stringify(r)); await q.close();
  }
  const e = await ctx.newPage(); watch(e, 'embed'); await e.goto(B + '/embed/?layout=grid&coins=BTC,ETH,SOL,TAO'); await e.waitForTimeout(4000);
  console.log('embed grid prices:', await e.evaluate(() => [...document.querySelectorAll('[data-wg-price]')].map(x => x.textContent).join(' ')));
  const m = await b.newPage({ viewport: { width: 390, height: 844 } }); watch(m, 'mobile'); await m.goto(B + '/'); await m.waitForTimeout(3000);
  console.log('mobile overflow px:', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  const n = await ctx.newPage(); console.log('404 status:', (await n.goto(B + '/nope')).status());
  console.log(`ISSUES (${issues.length}):\n` + [...new Set(issues)].filter(i => !i.startsWith('404')).slice(0, 20).join('\n')); process.exitCode = [...new Set(issues)].filter(i => !i.startsWith('404')).length ? 1 : 0;
  await b.close();
})();
