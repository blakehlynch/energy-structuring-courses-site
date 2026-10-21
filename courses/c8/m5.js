/* C8 M5 widget: consolidated volatility by Monte Carlo */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C8;
  var I = ESC.inputs('v-', ['s', 'r', 'f'], paint);
  var base = { prices: [10, 10, 9.8, 9.5, 9.2, 9, 8.8], qty: [100, 120, 135, 145, 150, 155, 158], vc: [6, 5.5, 5, 4.6, 4.2, 3.9, 3.6], wacc: 0.12, paths: 4000, seed: 31 };
  var bins = [], counts = [];
  function paint() {
    var s = +I.s.value, r = +I.r.value, fx = +I.f.value;
    ESC.out('v-s', Math.round(100 * s) + '%');
    ESC.out('v-r', f(r, 2));
    ESC.out('v-f', '$' + fx);
    var res = X.consolidatedVol(Object.assign({}, base, { sdP: s, rho: r, fixed: fx }));
    // returns histogram (recompute samples cheaply with the same seed)
    var z = X.normals(31), T = base.prices.length, zs = [];
    var cf0 = base.prices.map(function (p, t) { return (p - base.vc[t]) * base.qty[t] - fx; });
    for (var k = 0; k < base.paths; k++) {
      var e = z() * s, pv1 = 0, cf1 = 0;
      for (var t = 0; t < T; t++) { var p = base.prices[t] * Math.exp(e * Math.pow(r, t) - 0.5 * s * s * Math.pow(r, 2 * t)), cf = (p - base.vc[t]) * base.qty[t] - fx; if (t === 0) cf1 = cf; else pv1 += cf / Math.pow(1 + base.wacc, t); }
      if (res.PV0 > 0) zs.push(Math.log(Math.max(1e-4 * res.PV0, pv1 + cf1) / res.PV0));
    }
    var lo = -0.8, hi = 0.8, nb = 32, w = (hi - lo) / nb; bins = []; counts = [];
    for (var b = 0; b < nb; b++) { bins.push(+(lo + (b + 0.5) * w).toFixed(3)); counts.push(0); }
    zs.forEach(function (x) { var i = Math.floor((x - lo) / w); if (i >= 0 && i < nb) counts[i]++; });
    var dv = res.PV0 > 0 ? X.realLattice({ V0: res.PV0, sigma: Math.max(0.01, res.sigma), r: 0.05, delta: 0.10, T: 3, n: 150, defer: { I: 2400 } }).value : 0;
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Project volatility', res.PV0 > 0 ? f(100 * res.sigma, 1) + '%' : 'n/a', res.clamped ? res.clamped + ' draws wipe out the value: lognormal approximation breaks down' : 'input price sd ' + Math.round(100 * s) + '%') +
      ESC.stat('PV without flexibility', '$' + f(res.PV0, 0), 'NPV at $2,400 cost: $' + f(res.PV0 - 2400, 0)) +
      ESC.stat('Value with 3-year deferral', '$' + f(dv, 0), 'flexibility $' + f(dv - Math.max(0, res.PV0 - 2400), 0));
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('v-chart'), function () {
    var o = C.base({ xTitle: 'One-year log return on project value', yTitle: 'Draws', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.scales.x.ticks.callback = function (v, i) { return i % 4 === 0 ? Math.round(100 * bins[i]) + '%' : null; };
    o.plugins.tooltip.callbacks = { title: function (c) { return 'Return ≈ ' + Math.round(100 * bins[c[0].dataIndex]) + '%'; }, label: function (c) { return c.raw + ' draws'; } };
    return { type: 'bar', data: { labels: bins, datasets: [C.barDs('Draws', counts, 0, { barPercentage: 1, categoryPercentage: 0.95, borderRadius: 2 })] }, options: o };
  });
  paint();
})();
