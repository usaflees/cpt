// Part of the QA suite (see tests/README.md). Usage: node tests/search.cjs [base-url] [screenshot-dir]
const OUT = process.argv[3] || require('node:path').join(require('node:os').tmpdir(), 'cpt-qa');
require('node:fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
(async () => { const b = await chromium.launch(); const issues = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', e => issues.push(e.message)); p.on('console', m => m.type() === 'error' && issues.push(m.text()));
  for (const u of ['/coin/btc/', '/heatmap/', '/convert/', '/sector/ai/', '/widgets/', '/about/']) {
    await p.goto(B + u); await p.waitForTimeout(800);
    await p.keyboard.press('/'); const focused = await p.evaluate(() => document.activeElement.id);
    await p.keyboard.type('sol'); await p.waitForTimeout(150);
    const opts = await p.$$eval('#quickResults li', l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3));
    await p.keyboard.press('ArrowDown'); const act = await p.getAttribute('#quickSearch', 'aria-activedescendant');
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await p.waitForLoadState(); await p.waitForTimeout(300);
    console.log(u, '| "/" focuses', focused, '| results', opts.join(' / '), '| active after ↓', act, '| Enter ->', new URL(p.url()).pathname);
  }
  await p.goto(B + '/coin/eth/'); await p.fill('#quickSearch', 'ton'); await p.waitForTimeout(150);
  console.log('legacy "ton":', await p.$$eval('#quickResults li', l => l[0]?.textContent.replace(/\s+/g, ' ').trim()));
  await p.fill('#quickSearch', 'zzzz'); await p.waitForTimeout(150); console.log('no match:', await p.textContent('#quickResults'));
  await p.fill('#quickSearch', 'bit'); await p.waitForTimeout(150); await p.screenshot({ path: OUT + '/qs-desktop.png', clip: { x: 0, y: 0, width: 1366, height: 460 } });
  await p.keyboard.press('Escape'); console.log('Esc closes:', await p.$eval('#quickResults', e => e.hidden));
  // home Enter
  await p.goto(B + '/'); await p.waitForTimeout(1500); await p.fill('#searchInput', 'kaspa'); await p.press('#searchInput', 'Enter'); await p.waitForLoadState(); console.log('home Enter "kaspa" ->', new URL(p.url()).pathname);
  // theme: light system, fresh storage
  const lc = await b.newContext({ colorScheme: 'light' }); const lp = await lc.newPage(); await lp.goto(B + '/coin/btc/'); await lp.waitForTimeout(1000);
  console.log('light OS first visit:', await lp.getAttribute('html', 'data-theme'), '| saved:', await lp.evaluate(() => localStorage.getItem('cpt_theme')));
  await lp.goto(B + '/embed/?coins=BTC&layout=single'); await lp.waitForTimeout(500); console.log('embed on light OS:', await lp.getAttribute('html', 'data-theme'));
  const dc = await b.newContext({ colorScheme: 'dark' }); const dp = await dc.newPage(); await dp.goto(B + '/'); await dp.waitForTimeout(800); console.log('dark OS first visit:', await dp.getAttribute('html', 'data-theme'));
  await lp.goto(B + '/'); await lp.waitForTimeout(800); await lp.click('summary[aria-label=Menu]'); await lp.click('[data-theme-val=oled]'); await lp.reload(); await lp.waitForTimeout(500); console.log('explicit choice persists over OS:', await lp.getAttribute('html', 'data-theme'));
  // notifications
  const nc = await b.newContext({ permissions: ['notifications'] }); const np = await nc.newPage();
  await np.addInitScript(() => { window.__notes = []; const N = window.Notification; window.Notification = function (t, o) { window.__notes.push(t + ' | ' + o.body); }; window.Notification.permission = 'granted'; window.Notification.requestPermission = N.requestPermission.bind(N); Object.defineProperty(navigator, 'serviceWorker', { value: undefined }); });
  await np.goto(B + '/coin/btc/'); await np.waitForFunction(() => !document.getElementById('cpPrice').classList.contains('is-stale'), null, { timeout: 20000 });
  const price = await np.evaluate(() => parseFloat(document.getElementById('cpPrice').textContent.replace(/[$,]/g, '')));
  await np.fill('#cp-alert', String(price + 0.01)); await np.click('[data-action=save-alert]');
  await np.waitForFunction(() => window.__notes.length > 0, null, { timeout: 60000 }).catch(() => {});
  console.log('notification fired:', await np.evaluate(() => window.__notes));
  // mobile look
  const mc = await b.newContext({ viewport: { width: 375, height: 812 } }); const mp = await mc.newPage(); await mp.goto(B + '/coin/btc/'); await mp.waitForTimeout(800);
  await mp.fill('#quickSearch', 'pe'); await mp.waitForTimeout(150); await mp.screenshot({ path: OUT + '/qs-mobile.png', clip: { x: 0, y: 0, width: 375, height: 520 } });
  console.log('mobile overflow', await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  console.log('ISSUES (' + issues.length + ')', issues.join('\n')); process.exitCode = issues.length ? 1 : 0; await b.close(); })();
