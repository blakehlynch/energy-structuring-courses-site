/* C4 M7 widget: trade-finance capital and return */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var CCF = { lc: 0.2, sb: 0.5, loan: 1.0, lc100: 1.0 }, NAMES = { lc: 'LC (20%)', sb: 'Standby (50%)', loan: 'Loan (100%)', lc100: 'LC at 100%' };
  var I = ESC.inputs('k-', ['inst', 'exp', 'rw', 'fee', 'days'], paint, ['input', 'change']);
  var bars = [];
  function paint() {
    var exp = +I.exp.value * 1e6, rw = +I.rw.value, fee = +I.fee.value / 100, days = +I.days.value, inst = I.inst.value;
    ESC.out('k-exp', '$' + I.exp.value + 'm');
    ESC.out('k-rw', Math.round(100 * rw) + '%');
    ESC.out('k-fee', f(+I.fee.value, 2) + '%');
    ESC.out('k-days', days);
    var r = X.returnOnCapital({ exposure: exp, feePa: fee, days: days, ccf: CCF[inst], rw: rw });
    document.getElementById('k-stats').innerHTML =
      ESC.stat('Capital required', '$' + f(r.capital / 1e6, 2) + 'm', 'CCF ' + Math.round(100 * CCF[inst]) + '% × RW ' + Math.round(100 * rw) + '% × 8%') +
      ESC.stat('Fee income', '$' + f(r.fee / 1e3, 0) + 'k', 'over ' + days + ' days') +
      ESC.stat('Return on capital', f(100 * r.annualised, 1) + '%', 'annualised, gross');
    bars = Object.keys(CCF).map(function (k) { return { k: k, v: 100 * X.returnOnCapital({ exposure: exp, feePa: fee, days: days, ccf: CCF[k], rw: rw }).annualised }; });
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('k-chart'), function () {
    var o = C.base({ yTitle: 'Return on capital (%)', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return f(c.raw, 1) + '%'; } };
    var cur = I.inst.value;
    return { type: 'bar', data: { labels: bars.map(function (b) { return NAMES[b.k]; }), datasets: [C.barDs('Return on capital', bars.map(function (b) { return +b.v.toFixed(2); }), 0, { backgroundColor: bars.map(function (b) { return b.k === cur ? C.series(0) : C.wash(C.series(0), 0.4); }) })] }, options: o };
  });
  paint();
})();
