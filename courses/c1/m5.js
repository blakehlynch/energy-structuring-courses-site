/* C1 M5 widget: boom-bust investment cycle */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C1;
  var I = ESC.inputs('c-', ['lag', 'beta', 'eps', 'buf', 'shock', 'dec'], paint);
  var run = null, run0 = null;
  function opts(buf) {
    return { years: 40, g: 0.015, eps: +I.eps.value, lag: +I.lag.value, delta: +I.dec.value, beta: +I.beta.value, P0: 60, floor: 20, ceiling: 160,
      buffer: buf, d0: 100, shock: { year: 3, size: +I.shock.value / 100, len: 2 } };
  }
  function vol(P) { var s = 0; for (var i = 1; i < P.length; i++) s += Math.abs(Math.log(P[i] / P[i - 1])); return s / (P.length - 1); }
  function paint() {
    ESC.out('c-lag', I.lag.value + ' yrs');
    ESC.out('c-beta', f(+I.beta.value, 2));
    ESC.out('c-eps', f(+I.eps.value, 2));
    ESC.out('c-buf', f(100 * I.buf.value, 1) + '%');
    ESC.out('c-shock', (+I.shock.value > 0 ? '+' : '') + I.shock.value + '%');
    ESC.out('c-dec', f(100 * I.dec.value, 1) + '%');
    run = X.cycleSim(opts(+I.buf.value));
    run0 = +I.buf.value > 0 ? X.cycleSim(opts(0)) : null;
    var P = run.P, mx = Math.max.apply(null, P), mn = Math.min.apply(null, P);
    document.getElementById('c-stats').innerHTML =
      ESC.stat('Price range', '$' + f(mn, 0) + ' – $' + f(mx, 0), 'over 40 years (floor $20, ceiling $160)') +
      ESC.stat('Average |annual change|', f(100 * vol(P), 1) + '%', run0 ? 'vs ' + f(100 * vol(run0.P), 1) + '% with no swing producer' : 'compare Kaiser: 3.5% (1934–70) vs 13.7% (1970–2017)') +
      ESC.stat('Years at floor or ceiling', String(P.filter(function (p) { return p <= 20.01 || p >= 159.99; }).length), 'bust or demand-destruction years');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('c-chart'), function () {
    var labels = []; for (var y = 1; y <= 40; y++) labels.push(y);
    var ds = [];
    if (run) ds.push(C.lineDs(+I.buf.value > 0 ? 'With swing producer' : 'Price (no swing producer)', run.P.map(function (v) { return +v.toFixed(1); }), 0));
    if (run0) ds.push(C.lineDs('No swing producer', run0.P.map(function (v) { return +v.toFixed(1); }), 1));
    var o = C.base({ legend: ds.length > 1, mode: 'index', xTitle: 'Year', yTitle: 'Price ($/bbl)' });
    o.scales.y.min = 0; o.scales.y.max = 170;
    o.plugins.tooltip.callbacks = { title: function (it) { return 'Year ' + it[0].label; }, label: function (c) { return c.dataset.label + ': $' + f(c.raw, 0); } };
    return { type: 'line', data: { labels: labels, datasets: ds }, options: o };
  });
  paint();
})();
