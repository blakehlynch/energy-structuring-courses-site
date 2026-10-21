/* C9 M6 widget: cash-flow waterfall */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C9;
  var BASE = [150, 152, 155, 158, 161, 164, 167, 170, 173, 176], D = X.sizeDebt(BASE, 1.35, 0.065, 10, 'annuity');
  var I = ESC.inputs('f-', ['s', 'l', 'm', 'w'], paint);
  var W = null;
  function paint() {
    var s = +I.s.value, l = +I.l.value, m = +I.m.value, w = +I.w.value;
    ESC.out('f-s', '−' + Math.round(100 * s) + '%');
    ESC.out('f-l', f(l, 2) + '×');
    ESC.out('f-m', m);
    ESC.out('f-w', Math.round(100 * w) + '%');
    var cf = BASE.map(function (c, t) { return t === 3 || t === 4 ? c * (1 - s) : c; });
    W = X.waterfall({ cfads: cf, ds: D.ds, dsraMonths: m, lockup: l, sweep: w, dsraInit: D.ds[0] / 2 });
    document.getElementById('f-stats').innerHTML =
      ESC.stat('Total distributions', '$' + f(W.distributions, 0) + 'm', 'over 10 years') +
      ESC.stat('Lock-up years', String(W.lockups), 'swept $' + f(W.swept, 1) + 'm') +
      ESC.stat('Payment default', W.defaultYear ? 'Year ' + W.defaultYear : 'None', 'after DSRA exhausted');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('f-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Year', yTitle: '$m', mode: 'index' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 1) + 'm'; } };
    var rows = W ? W.rows : [], g = function (fn) { return rows.map(function (r) { return +fn(r).toFixed(2); }); };
    return { type: 'bar', data: { labels: rows.map(function (r) { return r.t; }), datasets: [
      C.barDs('Debt service from cash flow', g(function (r) { return Math.min(r.cfads, r.ds); }), 0, { borderRadius: 0 }),
      C.barDs('DSRA draw', g(function (r) { return r.dsraDraw; }), 3, { borderRadius: 0 }),
      C.barDs('Swept to prepayment', g(function (r) { return r.sweep; }), 4, { borderRadius: 0 }),
      C.barDs('Distributions', g(function (r) { return r.dist; }), 2, { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: false })] }, options: o };
  });
  paint();
})();
