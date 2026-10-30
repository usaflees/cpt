/**
 * CryptoPriceTicker.com — telemetry collector (Google Apps Script, bound to a PRIVATE Google Sheet).
 *
 * Runs as you, so there is no service account, no key and nothing stored in the public repo.
 *   nightly()       Search Console (1 finalized day), URL Inspection (rotating), Cloudflare analytics,
 *                   plus a health-alert email when something breaks.
 *   weeklyDigest()  Page-level summary with query text reduced to known coin terms, pushed as JSON
 *                   to a PRIVATE GitHub repo for the weekly improvement task to read.
 *
 * Setup: see scripts/telemetry/README.md. Run testSetup() once after filling in Script Properties.
 * Written from the official API docs; Cloudflare GraphQL field names should be confirmed with
 * cfIntrospect() on first run (each source fails independently and is logged in the "log" tab).
 */

const SITE = 'https://cryptopriceticker.com/';
const DAY_MS = 864e5;

function props_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return {
    gscSite: p.GSC_SITE || 'sc-domain:cryptopriceticker.com',
    cfToken: p.CF_API_TOKEN, cfAccount: p.CF_ACCOUNT_ID, cfZone: p.CF_ZONE_ID, cfSiteTag: p.CF_SITE_TAG,
    ghToken: p.GITHUB_TOKEN, ghRepo: p.GITHUB_REPO || 'usaflees/cpt-telemetry',
    alertEmail: p.ALERT_EMAIL || Session.getEffectiveUser().getEmail()
  };
}

const ymd_ = d => Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}

function append_(name, header, rows) {
  if (!rows.length) return;
  const sh = sheet_(name, header);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function log_(source, status, detail) {
  append_('log', ['time', 'source', 'status', 'detail'], [[new Date(), source, status, String(detail).slice(0, 500)]]);
}

function fetchJson_(url, options) {
  const res = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options));
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 300) throw new Error(code + ' ' + body.slice(0, 300));
  return body ? JSON.parse(body) : {};
}

/* ------------------------------ Search Console ------------------------------ */

function gscQuery_(cfg, body) {
  const url = 'https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(cfg.gscSite) + '/searchAnalytics/query';
  const rows = [];
  // rowLimit max is 25,000; page with startRow until a short page comes back (rows are sorted by clicks,
  // so stopping at 500 would silently drop exactly the low-click rows we care about).
  for (let startRow = 0; startRow < 100000; startRow += 25000) {
    const r = fetchJson_(url, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify(Object.assign({ rowLimit: 25000, startRow: startRow }, body))
    });
    const page = r.rows || [];
    rows.push.apply(rows, page);
    if (page.length < 25000) break;
  }
  return rows;
}

// Latest date with FINAL data: ask for the last 6 days by date and take the newest returned.
function gscLatestFinalDate_(cfg) {
  const end = new Date(Date.now() - DAY_MS), start = new Date(Date.now() - 6 * DAY_MS);
  const rows = gscQuery_(cfg, { startDate: ymd_(start), endDate: ymd_(end), dimensions: ['date'] });
  return rows.length ? rows.map(r => r.keys[0]).sort().pop() : null;
}

function collectGsc_(cfg) {
  const day = gscLatestFinalDate_(cfg);
  if (!day) throw new Error('no final Search Console data yet');
  const done = PropertiesService.getScriptProperties().getProperty('GSC_LAST_DAY');
  if (done && done >= day) return 'already have ' + day;
  const base = { startDate: day, endDate: day };
  const pages = gscQuery_(cfg, Object.assign({ dimensions: ['page'] }, base));
  append_('gsc_pages', ['date', 'page', 'clicks', 'impressions', 'ctr', 'position'],
    pages.map(r => [day, r.keys[0], r.clicks, r.impressions, r.ctr, r.position]));
  const qp = gscQuery_(cfg, Object.assign({ dimensions: ['query', 'page'] }, base));
  append_('gsc_queries', ['date', 'query', 'page', 'clicks', 'impressions', 'ctr', 'position'],
    qp.map(r => [day, r.keys[0], r.keys[1], r.clicks, r.impressions, r.ctr, r.position]));
  const dev = gscQuery_(cfg, Object.assign({ dimensions: ['page', 'device'] }, base));
  append_('gsc_devices', ['date', 'page', 'device', 'clicks', 'impressions', 'ctr', 'position'],
    dev.map(r => [day, r.keys[0], r.keys[1], r.clicks, r.impressions, r.ctr, r.position]));
  PropertiesService.getScriptProperties().setProperty('GSC_LAST_DAY', day);
  return day + ': ' + pages.length + ' pages, ' + qp.length + ' query rows';
}

/* ------------------------------ URL Inspection ------------------------------ */

