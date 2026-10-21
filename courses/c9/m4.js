/* C9 M4 widget: debt sizing and sculpting */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C9;
  var PROF = ['level', 'annuity', 'sculpted'], NAMES = ['Level principal', 'Annuity', 'Sculpted'];
  var cf = []; for (var t = 0; t < 25; t++) cf.push(100 * Math.pow(1.02, t) * (t >= 10 && t < 12 ? 0.85 : 1));
  var I = ESC.inputs('d-', ['s', 'n', 'k', 'p'], paint);
  var res = null;
  function paint() {
    var s = +I.s.value, n = +I.n.value, k = +I.k.value, p = +I.p.value;
    ESC.out('d-s', f(s, 2) + '×');
    ESC.out('d-n', n);
    ESC.out('d-k', f(100 * k, 2) + '%');
    ESC.out('d-p', NAMES[p]);
    res = X.sizeDebt(cf, s, k, n, PROF[p]);
    var irr = X.equityIrr(1050, res.debt, cf, res.ds);
    document.getElementById('d-stats').innerHTML =
      ESC.stat('Debt capacity', '$' + f(res.debt, 0) + 'm', f(100 * res.debt / 1050, 0) + '% gearing') +
      ESC.stat('LLCR / PLCR', f(res.llcr, 2) + ' / ' + f(res.plcr, 2), 'min DSCR ' + f(res.minDscr, 2)) +
      ESC.stat('Average life', f(res.wal, 1) + ' yrs', 'weighted by repayments') +
      ESC.stat('Equity IRR', isNaN(irr) ? '–' : f(100 * irr, 1) + '%', 'capex $1,050m');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('d-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Year', yTitle: '$m', mode: 'index' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 1) + 'm'; } };
    var labels = cf.map(function (_, i) { return i + 1; });
    var ds = labels.map(function (_, i) { return res && res.ds[i] !== undefined ? +res.ds[i].toFixed(2) : 0; });
    return { type: 'bar', data: { labels: labels, datasets: [
      C.barDs('Debt service', ds, 1),
      Object.assign(C.lineDs('CFADS', cf.map(function (x) { return +x.toFixed(2); }), 0, { pointRadius: 2 }), { type: 'line' })] }, options: o };
  });
  paint();
})();
