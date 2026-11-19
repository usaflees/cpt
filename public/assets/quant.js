// Calculators for the quant sections (scripts/build-seo-engine.mjs). The tables are complete without this
// file; it only recomputes the "your amount" row and the parity sliders. One delegated listener, no layout reads.
(function () {
  function loc(v, min, max) { return v.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max }); }
  // Same rules as usd() in the build script, so typed results match the static cells.
  function usd(v) { return "$" + (v >= 1000 ? loc(v, 2, 2) : v >= 1 ? loc(v, 2, 4) : loc(Number(v.toPrecision(4)), 0, 12)); }
  function scenario(box, src) {
    var amount = box.querySelector("[data-q-amount]"), range = box.querySelector("[data-q-range]");
    var v = parseFloat(src.value);
    if (!(v >= 0)) v = 0;
    if (src === range) amount.value = v; else range.value = Math.min(Math.max(v, +range.min), +range.max);
    box.getAttribute("data-mults").split(",").forEach(function (k, i) {
      var out = box.querySelector('[data-q-out="' + i + '"]');
      var r = v * parseFloat(k);
      if (out) out.textContent = k === "" ? "n/a" : r >= 0.01 ? "$" + loc(r, 2, 2) : usd(r);
    });
  }
  function flip(box, src) {
    var pct = parseFloat(src.value) / 100, price = parseFloat(box.getAttribute("data-target")) * pct / parseFloat(box.getAttribute("data-circ"));
    box.querySelector("[data-q-pct]").textContent = Math.round(pct * 100);
    box.querySelector("[data-q-price]").textContent = usd(price);
    box.querySelector("[data-q-mult]").textContent = loc(price / parseFloat(box.getAttribute("data-price")), 2, 2) + "x";
  }
  document.addEventListener("input", function (e) {
    var box = e.target.closest && e.target.closest("[data-q-calc]");
    if (!box) return;
    if (box.getAttribute("data-q-calc") === "flip") flip(box, e.target); else scenario(box, e.target);
  });
})();
