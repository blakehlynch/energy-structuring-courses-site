/* C11 M5 widget: round-voyage cost per delivered MMBtu */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C11;
  var CARGOES = X.train({ mtpa: 4.5, shipM3: 174000, density: 0.45, avail: 0.93 }).cargoes;   // Module 1 worked example
  var I = ESC.inputs('v-', ['nm', 'kn', 'hire', 'bor', 'gas', 'port'], paint);
  var v = null;
  function paint() {
    ESC.out('v-nm', f(+I.nm.value, 0));
    ESC.out('v-kn', f(+I.kn.value, 1));
    ESC.out('v-hire', '$' + I.hire.value + 'k');
    ESC.out('v-bor', f(+I.bor.value, 2) + '%');
    ESC.out('v-gas', '$' + f(+I.gas.value, 2));
    ESC.out('v-port', '$' + f(+I.port.value, 1) + 'm');
    v = X.voyage({ nm: +I.nm.value, kn: +I.kn.value, portDays: 4, hire: +I.hire.value * 1000, bor: +I.bor.value / 100, gas: +I.gas.value,
      port: +I.port.value * 1e6, cargoM3: 174000, density: 0.45 });
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Round voyage', f(v.rtDays, 1) + ' days', f(v.seaDays, 1) + ' at sea') +
      ESC.stat('Delivered', f(v.delivered / 1e6, 3) + 'm MMBtu', f(v.boil / 1e3, 0) + 'k boiled off') +
      ESC.stat('Cost per MMBtu', '$' + f(v.perMMBtu, 3), '$' + f(v.total / 1e6, 2) + 'm a voyage') +
      ESC.stat('Ships for one train', f(X.shipsNeeded(CARGOES, v.cargoesPerShip), 1), f(v.cargoesPerShip, 1) + ' cargoes per ship a year');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('v-chart'), function () {
    var o = C.base({ yTitle: '$/MMBtu delivered', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return '$' + f(c.raw, 3) + '/MMBtu'; } };
    var d = v ? [v.hirePer, v.boilPer, v.portPer, v.perMMBtu] : [0, 0, 0, 0];
    return { type: 'bar', data: { labels: ['Hire', 'Boil-off', 'Port and canal', 'Total'],
      datasets: [C.barDs('Cost', d.map(function (x) { return +x.toFixed(3); }), 0, { backgroundColor: [C.series(0), C.series(1), C.series(2), C.series(4)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
