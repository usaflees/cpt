// Runs in <head> before first paint so the colour theme never flashes: ?theme=, then the saved
// choice, then (except in embedded widgets) the device's light/dark setting.
(function () {
  var themes = ["neon", "kali", "green", "slate", "oled", "light"];
  var q = new URLSearchParams(location.search);
  var t = q.get("theme");
  if (themes.indexOf(t) < 0) {
    try { t = localStorage.getItem("cpt_theme"); } catch (e) { t = null; }
  }
  var embed = /^\/embed\//.test(location.pathname) || q.get("embed") === "1";
  if (themes.indexOf(t) < 0 && !embed && window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) t = "light";
  if (themes.indexOf(t) >= 0) document.documentElement.setAttribute("data-theme", t);
  // A skipped cross-document view transition rejects its promises; handle them (see app.js, pageswap).
  addEventListener("pagereveal", function (e) { var v = e.viewTransition; if (v) [v.ready, v.finished, v.updateCallbackDone].forEach(function (p) { if (p) p.catch(function () {}); }); });
})();
