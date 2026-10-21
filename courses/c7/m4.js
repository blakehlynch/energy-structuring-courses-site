/* C7 M4 widget: storage intrinsic and rolling intrinsic */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C7;
  var BASE = [3.20, 3.25, 3.35, 3.45, 3.50, 3.55, 3.75, 4.10, 4.45, 4.60, 4.40, 3.95], N = [30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31];
  var MON = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  var I = ESC.inputs('s-', ['i', 'w', 'k', 'v'], paint);
  var F = BASE.slice(), sd = null;
  function paint() {
    var inj = +I.i.value, wd = +I.w.value, k = +I.k.value, v = +I.v.value;
    ESC.out('s-i', f(inj, 0));
    ESC.out('s-w', f(wd, 0));
    ESC.out('s-k', '×' + f(k, 2));
    ESC.out('s-v', Math.round(100 * v) + '%');
    F = BASE.map(function (b) { return 3.20 + k * (b - 3.20); });
    var fac = { cap: 1e6, step: 20000, inj: inj, wd: wd, ci: 0.02, cw: 0.02 };
    sd = X.storageDP(F, N, fac, 0, 0);
    var ri = X.rollingIntrinsic(F, N, fac, { paths: 200, seed: 17, s1: 0.3, b1: 0.1, s2: v, b2: 1.5, lead: 1 / 12 });
    var turns = 1e6 / inj + 1e6 / wd;
    document.getElementById('s-stats').innerHTML =
      ESC.stat('Intrinsic value', '$' + f(sd.value / 1e3, 0) + 'k', '$' + f(sd.value / 1e6, 3) + '/MMBtu capacity') +
      ESC.stat('Extrinsic (rolling intrinsic)', '$' + f(ri.extrinsic / 1e3, 1) + 'k', sd.value > 0 ? f(100 * ri.extrinsic / sd.value, 1) + '% of intrinsic' : 'flat curve') +
      ESC.stat('Total', '$' + f(ri.total / 1e3, 0) + 'k', 'lower bound') +
      ESC.stat('Cycle time', f(turns, 0) + ' days', f(365 / turns, 1) + ' turns a year max');
    chC.rebuild(); chI.rebuild();
  }
  var chC = C.make(document.getElementById('s-curve'), function () {
    var o = C.base({ yTitle: '$/MMBtu' });
    o.plugins.tooltip.callbacks = { label: function (c) { return 'Forward: $' + f(c.raw, 3); } };
    return { type: 'line', data: { labels: MON, datasets: [C.lineDs('Forward', F.map(function (x) { return +x.toFixed(3); }), 0, { pointRadius: 3 })] }, options: o };
  });
  var chI = C.make(document.getElementById('s-inv'), function () {
    var o = C.base({ yTitle: 'Inventory (000 MMBtu)', mode: 'nearest' });
    o.scales.x.grid = { display: false }; o.scales.y.min = 0; o.scales.y.max = 1000;
    o.plugins.tooltip.callbacks = { label: function (c) { return 'End-of-month inventory: ' + f(c.raw, 0) + 'k'; } };
    var inv = sd ? sd.inventory.slice(1).map(function (x) { return x / 1e3; }) : [];
    return { type: 'bar', data: { labels: MON, datasets: [C.barDs('Inventory', inv, 2)] }, options: o };
  });
  paint();
})();
