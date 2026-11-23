// Part of the QA suite (see tests/README.md). On-device AI on coin pages (assets/ondevice.js): with stand-in
// LanguageModel and Translator objects the "Ask about" section answers a preset from the page's own numbers and
// translates the About section and back; without them the browser never requests ondevice.js.
// Usage: node tests/ondevice.cjs [base-url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:8788';
const fake = () => {
  window.__prompts = [];
  const one = { promptStreaming(p) { window.__prompts.push(p); return (async function* () { yield 'Measured '; yield 'answer.'; })(); }, destroy() {} };
  window.LanguageModel = { availability: async () => 'available', create: async () => ({ clone: async () => one, destroy() {} }) };
  window.Translator = { availability: async () => 'available', create: async () => ({ translate: async t => `[es] ${t}` }) };
};
(async () => {
  const b = await chromium.launch(); const issues = [];
  const check = (ok, msg) => { if (!ok) issues.push(msg); };
  {
    const p = await b.newPage(); const urls = [];
    p.on('request', r => urls.push(r.url()));
    await p.goto(B + '/coin/sol/'); await p.waitForTimeout(1200);
    check(!urls.some(u => u.includes('/assets/ondevice.js')), 'ondevice.js was requested in a browser without built-in AI');
    check(!(await p.$('section.ondevice')), 'on-device section shown without built-in AI');
    await p.close();
  }
  const ctx = await b.newContext({ locale: 'es-ES' }); await ctx.addInitScript(fake);
  const p = await ctx.newPage();
  p.on('pageerror', e => issues.push(`pageerror: ${e.message}`));
  await p.goto(B + '/coin/sol/');
  await p.waitForFunction(() => window.CPT_ONDEVICE, null, { timeout: 8000 }).catch(() => issues.push('on-device section never set up'));
  check(JSON.stringify(await p.evaluate(() => window.CPT_ONDEVICE)) === '{"ask":true,"translate":true}', 'ask and translate not both offered');
  await p.click('[data-preset="0"]');
  await p.waitForFunction(() => document.querySelector('.ondevice-answer')?.textContent === 'Measured answer.', null, { timeout: 4000 }).catch(() => issues.push('no answer shown'));
  const prompt = await p.evaluate(() => window.__prompts[0] || '');
  check(/^FACTS:/.test(prompt) && /QUESTION: Why did SOL move/.test(prompt) && /52-week high/.test(prompt), `prompt facts: ${prompt.slice(0, 160)}`);
  await p.click('[data-tr="on"]');
  await p.waitForFunction(() => document.querySelector('section[aria-labelledby="about-h"]')?.dataset.translated === 'es', null, { timeout: 4000 }).catch(() => issues.push('About not translated'));
  check(/^\[es\] /.test(await p.textContent('section[aria-labelledby="about-h"] p')), 'About paragraph text not replaced');
  await p.click('[data-tr="off"]');
  check(!/^\[es\]/.test(await p.textContent('section[aria-labelledby="about-h"] p')), 'English original not restored');
  console.log(`/coin/sol/: on-device ${JSON.stringify(await p.evaluate(() => window.CPT_ONDEVICE))}; facts ${prompt.length} chars`);
  await ctx.close();
  console.log(`ISSUES (${issues.length}):`, issues.join(' | '));
  await b.close(); process.exitCode = issues.length ? 1 : 0;
})();
