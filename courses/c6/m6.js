/* C6 M6 widget: stack-based hybrid power model */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C6;
  var I = ESC.inputs('h-', ['cap', 'lv', 'gv', 'r'], paint);
  var H = null, st = null;
  function paint() {
    var cap = +I.cap.value, lv = +I.lv.value, gv = +I.gv.value, r = +I.r.value;
    ESC.out('h-cap', f(cap, 0));
    ESC.out('h-lv', '±' + Math.round(100 * lv) + '%');
    ESC.out('h-gv', Math.round(100 * gv) + '%');
    ESC.out('h-r', f(r, 2));
    st = { cap: cap, h0: 6.5, h1: 4, adder: 2, u0: 0.85, capPrice: 1000, k: 3 };
    H = X.hybrid({ n: 4000, seed: 21, loadMean: 24000, loadVol: lv, gasF: 3.5, gasVol: gv, T: 0.25, rho: r, stack: st });
    document.getElementById('h-stats').innerHTML =
      ESC.stat('Mean price', '$' + f(H.mean, 2), 'at expected drivers $' + f(H.atMean, 2)) +
      ESC.stat('99th percentile', '$' + f(H.p99, 0), 'median $' + f(H.p50, 2)) +
      ESC.stat('Power–gas correlation', f(H.corrPG, 2), 'tight scenarios ' + f(100 * H.spikeShare, 1) + '%') +
      ESC.stat('Implied heat rate', f(H.ihr, 2), 'mean price / $3.50 gas');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('h-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Load (MW)', yTitle: '$/MWh (log scale)', mode: 'nearest' });
    o.scales.x.type = 'linear';
    o.scales.y.type = 'logarithmic'; o.scales.y.min = 10; o.scales.y.max = 1000;
    o.scales.y.ticks.callback = function (v) { return [10, 20, 50, 100, 200, 500, 1000].indexOf(v) >= 0 ? '$' + v : null; };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 2) + ' at ' + f(c.raw.x, 0) + ' MW'; } };
    var pts = [], curve = [];
    if (H) {
      for (var i = 0; i < 800; i++) pts.push({ x: Math.round(H.load[i]), y: +Math.max(10, H.price[i]).toFixed(2) });
      for (var L = 16000; L <= 32000; L += 250) curve.push({ x: L, y: +Math.max(10, X.stackPrice(L, 3.5, st)).toFixed(2) });
    }
    return { type: 'scatter', data: { datasets: [
      { label: 'Scenario', data: pts, backgroundColor: C.wash(C.series(0), 0.45), borderWidth: 0, pointRadius: 2.5, pointHoverRadius: 5 },
      C.lineDs('Stack at $3.50 gas', curve, 2, { showLine: true, type: 'line' })] }, options: o };
  });
  paint();
})();
