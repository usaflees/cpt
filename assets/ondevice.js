/* CryptoPriceTicker.com — On-device AI on coin pages (experiment). Nothing leaves the browser.
 *
 *   Ask     "Ask about BTC": questions answered by the language model built into the visitor's browser
 *           (Chrome's Prompt API, Gemini Nano) using only the numbers already on this page: the live price,
 *           the 24 h move versus BTC and the market, recent measured moves, and the performance table.
 *           Presets include "Why did it move today?", which can only say what the page measured
 *           (moving with the market or on its own), never a news reason.
 *   Translate  When the browser's language isn't English and Chrome's Translator API can translate into it,
 *           a button translates the "About" section in place, with a button back to the original.
 *
 * assets/app.js loads this file only on coin pages, only when the browser has LanguageModel or Translator,
 * from the hashed URL the build writes into <meta name="cpt-ondevice">. Answers are made on demand, labelled
 * as machine-generated, never stored and never in the HTML, so crawlers and other browsers see nothing.
 * The section is added below the About section after load (Chrome's scroll anchoring keeps the view still).
 */
(function () {
  "use strict";
  const api = window.CPT;
  if (!api || api.MODE !== "coin") return;
  const { state, esc } = api;
  const SYM = state.coinPageSym;
  const about = document.querySelector('section[aria-labelledby="about-h"]');
  if (!SYM || !about) return;
  const LANG_OPTS = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
  const PRESETS = [
    ["Why did it move today?", `Why did ${SYM} move over the last 24 hours? Say whether it moved with BTC and the wider market or on its own, using only the facts.`],
    ["How volatile is it?", `How volatile has ${SYM} been? Use the volatility, drawdown and 52-week range in the facts.`],
    ["How far from its high?", `How far is ${SYM} from its 52-week high and low right now?`]
  ];
  const text = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const pct = v => (isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "unknown");

  // The model sees only this: what a reader of the page can see, as plain lines.
  function facts() {
    const c = state.coins.get(SYM), btc = state.coins.get("BTC");
    const lines = [`Coin: ${c ? c.name : SYM} (${SYM}).`];
    if (c && c.price > 0) lines.push(`Price now: $${api.fmtPrice(c.price)} (${c.live ? "live from exchanges" : "last saved snapshot, not live yet"}).`);
    if (c && c.live && isFinite(c.change24h)) lines.push(`${SYM} change over the last 24 hours: ${pct(c.change24h)}.`);
    if (btc && btc !== c && btc.live && isFinite(btc.change24h)) lines.push(`BTC change over the last 24 hours: ${pct(btc.change24h)}.`);
    const market = text(document.getElementById("flashMarket"));
    if (market) lines.push(`Versus the market: ${market}`);
    const flashes = Array.from(document.querySelectorAll("#flashList li:not(.flash-empty)")).slice(0, 5).map(text).filter(Boolean);
    if (flashes.length) lines.push(`Sharp moves measured while this page was open: ${flashes.join(" | ")}`);
    const perf = document.querySelector('section[aria-labelledby="perf-h"]');
    if (perf) {
      lines.push(`Performance summary: ${text(perf.querySelector("p.prose"))}`);
      perf.querySelectorAll(".stat-grid .metric-box").forEach(b => lines.push(`${text(b)}.`));
      const months = Array.from(perf.querySelectorAll(".history-table tbody tr")).slice(0, 6).map(text);
      if (months.length) lines.push(`Recent month-end closes (month, close, change): ${months.join(" | ")}`);
    }
    return lines.join("\n").slice(0, 6000);
  }
  const SYSTEM = [
    "You answer questions about one cryptocurrency for a visitor of a price website.",
    "Use only the FACTS in the user's message. If they don't contain the answer, say that this page doesn't show it.",
    "Never invent news, events, reasons or numbers. You can't know why a price moved beyond what the facts measure.",
    "Never predict prices and never give financial advice or tell anyone to buy or sell.",
    "Answer in two or three short plain sentences, no lists or headings."
  ].join(" ");

  /* ---------------- UI ---------------- */
  const sec = document.createElement("section");
  sec.className = "page-section ondevice";
  sec.setAttribute("aria-labelledby", "ask-h");
  sec.hidden = true;
  about.after(sec);

  async function setupAsk() {
    if (!("LanguageModel" in self)) return null;
    let avail;
    try { avail = await LanguageModel.availability(LANG_OPTS); } catch (_) { return null; }
    if (avail === "unavailable") return null;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <h2 id="ask-h">Ask about ${esc(SYM)} <span class="muted">· on-device AI</span></h2>
      <p class="muted">Answered by the AI model built into your browser, on your device, from the numbers on this page only. It can be wrong: check the figures above. Not financial advice.${avail === "available" ? "" : " The first question makes your browser download its AI model once, which is large and can take a few minutes."}</p>
      <div class="ondevice-presets">${PRESETS.map(([label], i) => `<button type="button" class="action-btn" data-preset="${i}">${esc(label)}</button>`).join("")}</div>
      <form class="ondevice-form" autocomplete="off">
        <label class="sr-only" for="askInput">Your question about ${esc(SYM)}</label>
        <input id="askInput" class="form-input" type="text" maxlength="200" placeholder="Ask about ${esc(SYM)}'s price and moves">
        <button type="submit" class="action-btn">Ask</button>
      </form>
      <p class="ondevice-status muted" aria-live="polite"></p>
      <p class="ondevice-answer" aria-live="polite"></p>`;
    const status = wrap.querySelector(".ondevice-status"), out = wrap.querySelector(".ondevice-answer");
    const input = wrap.querySelector("#askInput");
    let session = null, busy = null;
    async function ask(q) {
      q = String(q || "").trim().slice(0, 200);
      if (!q) return;
      if (busy) busy.abort();
      const ctl = busy = new AbortController();
      out.textContent = ""; out.removeAttribute("data-question");
      try {
        if (!session) {
          status.textContent = "Starting your browser's AI model…";
          session = await LanguageModel.create({
            ...LANG_OPTS,
            initialPrompts: [{ role: "system", content: SYSTEM }],
            monitor(m) { m.addEventListener("downloadprogress", e => { status.textContent = `Downloading your browser's AI model: ${Math.round(e.loaded * 100)}%`; }); },
            signal: ctl.signal
          });
        }
        status.textContent = "Thinking on your device…";
        // A clone keeps each question independent (no memory of earlier answers or their facts).
        const one = await session.clone({ signal: ctl.signal });
        try {
          const stream = one.promptStreaming(`FACTS:\n${facts()}\n\nQUESTION: ${q}`, { signal: ctl.signal });
          let acc = "";
          for await (const chunk of stream) { acc += chunk; out.textContent = acc; }
          out.dataset.question = q;
          status.textContent = `Your question: “${q}” · AI-generated on your device from this page's numbers.`;
        } finally { one.destroy(); }
      } catch (e) {
        if (e && e.name === "AbortError") return;
        status.textContent = e && e.name === "NotAllowedError"
          ? "Your browser needs a click to start its AI model. Press a question again."
          : "Your browser's AI model couldn't answer just now. The numbers above are unchanged.";
      } finally { if (busy === ctl) busy = null; }
    }
    wrap.addEventListener("click", e => { const b = e.target.closest("[data-preset]"); if (b) ask(PRESETS[+b.dataset.preset][1]); });
    wrap.querySelector("form").addEventListener("submit", e => { e.preventDefault(); ask(input.value); });
    addEventListener("pagehide", e => { if (!e.persisted && session) { session.destroy(); session = null; } });
    return wrap;
  }

  async function setupTranslate() {
    if (!("Translator" in self)) return null;
    const target = String(navigator.language || "en").split("-")[0].toLowerCase();
    if (!target || target === "en") return null;
    let avail;
    try { avail = await Translator.availability({ sourceLanguage: "en", targetLanguage: target }); } catch (_) { return null; }
    if (avail === "unavailable") return null;
    let langName = target;
    try { langName = new Intl.DisplayNames([navigator.language], { type: "language" }).of(target) || target; } catch (_) {}
    const wrap = document.createElement("div");
    wrap.className = "ondevice-translate";
    wrap.innerHTML = `<h2 id="tr-h">${esc(SYM)} in ${esc(langName)}</h2>
      <p class="muted">Your browser can translate the "About ${esc(SYM)}" section into ${esc(langName)} on your device. Machine translation can be wrong; the English text is the original.</p>
      <button type="button" class="action-btn" data-tr="on">Translate "About" into ${esc(langName)}</button>
      <button type="button" class="action-btn" data-tr="off" hidden>Show the English original</button>
      <p class="ondevice-status muted" aria-live="polite"></p>`;
    const status = wrap.querySelector(".ondevice-status");
    const on = wrap.querySelector('[data-tr="on"]'), off = wrap.querySelector('[data-tr="off"]');
    const parts = Array.from(about.querySelectorAll("h2, h3, p"));
    const originals = parts.map(el => el.innerHTML);
    let translator = null, translated = null;
    on.addEventListener("click", async () => {
      on.disabled = true;
      try {
        if (!translated) {
          if (!translator) {
            status.textContent = "Starting your browser's translator…";
            translator = await Translator.create({
              sourceLanguage: "en", targetLanguage: target,
              monitor(m) { m.addEventListener("downloadprogress", e => { status.textContent = `Downloading the ${langName} language pack: ${Math.round(e.loaded * 100)}%`; }); }
            });
          }
          status.textContent = "Translating on your device…";
          translated = [];
          for (const el of parts) translated.push(await translator.translate(text(el)));
        }
        parts.forEach((el, i) => { el.textContent = translated[i]; el.lang = target; });
        about.dataset.translated = target;
        status.textContent = `Machine-translated into ${langName} on your device.`;
        on.hidden = true; off.hidden = false;
      } catch (_) {
        status.textContent = "Your browser couldn't translate this just now.";
        translated = null;
      } finally { on.disabled = false; }
    });
    off.addEventListener("click", () => {
      parts.forEach((el, i) => { el.innerHTML = originals[i]; el.removeAttribute("lang"); });
      delete about.dataset.translated;
      status.textContent = "";
      on.hidden = false; off.hidden = true;
    });
    return wrap;
  }

  Promise.all([setupAsk(), setupTranslate()]).then(([ask, tr]) => {
    if (!ask && !tr) { sec.remove(); return; }
    if (ask) sec.append(ask); else sec.setAttribute("aria-labelledby", "tr-h");
    if (tr) sec.append(tr);
    sec.hidden = false;
    window.CPT_ONDEVICE = { ask: Boolean(ask), translate: Boolean(tr) };
  });
})();
