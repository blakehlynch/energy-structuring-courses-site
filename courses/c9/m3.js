/* C9 M3 widget: construction risk and contingency */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C9;
  var I = ESC.inputs('c-', ['c', 'l', 'o', 'd'], paint);
  var xs = [], ys = [], cur = 0;
  function run(c, l, o, d) { return X.constructionRisk({ capex: 1000, overrunMean: o, overrunVol: 0.8, delayMean: d, monthlyRevenueLoss: 12, ldRate: 8, ldCap: l, contingency: c, paths: 5000, seed: 51 }); }
  function paint() {
    var c = +I.c.value, l = +I.l.value, o = +I.o.value, d = +I.d.value;
    ESC.out('c-c', Math.round(100 * c) + '%');
    ESC.out('c-l', Math.round(100 * l) + '%');
    ESC.out('c-o', Math.round(100 * o) + '%');
    ESC.out('c-d', f(d, 1));
    var r = run(c, l, o, d); cur = Math.round(100 * c);
    xs = []; ys = [];
    for (var k = 0; k <= 30; k += 2) { xs.push(k); ys.push(+(100 * run(k / 100, l, o, d).pShortfall).toFixed(2)); }
    document.getElementById('c-stats').innerHTML =
      ESC.stat('Probability of shortfall', f(100 * r.pShortfall, 1) + '%', 'needs equity or debt beyond plan') +
      ESC.stat('Expected gap', '$' + f(r.expectedGap, 1) + 'm', 'average uncovered amount') +
      ESC.stat('95th-percentile gap', '$' + f(r.p95Gap, 0) + 'm', 'what lenders worry about');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('c-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Contingency (% of capex)', yTitle: 'Shortfall probability (%)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + '% contingency'; }, label: function (c) { return c.raw === null ? null : c.dataset.label + ': ' + f(c.raw, 1) + '%'; } };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('Shortfall probability', ys, 0, { pointRadius: 2 }), C.lineDs('Selected', xs.map(function (x, i) { return Math.abs(x - cur) < 1 ? ys[i] : null; }), 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
