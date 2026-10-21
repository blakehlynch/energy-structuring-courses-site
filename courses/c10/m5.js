/* C10 M5 widget: terminal deal model */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C10;
  var I = ESC.inputs('m-', ['t', 'c', 'u', 'd'], paint);
  var xs = [], ys = [], cur = 0;
  function deal(t, c, u, d) { return X.terminalDeal({ capex: 500, opexFixed: 14, capacity: 36.5, contracted: c, tariff: t, spotUtil: u, spotTariff: 1.6, life: 20, tenor: 15, kd: 0.065, dscrC: d, dscrM: 2.0 }); }
  function paint() {
    var t = +I.t.value, c = +I.c.value, u = +I.u.value, d = +I.d.value;
    ESC.out('m-t', '$' + f(t, 2));
    ESC.out('m-c', Math.round(100 * c) + '%');
    ESC.out('m-u', Math.round(100 * u) + '%');
    ESC.out('m-d', f(d, 2) + '×');
    var r = deal(t, c, u, d); cur = Math.round(100 * c);
    var o = { capex: 500, opexFixed: 14, capacity: 36.5, contracted: c, tariff: t, spotUtil: u, spotTariff: 1.6, life: 20, tenor: 15, kd: 0.065, dscrC: d, dscrM: 2.0 };
    xs = []; ys = [];
    for (var s = 20; s <= 100; s += 5) { var q = deal(t, s / 100, u, d); xs.push(s); ys.push(isNaN(q.irr) ? null : +(100 * q.irr).toFixed(2)); }
    document.getElementById('m-stats').innerHTML =
      ESC.stat('Equity IRR', isNaN(r.irr) ? '–' : f(100 * r.irr, 1) + '%', 'fund target 12%') +
      ESC.stat('Debt', '$' + f(r.debt, 1) + 'm', f(100 * r.gearing, 1) + '% gearing; DSCR ' + f(r.dscr, 2)) +
      ESC.stat('Tariff for 12% IRR', '$' + f(X.tariffForIrr(o, 0.12), 3) + '/bbl', 'at this contracted share');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('m-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Contracted share (%)', yTitle: 'Equity IRR (%)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + '% contracted'; }, label: function (c) { return c.raw === null ? null : c.dataset.label + ': ' + f(c.raw, 1) + '%'; } };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('Equity IRR', ys, 0, { pointRadius: 2 }), C.lineDs('Selected', xs.map(function (x, i) { return x === cur ? ys[i] : null; }), 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
