// Part of the QA suite (see tests/README.md). AI-agent tools (WebMCP, assets/agent.js): with a stand-in
// document.modelContext the home and coin pages register the tools and each one answers; without it the
// browser never requests agent.js. Usage: node tests/agent.cjs [base-url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
const EXPECTED = ['convert_amount', 'find_coins', 'get_exchange_gaps', 'get_movers', 'get_prices', 'set_price_alert', 'update_watchlist'];
// Minimal stand-in for Chrome's document.modelContext (registerTool with an AbortSignal, execute(input)).
const fake = () => {
  const tools = new Map();
  Object.defineProperty(document, 'modelContext', { value: {
    registerTool(t, opts = {}) { tools.set(t.name, t); opts.signal?.addEventListener('abort', () => tools.delete(t.name)); return Promise.resolve(); },
    async getTools() { return [...tools.values()].map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })); },
    async executeTool(name, input) { return JSON.parse(await tools.get(name).execute(input, {})); }
  } });
};
(async () => {
  const b = await chromium.launch(); const issues = [];
  const check = (ok, msg) => { if (!ok) issues.push(msg); };

  // 1. No modelContext: agent.js is never fetched.
  {
    const p = await b.newPage(); const urls = [];
    p.on('request', r => urls.push(r.url()));
    await p.goto(B + '/'); await p.waitForTimeout(1200);
    check(!urls.some(u => u.includes('/assets/agent.js')), 'agent.js was requested in a browser without WebMCP');
    await p.close();
  }

  // 2. With modelContext: home and coin pages.
  for (const path of ['/', '/coin/sol/']) {
    const ctx = await b.newContext(); await ctx.addInitScript(fake);
    const p = await ctx.newPage();
    p.on('pageerror', e => issues.push(`${path} pageerror: ${e.message}`));
    await p.goto(B + path);
    await p.waitForFunction(() => window.CPT_AGENT, null, { timeout: 8000 }).catch(() => issues.push(`${path}: tools never registered`));
    const tools = await p.evaluate(() => document.modelContext.getTools());
    check(JSON.stringify(tools.map(t => t.name).sort()) === JSON.stringify(EXPECTED), `${path}: tools ${tools.map(t => t.name)}`);
    for (const t of tools) {
      check(t.description.length <= 500, `${t.name}: description over 500 characters`);
      check(t.inputSchema && t.inputSchema.type === 'object', `${t.name}: no object input schema`);
      check(typeof t.annotations?.readOnlyHint === 'boolean', `${t.name}: no readOnlyHint`);
    }
    const run = (name, input) => p.evaluate(([n, i]) => document.modelContext.executeTool(n, i), [name, input]);
    const find = await run('find_coins', { query: 'ethereum' });
    check(find.coins?.[0]?.symbol === 'ETH', `${path} find_coins: ${JSON.stringify(find).slice(0, 120)}`);
    const prices = await run('get_prices', { symbols: ['BTC', 'nope'] });
    check(prices.coins?.[0]?.price_usd > 0 && prices.unknown_symbols?.[0] === 'nope' && prices.coins[0].page.endsWith('/coin/btc/'), `${path} get_prices: ${JSON.stringify(prices).slice(0, 160)}`);
    check('coinbase' in (prices.coins?.[0]?.exchanges || {}), `${path} get_prices: no per-exchange prices`);
    const conv = await run('convert_amount', { amount: 2, from: 'usd', to: 'BTC' });
    const btc = prices.coins?.[0]?.price_usd;
    check(conv.result > 0 && Math.abs(conv.result - 2 / btc) / (2 / btc) < 0.02, `${path} convert_amount: ${JSON.stringify(conv)}`);
    check((await run('convert_amount', { amount: 1, from: 'XYZ', to: 'USD' })).error, `${path} convert_amount: unknown code not refused`);
    const gaps = await run('get_exchange_gaps', {});
    check(Array.isArray(gaps.gaps) && gaps.note, `${path} get_exchange_gaps: ${JSON.stringify(gaps).slice(0, 120)}`);
    const movers = await run('get_movers', { direction: 'gainers', limit: 3 });
    check(Array.isArray(movers.coins) ? movers.coins.length <= 3 : Boolean(movers.error), `${path} get_movers: ${JSON.stringify(movers).slice(0, 120)}`);
    // Writes change only this browser's saved data.
    await run('update_watchlist', { action: 'add', symbols: ['KAS'] });
    check(JSON.parse(await p.evaluate(() => localStorage.getItem('cpt_watch'))).includes('KAS'), `${path} update_watchlist add: not saved`);
    const after = await run('update_watchlist', { action: 'remove', symbols: ['KAS'] });
    check(!after.watchlist.includes('KAS'), `${path} update_watchlist remove`);
    await run('set_price_alert', { symbol: 'sol', target_usd: 999 });
    check(JSON.parse(await p.evaluate(() => localStorage.getItem('cpt_alerts'))).SOL === 999, `${path} set_price_alert: not saved`);
    await run('set_price_alert', { symbol: 'SOL' });
    check(!JSON.parse(await p.evaluate(() => localStorage.getItem('cpt_alerts'))).SOL, `${path} set_price_alert: not cleared`);
    console.log(`${path}: ${tools.length} tools; BTC ${btc} (live ${prices.coins?.[0]?.live}); widest gap ${gaps.gaps?.[0]?.symbol ?? '—'} ${gaps.gaps?.[0]?.gap_bps ?? ''} bps`);
    await ctx.close();
  }
  console.log(`ISSUES (${issues.length}):`, issues.join(' | '));
  await b.close(); process.exitCode = issues.length ? 1 : 0;
})();
