/* C3 M3 widget: hedge P&L decomposition (long physical, short futures) */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;
  var I = ESC.inputs('h-', ['flat', 'basis', 'ratio', 'vol'], paint);
  function sgn(x, d) { return (x >= 0 ? '+' : '−') + f(Math.abs(x), d); }
  var r = null;
  function paint() {
    var flat = +I.flat.value, basis = +I.basis.value, ratio = +I.ratio.value, vol = +I.vol.value;
    ESC.out('h-flat', sgn(flat, 1));
    ESC.out('h-basis', sgn(basis, 1));
    ESC.out('h-ratio', f(ratio, 2));
    ESC.out('h-vol', f(vol, 1));
    r = X.hedgePnL({ flatMove: flat, basisMove: basis, ratio: ratio, volume: vol });
    var perBbl = X.hedgePnL({ flatMove: flat, basisMove: basis, ratio: ratio, volume: 1 });
    document.getElementById('h-stats').innerHTML =
      ESC.stat('Physical', sgn(r.physical, 2) + ' $m', 'benchmark + differential move') +
      ESC.stat('Futures', sgn(r.futures, 2) + ' $m', flat < 0 && ratio > 0 ? 'cash received through margin' : (ratio > 0 && flat > 0 ? 'cash paid out through margin calls' : 'no hedge cash flow')) +
      ESC.stat('Net', sgn(r.net, 2) + ' $m', sgn(perBbl.net, 2) + ' $/bbl; ' + (Math.abs(ratio - 1) < 1e-9 ? 'equals the basis move' : 'includes unhedged flat price'));
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('h-chart'), function () {
    var o = C.base({ yTitle: '$ million', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return sgn(c.raw, 2) + ' $m'; } };
    var d = r ? [r.physical, r.futures, r.net] : [0, 0, 0];
    return { type: 'bar', data: { labels: ['Physical', 'Futures', 'Net'], datasets: [C.barDs('P&L', d.map(function (x) { return +x.toFixed(3); }), 0, { backgroundColor: [C.series(0), C.series(1), C.series(2)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
