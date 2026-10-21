/* C12 M6 widget: xVA stack for three CSA choices */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C12;
  var I = ESC.inputs('z-', ['cs', 'fs', 'cc', 's', 'y'], paint);
  var rows = null;
  function cents(x, vol) { return 100 * x / vol; }
  function paint() {
    var cs = +I.cs.value / 1e4, fs = +I.fs.value / 1e4, cc = +I.cc.value / 100, s = +I.s.value / 100, y = +I.y.value, vol = 12 * y * 100000;
    ESC.out('z-cs', I.cs.value + ' bp');
    ESC.out('z-fs', I.fs.value + ' bp');
    ESC.out('z-cc', I.cc.value + '%');
    ESC.out('z-s', Math.round(100 * s) + '%');
    ESC.out('z-y', y + (y === 1 ? ' year' : ' years'));
    var base = { years: y, Q: 100000, F: 3, sig: s, kappa: 0, mporDays: 10, conf: 0.95 }, cv = { spread: cs, lgd: 0.6, r: 0.04 };
    var exU = X.exposure(base), exT = X.exposure(Object.assign({ threshold: 2e6 }, base)), exV = X.exposure(Object.assign({ threshold: 0 }, base));
    rows = [
      { name: 'Uncollateralised', cva: X.cva(exU, cv), fca: X.fca(exU, fs, 0.04), kva: X.kva(exU, cc, 0.04), mva: 0 },
      { name: '$2m threshold', cva: X.cva(exT, Object.assign({ key: 'epeC' }, cv)), fca: X.fca(exT, fs, 0.04, 'epeC'), kva: X.kva(exT, cc, 0.04, { key: 'epeC' }), mva: 0 },
      { name: 'VM + initial margin', cva: X.cva(exV, Object.assign({ key: 'epeC' }, cv)), fca: 0, kva: X.kva(exV, cc, 0.04, { key: 'epeC' }), mva: X.mva(exV, fs, 0.04, 0.99) }];
    rows.forEach(function (r) { ['cva', 'fca', 'kva', 'mva'].forEach(function (k) { r[k] = cents(r[k], vol); }); r.tot = r.cva + r.fca + r.kva + r.mva; });
    var best = rows.reduce(function (a, b) { return b.tot < a.tot ? b : a; });
    document.getElementById('z-stats').innerHTML = rows.map(function (r) {
      return ESC.stat(r.name, f(r.tot, 2) + '¢/MMBtu', 'CVA ' + f(r.cva, 2) + ' · FCA ' + f(r.fca, 2) + ' · KVA ' + f(r.kva, 2) + ' · MVA ' + f(r.mva, 2));
    }).join('') + ESC.stat('Cheapest for the dealer', best.name, 'before the client\'s liquidity cost');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('z-chart'), function () {
    var o = C.base({ yTitle: 'cents per MMBtu', legend: true, mode: 'nearest' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': ' + f(c.raw, 2) + '¢'; } };
    var lab = rows ? rows.map(function (r) { return r.name; }) : [];
    function ds(k, label, i) { return C.barDs(label, rows ? rows.map(function (r) { return +r[k].toFixed(3); }) : [], i, { borderSkipped: false, maxBarThickness: 60 }); }
    return { type: 'bar', data: { labels: lab, datasets: [ds('cva', 'CVA', 0), ds('fca', 'FCA', 1), ds('kva', 'KVA', 2), ds('mva', 'MVA', 3)] }, options: o };
  });
  paint();
})();