function sitemapUrls_() {
  const xml = UrlFetchApp.fetch(SITE + 'sitemap.xml').getContentText();
  return (xml.match(/<loc>[^<]+<\/loc>/g) || []).map(s => s.replace(/<\/?loc>/g, ''));
}

// ~40 URLs a night cycles all ~116 pages every 3 days (quota: 2,000/day per site).
function collectInspection_(cfg) {
  const urls = sitemapUrls_();
  const sp = PropertiesService.getScriptProperties();
  let cursor = Number(sp.getProperty('INSPECT_CURSOR') || 0);
  const prev = JSON.parse(sp.getProperty('INSPECT_STATE') || '{}');
  const rows = [], changes = [];
  for (let i = 0; i < Math.min(40, urls.length); i++) {
    const url = urls[(cursor + i) % urls.length];
    const r = fetchJson_('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ inspectionUrl: url, siteUrl: cfg.gscSite })
    });
    const s = (r.inspectionResult && r.inspectionResult.indexStatusResult) || {};
    const state = [s.verdict, s.coverageState, s.googleCanonical].join(' | ');
    if (prev[url] && prev[url] !== state) changes.push(url + ': ' + prev[url] + ' → ' + state);
    prev[url] = state;
    rows.push([ymd_(new Date()), url, s.verdict || '', s.coverageState || '', s.googleCanonical || '', s.userCanonical || '', s.lastCrawlTime || '']);
  }
  append_('inspection', ['checked', 'url', 'verdict', 'coverageState', 'googleCanonical', 'userCanonical', 'lastCrawlTime'], rows);
  sp.setProperty('INSPECT_CURSOR', String((cursor + 40) % urls.length));
  sp.setProperty('INSPECT_STATE', JSON.stringify(prev));
  return changes;
}

/* ------------------------------ Cloudflare ------------------------------ */

function cfGraphql_(cfg, query, variables) {
  const r = fetchJson_('https://api.cloudflare.com/client/v4/graphql', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.cfToken },
    payload: JSON.stringify({ query: query, variables: variables })
  });
  // GraphQL errors arrive with HTTP 200.
  if (r.errors && r.errors.length) throw new Error(JSON.stringify(r.errors).slice(0, 400));
  return r.data;
}

function collectCloudflare_(cfg) {
  const end = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS), start = new Date(end.getTime() - DAY_MS);
  const vars = { accountTag: cfg.cfAccount, zoneTag: cfg.cfZone, siteTag: cfg.cfSiteTag, start: start.toISOString(), end: end.toISOString() };
  const day = ymd_(start), out = [];
  try {
    const d = cfGraphql_(cfg, 'query($accountTag:string!,$siteTag:string!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$accountTag}){' +
      'rumPageloadEventsAdaptiveGroups(limit:1000,filter:{siteTag:$siteTag,datetime_geq:$start,datetime_lt:$end},orderBy:[count_DESC]){count sum{visits} dimensions{requestPath deviceType}}}}}', vars);
    const g = d.viewer.accounts[0].rumPageloadEventsAdaptiveGroups;
    append_('cf_pages', ['date', 'path', 'device', 'pageviews', 'visits'], g.map(x => [day, x.dimensions.requestPath, x.dimensions.deviceType, x.count, x.sum.visits]));
    out.push('rum ' + g.length);
  } catch (e) { log_('cloudflare-rum', 'error', e.message); }
  try {
    const d = cfGraphql_(cfg, 'query($accountTag:string!,$siteTag:string!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$accountTag}){' +
      'rumWebVitalsEventsAdaptiveGroups(limit:500,filter:{siteTag:$siteTag,datetime_geq:$start,datetime_lt:$end}){count dimensions{requestPath}' +
      ' quantiles{largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75}}}}}', vars);
    const g = d.viewer.accounts[0].rumWebVitalsEventsAdaptiveGroups;
    append_('cf_vitals', ['date', 'path', 'samples', 'lcp_p75_ms', 'inp_p75_ms', 'cls_p75'],
      g.map(x => [day, x.dimensions.requestPath, x.count, x.quantiles.largestContentfulPaintP75, x.quantiles.interactionToNextPaintP75, x.quantiles.cumulativeLayoutShiftP75]));
    out.push('vitals ' + g.length);
  } catch (e) { log_('cloudflare-vitals', 'error', e.message); }
  let errors = [];
  try {
    const d = cfGraphql_(cfg, 'query($zoneTag:string!,$start:Time!,$end:Time!){viewer{zones(filter:{zoneTag:$zoneTag}){' +
      'httpRequestsAdaptiveGroups(limit:200,filter:{datetime_geq:$start,datetime_lt:$end,edgeResponseStatus_geq:400},orderBy:[count_DESC]){count dimensions{clientRequestPath edgeResponseStatus}}}}}', vars);
    errors = d.viewer.zones[0].httpRequestsAdaptiveGroups;
    append_('cf_errors', ['date', 'path', 'status', 'requests'], errors.map(x => [day, x.dimensions.clientRequestPath, x.dimensions.edgeResponseStatus, x.count]));
    out.push('errors ' + errors.length);
  } catch (e) { log_('cloudflare-http', 'error', e.message); }
  return { summary: out.join(', '), errors: errors };
}

