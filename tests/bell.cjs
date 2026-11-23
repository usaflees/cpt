// Part of the QA suite (see tests/README.md). Bell Brief: after a bell the static home page doesn't show yet, the
// page asks /bell (functions/bell.js) and swaps in the newer edition the Cloudflare cron Worker stored; a 404
// (no Worker or binding yet) leaves the static edition and asks only once. Also checks functions/bell.js itself.
// Usage: node tests/bell.cjs [base-url]
const { chromium } = require('playwright');
const path = require('node:path');
const B = process.argv[2] || 'http://localhost:8788';
const lib = f => import('file://' + path.join(__dirname, '..', f));
(async () => {
  const issues = [];
  // The Function: 404 without the binding or a value, 405 for POST, the stored JSON otherwise.
  const { onRequest } = await lib('functions/bell.js');
  const req = m => new Request('https://x.test/bell', { method: m });
  const kv = v => ({ get: async () => v });
  if ((await onRequest({ request: req('GET'), env: {}, waitUntil() {} })).status !== 404) issues.push('function: no binding should be 404');
  if ((await onRequest({ request: req('GET'), env: { BELL: kv(null) }, waitUntil() {} })).status !== 404) issues.push('function: empty KV should be 404');
  if ((await onRequest({ request: req('POST'), env: { BELL: kv('{}') }, waitUntil() {} })).status !== 405) issues.push('function: POST should be 405');
  const ok = await onRequest({ request: req('GET'), env: { BELL: kv('{"a":1}') }, waitUntil() {} });
  if (ok.status !== 200 || (await ok.text()) !== '{"a":1}' || !/json/.test(ok.headers.get('content-type'))) issues.push('function: stored JSON not served');

  const b = await chromium.launch();
  const page = async (handler) => {
    const p = await b.newPage(); const calls = [];
    p.on('pageerror', e => issues.push('pageerror: ' + e.message));
    p.on('console', m => { if (/Content Security Policy/i.test(m.text())) issues.push('CSP: ' + m.text().slice(0, 120)); });
    // Read the static edition, then pretend the clock is 2 minutes past its next bell.
    const html = await (await fetch(B + '/')).text();
    const next = JSON.parse(html.match(/data-next='([^']*)'/)[1].replace(/&quot;/g, '"'));
    const staticCutoff = (html.match(/data-cutoff="([^"]+)"/) || [])[1] || null;
    await p.clock.setFixedTime(Date.parse(next[0].at) + 120e3);
    await p.route('**/bell', r => { calls.push(r.request().url()); return handler(r, next); });
    await p.goto(B + '/'); await p.waitForTimeout(2500);
    return { p, calls, next, staticCutoff };
  };

  // 1. No Worker yet: one request, static edition stays.
  {
    const { p, calls, staticCutoff } = await page(r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no edition"}' }));
    const cut = await p.getAttribute('#bell-brief', 'data-cutoff');
    if (calls.length !== 1) issues.push(`404: expected one /bell request, saw ${calls.length}`);
    if (cut !== staticCutoff) issues.push('404: static edition replaced');
    if (!/Publishing the/.test(await p.textContent('#bellNext'))) issues.push('404: no "Publishing" text after the bell');
    await p.close();
  }
  // 2. A newer edition in KV: swapped in, with the next bell's countdown.
  {
    const { bellSection } = await lib('scripts/lib/bell-html.mjs');
    let made;
    const { p, calls } = await page((r, next) => {
      const ed = { id: next[0].date + '-' + next[0].edition, edition: next[0].edition, date: next[0].date, cutoff: next[0].at, earlyClose: !!next[0].early, btcAtCutoff: 90000,
        items: [{ feed: 'fed', source: 'Federal Reserve', topic: 'Monetary Policy', title: 'Test release <b>escaped</b>', link: 'https://www.federalreserve.gov/x', published: new Date(Date.parse(next[0].at) - 3600e3).toISOString(), score: 10, btcChange: 0.5 }], sourcesFailed: [] };
      made = { updated: next[0].at, next: next.slice(1), editions: [ed] };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...made, html: bellSection(made) }) });
    });
    const cut = await p.getAttribute('#bell-brief', 'data-cutoff');
    if (cut !== made.editions[0].cutoff) issues.push(`swap: data-cutoff is ${cut}, expected ${made.editions[0].cutoff}`);
    if (await p.locator('#bell-brief').count() !== 1) issues.push('swap: not exactly one #bell-brief');
    if (!/Test release <b>escaped<\/b>/.test(await p.textContent('#bell-brief .bell-title'))) issues.push('swap: item title missing or not escaped');
    if (!/^Next: /.test(await p.textContent('#bellNext'))) issues.push('swap: countdown not restarted: ' + await p.textContent('#bellNext'));
    if (calls.length !== 1) issues.push(`swap: expected one /bell request, saw ${calls.length}`);
    await p.close();
  }
  // 3. Through the server: 404 without the KV binding or an edition, else an edition with its section (never the
  // home page or a 500).
  const r = await fetch(B + '/bell');
  if (r.status === 200) {
    const j = await r.json().catch(() => null), ed = j && j.editions && j.editions[0];
    if (!ed || !String(j.html).includes(`data-cutoff="${ed.cutoff}"`)) issues.push('server /bell: 200 without an edition and its html');
  } else if (r.status !== 404) issues.push(`server /bell: HTTP ${r.status} (expected 404, or 200 with an edition)`);
  console.log(`ISSUES (${issues.length}):`, issues.join(' | '));
  await b.close(); process.exitCode = issues.length ? 1 : 0;
})();
