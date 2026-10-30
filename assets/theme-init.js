// Runs in <head> before first paint so the saved (or ?theme=) colour theme never flashes.
(function () {
  var themes = ["kali", "green", "slate", "oled", "light"];
  var t = new URLSearchParams(location.search).get("theme");
  if (themes.indexOf(t) < 0) {
    try { t = localStorage.getItem("cpt_theme"); } catch (e) { t = null; }
  }
  if (themes.indexOf(t) >= 0) document.documentElement.setAttribute("data-theme", t);
})();
