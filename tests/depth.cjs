// Part of the QA suite (see tests/README.md). Big-order cost box on coin pages (assets/depth.js): the book walk
// on made-up levels, then on /coin/btc/ and /coin/sol/ a buy and a sell read the live order books and show a
// row per exchange with an average fill and a cost against the mid price; no sideways scroll at 375 px.
// Usage: node tests/depth.cjs [base-url]
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const issues = []; const check = (ok, msg) => { if (!ok) issues.push(msg); };
const ctx = { self: {}, window: {}, document: { getElementById: () => null } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/depth.js'), 'utf8'), ctx);
const fill = ctx.self.cptDepthFill;
const asks = [['100', '1'], ['101', '2'], ['105', '10']];
const a = fill(asks, 302); // 100 + 202 = 302: two levels, average 302/3
check(a.full && a.n === 2 && Math.abs(a.avg - 302 / 3) < 1e-9, `fill 302: ${JSON.stringify(a)}`);
const b = fill(asks, 50); check(b.full && b.n === 1 && b.avg === 100, `fill 50: ${JSON.stringify(b)}`);
const c = fill(asks, 1e6); check(!c.full && c.n === 3 && Math.abs(c.cost - 1352) < 1e-9, `fill too big: ${JSON.stringify(c)}`);
console.log('book walk: 3 cases checked');

const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
(async () => {
  const br = await chromium.launch();
  const p = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', e => issues.push(`pageerror: ${e.message}`));
  for (const [coin, side] of [['btc', 'buy'], ['sol', 'sell']]) {
    await p.goto(`${B}/coin/${coin}/`); await p.waitForTimeout(800);
    await p.selectOption('#depthSide', side); await p.fill('#depthAmt', '25000');
    await p.click('#depthForm button[type=submit]');
    await p.waitForSelector('#depthOut table', { timeout: 20000 }).catch(() => issues.push(`${coin}: no result table`));
    const rows = await p.$$eval('#depthOut tbody tr', l => l.map(r => Array.from(r.children, x => x.textContent.trim())));
    const good = rows.filter(r => r.length === 5 && /%$/.test(r[2]));
    check(good.length >= 2, `${coin} ${side}: fewer than 2 exchanges answered: ${JSON.stringify(rows)}`);
    check(good.every(r => parseFloat(r[2].replace('<', '')) >= 0 && parseFloat(r[2].replace('<', '')) < 5), `${coin} ${side}: odd cost vs mid: ${JSON.stringify(good)}`);
    check(!rows.some(r => /^Kraken/.test(r[0]) && /Couldn't/.test(r[1] || '')), `${coin}: Kraken book not read (pair name?)`);
    console.log(`${coin} ${side} $25k:`, rows.map(r => r.join(' | ')).join(' || '));
  }
  const m = await (await br.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  await m.goto(`${B}/coin/eth/`); await m.waitForTimeout(800); await m.click('#depthForm button[type=submit]');
  await m.waitForSelector('#depthOut table', { timeout: 20000 }).catch(() => {});
  check(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'sideways scroll at 375 px with the order-cost table');
  console.log('ISSUES (' + issues.length + ')', issues.join('\n')); process.exitCode = issues.length ? 1 : 0; await br.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
