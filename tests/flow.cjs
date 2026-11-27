// Part of the QA suite (see tests/README.md). Coin pages: "Who's buying and who's selling" (assets/flow.js) and
// "When does it usually move?" (assets/moves.js). Unit checks on the counting and grouping, then in the browser:
// neither box loads anything until it comes into view, the buyers/sellers table fills from live exchange trades with
// shares between 0 and 100%, and the hour chart shows 24 bars with the visitor's time zone named. No sideways scroll at 375 px.
// Usage: node tests/flow.cjs [base-url]
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const issues = []; const check = (ok, msg) => { if (!ok) issues.push(msg); };

// 1. Counting and grouping, without a browser.
const ctx = { self: {}, window: {}, document: { getElementById: () => null } }; vm.createContext(ctx);
for (const f of ['flow.js', 'moves.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', f), 'utf8'), ctx);
const { SIDE, tally } = ctx.self.cptFlow;
check(SIDE.CB('sell') === true && SIDE.CB('buy') === false, 'Coinbase side: the maker side should flip');
check(SIDE.KR('b') && SIDE.KR('buy') && !SIDE.KR('s') && !SIDE.KR('sell'), 'Kraken side: the taker side should be kept');
check(SIDE.BN(false) === true && SIDE.BN(true) === false, 'Binance side: m=true means a seller took the bid');
const now = 1e12;
const trades = { CB: [[now - 90e3, 100, true], [now - 30e3, 300, true], [now - 10e3, 100, false]], KR: [[now - 20e3, 50, false]] };
const one = tally(trades, { CB: now - 120e3, KR: now - 30e3 }, now, 60e3);
check(one.buy === 300 && one.sell === 100 && !one.ex.KR && one.big.usd === 300, `1-minute tally (Kraken covers 30 s only, so it is left out): ${JSON.stringify(one)}`);
const five = tally(trades, { CB: now - 120e3, KR: now - 30e3 }, now, 300e3);
check(!five.ex.KR && five.buy === 400 && five.sell === 100, `5-minute tally should leave out Kraken (covers 30 s only): ${JSON.stringify(five)}`);
const H = 3600e3, rows = [];
for (let i = 0; i < 48; i++) rows.push([i * H, 100, i % 24 === 9 ? 103 : 100.5]);
const g = ctx.self.cptMoves.group(rows, t => (t / H) % 24, t => Math.floor(t / 86400e3) % 7, t => `${(t / H) % 24}h`);
check(g.hours.length === 24 && Math.abs(g.hours[9].avg - 3) < 1e-9 && g.hours[9].n === 2 && Math.abs(g.hours[3].avg - 0.5) < 1e-9, `hour grouping: ${JSON.stringify(g.hours.slice(8, 10))}`);
console.log('unit: counting and grouping checked');

// 2. The page.
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
const seen = [];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: 'America/Chicago' })).newPage();
  const urls = []; p.on('request', r => urls.push(r.url()));
  const sockets = []; p.on('websocket', ws => sockets.push(ws.url()));
  p.on('pageerror', e => issues.push(`pageerror: ${e.message}`));
  await p.goto(B + '/coin/btc/'); await p.waitForTimeout(2500);
  check(!urls.some(u => /aggTrades|\/trades\?|public\/Trades|interval=1h|interval=60|granularity=3600/.test(u)), 'trades or hourly candles loaded before the boxes came into view');
  check(!sockets.some(u => /aggTrade/.test(u)), 'trade stream opened before the box came into view');

  await p.locator('#flowOut').scrollIntoViewIfNeeded();
  // The 1-minute row fills once any exchange's trades cover a minute; 5 minutes needs one whose last 1,000 trades span that long.
  await p.waitForFunction(() => /Last 1 minute[^]*\$[\d.]+/.test(document.querySelector('#flowOut tbody tr')?.textContent || ''), null, { timeout: 25000 })
    .catch(() => issues.push('buyers/sellers 1-minute row never filled in 25 s'));
  await p.waitForTimeout(2500);
  const flow = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#flowOut tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
    const shares = [...document.querySelectorAll('#flowOut .flow-bar')].map(e => e.getAttribute('aria-label'));
    const bars = [...document.querySelectorAll('#flowOut tbody td:last-child')].map(td => [td.textContent.trim(), td.querySelector('i')?.style.width]);
    return { rows, shares, bars, line: document.querySelector('#flowOut .tm-line')?.textContent || '' };
  });
  check(flow.rows.length === 3, `buyers/sellers rows: ${flow.rows.length}`);
  check(/Last 1 minute .*\$[\d.]+[KMB]?.*%/.test(flow.rows[0] || ''), `1-minute row: ${flow.rows[0]}`);
  check(flow.shares.every(s => /^(\d{1,3})% bought$|^No trades$/.test(s) && (!/\d/.test(s) || +s.match(/\d+/)[0] <= 100)), `shares: ${flow.shares.join(' | ')}`);
  check(flow.bars.every(([t, w]) => w === undefined || (t.startsWith('—') ? w === '0%' : t.endsWith(w))), `bar width doesn't match the share: ${JSON.stringify(flow.bars)}`);
  const exs = (flow.line.match(/(Coinbase|Kraken|Binance) \d+%/g) || []);
  check(!/over 5 minutes/.test(flow.line) || exs.length >= 1, `5-minute line names no exchange: ${flow.line}`);
  seen.push(`flow: ${flow.rows[0]} | ${exs.join(', ')}`);

  await p.locator('#movesOut').scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelectorAll('#movesOut .moves-bar').length === 24, null, { timeout: 20000 })
    .catch(() => issues.push('hour chart never drew 24 bars'));
  const moves = await p.evaluate(() => ({ text: document.getElementById('movesOut').textContent.replace(/\s+/g, ' '), now: document.querySelectorAll('#movesOut .moves-bar.is-now').length }));
  check(/moved most in the hour starting .+ your time \(an average of [\d.]+%/.test(moves.text), `hour sentence: ${moves.text.slice(0, 200)}`);
  check(/America\/Chicago/.test(moves.text) && moves.now === 1, `time zone or current hour missing: ${moves.now}`);
  seen.push(`moves: ${(moves.text.match(/Over the last .*?\)\./) || [''])[0]}`);

  // Phone width: no sideways scroll with both boxes filled.
  const m = await (await b.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  await m.goto(B + '/coin/btc/'); await m.locator('#flowOut').scrollIntoViewIfNeeded();
  await m.locator('#movesOut').scrollIntoViewIfNeeded(); await m.waitForTimeout(6000);
  check(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'sideways scroll at 375 px');
  // Reserved height against what the boxes need once filled (min-height in app.css), reported so it can be tuned.
  const hgt = async q => q.evaluate(() => ['flowOut', 'movesOut'].map(id => { const e = document.getElementById(id), r = e.cloneNode(true);
    r.style.minHeight = '0'; e.after(r); const h = r.offsetHeight; r.remove(); return `${id} ${h}/${parseInt(getComputedStyle(e).minHeight)}px`; }).join(', '));
  seen.push(`needed/reserved 1366: ${await hgt(p)}`, `375: ${await hgt(m)}`);

  console.log('ISSUES (' + issues.length + ')', issues.join('\n'), seen.length ? '| ' + seen.join(' | ') : '');
  process.exitCode = issues.length ? 1 : 0; await b.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
