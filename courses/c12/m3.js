/* C12 M3 widget: VaR backtest by exception count */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C12;
  var I = ESC.inputs('k-', ['T', 'c', 'n'], paint);
  var ks = [], pm = [], N = 0;
  function paint() {
    var T = +I.T.value, c = +I.c.value / 100, p = 1 - c;
    N = Math.min(+I.n.value, T);
    ESC.out('k-T', String(T));
    ESC.out('k-c', f(100 * c, 1) + '%');
    ESC.out('k-n', String(N));
    var exp = p * T, tail = X.binomAtLeast(N, T, p), lr = X.kupiec(N, T, p);
    var basel = (Math.abs(c - 0.99) < 1e-9 && T === 250) ? X.baselZone(N) : null;
    var top = Math.max(N + 3, Math.ceil(exp + 4 * Math.sqrt(exp * (1 - p))) + 1);
    ks = []; pm = [];
    for (var k = 0; k <= top; k++) { ks.push(k); pm.push(X.binomPmf(k, T, p)); }
    document.getElementById('k-stats').innerHTML =
      ESC.stat('Expected exceptions', f(exp, 1), 'p = ' + f(100 * p, 1) + '% over ' + T + ' days') +
      ESC.stat('P(this many or more)', f(100 * tail, 1) + '%', 'if the model is correct') +
      ESC.stat('Kupiec LR', f(lr, 2), lr > 3.841 ? 'reject at 95% (> 3.841)' : 'do not reject (≤ 3.841)') +
      ESC.stat('Basel zone', basel ? basel.zone : 'n/a', basel ? 'multiplier ' + f(3 + basel.plus, 2) : 'only for 99% over 250 days');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('k-chart'), function () {
    var o = C.base({ xTitle: 'Exceptions', yTitle: 'Probability (%)', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return f(c.raw, 2) + '%'; } };
    var col = ks.map(function (k) { return k === N ? C.series(3) : (k > N ? C.series(5) : C.series(0)); });
    return { type: 'bar', data: { labels: ks.map(String), datasets: [C.barDs('Probability', pm.map(function (x) { return +(100 * x).toFixed(3); }), 0, { backgroundColor: col, borderSkipped: false })] }, options: o };
  });
  paint();
})();
