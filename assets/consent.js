// Google Tag Manager and Google Analytics 4 with Google Consent Mode v2, behind a consent banner.
//
// - Analytics cookies stay off until the visitor clicks Accept. Before that, Consent Mode sends
//   cookieless pings that Google uses for modelled numbers. Ad signals are always denied: the
//   site shows no ads.
// - GTM loads after the page has finished loading (and only once a prerendered page is actually
//   shown), so it never delays the first paint or the live prices.
// - Embedded widgets never load it: they run on other people's websites.
// - The choice is kept in this browser (localStorage "cpt_consent"); "Cookie settings" in the
//   footer, or any element with data-consent-open, shows the banner again.
// The site's CSP allows this file ('self') and Google's tag domains; see _headers.
(function () {
  var GTM_ID = "GTM-PD9TXJX";
  // GA4 property, loaded directly with gtag.js (same consent rules). Don't also add a GA4 / Google
  // tag for this ID inside the GTM container, or every page view is counted twice.
  var GA_ID = "G-DF18LSQFVW";
  var q = new URLSearchParams(location.search);
  if (/^\/embed\//.test(location.pathname) || q.get("embed") === "1") return;

  var KEY = "cpt_consent";
  var read = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var write = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Defaults must be set before GTM loads.
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "denied", functionality_storage: "granted", security_storage: "granted",
    wait_for_update: 500
  });
  gtag("set", "ads_data_redaction", true);
  gtag("set", "url_passthrough", false);
  if (read() === "granted") gtag("consent", "update", { analytics_storage: "granted" });

  var loaded = false;
  function loadGtm() {
    if (loaded) return;
    loaded = true;
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM_ID;
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(g);
  }
  function whenIdle(fn) {
    var run = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1); })(fn, { timeout: 3000 }); };
    if (document.readyState === "complete") run(); else addEventListener("load", run, { once: true });
  }
  function start() { whenIdle(loadGtm); }
  if (document.prerendering) document.addEventListener("prerenderingchange", start, { once: true }); else start();

  // ---------- Banner ----------
  var bar = null;
  function choose(v) {
    write(v);
    gtag("consent", "update", { analytics_storage: v });
    window.dataLayer.push({ event: "cpt_consent_" + v });
    if (bar) { bar.remove(); bar = null; }
  }
  function showBanner() {
    if (bar) return;
    bar = document.createElement("section");
    bar.className = "consent-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Cookie consent");
    bar.innerHTML =
      '<p class="consent-text"><strong>Help us improve the site?</strong> We would like to use Google Analytics cookies to see which pages people use. ' +
      'They are only set if you agree. Your watchlist, portfolio and alerts never leave this browser either way. ' +
      '<a href="/about/#privacy-h">Privacy</a></p>' +
      '<div class="consent-actions"><button type="button" class="action-btn" data-consent="denied">Decline</button>' +
      '<button type="button" class="action-btn btn-accent" data-consent="granted">Accept</button></div>';
    bar.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-consent]");
      if (b) choose(b.getAttribute("data-consent"));
    });
    document.body.appendChild(bar);
  }
  document.addEventListener("click", function (e) {
    var o = e.target.closest && e.target.closest("[data-consent-open]");
    if (o) { e.preventDefault(); showBanner(); var a = bar && bar.querySelector("[data-consent=granted]"); if (a) a.focus(); }
  });
  var ready = function () { if (!read()) showBanner(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true }); else ready();
})();
