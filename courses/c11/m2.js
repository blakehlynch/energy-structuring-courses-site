/* C11 M2 widget: firm pipeline capacity as a spread option */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C11;
  var I = ESC.inputs('p-', ['m', 'h', 'sm', 'sh', 'r', 'res'], paint);
  var base = null, curve = [], RHO = [];
  for (var k = 0; k <= 20; k++) RHO.push(+(k * 0.0495).toFixed(3));
  function opts(rho) {
    return { market: +I.m.value, hub: +I.h.value, fuel: 0.0024, commodity: 0.035, reservation: +I.res.value, T: 0.25,
      sMarket: +I.sm.value / 100, sHub: +I.sh.value / 100, rho: rho, r: 0.04 };
  }
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x), 4); }
  function paint() {
    ESC.out('p-m', '$' + f(+I.m.value, 2));
    ESC.out('p-h', '$' + f(+I.h.value, 2));
    ESC.out('p-sm', I.sm.value + '%');
    ESC.out('p-sh', I.sh.value + '%');
    ESC.out('p-r', f(+I.r.value, 2));
    ESC.out('p-res', '$' + f(+I.res.value, 2));
    base = X.transport(opts(+I.r.value));
    curve = RHO.map(function (r) { return X.transport(opts(r)).value; });
    document.getElementById('p-stats').innerHTML =
      ESC.stat('Forward basis', money(+I.m.value - +I.h.value), 'market minus Henry Hub') +
      ESC.stat('Intrinsic value', money(base.intrinsic), 'after fuel and commodity charge') +
      ESC.stat('Capacity value', money(base.value), 'Kirk spread option') +
      ESC.stat('Net of reservation', money(base.net), base.net >= 0 ? 'worth buying' : 'premium exceeds value');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('p-chart'), function () {
    var o = C.base({ xTitle: 'Correlation', yTitle: '$/MMBtu', legend: true });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 3); } };
    var res = +I.res.value;
    return { type: 'line', data: { labels: RHO.map(function (r) { return f(r, 2); }),
      datasets: [C.lineDs('Capacity value', curve.map(function (v) { return +v.toFixed(4); }), 0),
        C.lineDs('Reservation charge', RHO.map(function () { return res; }), 4, { borderDash: [6, 4] })] }, options: o };
  });
  paint();
})();
