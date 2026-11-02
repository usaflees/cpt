// Part of the QA suite (see tests/README.md). Usage: node tests/converter.cjs [base-url] [screenshot-dir]
const OUT = process.argv[3] || require('node:path').join(require('node:os').tmpdir(), 'cpt-qa');
require('node:fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8788';
(async () => {
  const browser = await chromium.launch();
  const issues = [];
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') issues.push('console: ' + m.text()); });
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  const wait = ms => page.waitForTimeout(ms);
  const txt = id => page.$eval('#' + id, e => e.textContent);
  const val = id => page.$eval('#' + id, e => e.value);

  await page.goto(BASE + '/convert/');
  await page.waitForFunction(() => /^1 BTC = \$/.test(document.getElementById('cvRate').textContent) && !document.getElementById('converter').classList.contains('is-stale'), null, { timeout: 20000 });
  console.log('convert default:', await txt('cvRate'), '|', await txt('cvInverse'), '| B =', await val('cvB'));
  await page.fill('#cvA', '2.5');
  await wait(300);
  console.log('2.5 BTC ->', await val('cvB'));
  await page.selectOption('#cvTo', 'EUR');
  await page.waitForFunction(() => /€/.test(document.getElementById('cvRate').textContent), null, { timeout: 15000 });
  console.log('to EUR:', await txt('cvRate'), '| url', new URL(page.url()).search, '| title', await page.title());
  await page.selectOption('#cvFrom', 'KAS');
  await page.waitForFunction(() => !document.getElementById('converter').classList.contains('is-stale'), null, { timeout: 25000 }).catch(() => issues.push('KAS never went live'));
  console.log('KAS->EUR:', await txt('cvRate'), '| B =', await val('cvB'));
  await page.click('[data-action=cv-swap]');
  await wait(300);
  console.log('after swap: from', await val('cvFrom'), 'to', await val('cvTo'), '| A', await val('cvA'), '| rate', await txt('cvRate'));
  await page.fill('#cvB', '1000');
  await wait(300);
  console.log('typed B=1000 KAS -> A EUR =', await val('cvA'));
  await page.click('[data-action=cv-pair][data-from=ETH][data-to=BTC]');
  await page.waitForFunction(() => /^1 ETH = .* BTC$/.test(document.getElementById('cvRate').textContent), null, { timeout: 15000 });
  console.log('ETH->BTC pair:', await txt('cvRate'));
  // deep link
  await page.goto(BASE + '/convert/?from=sol&to=gbp&amount=10');
  await page.waitForFunction(() => /£/.test(document.getElementById('cvB').value + document.getElementById('cvRate').textContent), null, { timeout: 15000 }).catch(()=>{});
  await wait(1500);
  console.log('deep link sol->gbp x10:', await val('cvA'), await val('cvFrom'), await val('cvTo'), '=>', await val('cvB'), '|', await txt('cvRate'));
  // legacy TON
  await page.goto(BASE + '/convert/?from=ton&to=usd');
  console.log('renamed ton ->', await val('cvFrom'));

  // coin page
  await page.goto(BASE + '/coin/btc/');
  await page.waitForFunction(() => !document.getElementById('converter').classList.contains('is-stale'), null, { timeout: 20000 });
  const rows = await page.$$eval('[data-cv-amt]', els => els.slice(0, 3).map(e => e.textContent).concat(els.slice(-2).map(e => e.textContent)));
  console.log('btc page:', await txt('conv-h'), '|', await txt('cvRate'), '| table', rows.join(' ; '));
  await page.selectOption('#cvTo', 'INR');
  await page.waitForFunction(() => /₹/.test(document.getElementById('cvRate').textContent), null, { timeout: 15000 });
  const rows2 = await page.$$eval('[data-cv-amt]', els => [els[0].textContent, els[els.length-1].textContent]);
  const labels = await page.$$eval('[data-cv-other]', els => els.map(e => e.textContent).join(','));
  console.log('btc->INR table:', rows2.join(' ; '), '| labels', labels, '| url unchanged', page.url());
  await page.goto(BASE + '/coin/shib/');
  await page.waitForFunction(() => !document.getElementById('converter').classList.contains('is-stale'), null, { timeout: 20000 }).catch(() => issues.push('shib not live'));
  console.log('shib:', await txt('cvRate'), '|', await txt('cvInverse'), '| first row', await page.$eval('[data-cv-amt]', e => e.parentElement.textContent.replace(/\s+/g,' ')));
  // mobile
  const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
  m.on('pageerror', e => issues.push('mobile pageerror: ' + e.message));
  for (const u of ['/convert/', '/coin/eth/']) {
    await m.goto(BASE + u); await m.waitForTimeout(2500);
    const ov = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log('mobile overflow', u, ov);
    if (ov > 0) issues.push('overflow ' + u);
  }
  await m.goto(BASE + '/convert/'); await m.waitForTimeout(2000);
  await m.screenshot({ path: OUT + '/m-convert.png', fullPage: false });
  await m.goto(BASE + '/coin/eth/#convert'); await m.waitForTimeout(2500);
  await m.screenshot({ path: OUT + '/m-coin-convert.png' });
  const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await d.goto(BASE + '/convert/'); await d.waitForTimeout(3000);
  await d.screenshot({ path: OUT + '/d-convert.png' });
  await d.goto(BASE + '/coin/btc/#convert'); await d.waitForTimeout(3000);
  await d.screenshot({ path: OUT + '/d-coin-convert.png' });
  console.log('ISSUES (' + issues.length + '):', issues.join('\n')); process.exitCode = issues.length ? 1 : 0;
  await browser.close();
})();
