// Runs in <head> before first paint so the colour theme never flashes: ?theme=, then the saved
// choice, then (except in embedded widgets) the device's light/dark setting.
(function () {
  var themes = ["neon", "kali", "green", "slate", "oled", "light"];
  var q = new URLSearchParams(location.search);
  var t = q.get("theme");
  // ?theme=auto (widgets): follow the visitor's light/dark setting.
  if (t === "auto") t = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "neon";
  if (themes.indexOf(t) < 0) {
    try { t = localStorage.getItem("cpt_theme"); } catch (e) { t = null; }
  }
  var embed = /^\/embed\//.test(location.pathname) || q.get("embed") === "1";
  if (themes.indexOf(t) < 0 && !embed && window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) t = "light";
  if (themes.indexOf(t) >= 0) document.documentElement.setAttribute("data-theme", t);
  // Pop-out ticker buttons show only where Document Picture-in-Picture exists. Decided here, before the first paint,
  // so revealing them can't push the page down (it did at tablet widths when app.js unhid them later).
  if (!embed && "documentPictureInPicture" in window) document.documentElement.classList.add("has-pip");
  // A skipped cross-document view transition rejects its promises; handle them (see app.js, pageswap).
  addEventListener("pagereveal", function (e) { var v = e.viewTransition; if (v) [v.ready, v.finished, v.updateCallbackDone].forEach(function (p) { if (p) p.catch(function () {}); }); });
})();
