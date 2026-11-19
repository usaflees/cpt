// Part of the QA suite (see tests/README.md). Backup and restore in the home menu: export a file, clear the
// browser's data, import the file, and confirm everything came back (and that a foreign file is refused).
// Usage: node tests/backup.cjs [base-url]
const { chromium } = require('playwright');
const fs = require('node:fs');
const B = process.argv[2] || 'http://localhost:8788';
const SEED = { cpt_watch: '["BTC","SOL","KAS"]', cpt_bag: '{"BTC":0.25,"ETH":3}', cpt_alerts: '{"SOL":250}', cpt_theme: 'light',
  cpt_movealert: '{"pct":5,"mins":15,"scope":"all"}', cpt_bagalert: '{"above":50000,"below":0}', cpt_consent: 'denied' };
(async () => {
  const b = await chromium.launch(); const issues = [];
  const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage();
  p.on('pageerror', e => issues.push('pageerror: ' + e.message));
  await p.goto(B + '/'); await p.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
  await p.reload(); await p.waitForTimeout(1500);
  const menu = async () => { await p.locator('details.menu-pop summary').first().click(); };
  await menu();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#backupExport')]);
  const file = await dl.path(); const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (saved.app !== 'cryptopriceticker' || saved.data.cpt_consent) issues.push('export: wrong shape or includes the cookie choice');
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  // A file that isn't a backup changes nothing.
  const bad = file + '.bad.json'; fs.writeFileSync(bad, '{"hello":1}');
  await menu(); let [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('#backupImport')]);
  await chooser.setFiles(bad); await p.waitForTimeout(500);
  if (await p.evaluate(() => localStorage.getItem('cpt_watch'))) issues.push('import: a foreign file changed data');
  p.once('dialog', d => d.accept());
  await menu(); [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('#backupImport')]);
  await Promise.all([p.waitForEvent('load'), chooser.setFiles(file)]); await p.waitForTimeout(800);
  const back = await p.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(SEED));
  for (const [k, v] of Object.entries(SEED)) if (k !== 'cpt_consent' && back[k] !== v) issues.push(`restore: ${k} = ${back[k]} (expected ${v})`);
  if (await p.getAttribute('html', 'data-theme') !== 'light') issues.push('restore: theme not applied after reload');
  console.log('exported keys:', Object.keys(saved.data).join(', '));
  console.log(`ISSUES (${issues.length}):`, issues.join(' | '));
  await b.close(); process.exitCode = issues.length ? 1 : 0;
})();
