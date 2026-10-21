/* C9 M5 widget: borrowing base */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C9;
  var PROD = [12, 12, 11, 9.5, 8, 6.8, 5.8, 4.9, 4.2, 3.6, 3, 2.5];
  var I = ESC.inputs('b-', ['p', 'o', 'c', 't'], paint);
  function deck(p) { return [70, 68].concat(PROD.slice(2).map(function () { return p; })); }
  function bb(p, o, c, t) { return X.borrowingBase({ prod: PROD, price: deck(p), opex: o, tax: t, disc: 0.08, cover: c, tailShare: 0.25 }); }
  var xs = [], ys = [], cur = 0;
  function paint() {
    var p = +I.p.value, o = +I.o.value, c = +I.c.value, t = +I.t.value;
    ESC.out('b-p', '$' + p);
    ESC.out('b-o', '$' + o);
    ESC.out('b-c', f(c, 2) + '×');
    ESC.out('b-t', Math.round(100 * t) + '%');
    var r = bb(p, o, c, t); cur = p;
    xs = []; ys = [];
    for (var q = 35; q <= 100; q += 5) { xs.push(q); ys.push(+bb(q, o, c, t).base.toFixed(1)); }
    document.getElementById('b-stats').innerHTML =
      ESC.stat('Field-life (PLCR) base', '$' + f(r.base, 0) + 'm', 'NPV $' + f(r.npv, 0) + 'm ÷ ' + f(c, 2)) +
      ESC.stat('Reserve tail starts', 'after year ' + r.tailYear, 'last 25% of proved reserves') +
      ESC.stat('NPV to tail', '$' + f(r.npvToTail, 0) + 'm', 'cash before the tail');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('b-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Long-run deck price ($/bbl)', yTitle: 'Borrowing base ($m)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return '$' + c[0].label + '/bbl'; }, label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 0) + 'm'; } };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('Borrowing base', ys, 0, { pointRadius: 2 }), C.lineDs('Selected', xs.map(function (x) { return x === cur ? +bb(x, +I.o.value, +I.c.value, +I.t.value).base.toFixed(1) : null; }), 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
