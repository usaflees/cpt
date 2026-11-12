/* CryptoPriceTicker.com quant widget. Usage:
   <div class="cpt-quant" data-coin="BTC"></div><script async src="https://cryptopriceticker.com/widget.js"></script>
   Options: data-theme="light". No dependencies, no cookies, one request for the open dataset. */
(function () {
  var s = document.currentScript, o = "https://cryptopriceticker.com";
  try { o = new URL(s.src).origin; } catch (e) {}
  var nodes = document.querySelectorAll(".cpt-quant:not([data-ready])");
  if (!nodes.length) return;
  function f(v) { return "$" + (v >= 1 ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v >= 1000 ? 2 : 4 }) : Number(v.toPrecision(4)).toLocaleString("en-US", { maximumFractionDigits: 12 })); }
  function el(t, css, text) { var e = document.createElement(t); e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  fetch(o + "/api/v1/quant-snapshot.json").then(function (r) { return r.json(); }).then(function (d) {
    nodes.forEach(function (n) {
      n.setAttribute("data-ready", "1");
      var q = (n.getAttribute("data-coin") || "BTC").toLowerCase(), a = d.assets.filter(function (x) { return x.symbol.toLowerCase() === q || x.slug === q; })[0];
      var L = n.getAttribute("data-theme") === "light", fg = L ? "#1b1437" : "#f5f1ff", mu = L ? "#5b5380" : "#bdb0e6";
      var c = el("div", "box-sizing:border-box;max-width:340px;padding:14px 16px;border-radius:12px;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border:1px solid " + (L ? "#d9d3f0" : "#2d2260") + ";background:" + (L ? "#fff" : "#150e33") + ";color:" + fg);
      if (!a) { c.textContent = "Asset not in the dataset."; n.appendChild(c); return; }
      var up = a.change_24h_pct >= 0;
      c.appendChild(el("div", "font-weight:700", a.name + " (" + a.symbol + ")"));
      var p = el("div", "font-size:24px;font-weight:800;margin:2px 0", f(a.price_usd) + " ");
      p.appendChild(el("span", "font-size:13px;font-weight:600;color:" + (up ? (L ? "#0a7f55" : "#2ee8a5") : (L ? "#c22249" : "#ff6b8b")), (up ? "+" : "") + a.change_24h_pct.toFixed(2) + "% 24h"));
      c.appendChild(p);
      c.appendChild(el("div", "color:" + mu, "Turnover velocity " + a.turnover_velocity_pct.toFixed(2) + "% · ATH multiplier " + a.ath_recovery_multiplier.toFixed(2) + "x"));
      var m = el("div", "margin-top:8px;font-size:12px;color:" + mu, d.generated_at_utc.slice(0, 16).replace("T", " ") + " UTC · ");
      var l = el("a", "color:inherit;text-decoration:underline", "Data via CryptoPriceTicker.com");
      l.href = a.url; l.rel = "noopener"; l.target = "_blank";
      m.appendChild(l); c.appendChild(m); n.appendChild(c);
    });
  }).catch(function () {});
})();