/* ------------------------------ Entry points ------------------------------ */

function nightly() {
  const cfg = props_();
  const alerts = [];
  try { log_('gsc', 'ok', collectGsc_(cfg)); } catch (e) { log_('gsc', 'error', e.message); }
  try {
    const changes = collectInspection_(cfg);
    changes.forEach(c => alerts.push('Index status changed: ' + c));
    log_('inspection', 'ok', changes.length + ' changes');
  } catch (e) { log_('inspection', 'error', e.message); }
  if (cfg.cfToken) {
    const cf = collectCloudflare_(cfg);
    log_('cloudflare', 'ok', cf.summary);
    cf.errors.filter(x => x.dimensions.edgeResponseStatus >= 500 || x.count >= 20)
      .forEach(x => alerts.push(x.dimensions.edgeResponseStatus + ' × ' + x.count + ' on ' + x.dimensions.clientRequestPath));
  }
  trimOld_('gsc_queries', 120);
  if (alerts.length) MailApp.sendEmail(cfg.alertEmail, 'CryptoPriceTicker health alerts (' + alerts.length + ')', alerts.join('\n'));
}

// Weekly: page-level numbers for the last 28 days vs the 28 before, plus query text reduced to
// known coin names/tickers + intent words (anything else becomes "other" — search queries are
// attacker-controllable text, so raw queries never reach the AI).
function weeklyDigest() {
  const cfg = props_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lastDay = PropertiesService.getScriptProperties().getProperty('GSC_LAST_DAY');
  if (!lastDay) return log_('digest', 'skip', 'no Search Console data yet');
  const end = new Date(lastDay + 'T00:00:00Z').getTime();
  const inWin = (d, from, to) => { const t = new Date(d).getTime(); return t > end - to * DAY_MS && t <= end - from * DAY_MS; };

  const pages = {};
  const gp = ss.getSheetByName('gsc_pages');
  (gp ? gp.getDataRange().getValues().slice(1) : []).forEach(r => {
    const [date, page, clicks, impr, , pos] = r;
    const key = String(page).replace(SITE.replace(/\/$/, ''), '');
    const p = pages[key] = pages[key] || { clicks: 0, impressions: 0, posWeighted: 0, prevClicks: 0, prevImpressions: 0, prevPosWeighted: 0 };
    if (inWin(date, 0, 28)) { p.clicks += clicks; p.impressions += impr; p.posWeighted += pos * impr; }
    else if (inWin(date, 28, 56)) { p.prevClicks += clicks; p.prevImpressions += impr; p.prevPosWeighted += pos * impr; }
  });

  const terms = coinTerms_();
  const qs = {};
  const gq = ss.getSheetByName('gsc_queries');
  (gq ? gq.getDataRange().getValues().slice(1) : []).forEach(r => {
    const [date, query, page, clicks, impr, , pos] = r;
    if (!inWin(date, 0, 28)) return;
    const words = String(query).toLowerCase().split(/\s+/);
    const safe = words.every(w => terms.has(w)) ? words.join(' ') : 'other';
    const key = String(page).replace(SITE.replace(/\/$/, ''), '') + ' :: ' + safe;
    const q = qs[key] = qs[key] || { clicks: 0, impressions: 0, posWeighted: 0 };
    q.clicks += clicks; q.impressions += impr; q.posWeighted += pos * impr;
  });

  const digest = {
    generated: new Date().toISOString(), window: { end: lastDay, days: 28 },
    pages: Object.keys(pages).map(k => {
      const p = pages[k];
      return { page: k, clicks: p.clicks, impressions: p.impressions, ctr: p.impressions ? +(p.clicks / p.impressions).toFixed(4) : 0,
        position: p.impressions ? +(p.posWeighted / p.impressions).toFixed(1) : null,
        prev: { clicks: p.prevClicks, impressions: p.prevImpressions, position: p.prevImpressions ? +(p.prevPosWeighted / p.prevImpressions).toFixed(1) : null } };
    }).sort((a, b) => b.impressions - a.impressions),
    queries: Object.keys(qs).map(k => { const q = qs[k]; const [page, query] = k.split(' :: ');
      return { page: page, query: query, clicks: q.clicks, impressions: q.impressions, position: +(q.posWeighted / q.impressions).toFixed(1) }; })
      .filter(q => q.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 300),
    index: latestInspection_(ss),
    vitals: recent_(ss, 'cf_vitals', 7), errors: recent_(ss, 'cf_errors', 7)
  };
  pushToGitHub_(cfg, 'digest/latest.json', JSON.stringify(digest, null, 1));
  pushToGitHub_(cfg, 'digest/' + lastDay + '.json', JSON.stringify(digest));
  log_('digest', 'ok', digest.pages.length + ' pages, ' + digest.queries.length + ' query rows');
}

