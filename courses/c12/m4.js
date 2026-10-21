/* C12 M4 widget: exposure profile of a monthly gas swap */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C12;
  var I = ESC.inputs('e-', ['y', 'q', 's', 'k', 'L', 'm'], paint);
  var ex = null, coll = false;
  function m$(x) { return '$' + f(x / 1e6, 2) + 'm'; }
  function paint() {
    var y = +I.y.value, q = +I.q.value * 1000, s = +I.s.value / 100, k = +I.k.value, L = +I.L.value, mp = +I.m.value;
    ESC.out('e-y', y + (y === 1 ? ' year' : ' years'));
    ESC.out('e-q', f(q / 1000, 0) + 'k');
    ESC.out('e-s', Math.round(100 * s) + '%');
    ESC.out('e-k', f(k, 1));
    ESC.out('e-L', L >= 20 ? 'none' : '$' + f(L, 1) + 'm');
    ESC.out('e-m', mp + ' days');
    coll = L < 20;
    var o = { years: y, Q: q, F: 3, sig: s, kappa: k, mporDays: mp, conf: 0.95 };
    if (coll) o.threshold = L * 1e6;
    ex = X.exposure(o);
    var sp = X.profileStats(ex, 'pfe'), se = X.profileStats(ex, 'epe');
    var sc = coll ? X.profileStats(ex, 'pfeC') : sp, sce = coll ? X.profileStats(ex, 'epeC') : se;
    document.getElementById('e-stats').innerHTML =
      ESC.stat('Peak 95% PFE', m$(sp.peak), 'at month ' + f(12 * sp.tPeak, 0)) +
      ESC.stat('Peak EPE', m$(se.peak), 'average EPE ' + m$(se.average)) +
      ESC.stat('Collateralised peak PFE', coll ? m$(sc.peak) : '–', coll ? 'threshold plus margin-period move' : 'no CSA') +
      ESC.stat('Collateralised average EPE', coll ? m$(sce.average) : '–', 'notional $' + f(12 * y * q * 3 / 1e6, 1) + 'm');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('e-chart'), function () {
    var o = C.base({ xTitle: 'Months', yTitle: '$m', legend: true });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2) + 'm'; } };
    var lab = ex ? ex.map(function (e) { return f(12 * e.t, 0); }) : [];
    var ds = [C.lineDs('PFE (95%)', ex ? ex.map(function (e) { return +(e.pfe / 1e6).toFixed(3); }) : [], 0),
      C.lineDs('EPE', ex ? ex.map(function (e) { return +(e.epe / 1e6).toFixed(3); }) : [], 1)];
    if (coll && ex) {
      ds.push(C.lineDs('PFE with CSA', ex.map(function (e) { return +(e.pfeC / 1e6).toFixed(3); }), 0, { borderDash: [6, 4] }));
      ds.push(C.lineDs('EPE with CSA', ex.map(function (e) { return +(e.epeC / 1e6).toFixed(3); }), 1, { borderDash: [6, 4] }));
    }
    return { type: 'line', data: { labels: lab, datasets: ds }, options: o };
  });
  paint();
})();
