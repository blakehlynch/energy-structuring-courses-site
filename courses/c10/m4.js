/* C10 M4 widget: virtual PPA risk */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C10;
  var I = ESC.inputs('v-', ['c', 'b', 's', 'p'], paint);
  function money(x) { return (x < 0 ? '−$' : '+$') + f(Math.abs(x) / 1e6, 2) + 'm'; }
  var bins = [], counts = [];
  function paint() {
    var c = +I.c.value, b = +I.b.value, s = +I.s.value, p = +I.p.value;
    ESC.out('v-c', Math.round(100 * c) + '%');
    ESC.out('v-b', '$' + f(b, 1));
    ESC.out('v-s', Math.round(100 * s) + '%');
    ESC.out('v-p', '$' + f(p, 1));
    var o = { ppa: p, hubBase: 50, capture: c, basisMean: b, basisSd: 3, mwh: 250000, volSd: 0.06, priceSd: s, rhoVP: -0.2, paths: 5000, seed: 61 };
    var r = X.solarPPA(o);
    // rebuild the sample for the histogram with the same seed
    var z = X.normals(61), res = [];
    for (var k = 0; k < 5000; k++) { var zp = z(), zv = -0.2 * zp + Math.sqrt(1 - 0.04) * z(), zb = z(); var base = 50 * Math.exp(s * zp - 0.5 * s * s); res.push(250000 * Math.max(0, 1 + 0.06 * zv) * (base * c - (b + 3 * zb) - p)); }
    var lo = -12e6, hi = 12e6, nb = 32, w = (hi - lo) / nb; bins = []; counts = [];
    for (var i = 0; i < nb; i++) { bins.push(lo + (i + 0.5) * w); counts.push(0); }
    res.forEach(function (x) { var j = Math.min(nb - 1, Math.max(0, Math.floor((x - lo) / w))); counts[j]++; });
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Expected settlement', money(r.expected), 'per year to the buyer') +
      ESC.stat('5th percentile year', money(r.p5), '95th ' + money(r.p95)) +
      ESC.stat('Shape cost vs baseload', '$' + f(r.shapeCost / 1e6, 2) + 'm', 'basis $' + f(r.basisCost / 1e6, 2) + 'm');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('v-chart'), function () {
    var o = C.base({ xTitle: 'Annual settlement to the buyer ($m)', yTitle: 'Simulated years', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.scales.x.ticks.callback = function (v, i) { return i % 4 === 0 ? f(bins[i] / 1e6, 0) : null; };
    o.plugins.tooltip.callbacks = { title: function (c) { return '≈ $' + f(bins[c[0].dataIndex] / 1e6, 1) + 'm'; }, label: function (c) { return c.raw + ' years'; } };
    return { type: 'bar', data: { labels: bins, datasets: [C.barDs('Years', counts, 0, { barPercentage: 1, categoryPercentage: 0.95, borderRadius: 2, backgroundColor: bins.map(function (b) { return b < 0 ? C.series(3) : C.series(0); }) })] }, options: o };
  });
  paint();
})();
