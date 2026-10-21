/* C12 M5 widget: CVA of a gas swap with wrong-way risk */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C12;
  var I = ESC.inputs('a-', ['y', 's', 'cs', 'lgd', 'rho'], paint);
  var ex = null, cond = [], par = null;
  function paint() {
    var y = +I.y.value, s = +I.s.value / 100, cs = +I.cs.value / 1e4, lgd = +I.lgd.value / 100, rho = +I.rho.value;
    ESC.out('a-y', y + (y === 1 ? ' year' : ' years'));
    ESC.out('a-s', Math.round(100 * s) + '%');
    ESC.out('a-cs', I.cs.value + ' bp');
    ESC.out('a-lgd', I.lgd.value + '%');
    ESC.out('a-rho', (rho > 0 ? '+' : '') + f(rho, 2));
    ex = X.exposure({ years: y, Q: 100000, F: 3, sig: s, kappa: 0, mporDays: 10, conf: 0.95 });
    par = { spread: cs, lgd: lgd, r: 0.04 };
    var c0 = X.cva(ex, par), cw = rho ? X.cva(ex, Object.assign({ rho: rho }, par)) : c0, vol = 12 * y * 100000;
    cond = ex.map(function (e) { return rho ? X.epeWwr(e.s, e.t, cs, lgd, rho) : e.epe; });
    document.getElementById('a-stats').innerHTML =
      ESC.stat('CVA, independent', '$' + f(c0 / 1e6, 3) + 'm', f(100 * c0 / vol, 2) + ' cents/MMBtu') +
      ESC.stat('CVA with correlation', '$' + f(cw / 1e6, 3) + 'm', f(100 * cw / vol, 2) + ' cents/MMBtu') +
      ESC.stat('Wrong-way multiple', '× ' + f(cw / c0, 2), rho > 0 ? 'wrong-way' : (rho < 0 ? 'right-way' : 'independent')) +
      ESC.stat('Default probability over the tenor', f(100 * X.cumPd(y, cs, lgd), 1) + '%', 'cumulative, from the spread');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('a-chart'), function () {
    var o = C.base({ xTitle: 'Months', yTitle: 'EPE ($m)', legend: true });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2) + 'm'; } };
    var lab = ex ? ex.map(function (e) { return f(12 * e.t, 0); }) : [];
    return { type: 'line', data: { labels: lab, datasets: [
      C.lineDs('EPE', ex ? ex.map(function (e) { return +(e.epe / 1e6).toFixed(3); }) : [], 1),
      C.lineDs('EPE given default', cond.map(function (v) { return +(v / 1e6).toFixed(3); }), 5, { borderDash: [6, 4] })] }, options: o };
  });
  paint();
})();
