/* C4 M5 widget: hedge overlay for a commodity-backed loan */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var BE = 59.6968;
  var I = ESC.inputs('h-', ['type', 'kp', 'pp', 'kc', 'cp', 'cr', 'px'], paint, ['input', 'change']);
  var spec = null;
  function mkSpec() {
    var t = I.type.value, kp = +I.kp.value, pp = +I.pp.value, kc = +I.kc.value, cp = +I.cp.value, cr = +I.cr.value;
    if (t === 'put') return { type: 'put', K: kp, premium: pp };
    if (t === 'collar') return { type: 'collar', Kp: kp, Kc: kc };
    if (t === 'swap') return { type: 'swap', K: kp };
    if (t === 'calls') return { type: 'calls', Kc: kc, premium: cp, ratio: cr };
    return { type: 'none' };
  }
  function paint() {
    ['kp', 'pp', 'kc', 'cp', 'px'].forEach(function (k) { ESC.out('h-' + k, '$' + I[k].value); });
    ESC.out('h-cr', f(+I.cr.value, 1) + '×');
    spec = mkSpec();
    var px = +I.px.value, v = X.hedgedProceeds(px, spec), cover = v / BE;
    document.getElementById('h-stats').innerHTML =
      ESC.stat('Proceeds per bbl', '$' + f(v, 2), 'at $' + px + ' market') +
      ESC.stat('Debt-service cover', f(cover, 2) + '×', cover >= 1 ? 'debt service met' : 'shortfall: top-up or reserve needed') +
      ESC.stat('Versus unhedged', (v - px >= 0 ? '+' : '−') + '$' + f(Math.abs(v - px), 2), 'per barrel');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('h-chart'), function () {
    var xs = []; for (var p = 20; p <= 140; p += 5) xs.push(p);
    var o = C.base({ legend: true, xTitle: 'Average market price ($/bbl)', yTitle: 'Proceeds ($/bbl)' });
    o.scales.x.type = 'linear'; o.scales.x.min = 20; o.scales.x.max = 140;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 2); } };
    var sp = spec || { type: 'none' };
    return { type: 'line', data: { datasets: [
      C.lineDs('Hedged proceeds', xs.map(function (x) { return { x: x, y: +X.hedgedProceeds(x, sp).toFixed(2) }; }), 0),
      C.lineDs('Unhedged', xs.map(function (x) { return { x: x, y: x }; }), 4, { borderDash: [5, 4] }),
      C.lineDs('Breakeven debt service', [{ x: 20, y: BE }, { x: 140, y: BE }], 3, { borderDash: [2, 3] }),
      C.lineDs('Scenario', [{ x: +I.px.value, y: +X.hedgedProceeds(+I.px.value, sp).toFixed(2) }], 1, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
