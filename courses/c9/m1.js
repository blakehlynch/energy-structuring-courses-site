/* C9 M1 widget: leverage and returns */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C9;
  var I = ESC.inputs('v-', ['d', 'k', 'r', 't'], paint);
  var xs = [], ys = [], cur = null;
  function paint() {
    var d = +I.d.value, k = +I.k.value, r = +I.r.value, t = +I.t.value;
    ESC.out('v-d', Math.round(100 * d) + '%');
    ESC.out('v-k', f(100 * k, 2) + '%');
    ESC.out('v-r', '$' + r);
    ESC.out('v-t', Math.round(100 * t) + '%');
    var o = X.leverageReturn({ cost: 1000, revenue: r, debtShare: d, kd: k, tax: t });
    xs = []; ys = [];
    for (var s = 0; s <= 0.9501; s += 0.05) { xs.push(Math.round(100 * s)); ys.push(+(100 * X.leverageReturn({ cost: 1000, revenue: r, debtShare: s, kd: k, tax: t }).roe).toFixed(2)); }
    cur = Math.round(100 * d);
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Return on equity', f(100 * o.roe, 2) + '%', 'equity $' + f(o.equity, 0)) +
      ESC.stat('Interest cost', '$' + f(1000 * d * k, 1), 'per year') +
      ESC.stat('Revenue for a 14% equity return', '$' + f(X.requiredRevenue({ cost: 1000, debtShare: d, kd: k, ke: 0.14, tax: t }), 1), 'what an offtaker must pay');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('v-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Debt share (%)', yTitle: 'Return on equity (%)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + '% debt'; }, label: function (c) { return c.raw === null ? null : c.dataset.label + ': ' + f(c.raw, 2) + '%'; } };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('ROE', ys, 0, { pointRadius: 2 }), C.lineDs('Selected', xs.map(function (x, i) { return x === cur ? ys[i] : null; }), 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
