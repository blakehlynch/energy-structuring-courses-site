/* C9 M2 widget: revenue structure and debt cover */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C9;
  var TYPES = ['ppa', 'collar', 'merchant'], NAMES = ['PPA at $52', 'Collar', 'Merchant'];
  var I = ESC.inputs('r-', ['t', 'v', 'f'], paint);
  var bins = [], counts = [];
  function paint() {
    var t = +I.t.value, v = +I.v.value, fl = +I.f.value;
    ESC.out('r-t', NAMES[t]);
    ESC.out('r-v', Math.round(100 * v) + '%');
    ESC.out('r-f', '$' + fl);
    var r = X.revenueRisk({ type: TYPES[t], mwh: 4.2e6, price: 55, vol: v, strike: 52, floor: fl, cap: 70, opex: 120, ds: 70, paths: 5000, seed: 41 });
    var lo = -1, hi = 4, nb = 40, w = (hi - lo) / nb; bins = []; counts = [];
    for (var b = 0; b < nb; b++) { bins.push(+(lo + (b + 0.5) * w).toFixed(3)); counts.push(0); }
    r.dist.forEach(function (x) { var i = Math.min(nb - 1, Math.max(0, Math.floor((x - lo) / w))); counts[i]++; });
    document.getElementById('r-stats').innerHTML =
      ESC.stat('Mean DSCR', f(r.mean, 2), NAMES[t]) +
      ESC.stat('5th percentile DSCR', f(r.p5, 2), 'what lenders size against') +
      ESC.stat('Years with DSCR < 1', f(100 * r.pBelow1, 1) + '%', 'debt service not covered');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('r-chart'), function () {
    var o = C.base({ xTitle: 'Annual DSCR', yTitle: 'Simulated years', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.scales.x.ticks.callback = function (v, i) { return i % 8 === 4 ? f(bins[i], 1) : null; };
    o.plugins.tooltip.callbacks = { title: function (c) { return 'DSCR ≈ ' + f(bins[c[0].dataIndex], 2); }, label: function (c) { return c.raw + ' years'; } };
    return { type: 'bar', data: { labels: bins, datasets: [C.barDs('Years', counts, 0, { barPercentage: 1, categoryPercentage: 0.95, borderRadius: 2, backgroundColor: bins.map(function (b) { return b < 1 ? C.series(3) : C.series(0); }) })] }, options: o };
  });
  paint();
})();
