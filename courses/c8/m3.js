/* C8 M3 widget: investment trigger */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C8;
  var I = ESC.inputs('m-', ['s', 'd', 'r'], paint);
  var xs = [], Fv = [], npv = [], vs = 0, Fvs = 0;
  function paint() {
    var s = +I.s.value, d = +I.d.value, r = +I.r.value;
    ESC.out('m-s', Math.round(100 * s) + '%');
    ESC.out('m-d', f(100 * d, 1) + '%');
    ESC.out('m-r', f(100 * r, 1) + '%');
    var t = X.timing(100, 100, r, d, s); vs = t.Vstar;
    var top = Math.min(1000, Math.max(300, 1.4 * vs));
    xs = []; Fv = []; npv = [];
    for (var v = 0; v <= top + 1e-9; v += top / 100) { xs.push(+v.toFixed(1)); Fv.push(+X.timing(v || 1e-6, 100, r, d, s).F.toFixed(3)); npv.push(+(v - 100).toFixed(3)); }
    Fvs = vs - 100;
    document.getElementById('m-stats').innerHTML =
      ESC.stat('Trigger V*', '$' + f(vs, 2), 'invest when value reaches this') +
      ESC.stat('Multiple of cost', f(t.multiple, 3) + '×', 'β₁ = ' + f(t.beta, 4)) +
      ESC.stat('Option value at V = $100', '$' + f(t.F, 2), 'NPV = $0');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('m-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Project value V ($)', yTitle: '$', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.y.min = -100;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 2) + ' at V = $' + f(c.raw.x, 0); } };
    var pts = function (arr) { return xs.map(function (x, i) { return { x: x, y: arr[i] }; }); };
    return { type: 'line', data: { datasets: [
      C.lineDs('Option value F(V)', pts(Fv), 0),
      C.lineDs('NPV = V − I', pts(npv), 4, { borderDash: [6, 4] }),
      C.lineDs('Trigger', [{ x: +vs.toFixed(2), y: +Fvs.toFixed(2) }], 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
