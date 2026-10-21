/* C6 M2 widget: seasonal curve builder */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C6;
  var W = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], WIN = [0, 1, 2, 10, 11], SUM = [3, 4, 5, 6, 7, 8, 9], ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var I = ESC.inputs('g-', ['w', 's', 'a', 'h'], paint);
  var curve = [], qw = 0, qs = 0;
  function paint() {
    qw = +I.w.value; qs = +I.s.value; var a = +I.a.value, h = +I.h.value;
    ESC.out('g-w', '$' + f(qw, 2));
    ESC.out('g-s', '$' + f(qs, 2));
    ESC.out('g-a', '±' + Math.round(100 * a) + '%');
    ESC.out('g-h', f(h, 1));
    curve = X.shapeToQuotes([{ months: WIN, price: qw }, { months: SUM, price: qs }], X.gasShape(a), W);
    document.getElementById('g-stats').innerHTML =
      ESC.stat('Calendar strip', '$' + f(X.stripAverage(curve, ALL, W), 3), 'day-weighted average') +
      ESC.stat('January / July', '$' + f(curve[0], 3) + ' / $' + f(curve[6], 3), 'peak and trough months') +
      ESC.stat('Mar → Apr step', '$' + f(curve[3] - curve[2], 3), 'season boundary') +
      ESC.stat('January power', '$' + f(X.heatRateCurve([curve[0]], h, 3)[0], 2) + '/MWh', 'heat rate × gas + $3');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('g-chart'), function () {
    var o = C.base({ legend: true, yTitle: '$/MMBtu' });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 3); } };
    var strip = ALL.map(function (m) { return WIN.indexOf(m) >= 0 ? qw : qs; });
    return { type: 'line', data: { labels: MON, datasets: [
      C.lineDs('Monthly forward', curve.map(function (x) { return +x.toFixed(3); }), 0, { pointRadius: 3 }),
      C.lineDs('Season strip quote', strip, 4, { borderDash: [6, 4], stepped: 'middle' })] }, options: o };
  });
  paint();
})();
