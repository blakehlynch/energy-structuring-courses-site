/* C1 M1 widget: pump price decomposition */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C1;
  var ids = ['crude', 'crack', 'dist', 'tax'];
  var I = ESC.inputs('r-', ids, paint);
  function split(crude) {
    var c = crude / 42, r = +I.crack.value, d = +I.dist.value, t = +I.tax.value;
    return X.retailBreakdown({ crude: crude, spot: c + r, taxes: t, retail: c + r + d + t });
  }
  function paint() {
    ESC.out('r-crude', '$' + I.crude.value);
    ESC.out('r-crack', '$' + f(+I.crack.value, 2));
    ESC.out('r-dist', '$' + f(+I.dist.value, 2));
    ESC.out('r-tax', '$' + f(+I.tax.value, 2));
    var b = split(+I.crude.value), b10 = split(+I.crude.value + 10);
    document.getElementById('r-stats').innerHTML =
      ESC.stat('Retail price', '$' + f(b.total, 2) + '/gal', 'sum of the four components') +
      ESC.stat('Crude share', f(100 * b.shares.crude, 1) + '%', 'crude cost ÷ retail') +
      ESC.stat('Tax share', f(100 * b.shares.taxes, 1) + '%', 'taxes ÷ retail') +
      ESC.stat('+$10/bbl crude', '+' + f(100 * (b10.total / b.total - 1), 1) + '% at the pump', '+$' + f(10 / 42, 3) + '/gal, all else equal');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('r-chart'), function () {
    var xs = [20, 40, 60, 80, 100, 120, 140];
    var rows = xs.map(split);
    var mk = function (lab, key, i) { return C.barDs(lab, rows.map(function (r) { return +r[key].toFixed(3); }), i, { stack: 's', borderRadius: 0, borderColor: C.v('--surface'), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 } }); };
    var o = C.base({ legend: true, mode: 'index', xTitle: 'Crude price ($/bbl)', yTitle: '$ per gallon' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { title: function (it) { return 'Crude $' + it[0].label + '/bbl'; }, label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); },
      footer: function (it) { var t = it.reduce(function (a, c) { return a + c.raw; }, 0); return 'Retail $' + f(t, 2) + '/gal'; } };
    return { type: 'bar', data: { labels: xs, datasets: [mk('Crude', 'crude', 0), mk('Refining', 'refining', 1), mk('Distribution & marketing', 'distribution', 2), mk('Taxes', 'taxes', 3)] }, options: o };
  });
  paint();
})();
