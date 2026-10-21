/* C5 M4 widget: two-zone locational pricing */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var I = ESC.inputs('z-', ['da', 'db', 'f', 'ab'], paint);
  var z = null, P = null;
  function paint() {
    P = { aA: 12, bA: 0.004, dA: +I.da.value, aB: +I.ab.value, bB: 0.006, dB: +I.db.value, F: +I.f.value };
    ESC.out('z-da', f(P.dA, 0));
    ESC.out('z-db', f(P.dB, 0));
    ESC.out('z-f', f(P.F, 0));
    ESC.out('z-ab', '$' + P.aB);
    z = X.twoZone(P);
    var dir = z.flow >= 0 ? 'A → B' : 'B → A';
    document.getElementById('z-stats').innerHTML =
      ESC.stat('Price in A', '$' + f(z.piA, 2), 'generation ' + f(z.PA, 0) + ' MW') +
      ESC.stat('Price in B', '$' + f(z.piB, 2), 'generation ' + f(z.PB, 0) + ' MW') +
      ESC.stat('Flow', f(Math.abs(z.flow), 0) + ' MW', dir + (z.constrained ? ' · line binding' : ' · unconstrained')) +
      ESC.stat('Congestion rent', '$' + f(z.rent, 0) + '/h', 'paid out to FTR holders');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('z-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Generation in zone (MW)', yTitle: '$/MWh', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 2) + ' at ' + f(c.raw.x, 0) + ' MW'; } };
    var max = 9000, line = function (a, b) { return [{ x: 0, y: a }, { x: max, y: +(a + b * max).toFixed(2) }]; };
    var ds = P ? [
      C.lineDs('Zone A supply', line(P.aA, P.bA), 0),
      C.lineDs('Zone B supply', line(P.aB, P.bB), 1),
      C.lineDs('A operating point', [{ x: +z.PA.toFixed(0), y: +z.piA.toFixed(2) }], 0, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 }),
      C.lineDs('B operating point', [{ x: +z.PB.toFixed(0), y: +z.piB.toFixed(2) }], 1, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] : [];
    return { type: 'line', data: { datasets: ds }, options: o };
  });
  paint();
})();
