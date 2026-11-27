/* CryptoPriceTicker.com — plain-words filter for the home table ("AI coins down 5% this week").
 *
 * A rule reader turns the sentence into a filter on the live numbers app.js streams (window.CPT), shown as chips
 * above the table. Sentences it can't read can go, on a button press, to the browser's own language model
 * (Chrome's Prompt API) with a JSON Schema that only allows filter conditions: the model writes no page text.
 * Nothing typed leaves the browser or is stored. Hook into app.js: window.CPT_SCREEN = { match, sortBy, asc,
 * limit } or null. self.cptScreenParse is for tests/screener.cjs.
 */
(function () {
  "use strict";
  const SECTORS = [
    ["AI", /\b(ai|artificial intelligence)\b/], ["Meme", /\bmeme ?(coins?|tokens?|s)?\b/], ["DeFi", /\b(defi|rwa)\b/],
    ["L1", /\b(l1s?|layer[ -]?(1|one)s?)\b/], ["L2", /\b(l2s?|layer[ -]?(2|two)s?|rollups?)\b/], ["Gaming", /\b(gaming|games?|metaverse)\b/],
    ["Privacy", /\bprivacy\b/], ["DePIN", /\bdepin\b/], ["Stable", /\b(stable ?coins?|stables)\b/]
  ];
  const UP = "up|gain(?:ed|ing|s)?|rose|risen|rising|climb(?:ed|ing)?|green|higher|pump(?:ed|ing)?|rall(?:y|ied|ying)|jump(?:ed|ing)?|surg(?:e|ed|ing)|increas(?:e|ed|ing)";
  const DOWN = "down|fell|fall(?:ing|en)?|lost|los(?:e|ing)|drop(?:ped|ping)?|red|lower|dump(?:ed|ing)?|declin(?:e|ed|ing)|crash(?:ed|ing)?|sank|sink(?:ing)?|decreas(?:e|ed|ing)|slid|bleed(?:ing)?|dip(?:ped)?";
  const MIN = "more than|over|above|at least|greater than|>=|>";
  const MAX = "less than|under|below|at most|no more than|up to|<=|<";
  const NUM = "(\\d+(?:\\.\\d+)?)\\s*(k|thousand|m|mn|mil|million|b|bn|billion|t|tn|trillion)?\\b";
  const MULT = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12 };
  const STOP = new Set("show me find list give all any the a an of in on with and or that which who whose are is were was have has had coins coin tokens token crypto cryptos cryptocurrency cryptocurrencies currencies today now right by than for its it their price prices change changed moved last past since just only please being been".split(" "));
  // A bare number after "market cap over" means billions ("over 10"), unless it is already a full amount.
  const num = (n, unit, dflt = 1) => +n * (unit ? MULT[unit] : +n >= 1e4 ? 1 : dflt);

  /* Words -> filter. Returns { f, used, left } where f is null when nothing was recognised. */
  function parse(input) {
    let s = " " + String(input).toLowerCase().replace(/[−–—]/g, "-").replace(/\bper ?cent\b/g, "%").replace(/,(?=\d{3}\b)/g, "").replace(/\s+/g, " ") + " ";
    const f = {}, used = [];
    const take = (re, fn) => { s = s.replace(re, (...m) => { const r = fn(...m); if (r !== false) { used.push(m[0].trim()); return " "; } return m[0]; }); };
    const set = (k, v) => { f[k] = v; };
    take(/\b(?:no|not|without|excluding|exclude|except|ex|minus)\s+(?:the\s+)?(?:stable ?coins?|stables)\b/g, () => set("noStable", true));
    take(/\b(?:my\s+)?(?:watch ?list|starred|favou?rites)\b/g, () => set("list", "WATCH"));
    take(/\b(?:my\s+)?(?:holdings|bag|portfolio)\b/g, () => set("list", "BAG"));
    take(/\b(?:7 ?d(?:ays?)?|7-day|seven days|(?:this|past|last) week|weekly|week)\b/g, () => set("tf", "7d"));
    take(/\b(?:24 ?h(?:ours?)?|24-hour|today|daily|(?:the )?(?:last|past) day)\b/g, () => set("tf", "24h"));
    // Market cap and volume first, so their dollar amounts aren't read as prices.
    const money = (field, words, dflt) => {
      const W = `(?:${words})`;
      take(new RegExp(`${W}\\s*(?:of\\s*|is\\s*)?(${MIN}|${MAX})\\s*\\$?\\s*${NUM}`, "g"), (m, cmp, n, u) => setRange(field, cmp, num(n, u, dflt)));
      take(new RegExp(`(${MIN}|${MAX})\\s*\\$?\\s*${NUM}\\s*(?:in\\s*|of\\s*)?${W}`, "g"), (m, cmp, n, u) => setRange(field, cmp, num(n, u, dflt)));
    };
    const setRange = (field, cmp, v) => { if (!isFinite(v)) return false; set(field + (new RegExp(`^(?:${MAX})$`).test(cmp) ? "Max" : "Min"), v); };
    // Size classes and "most traded" first, so "large caps under $5" reads $5 as a price, not a market cap.
    take(/\b(?:large|big|mega)[ -]?caps?\b|\bblue[ -]?chips?\b/g, () => set("mcapMin", 1e10));
    take(/\bmid[ -]?caps?\b/g, () => { set("mcapMin", 1e9); set("mcapMax", 1e10); });
    take(/\bsmall[ -]?caps?\b/g, () => set("mcapMax", 1e9));
    take(/\bmicro[ -]?caps?\b/g, () => set("mcapMax", 1e8));
    take(/\b(?:most|highest|top|high|heavily)\s+(?:traded|volume)\b/g, () => { set("sortBy", "vol24h"); set("asc", false); });
    money("mcap", "market ?cap(?:italization)?|mcap|m-cap|caps?|valuation|valued at", 1e9);
    money("vol", "(?:24 ?h\\s*)?(?:trading\\s*)?volume|vol", 1e6);
    // Price
    take(new RegExp(`(?:price\\s*(?:is\\s*)?)?(${MIN}|${MAX}|cheaper than|pricier than)\\s*\\$\\s*${NUM}`, "g"), (m, cmp, n, u) => setRange("price", cmp.replace("cheaper than", "under").replace("pricier than", "over"), num(n, u)));
    take(new RegExp(`price\\s*(?:is\\s*)?(${MIN}|${MAX})\\s*${NUM}`, "g"), (m, cmp, n, u) => setRange("price", cmp, num(n, u)));
    take(new RegExp(`(${MIN}|${MAX})\\s*${NUM}\\s*(?:dollars?|usd|bucks)\\b`, "g"), (m, cmp, n, u) => setRange("price", cmp, num(n, u)));
    take(/\b(?:(?:under|below|less than) (?:a|one) dollar|sub[ -]?dollar|penny)\b/g, m => set("priceMax", /penny/.test(m) ? 0.01 : 1));
    // Change in percent
    take(/\bbetween\s*([+-]?\d+(?:\.\d+)?)\s*%?\s*(?:and|to)\s*([+-]?\d+(?:\.\d+)?)\s*%/g, (m, a, b) => { set("chgMin", Math.min(+a, +b)); set("chgMax", Math.max(+a, +b)); });
    take(/\b(?:flat|unchanged|sideways)\b/g, () => { set("chgMin", -1); set("chgMax", 1); });
    const dirRange = (dir, cmp, n) => {
      const v = +n, cap = cmp && new RegExp(`^(?:${MAX})$`).test(cmp);
      if (dir === "up") { if (cap) { set("chgMin", 0); set("chgMax", v); } else set("chgMin", v); }
      else if (cap) { set("chgMin", -v); set("chgMax", 0); } else set("chgMax", -v);
    };
    const dirOf = w => (new RegExp(`^(?:${UP}|gainers?|winners?|rise)$`).test(w) ? "up" : "down");
    take(new RegExp(`\\b(${UP}|${DOWN})\\s*(?:by\\s*)?(?:(${MIN}|${MAX})\\s*)?(\\d+(?:\\.\\d+)?)\\s*%(?:\\s*or more)?`, "g"), (m, w, cmp, n) => dirRange(dirOf(w), cmp, n));
    take(new RegExp(`(?:(${MIN}|${MAX})\\s*)?(\\d+(?:\\.\\d+)?)\\s*%\\s*\\+?\\s*(?:or more\\s*)?(gainers?|winners?|gains?|rise|${UP}|losers?|losses|${DOWN})\\b`, "g"), (m, cmp, n, w) => dirRange(dirOf(w), cmp, n));
    take(/\b(?:moved|moving|swung|swings?|volatile|move[ds]?)\s*(?:by\s*)?(?:more than|over|at least)?\s*(\d+(?:\.\d+)?)\s*%/g, (m, n) => set("absMin", +n));
    take(new RegExp(`(${MIN}|${MAX})\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*%`, "g"), (m, cmp, n) => setRange("chg", cmp, +n));
    take(/([+-])(\d+(?:\.\d+)?)\s*%/g, (m, sign, n) => set(sign === "+" ? "chgMin" : "chgMax", +(sign + n)));
    take(/\b(\d+(?:\.\d+)?)\s*%/g, (m, n) => set("absMin", +n));
    // Order and count
    take(/\btop\s+(\d{1,3})\s+(gainers?|winners?|losers?|decliners?)\b/g, (m, n, w) => { set("limit", +n); set("sortBy", "chg"); set("asc", /^(los|dec)/.test(w)); });
    take(/\b(?:(?:biggest|top|best)\s+)?(?:gainers?|winners?|pumpers?)\b/g, () => { set("sortBy", "chg"); set("asc", false); });
    take(/\b(?:(?:biggest|worst|top)\s+)?(?:losers?|decliners?|dumpers?)\b/g, () => { set("sortBy", "chg"); set("asc", true); });
    take(/\b(?:cheapest|lowest price)\b/g, () => { set("sortBy", "price"); set("asc", true); });
    take(/\b(?:most expensive|highest price|priciest)\b/g, () => { set("sortBy", "price"); set("asc", false); });
    take(/\b(?:smallest|tiniest)\b/g, () => { set("sortBy", "mcap"); set("asc", true); });
    take(/\btop\s+(\d{1,3})\b/g, (m, n) => set("rankMax", +n));
    take(/\bfirst\s+(\d{1,3})\b/g, (m, n) => set("limit", +n));
    // A direction word on its own: "green today", "AI coins up".
    take(new RegExp(`\\b(${UP})\\b`, "g"), () => { if (f.chgMin == null && f.chgMax == null) set("chgMin", 0); });
    take(new RegExp(`\\b(${DOWN})\\b`, "g"), () => { if (f.chgMin == null && f.chgMax == null) set("chgMax", 0); });
    // Sector last: "AI" can appear anywhere in the sentence.
    for (const [key, re] of SECTORS) take(new RegExp(re.source, "g"), () => { if (f.sector && f.sector !== key) return false; set("sector", key); });
    const left = s.split(/[^a-z0-9$.%+-]+/).filter(w => w && !STOP.has(w) && !/^[.$%+-]+$/.test(w));
    return { f: Object.keys(f).length ? finish(f) : null, used, left };
  }
  function finish(f) {
    if (f.sortBy === "chg") f.sortBy = f.tf === "7d" ? "change7d" : "change24h";
    if (f.rankMax && !f.sortBy && f.chgMin == null && f.chgMax == null && f.absMin == null && !f.sector && !f.list) { f.limit = f.rankMax; delete f.rankMax; }
    f.tf = f.tf || "24h";
    return f;
  }

  /* ------------------------------------------------------------------ */
  const api = window.CPT;
  self.cptScreenParse = parse;
  const input = document.getElementById("searchInput");
  const wrap = document.getElementById("prices");
  if (!api || api.MODE !== "home" || !input || !wrap) return;
  const { state, esc } = api;
  const fmtUsd = v => (v >= 1e12 ? `$${+(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${+(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${+(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${+(v / 1e3).toFixed(1)}K` : `$${+v.toPrecision(4)}`);
  const pct = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`;

  function matcher(f) {
    return c => {
      if (f.sector && !(c.sectors.includes(f.sector) || (f.sector === "DeFi" && c.sectors.includes("RWA")))) return false;
      if (f.noStable && c.sectors.includes("Stable")) return false;
      if (f.list === "WATCH" && !state.watchlist.has(c.sym)) return false;
      if (f.list === "BAG" && !(state.bag[c.sym] > 0)) return false;
      if (f.chgMin != null || f.chgMax != null || f.absMin != null) {
        const ch = f.tf === "7d" ? api.change7d(c) : c.change24h;
        if (ch == null || !isFinite(ch)) return false;
        if (f.chgMin != null && ch < f.chgMin) return false;
        if (f.chgMax != null && ch > f.chgMax) return false;
        if (f.absMin != null && Math.abs(ch) < f.absMin) return false;
      }
      const between = (v, lo, hi) => (lo == null || v >= lo) && (hi == null || v <= hi);
      if ((f.priceMin != null || f.priceMax != null) && !(c.price > 0 && between(c.price, f.priceMin, f.priceMax))) return false;
      if ((f.mcapMin != null || f.mcapMax != null) && !(c.mcap > 0 && between(c.mcap, f.mcapMin, f.mcapMax))) return false;
      if ((f.volMin != null || f.volMax != null) && !(c.vol24h > 0 && between(c.vol24h, f.volMin, f.volMax))) return false;
      if (f.rankMax && c.rank > f.rankMax) return false;
      return true;
    };
  }
  function describe(f) {
    const tf = f.tf === "7d" ? "7-day" : "24 h", out = [];
    if (f.list) out.push(f.list === "WATCH" ? "your watchlist" : "your holdings");
    if (f.sector) out.push(`sector ${f.sector === "Stable" ? "stablecoins" : f.sector}`);
    if (f.noStable) out.push("no stablecoins");
    if (f.chgMin != null && f.chgMax != null) out.push(`${tf} change ${pct(f.chgMin)} to ${pct(f.chgMax)}`);
    else if (f.chgMin != null) out.push(f.chgMin === 0 ? `up (${tf})` : `${tf} change ≥ ${pct(f.chgMin)}`);
    else if (f.chgMax != null) out.push(f.chgMax === 0 ? `down (${tf})` : `${tf} change ≤ ${pct(f.chgMax)}`);
    if (f.absMin != null) out.push(`moved ${f.absMin}% or more either way (${tf})`);
    const rng = (name, lo, hi) => { if (lo != null && hi != null) out.push(`${name} ${fmtUsd(lo)} to ${fmtUsd(hi)}`); else if (lo != null) out.push(`${name} ≥ ${fmtUsd(lo)}`); else if (hi != null) out.push(`${name} ≤ ${fmtUsd(hi)}`); };
    rng("price", f.priceMin, f.priceMax); rng("market cap", f.mcapMin, f.mcapMax); rng("24 h volume", f.volMin, f.volMax);
    if (f.rankMax) out.push(`top ${f.rankMax} by market cap`);
    const by = { change24h: "24 h change", change7d: "7-day change", vol24h: "24 h volume", price: "price", mcap: "market cap" }[f.sortBy];
    if (by) out.push(`sorted by ${by}, ${f.asc ? "lowest" : "highest"} first`);
    if (f.limit) out.push(`first ${f.limit}`);
    return out;
  }

  /* ---------------- UI: one status line above the table ---------------- */
  const note = document.createElement("div");
  note.className = "screen-note";
  note.id = "screenNote";
  note.setAttribute("role", "status");
  note.hidden = true;
  wrap.before(note);
  input.setAttribute("aria-describedby", "screenNote");
  const EXAMPLES = ["AI coins down 5% this week", "large caps up today", "top 10 losers", "under $1 with volume over 50m"];
  // An empty, focused search box shows a few examples to tap.
  function hint() {
    if (input.value.trim() || document.activeElement !== input) return;
    note.innerHTML = `<span class="screen-label">Filter in plain words, for example:</span> ${EXAMPLES.map(t => `<button type="button" class="screen-chip screen-eg">${esc(t)}</button>`).join("")}`;
    note.hidden = false;
  }
  input.addEventListener("focus", hint);
  input.addEventListener("blur", () => setTimeout(() => { if (!input.value.trim() && !note.contains(document.activeElement)) note.hidden = true; }, 200));

  let current = null, refresh = 0, aiState = null, wait7 = 0, lastLeft = [];
  const have7 = () => { let k = 0; state.coins.forEach(c => { if (c.open7 > 0) k++; }); return k; };
  function apply(f, how) {
    current = f && { f, how };
    window.CPT_SCREEN = f ? { match: matcher(f), sortBy: f.sortBy, asc: !!f.asc, limit: f.limit } : null;
    clearInterval(wait7);
    // 7-day changes come from Binance after loadOpen7(): redraw as they arrive (checked each second, up to 20 s).
    if (f && f.tf === "7d" && api.loadOpen7) {
      api.loadOpen7();
      let seen = have7(), n = 0;
      wait7 = setInterval(() => { const k = have7(); if (k !== seen) { seen = k; api.render(); if (current) show(lastLeft); } if (++n >= 20) clearInterval(wait7); }, 1000);
    }
    clearInterval(refresh);
    // Prices keep moving: re-check the filter every 30 s, unless the visitor is typing in the table.
    if (f) refresh = setInterval(() => { if (!document.hidden && !wrap.contains(document.activeElement)) api.render(); }, 30e3);
  }
  function show(left) {
    if (!current) { note.hidden = !aiState; return; }
    const parts = describe(current.f).map(t => `<span class="screen-chip">${esc(t)}</span>`).join("");
    lastLeft = left || [];
    const loading7 = current.f.tf === "7d" && have7() < 10 ? ` <span class="muted">7-day changes are still loading.</span>` : "";
    const extra = loading7 + (left && left.length ? ` <span class="muted">Not used: ${esc(left.slice(0, 5).join(", "))}.</span>` : "");
    note.innerHTML = `<span class="screen-label">${current.how === "ai" ? "Read by the AI in your browser, check it:" : "Filter:"}</span> ${parts}${extra} <button type="button" class="action-btn screen-clear">Clear</button>`;
    note.hidden = false;
  }
  function offerAi(q) {
    if (!aiState || aiState === "unavailable") { note.hidden = true; return; }
    note.innerHTML = `<span class="muted">No filter read from that.</span> <button type="button" class="action-btn screen-ai">Read it with on-device AI</button>${aiState === "available" ? "" : ` <span class="muted">(your browser downloads its AI model once)</span>`}`;
    note.dataset.q = q;
    note.hidden = false;
  }

  let timer;
  input.addEventListener("input", () => {
    const q = input.value.trim();
    const words = q.split(/\s+/).filter(Boolean).length;
    // Single words stay a coin search ("pump", "ai"); a filter needs two words or a % / $ sign.
    const r = q && (words >= 2 || /[%$<>]/.test(q)) ? parse(q) : { f: null };
    apply(r.f, "rules");
    clearTimeout(timer);
    // The status line is announced to screen readers, so it updates once typing pauses, not per key.
    if (r.f) timer = setTimeout(() => show(r.left), 250);
    else if (words >= 3) timer = setTimeout(() => offerAi(q), 350);
    else if (!q) hint();
    else note.hidden = true;
  });
  // A click on a column header takes over the order from the filter's own sort.
  document.addEventListener("click", e => {
    if (current && current.f.sortBy && e.target.closest("[data-action=sort]")) { delete current.f.sortBy; apply(current.f, current.how); show(lastLeft); }
  }, true);
  // Enter (Go on phone keyboards) with a filter active: close the keyboard and bring the filtered table into view.
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter" || !current) return;
    input.blur();
    note.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  note.addEventListener("mousedown", e => { if (e.target.closest(".screen-eg")) e.preventDefault(); }); // keep focus in the box
  note.addEventListener("click", e => {
    if (e.target.closest(".screen-clear")) {
      input.value = ""; input.dispatchEvent(new Event("input")); input.focus();
    } else if (e.target.closest(".screen-ai")) readWithAi(note.dataset.q || "");
    else if (e.target.closest(".screen-eg")) { input.value = e.target.textContent; input.dispatchEvent(new Event("input")); input.focus(); }
  });

  /* ---------------- On-device AI (Chrome Prompt API, structured output) ---------------- */
  const LANG = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
  if ("LanguageModel" in self) LanguageModel.availability(LANG).then(a => { aiState = a; }, () => {});
  const FIELDS = ["change", "price", "marketCap", "volume", "rank"];
  const SCHEMA = {
    type: "object", additionalProperties: false,
    required: ["sector", "excludeStablecoins", "timeframe", "conditions", "sortBy", "sortOrder", "limit"],
    properties: {
      sector: { type: "string", enum: ["any"].concat(SECTORS.map(s => s[0])) },
      excludeStablecoins: { type: "boolean" },
      timeframe: { type: "string", enum: ["24h", "7d"] },
      conditions: {
        type: "array", maxItems: 6,
        items: { type: "object", additionalProperties: false, required: ["field", "op", "value"], properties: { field: { type: "string", enum: FIELDS }, op: { type: "string", enum: [">=", "<="] }, value: { type: "number" } } }
      },
      sortBy: { type: "string", enum: ["rank", "change", "price", "marketCap", "volume"] },
      sortOrder: { type: "string", enum: ["desc", "asc"] },
      limit: { type: "integer", minimum: 0, maximum: 500 }
    }
  };
  const SYSTEM = [
    "You turn a visitor's request into a filter for a table of cryptocurrencies. Output only the JSON the schema allows.",
    "Fields: change is the percent price change (e.g. -5 for down 5%), price is in US dollars, marketCap and volume are in US dollars (10 billion = 10000000000), rank is the market-cap rank (1 = largest).",
    "Sectors: AI, Meme, DeFi, L1, L2, Gaming, Privacy, DePIN, Stable (stablecoins), or any. timeframe is 24h unless the request says week or 7 days.",
    "Use limit 0 for no limit and sortBy rank with sortOrder asc unless the request asks for an order. Leave out anything the request doesn't ask for."
  ].join(" ");
  let session = null;
  async function readWithAi(q) {
    if (!q || !("LanguageModel" in self)) return;
    note.innerHTML = `<span class="muted">Reading with the AI in your browser…</span>`;
    try {
      session = session || await LanguageModel.create({ ...LANG, initialPrompts: [{ role: "system", content: SYSTEM }] });
      const s = await session.clone();
      const raw = await s.prompt(`REQUEST: ${q.slice(0, 300)}`, { responseConstraint: SCHEMA });
      s.destroy && s.destroy();
      const f = fromAi(JSON.parse(raw));
      if (input.value.trim() !== q) return; // the visitor typed something else meanwhile
      if (!f) { note.innerHTML = `<span class="muted">The on-device AI found no filter in that either. Try “down 5% today” or “market cap over 1B”.</span>`; return; }
      apply(f, "ai"); show([]); api.render();
    } catch (_) {
      note.innerHTML = `<span class="muted">The on-device AI couldn't read that just now.</span>`;
    }
  }
  // Validate the model's JSON field by field; anything out of range is dropped, never guessed.
  function fromAi(j) {
    if (!j || typeof j !== "object") return null;
    const f = {};
    if (SECTORS.some(s => s[0] === j.sector)) f.sector = j.sector;
    if (j.excludeStablecoins === true && f.sector !== "Stable") f.noStable = true;
    f.tf = j.timeframe === "7d" ? "7d" : "24h";
    const key = { change: "chg", price: "price", marketCap: "mcap", volume: "vol" };
    (Array.isArray(j.conditions) ? j.conditions : []).slice(0, 6).forEach(c => {
      const v = +c?.value;
      if (!isFinite(v) || !FIELDS.includes(c.field) || (c.op !== ">=" && c.op !== "<=")) return;
      if (c.field === "rank") { if (c.op === "<=" && v >= 1) f.rankMax = Math.round(v); return; }
      if (c.field === "change" && Math.abs(v) > 1000) return;
      if (c.field !== "change" && v < 0) return;
      f[key[c.field] + (c.op === ">=" ? "Min" : "Max")] = v;
    });
    const sort = { change: f.tf === "7d" ? "change7d" : "change24h", price: "price", marketCap: "mcap", volume: "vol24h" }[j.sortBy];
    if (sort) { f.sortBy = sort; f.asc = j.sortOrder === "asc"; }
    if (Number.isInteger(j.limit) && j.limit > 0 && j.limit <= 500) f.limit = j.limit;
    return Object.keys(f).some(k => k !== "tf") ? f : null;
  }
  window.CPT_SCREEN_UI = true;
  // Loaded on the box's first focus: catch up with anything typed before this file arrived.
  // The examples push the table down, so after a slow download (more than ~0.4 s since the tap) they wait for the next focus.
  const me = document.currentScript && performance.getEntriesByName(document.currentScript.src)[0];
  if (input.value.trim()) input.dispatchEvent(new Event("input")); else if (!me || performance.now() - me.startTime < 400) hint();
})();
