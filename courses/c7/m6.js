/* C7 M6 widget: hierarchical P&L attribution */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C7;
  var I = ESC.inputs('h-', ['hh', 't', 'p', 'h'], paint);
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x) / 1e3, 1) + 'k'; }
  var H = null;
  function paint() {
    var hh = +I.hh.value, t = +I.t.value, p = +I.p.value, h = +I.h.value * 1000;
    ESC.out('h-hh', (hh >= 0 ? '+' : '') + f(hh, 2));
    ESC.out('h-t', (t >= 0 ? '+' : '') + f(t, 2));
    ESC.out('h-p', (p >= 0 ? '+' : '') + f(p, 1));
    ESC.out('h-h', f(h / 1000, 0));
    var nodes = [{ id: 'HH', parent: null, beta: 1, pos: h }, { id: 'TETM3', parent: 'HH', beta: 1.10, pos: 1000000 }, { id: 'PJM', parent: 'HH', beta: 8.0, pos: -50000 }];
    H = X.hierarchy(nodes, { HH: hh, TETM3: t, PJM: p });
    var d = H.totalDelta.HH;
    document.getElementById('h-stats').innerHTML =
      ESC.stat('Total P&L', money(H.pnl), 'sum of positions × moves') +
      ESC.stat('Henry Hub-equivalent delta', (d < 0 ? '−' : '') + f(Math.abs(d) / 1e3, 0) + 'k MMBtu', d === 0 ? 'benchmark-neutral' : (d > 0 ? 'net long' : 'net short')) +
      ESC.stat('Basis + conversion P&L', money(H.attribution.TETM3 + H.attribution.PJM), 'unexplained by the benchmark');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('h-chart'), function () {
    var o = C.base({ yTitle: '$k', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return money(c.raw * 1e3); } };
    var d = H ? [H.attribution.HH, H.attribution.TETM3, H.attribution.PJM, H.pnl].map(function (x) { return +(x / 1e3).toFixed(1); }) : [0, 0, 0, 0];
    return { type: 'bar', data: { labels: ['Benchmark (HH)', 'TETM3 basis', 'PJM conversion', 'Total'], datasets: [C.barDs('P&L', d, 0, { backgroundColor: [C.series(0), C.series(1), C.series(2), C.series(4)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
