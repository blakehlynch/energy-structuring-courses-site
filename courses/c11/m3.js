/* C11 M3 widget: liquefaction cost-of-service fee and US FOB price */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C11;
  var I = ESC.inputs('t-', ['capex', 'r', 'n', 'op', 'av', 'hh'], paint);
  var CAPEX = [], curve = [], cur = null;
  for (var k = 200; k <= 3000; k += 50) CAPEX.push(k);
  function opts(capex) {
    return { capexPerT: capex, mtpa: 4.5, r: +I.r.value / 100, life: +I.n.value, opexPct: +I.op.value / 100, avail: +I.av.value / 100 };
  }
  function paint() {
    ESC.out('t-capex', '$' + f(+I.capex.value, 0));
    ESC.out('t-r', f(+I.r.value, 1) + '%');
    ESC.out('t-n', I.n.value);
    ESC.out('t-op', f(+I.op.value, 1) + '%');
    ESC.out('t-av', I.av.value + '%');
    ESC.out('t-hh', '$' + f(+I.hh.value, 2));
    cur = X.tariff(opts(+I.capex.value));
    curve = CAPEX.map(function (c) { return X.tariff(opts(c)).fee; });
    var fob = X.usFob(+I.hh.value, cur.fee);
    document.getElementById('t-stats').innerHTML =
      ESC.stat('Liquefaction fee', '$' + f(cur.fee, 2) + '/MMBtu', 'capital $' + f(cur.capFee, 2) + ', opex $' + f(cur.opexFee, 2)) +
      ESC.stat('Capex', '$' + f(cur.capex / 1e9, 2) + 'bn', 'charge $' + f(cur.capCharge / 1e6, 0) + 'm a year') +
      ESC.stat('US FOB price', '$' + f(fob, 2), '1.15 × Henry Hub + fee') +
      ESC.stat('Delivered Asia / Europe', '$' + f(fob + 3.25, 2) + ' / $' + f(fob + 2.0, 2), 'margin $0.75 plus shipping');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('t-chart'), function () {
    var o = C.base({ xTitle: 'Unit capex ($ per t/y)', yTitle: '$/MMBtu', legend: true });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); } };
    var at = CAPEX.map(function (c) { return c === +I.capex.value ? +(cur ? cur.fee : 0).toFixed(2) : null; });
    return { type: 'line', data: { labels: CAPEX.map(function (c) { return f(c, 0); }),
      datasets: [C.lineDs('Fee', curve.map(function (v) { return +v.toFixed(3); }), 0),
        C.lineDs('Current setting', at, 3, { showLine: false, pointRadius: 6 })] }, options: o };
  });
  paint();
})();
