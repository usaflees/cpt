/* CryptoPriceTicker.com — Bell Brief (home page).
 *
 * The edition itself is static HTML (scripts/build-bell.mjs → content/bell.json → scripts/build-coin-pages.mjs), so
 * crawlers and visitors without JavaScript see it in full. This file adds only the live parts:
 *   - "Next edition in …" and a progress bar from this edition to the next bell (from data-next on #bell-brief)
 *   - Bitcoin's live move since this bell (data-btc), from the price app.js streams (window.CPT)
 *   - the reveal and the bell ring when the block scrolls into view, and again when a new bell passes
 *   - after a bell the page doesn't show yet, a newer edition from /bell (functions/bell.js, written by the
 *     Cloudflare cron Worker), swapped in without a reload; a 204 there means none, and the page stays as it is
 * Every element it fills has its text or space in the HTML already, so nothing shifts.
 */
(function () {
  "use strict";
  let box = document.getElementById("bell-brief");
  if (!box) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const name = n => (n.edition === "open" ? "opening bell" : n.early ? "early closing bell" : "closing bell");
  const local = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const span = ms => {
    const m = Math.max(1, Math.round(ms / 6e4)), h = Math.floor(m / 60), d = Math.floor(h / 24);
    return d ? `${d} d ${h % 24} h` : h ? `${h} h ${m % 60} min` : `${m} min`;
  };
  let next, cutoff, btc0, nextEl, bar, since, lastPassed;
  let tries = 0, lastTry = 0, busy = false, off = false;

  function setup(el) {
    box = el;
    next = JSON.parse(box.dataset.next || "[]").map(n => ({ ...n, t: Date.parse(n.at) })).filter(n => n.t > 0);
    cutoff = Date.parse(box.dataset.cutoff || "") || null;
    btc0 = Number(box.dataset.btc) || null;
    nextEl = document.getElementById("bellNext"); bar = document.getElementById("bellBar"); since = document.getElementById("bellSince");
    lastPassed = cutoff;
    box.classList.add("js-bell");
  }

  function ring() {
    if (reduce) return;
    box.classList.remove("ring");
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("ring")));
  }

  // Once a minute for up to 20 minutes after each bell; never again on this page after a 204 or 404 (no Worker edition).
  async function fresh(now) {
    if (off || busy || tries >= 20 || now - lastTry < 60e3) return;
    busy = true; lastTry = now; tries++;
    try {
      const r = await fetch("/bell", { cache: "no-store" });
      if (r.status === 204 || r.status === 404) { off = true; return; }
      const j = r.ok ? await r.json() : null, ed = j && j.editions && j.editions[0];
      if (!ed || !(Date.parse(ed.cutoff) > (cutoff || 0)) || typeof j.html !== "string") return;
      const t = document.createElement("template");
      t.innerHTML = j.html;
      const el = t.content.getElementById("bell-brief");
      if (!el) return;
      el.classList.add("is-in");
      box.replaceWith(el);
      setup(el);
      ring(); tick(); live();
    } catch (e) { /* keep the edition shown */ } finally { busy = false; }
  }

  function tick() {
    const now = Date.now();
    const upcoming = next.find(n => n.t > now);
    const passed = next.filter(n => n.t <= now).pop();
    if (passed && now - passed.t < 15 * 60e3) {
      // The next edition is being published; it appears here (or after a reload) once it is out.
      nextEl.textContent = `Publishing the ${name(passed)} edition: reload in a minute`;
      if (lastPassed !== passed.t) { lastPassed = passed.t; tries = 0; ring(); }
    } else if (passed) {
      // Publishing can run late (scheduled jobs start late or are skipped), so don't claim a new edition exists.
      nextEl.textContent = `The ${name(passed)} edition was due at ${local(passed.t)} your time: reload to check for it`;
    } else if (upcoming) {
      nextEl.textContent = `Next: ${name(upcoming)} in ${span(upcoming.t - now)} (${local(upcoming.t)} your time)`;
    }
    if (bar && cutoff && upcoming) {
      const p = Math.min(1, Math.max(0, (now - cutoff) / (upcoming.t - cutoff)));
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    if (passed) fresh(now);
  }

  function live() {
    const c = window.CPT && window.CPT.state && window.CPT.state.coins.get("BTC");
    if (!since || !btc0 || !c || !c.live) return;
    const pct = ((c.price - btc0) / btc0) * 100;
    since.textContent = `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}% · ${window.CPT.fmtPrice(c.price, "USD")} live`;
    since.className = pct >= 0 ? "txt-up" : "txt-down";
  }

  setup(box);
  // Reveal once in view (transform only: content is never hidden or faded, so contrast checks and crawlers see it).
  const show = () => { box.classList.add("is-in"); ring(); };
  if (reduce || !("IntersectionObserver" in window)) box.classList.add("is-in");
  else new IntersectionObserver((entries, obs) => { if (entries.some(e => e.isIntersecting)) { show(); obs.disconnect(); } }, { threshold: 0.25 }).observe(box);

  tick();
  live();
  setInterval(tick, 15e3);
  setInterval(live, 5e3);
})();
