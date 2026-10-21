/* C8 M4 widget: entry and exit band */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C8;
  var I = ESC.inputs('e-', ['s', 'i', 'e'], paint);
  var sig = [], PH = [], PL = [], WH = 0, WL = 0, cur = null;
  function paint() {
    var s = +I.s.value, inv = +I.i.value, e = +I.e.value;
    ESC.out('e-s', Math.round(100 * s) + '%');
    ESC.out('e-i', '$' + inv);
    ESC.out('e-e', (e < 0 ? '−$' : '$') + Math.abs(e));
    var base = { C: 40, I: inv, E: e, r: 0.05, delta: 0.05 };
    var r = X.entryExit(Object.assign({ sigma: s }, base)); WH = r.WH; WL = r.WL; cur = { s: s, PH: r.PH, PL: r.PL };
    sig = []; PH = []; PL = [];
    for (var v = 0.05; v <= 0.5001; v += 0.025) { var q = X.entryExit(Object.assign({ sigma: v }, base)); sig.push(+v.toFixed(3)); PH.push(+q.PH.toFixed(2)); PL.push(+q.PL.toFixed(2)); }
    document.getElementById('e-stats').innerHTML =
      ESC.stat('Enter at P_H', '$' + f(r.PH, 2), 'Marshallian $' + f(r.WH, 2)) +
      ESC.stat('Exit at P_L', '$' + f(r.PL, 2), 'Marshallian $' + f(r.WL, 2)) +
      ESC.stat('Band of inaction', '$' + f(r.PH - r.PL, 2), 'vs $' + f(r.WH - r.WL, 2) + ' without uncertainty');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('e-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Volatility σ', yTitle: 'Price ($)', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0.05; o.scales.x.max = 0.5;
    o.scales.x.ticks.callback = function (v) { return Math.round(100 * v) + '%'; };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 2); } };
    var pts = function (arr) { return sig.map(function (x, i) { return { x: x, y: arr[i] }; }); };
    var flat = function (y) { return [{ x: 0.05, y: y }, { x: 0.5, y: y }]; };
    return { type: 'line', data: { datasets: [
      C.lineDs('Entry threshold P_H', pts(PH), 0),
      C.lineDs('Exit threshold P_L', pts(PL), 1),
      C.lineDs('Marshallian entry', flat(WH), 0, { borderDash: [6, 4], borderWidth: 1.5 }),
      C.lineDs('Marshallian exit', flat(WL), 1, { borderDash: [6, 4], borderWidth: 1.5 }),
      C.lineDs('Current σ', cur ? [{ x: cur.s, y: +cur.PH.toFixed(2) }, { x: cur.s, y: +cur.PL.toFixed(2) }] : [], 2, { showLine: false, pointRadius: 6, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
