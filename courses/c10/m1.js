/* C10 M1 widget: intermediation fee builder */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C10;
  var I = ESC.inputs('i-', ['p', 'd', 'r', 'q'], paint);
  var R = null;
  function paint() {
    var p = +I.p.value, d = +I.d.value, r = +I.r.value, q = +I.q.value;
    ESC.out('i-p', '$' + p);
    ESC.out('i-d', d);
    ESC.out('i-r', f(100 * r, 2) + '%');
    ESC.out('i-q', f(100 * q, 2) + '%');
    R = X.intermediation({ kbd: 150, crude: p, crudeDays: d, productDays: 12, productPrice: p + 15, fundRate: r, advance: 0.85, roe: 0.15, hedgeCost: 0.05, pd: q, lgd: 0.4, opCost: 0.10 });
    document.getElementById('i-stats').innerHTML =
      ESC.stat('Minimum fee', '$' + f(R.feeNeeded, 3) + '/bbl', '$' + f(R.feeNeeded * R.bblYr / 1e6, 1) + 'm a year') +
      ESC.stat('Average inventory', '$' + f(R.inventory / 1e6, 0) + 'm', 'trader capital $' + f(R.equity / 1e6, 1) + 'm') +
      ESC.stat('Funding share of fee', f(100 * R.fundingPerBbl / R.feeNeeded, 0) + '%', 'index this to rates and price');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('i-chart'), function () {
    var o = C.base({ yTitle: '$/bbl', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return '$' + f(c.raw, 3) + '/bbl'; } };
    var d = R ? [R.fundingPerBbl, R.capitalPerBbl, R.elPerBbl, 0.05, 0.10, R.feeNeeded] : [0, 0, 0, 0, 0, 0];
    return { type: 'bar', data: { labels: ['Funding', 'Capital', 'Expected loss', 'Hedging', 'Operations', 'Total fee'], datasets: [C.barDs('Fee component', d.map(function (x) { return +x.toFixed(4); }), 0, { backgroundColor: [C.series(0), C.series(1), C.series(3), C.series(4), C.series(5), C.series(2)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
