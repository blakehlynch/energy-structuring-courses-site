/* C10 M3 widget: storage lease bid */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C10;
  var BASE = [3.20, 3.25, 3.35, 3.45, 3.50, 3.55, 3.75, 4.10, 4.45, 4.60, 4.40, 3.95], N = [30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31];
  var FAC = { cap: 2e6, step: 40000, inj: 20000, wd: 40000, ci: 0.02, cw: 0.02 };
  var I = ESC.inputs('l-', ['k', 'e', 'c', 'm'], paint);
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x) / 1e6, 3) + 'm'; }
  var R = null, M = 0, CAP = 0;
  function paint() {
    var k = +I.k.value, e = +I.e.value, c = +I.c.value, m = +I.m.value;
    ESC.out('l-k', '×' + f(k, 2));
    ESC.out('l-e', Math.round(100 * e) + '%');
    ESC.out('l-c', Math.round(100 * c) + '%');
    ESC.out('l-m', '$' + f(m, 2) + 'm');
    R = X.storageLease({ F: BASE.map(function (b) { return 3.20 + k * (b - 3.20); }), n: N, fac: FAC, extrinsicPct: e, capture: c, margin: m * 1e6, fee: 2.3e6 });
    M = m * 1e6; CAP = c;
    document.getElementById('l-stats').innerHTML =
      ESC.stat('Bid', money(R.bid), '$' + f(R.perUnit, 3) + '/MMBtu capacity') +
      ESC.stat('Intrinsic', money(R.intrinsic), 'lockable today') +
      ESC.stat('Expected profit at $2.3m fee', money(R.npvAtFee - M), 'after required margin');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('l-chart'), function () {
    var o = C.base({ yTitle: '$m', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return money(c.raw * 1e6); } };
    var d = R ? [R.intrinsic, R.extrinsic * CAP, -M, R.bid] : [0, 0, 0, 0];
    return { type: 'bar', data: { labels: ['Intrinsic', 'Extrinsic bid', 'Margin', 'Bid'], datasets: [C.barDs('$m', d.map(function (x) { return +(x / 1e6).toFixed(4); }), 0, { backgroundColor: [C.series(0), C.series(1), C.series(3), C.series(2)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
