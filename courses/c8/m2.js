/* C8 M2 widget: real-options lattice */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C8;
  var I = ESC.inputs('l-', ['s', 'a', 'x', 'c'], paint);
  var vals = [0, 0, 0, 0, 0];
  function paint() {
    var s = +I.s.value, a = +I.a.value, x = +I.x.value, c = +I.c.value;
    ESC.out('l-s', Math.round(100 * s) + '%');
    ESC.out('l-a', '$' + a);
    ESC.out('l-x', Math.round(100 * x) + '%');
    ESC.out('l-c', '$' + c);
    var base = { V0: 200, sigma: s, r: 0.05, delta: 0.04, T: 5, n: 250 };
    var L = function (o) { return X.realLattice(Object.assign({}, base, o)).option; };
    var ab = a > 0 ? L({ abandon: { S: a } }) : 0, ex = x > 0 ? L({ expand: { x: x, I: 50 } }) : 0, co = c > 0 ? L({ contract: { c: 0.25, S: c } }) : 0;
    var all = {}; if (a > 0) all.abandon = { S: a }; if (x > 0) all.expand = { x: x, I: 50 }; if (c > 0) all.contract = { c: 0.25, S: c };
    var tot = Object.keys(all).length ? L(all) : 0;
    vals = [ab, ex, co, ab + ex + co, tot];
    document.getElementById('l-stats').innerHTML =
      ESC.stat('Value with all options', '$' + f(200 + tot, 2), 'base $200 without flexibility') +
      ESC.stat('Flexibility value', '$' + f(tot, 2), 'combined, valued together') +
      ESC.stat('Interaction', '−$' + f(Math.max(0, ab + ex + co - tot), 2), 'sum of parts minus combined');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('l-chart'), function () {
    var o = C.base({ yTitle: '$', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return '$' + f(c.raw, 2); } };
    return { type: 'bar', data: { labels: ['Abandon', 'Expand', 'Contract', 'Sum of parts', 'Combined'], datasets: [C.barDs('Option value', vals.map(function (v) { return +v.toFixed(2); }), 0, { backgroundColor: [C.series(0), C.series(1), C.series(2), C.series(4), C.series(3)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
