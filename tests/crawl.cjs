// Part of the QA suite (see tests/README.md). Loads every URL in sitemap.xml plus widget variants and the 404 page,
// and reports console errors, uncaught errors, CSP violations and failed requests (these fail the run), plus browser
// warnings (listed, not failing: an invalid speculation-rules file, for example, only ever shows up as a warning).
// Usage: node tests/crawl.cjs [base-url]
const { chromium } = require('playwright');
const fs = require('node:fs');
const BASE = (process.argv[2] || 'http://localhost:8788').replace(/\/$/, '');
const VT_SKIP = /Transition was (aborted because of invalid state|skipped)/; // see tests/README.md
const paths = [...fs.readFileSync(__dirname + '/../sitemap.xml', 'utf8').matchAll(/<loc>https:\/\/cryptopriceticker\.com([^<]*)<\/loc>/g)].map(m => m[1] || '/')
  .concat(['/embed/?coins=BTC,ETH,SOL&layout=marquee', '/embed/?coins=BTC,ETH,SOL,XRP&layout=grid', '/embed/?coins=BTC&layout=single', '/this-page-does-not-exist']);
(async () => {
  const b = await chromium.launch(); const problems = []; const warnings = new Map(); let i = 0;
  const worker = async () => {
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    while (i < paths.length) {
      const path = paths[i++]; const p = await ctx.newPage(); const local = [];
      // (the crawl blocks service workers itself so every page loads fresh; that notice is ours, not the site's)
      p.on('console', m => { if (m.type() === 'warning' && !/blocked by Playwright/.test(m.text())) warnings.set(m.text().slice(0, 160), path); });
      p.on('console', m => { if ((m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) && !VT_SKIP.test(m.text()) && !(path.startsWith('/this-page') && /404/.test(m.text()))) local.push('console: ' + m.text().slice(0, 140)); });
      p.on('pageerror', e => { if (!VT_SKIP.test(e.message)) local.push('pageerror: ' + e.message.slice(0, 140)); });
      p.on('response', r => { const u = r.url(); if (r.status() >= 400 && !(path.startsWith('/this-page') && u.endsWith(path))) local.push(`HTTP ${r.status()} ${u.replace(BASE, '')}`); });
      p.on('requestfailed', r => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f)) local.push(`failed ${r.url().replace(BASE, '').slice(0, 100)} ${f}`); });
      try { await p.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); await p.waitForTimeout(2500); } catch (e) { local.push('load: ' + e.message.split('\n')[0]); }
      if (local.length) problems.push(`${path}\n  ` + [...new Set(local)].join('\n  '));
      await p.close();
    }
    await ctx.close();
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(problems.join('\n'));
  for (const [w, path] of warnings) console.log(`warning (first on ${path}): ${w}`);
  console.log(`crawl: ${paths.length} pages, ${problems.length} with problems, ${warnings.size} distinct warnings`);
  process.exitCode = problems.length ? 1 : 0; await b.close();
})();