function coinTerms_() {
  const js = UrlFetchApp.fetch(SITE + 'assets/coins.js').getContentText();
  const terms = new Set(['price', 'prices', 'live', 'chart', 'today', 'usd', 'market', 'cap', 'crypto', 'coin', 'to', 'value', 'now', 'ticker', 'widget', 'cryptocurrency']);
  (js.match(/sym: "[^"]+", name: "[^"]+"/g) || []).forEach(m => {
    const [, sym, name] = m.match(/sym: "([^"]+)", name: "([^"]+)"/);
    terms.add(sym.toLowerCase());
    name.toLowerCase().replace(/[()]/g, ' ').split(/\s+/).filter(Boolean).forEach(w => terms.add(w));
  });
  return terms;
}

function latestInspection_(ss) {
  const sh = ss.getSheetByName('inspection');
  const last = {};
  (sh ? sh.getDataRange().getValues().slice(1) : []).forEach(r => { last[r[1]] = { checked: r[0], verdict: r[2], coverageState: r[3], googleCanonical: r[4] }; });
  return Object.keys(last).filter(u => last[u].verdict !== 'PASS').map(u => Object.assign({ url: u }, last[u]));
}

function recent_(ss, name, days) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const header = values.shift();
  const cutoff = Date.now() - days * DAY_MS;
  return values.filter(r => new Date(r[0]).getTime() >= cutoff).map(r => { const o = {}; header.forEach((h, i) => { o[h] = r[i]; }); return o; });
}

function pushToGitHub_(cfg, path, content) {
  const url = 'https://api.github.com/repos/' + cfg.ghRepo + '/contents/' + path;
  const headers = { Authorization: 'Bearer ' + cfg.ghToken, Accept: 'application/vnd.github+json' };
  let sha;
  const existing = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
  if (existing.getResponseCode() === 200) sha = JSON.parse(existing.getContentText()).sha;
  fetchJson_(url, { method: 'put', contentType: 'application/json', headers: headers,
    payload: JSON.stringify({ message: 'telemetry: ' + path, content: Utilities.base64Encode(content, Utilities.Charset.UTF_8), sha: sha }) });
}

function trimOld_(name, days) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return;
  const dates = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  const cutoff = Date.now() - days * DAY_MS;
  let n = 0;
  while (n < dates.length && new Date(dates[n][0]).getTime() < cutoff) n++;
  if (n) sh.deleteRows(2, n);
}

/* ------------------------------ Setup helpers ------------------------------ */

// Run once: checks every credential and prints what works.
function testSetup() {
  const cfg = props_();
  try { Logger.log('Search Console latest final day: ' + gscLatestFinalDate_(cfg)); } catch (e) { Logger.log('Search Console FAILED: ' + e.message); }
  if (cfg.cfToken) { try { Logger.log('Cloudflare: ' + collectCloudflare_(cfg).summary); } catch (e) { Logger.log('Cloudflare FAILED: ' + e.message); } }
  else Logger.log('Cloudflare: CF_API_TOKEN not set (optional until Web Analytics is on)');
  if (cfg.ghToken) { try { fetchJson_('https://api.github.com/repos/' + cfg.ghRepo, { headers: { Authorization: 'Bearer ' + cfg.ghToken } }); Logger.log('GitHub repo OK: ' + cfg.ghRepo); } catch (e) { Logger.log('GitHub FAILED: ' + e.message); } }
  else Logger.log('GitHub: GITHUB_TOKEN not set (needed for weeklyDigest)');
}

// Creates the two time-driven triggers (nightly ~03:00, weekly Sunday ~05:00, script time zone).
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('nightly').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('weeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(5).create();
}

// Lists the fields of a Cloudflare dataset, to confirm names used above (Logger output).
function cfIntrospect() {
  const cfg = props_();
  ['AccountRumWebVitalsEventsAdaptiveGroups', 'AccountRumPageloadEventsAdaptiveGroups', 'ZoneHttpRequestsAdaptiveGroups'].forEach(t => {
    try { Logger.log(t + ': ' + JSON.stringify(cfGraphql_(cfg, '{__type(name:"' + t + '"){fields{name}}}', {}))); } catch (e) { Logger.log(t + ' FAILED: ' + e.message); }
  });
}
