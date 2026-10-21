/* C5 M1 widget: load-duration curve builder */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var I = ESC.inputs('l-', ['mean', 'sea', 'day', 'noise'], paint);
  var curve = [];
  function paint() {
    var o = { mean: +I.mean.value, seasonal: +I.sea.value, daily: +I.day.value, noise: +I.noise.value, seed: 3 };
    ESC.out('l-mean', f(o.mean, 0));
    ESC.out('l-sea', '±' + Math.round(100 * o.seasonal) + '%');
    ESC.out('l-day', '±' + Math.round(100 * o.daily) + '%');
    ESC.out('l-noise', '±' + Math.round(100 * o.noise) + '%');
    var load = X.synthLoad(o), sorted = X.ldc(load);
    curve = []; for (var i = 0; i < 8760; i += 73) curve.push({ x: 100 * (i + 1) / 8760, y: Math.round(sorted[i]) }); curve.push({ x: 100, y: Math.round(sorted[8759]) });
    var peak = sorted[0];
    document.getElementById('l-stats').innerHTML =
      ESC.stat('Peak', f(peak, 0) + ' MW', 'minimum ' + f(sorted[8759], 0) + ' MW') +
      ESC.stat('Load factor', f(100 * X.loadFactor(load), 1) + '%', 'average ÷ peak') +
      ESC.stat('Hours above 90% of peak', f(X.hoursAbove(load, 0.9 * peak), 0), 'capacity used rarely') +
      ESC.stat('Top-5% slice', f(peak - sorted[Math.round(0.05 * 8760) - 1], 0) + ' MW', 'needed ≤ 438 h a year');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('l-chart'), function () {
    var o = C.base({ xTitle: 'Duration (% of hours load is at or above level)', yTitle: 'Load (MW)', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0; o.scales.x.max = 100;
    o.plugins.tooltip.callbacks = { title: function () { return ''; }, label: function (c) { return f(c.raw.y, 0) + ' MW at ' + f(c.raw.x, 1) + '%'; } };
    return { type: 'line', data: { datasets: [C.lineDs('Load-duration curve', curve, 0, { fill: 'origin', backgroundColor: C.wash(C.series(0), 0.15) })] }, options: o };
  });
  paint();
})();
