/* C5 M2 widget: screening curves and technology mix */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var LD = X.ldc(X.synthLoad({ mean: 10000, seasonal: 0.15, daily: 0.20, noise: 0.05, seed: 3 }));
  var I = ESC.inputs('s-', ['gas', 'co2', 'r', 'nuc'], paint);
  var T = null;
  function paint() {
    var gas = +I.gas.value, co2 = +I.co2.value, r = +I.r.value, nuc = +I.nuc.value;
    ESC.out('s-gas', '$' + f(gas, 1));
    ESC.out('s-co2', '$' + co2);
    ESC.out('s-r', f(100 * r, 1) + '%');
    ESC.out('s-nuc', '$' + f(nuc, 0));
    T = [
      { name: 'Nuclear', fc: X.annualFixed(nuc, r, 60, 110), vc: X.variableCost(10.4, 0.7, 2, 0, co2) },
      { name: 'CCGT', fc: X.annualFixed(1100, r, 30, 15), vc: X.variableCost(6.5, gas, 3, 0.35, co2) },
      { name: 'Peaker', fc: X.annualFixed(750, r, 30, 10), vc: X.variableCost(10.0, gas, 5, 0.55, co2) }];
    var mix = X.optimalMix(T, LD);
    document.getElementById('s-stats').innerHTML = T.map(function (t, i) {
      return ESC.stat(t.name, f(mix.caps[i], 0) + ' MW', 'FC $' + f(t.fc / 1e3, 0) + 'k · VC $' + f(t.vc, 1));
    }).join('') + ESC.stat('Boundaries', f(100 * mix.bounds[1], 1) + '% / ' + (mix.bounds[0] >= 1 ? '>100' : f(100 * mix.bounds[0], 1)) + '%', 'CCGT/peaker · nuclear/CCGT CF*');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('s-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Capacity factor (%)', yTitle: 'Annual cost ($k per MW-yr)', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0; o.scales.x.max = 100; o.scales.y.min = 0;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 0) + 'k at ' + c.raw.x + '% CF'; } };
    var ds = (T || []).map(function (t, i) { var pts = []; for (var cf = 0; cf <= 100; cf += 5) pts.push({ x: cf, y: +(X.screening(t.fc, t.vc, cf / 100) / 1e3).toFixed(1) }); return C.lineDs(t.name, pts, i); });
    return { type: 'line', data: { datasets: ds }, options: o };
  });
  paint();
})();
