// Part of the QA suite (see tests/README.md). Plain-words filter on the home table (assets/screener.js):
// the rule-based reader turns sample sentences into the expected filters; in the browser the file loads only
// when the search box gets focus, a typed sentence filters the table to coins that really match (checked
// against window.CPT's live numbers), Enter stays on the page, Clear restores the search, and with a stand-in
// LanguageModel a sentence the rules can't read goes through the Prompt API with a JSON Schema.
// Usage: node tests/screener.cjs [base-url]
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const issues = []; const check = (ok, msg) => { if (!ok) issues.push(msg); };

// 1. The reader, without a browser.
const ctx = { self: {}, window: {}, document: { getElementById: () => null } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/screener.js'), 'utf8'), ctx);
const parse = ctx.self.cptScreenParse;
const CASES = {
  'AI coins down 5% this week': { tf: '7d', chgMax: -5, sector: 'AI' },
  'large caps up today': { tf: '24h', mcapMin: 1e10, chgMin: 0 },
  'under $1 with volume over 50m': { tf: '24h', priceMax: 1, volMin: 5e7 },
  'top 10 losers': { tf: '24h', limit: 10, sortBy: 'change24h', asc: true },
  'market cap over 10b and down 2%': { tf: '24h', mcapMin: 1e10, chgMax: -2 },
  'meme coins that moved 10%': { tf: '24h', absMin: 10, sector: 'Meme' },
  'biggest gainers this week excluding stablecoins': { tf: '7d', noStable: true, sortBy: 'change7d', asc: false },
  'coins between -2% and 2% today': { tf: '24h', chgMin: -2, chgMax: 2 },
  'top 50 down over 4% 7d': { tf: '7d', chgMax: -4, rankMax: 50 },
  'small caps losing 10% or more': { tf: '24h', mcapMax: 1e9, chgMax: -10 },
  'market cap over 1000000000': { tf: '24h', mcapMin: 1e9 },
  'defi up less than 2%': { tf: '24h', sector: 'DeFi', chgMin: 0, chgMax: 2 },
  'most traded under $1': { tf: '24h', sortBy: 'vol24h', asc: false, priceMax: 1 },
  'large cap under $5': { tf: '24h', mcapMin: 1e10, priceMax: 5 },
  'cap over 10b': { tf: '24h', mcapMin: 1e10 },
  'what is bitcoin': null
};
const norm = o => o && JSON.stringify(Object.keys(o).sort().reduce((a, k) => ((a[k] = o[k]), a), {}));
for (const [q, want] of Object.entries(CASES)) {
  const got = parse(q).f;
  check(norm(got) === norm(want), `reader: "${q}" -> ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
}
console.log(`reader: ${Object.keys(CASES).length} sentences checked`);

// 2. The page.
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
const rows = p => p.$$eval('#tableBody tr[data-sym]', l => l.map(r => r.dataset.sym));
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await c.addInitScript(() => {
    window.__prompts = [];
    const ans = JSON.stringify({ sector: 'Meme', excludeStablecoins: false, timeframe: '24h', conditions: [{ field: 'change', op: '<=', value: -1 }], sortBy: 'change', sortOrder: 'asc', limit: 0 });
    const one = { prompt: async (t, o) => { window.__prompts.push({ t, schema: !!(o && o.responseConstraint) }); return ans; }, destroy() {} };
    window.LanguageModel = { availability: async () => 'available', create: async () => ({ clone: async () => one, destroy() {} }) };
  });
  const p = await c.newPage(); const urls = [];
  p.on('request', r => urls.push(r.url()));
  p.on('pageerror', e => issues.push(`pageerror: ${e.message}`));
  await p.goto(B + '/');
  // Wait for live prices so the filter checks real numbers.
  await p.waitForFunction(() => window.CPT && Array.from(window.CPT.state.coins.values()).filter(c => c.live).length > 20, null, { timeout: 30000 }).catch(() => issues.push('fewer than 20 live coins after 30 s'));
  check(!urls.some(u => u.includes('/assets/screener.js')), 'screener.js loaded before the search box got focus');
  await p.focus('#searchInput');
  await p.waitForFunction(() => window.CPT_SCREEN_UI, null, { timeout: 8000 }).catch(() => issues.push('screener.js never loaded on focus'));
  check(await p.isVisible('.screen-eg'), 'no examples under an empty, focused search box');

  // A single word stays a coin search.
  await p.fill('#searchInput', 'pump'); await p.waitForTimeout(400);
  check(await p.evaluate(() => window.CPT_SCREEN === null || window.CPT_SCREEN === undefined), '"pump" was read as a filter');

  // A sentence filters the table to coins that match.
  await p.fill('#searchInput', 'large caps up today'); await p.waitForTimeout(600);
  const note = (await p.textContent('#screenNote')).replace(/\s+/g, ' ');
  check(/market cap ≥ \$10B/.test(note) && /up \(24 h\)/.test(note), `filter line: ${note}`);
  const syms = await rows(p);
  const bad = await p.evaluate(s => s.filter(x => { const c = window.CPT.state.coins.get(x); return !(c.mcap >= 0.97e10 && c.change24h >= -0.3); }), syms); // small tolerance: prices move between render and check
  check(!bad.length, `rows that don't match "large caps up today": ${bad.join(', ')}`);
  console.log(`"large caps up today": ${syms.length} rows | ${note}`);

  // Enter keeps the page (no jump to a coin page).
  const before = p.url(); await p.press('#searchInput', 'Enter'); await p.waitForTimeout(500);
  check(p.url() === before, `Enter left the page: ${p.url()}`);

  // Count and order.
  await p.fill('#searchInput', 'top 10 losers'); await p.waitForTimeout(600);
  const lose = await rows(p);
  const ch = await p.evaluate(s => s.map(x => window.CPT.state.coins.get(x).change24h), lose);
  // Live prices keep moving between the redraw and this read, so neighbours may swap by a little.
  check(lose.length === 10 && ch.every((v, i) => i === 0 || v >= ch[i - 1] - 1.5), `"top 10 losers": ${lose.length} rows, changes ${ch.map(v => v.toFixed(2)).join(' ')}`);

  // Clear restores the full search.
  await p.click('.screen-clear'); await p.waitForTimeout(400);
  check(await p.inputValue('#searchInput') === '' && await p.evaluate(() => !window.CPT_SCREEN), 'Clear did not reset the box and filter');

  // On-device AI for a sentence the rules can't read.
  await p.fill('#searchInput', 'show me the frog themed stuff that tanked'); await p.waitForTimeout(900);
  check(await p.isVisible('.screen-ai'), 'no on-device AI offer for an unreadable sentence');
  await p.click('.screen-ai');
  await p.waitForFunction(() => /Read by the AI/.test(document.getElementById('screenNote').textContent), null, { timeout: 5000 }).catch(() => issues.push('AI filter never shown'));
  const pr = await p.evaluate(() => window.__prompts[0]);
  check(pr && pr.schema && /frog themed/.test(pr.t), `prompt: ${JSON.stringify(pr)}`);
  const meme = await rows(p);
  const badAi = await p.evaluate(s => s.filter(x => { const c = window.CPT.state.coins.get(x); return !(c.sectors.includes('Meme') && c.change24h <= -0.7); }), meme);
  check(!badAi.length, `rows that don't match the AI filter: ${badAi.join(', ')}`);
  console.log(`AI filter: ${meme.length} rows | ${(await p.textContent('#screenNote')).replace(/\s+/g, ' ').trim()}`);

  // Phone width: no sideways scroll with the filter line showing.
  const m = await b.newContext({ viewport: { width: 375, height: 812 } }); const mp = await m.newPage();
  await mp.goto(B + '/'); await mp.waitForTimeout(1500); await mp.focus('#searchInput');
  await mp.waitForFunction(() => window.CPT_SCREEN_UI, null, { timeout: 8000 }).catch(() => {});
  await mp.fill('#searchInput', 'AI coins down 5% this week under $10'); await mp.waitForTimeout(600);
  check(await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'sideways scroll at 375 px with the filter line');

  console.log('ISSUES (' + issues.length + ')', issues.join('\n')); process.exitCode = issues.length ? 1 : 0; await b.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
