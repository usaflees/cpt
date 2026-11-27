// Part of the QA suite (see tests/README.md). Coin pages: "Where are the big orders waiting?" (assets/walls.js).
// Unit checks on the band width, grouping and ranking, then in the browser: no order book is read before the box
// comes into view, three buy walls sit below the price and three sell walls above it, all within 2%, the box keeps
// working on its second read 20 s later, and there is no sideways scroll at 375 px.
// Usage: node tests/walls.cjs [base-url]
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const issues = []; const check = (ok, msg) => { if (!ok) issues.push(msg); };

// 1. Bands without a browser.
const ctx = { self: {}, window: {}, document: { getElementById: () => null } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/walls.js'), 'utf8'), ctx);
const { width, bands, top, pulledOf } = ctx.self.cptWalls;
check(width(91234) === 100 && width(3456) === 2 && width(0.1234) === 0.0001 && width(160) === 0.2 && width(6000) === 5, `band width: ${[91234, 3456, 0.1234, 160, 6000].map(width)}`);
const books = { BN: { bids: [['99.95', '10'], ['99.55', '100'], ['97', '1000']], asks: [['100.05', '10'], ['101.2', '50']] },
  KR: { bids: [['99.52', '20']], asks: [['101.25', '30'], ['103', '999']] } };
const b = bands(books, 0.1, 98, 102);
const bid = b.bids.get(995), ask = b.asks.get(1012);
check(b.bids.size === 2 && !b.bids.has(970) && Math.abs(bid.usd - (99.55 * 100 + 99.52 * 20)) < 1e-6 && bid.ex.KR && bid.ex.BN, `bid bands: ${JSON.stringify([...b.bids])}`);
check(Math.abs(ask.usd - (101.2 * 50 + 101.25 * 30)) < 1e-6 && !b.asks.has(1030), `ask bands: ${JSON.stringify([...b.asks])}`);
const t = top(b.bids, 3);
check(t.length === 2 && t[0].k === 995 && t[0].x === 1, `top bids: ${JSON.stringify(t)}`);
// Pulled: shrank by two thirds while the price stayed over 0.25% away and the band stayed inside the books' reach.
const was = [{ side: 'bids', k: 995, usd: 12000, ex: { BN: 1 } }, { side: 'asks', k: 1012, usd: 9000, ex: { BN: 1 } }];
const gone = { bids: new Map(), asks: new Map() };
check(pulledOf(was, gone, 0.1, 98, 102, 100, 100).length === 2, 'pulled: both walls vanished with the price 0.5% and 1.2% away');
check(pulledOf(was, gone, 0.1, 98, 102, 99.6, 100).length === 1, 'pulled: the price came within 0.25% of the buy wall, so it traded, not pulled');
check(pulledOf(was, gone, 0.1, 99.7, 102, 100, 100).length === 1, 'pulled: the buy wall is now outside what the books reach, so it is not judged');
check(pulledOf(was, { bids: new Map([[995, { usd: 5000 }]]), asks: new Map([[1012, { usd: 2000 }]]) }, 0.1, 98, 102, 100, 100).length === 1, 'pulled: only the ask lost two thirds');
console.log('unit: bands checked');

// 2. The page.
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
const seen = [];
(async () => {
  const br = await chromium.launch();
  const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const urls = []; p.on('request', r => urls.push(r.url()));
  p.on('pageerror', e => issues.push(`pageerror: ${e.message}`));
  await p.goto(B + '/coin/btc/'); await p.waitForTimeout(2500);
  // The stats panel reads Binance's book (limit=1000) on load; the walls box asks for limit=5000.
  check(!urls.some(u => /\/depth\?.*limit=5000|\/book\?|public\/Depth/.test(u)), 'an order book was read before the box came into view');
  await p.locator('#wallsOut').scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelectorAll('#wallsOut tbody tr').length >= 2, null, { timeout: 25000 })
    .catch(() => issues.push('walls table never filled in 25 s'));
  const read = () => p.evaluate(() => {
    const cap = document.querySelector('#wallsOut caption')?.textContent || '';
    const mid = +(cap.match(/above \$([\d,.]+)/) || [, ''])[1].replace(/,/g, '');
    const rows = [...document.querySelectorAll('#wallsOut tbody tr')].map(r => {
      const td = r.querySelectorAll('th, td'); const [lo, hi] = td[1].textContent.match(/[\d,.]+/g).map(v => +v.replace(/,/g, ''));
      return { side: td[0].textContent, lo, hi, d: td[2].textContent, ex: td[4].textContent, txt: r.textContent.replace(/\s+/g, ' ').trim() };
    });
    return { cap, mid, rows, text: document.getElementById('wallsOut').textContent };
  });
  const r1 = await read();
  const nb = r1.rows.filter(r => r.side === 'Buy').length, ns = r1.rows.filter(r => r.side === 'Sell').length;
  check(nb >= 1 && nb <= 3 && ns >= 1 && ns <= 3 && r1.rows.every(r => r.lo > 0), `walls rows: ${r1.rows.map(r => r.txt).join(' | ')}`);
  check(r1.mid > 0 && r1.rows.every(r => (r.side === 'Buy' ? r.lo <= r1.mid : r.hi >= r1.mid) && r.lo > r1.mid * 0.979 && r.hi < r1.mid * 1.021), `walls outside 2% or on the wrong side of ${r1.mid}: ${r1.rows.map(r => r.txt).join(' | ')}`);
  check(r1.rows.every(r => /(Binance|Kraken|Coinbase)/.test(r.ex)), 'a wall names no exchange');
  check(/adds up resting orders on (Binance|Kraken|Coinbase)/.test(r1.text) && /(No wall has been pulled|Pulled before the price got there)/.test(r1.text), `walls notes: ${r1.text.slice(-400)}`);
  seen.push(`walls: ${r1.cap} | ${r1.rows.map(r => `${r.side} ${r.d} ${r.txt.match(/\$[\d.]+[KMB]/)?.[0]}`).join(', ')}`);
  const cap1 = r1.cap;
  await p.waitForFunction(c => (document.querySelector('#wallsOut caption')?.textContent || c) !== c, cap1, { timeout: 40000 })
    .catch(() => issues.push('walls never read the books a second time in 40 s'));
  const r2 = await read();
  check(r2.rows.length >= 2 && /No wall has been pulled|Pulled before/.test(r2.text), `second read: ${r2.rows.length} rows`);

  const m = await (await br.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  await m.goto(B + '/coin/btc/'); await m.locator('#wallsOut').scrollIntoViewIfNeeded();
  await m.waitForFunction(() => document.querySelectorAll('#wallsOut tbody tr').length >= 2, null, { timeout: 25000 }).catch(() => issues.push('walls never filled at 375 px'));
  check(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'sideways scroll at 375 px');
  // The reserved height (app.css) should hold the filled box, so nothing below it moves.
  const hgt = q => q.evaluate(() => { const e = document.getElementById('wallsOut'), r = e.cloneNode(true); r.removeAttribute('id');
    r.style.minHeight = '0'; e.after(r); const h = r.offsetHeight; r.remove(); return [h, parseInt(getComputedStyle(e).minHeight)]; });
  const [hd, hm] = [await hgt(p), await hgt(m)];
  check(hd[0] <= hd[1] + 24 && hm[0] <= hm[1] + 24, `walls box needs more height than reserved: 1366 ${hd.join('/')}, 375 ${hm.join('/')}`);
  seen.push(`needed/reserved 1366: ${hd.join('/')}px, 375: ${hm.join('/')}px`);

  console.log('ISSUES (' + issues.length + ')', issues.join('\n'), seen.length ? '| ' + seen.join(' | ') : '');
  process.exitCode = issues.length ? 1 : 0; await br.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
