/* C11 M1 widget: LNG chain calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C11;
  var STAGES = [{ name: 'Production', cost: 2.5 }, { name: 'Liquefaction', cost: 4.0 }, { name: 'Shipping', cost: 1.5 }, { name: 'Regasification', cost: 0.5 }];
  var I = ESC.inputs('c-', ['mt', 'ship', 'hv', 'av', 'p'], paint);
  var ch = null;
  function paint() {
    var mt = +I.mt.value, ship = +I.ship.value * 1000, hv = +I.hv.value, av = +I.av.value / 100, p = +I.p.value;
    ESC.out('c-mt', f(mt, 1));
    ESC.out('c-ship', f(ship / 1000, 0) + 'k');
    ESC.out('c-hv', f(hv, 0));
    ESC.out('c-av', f(100 * av, 0) + '%');
    ESC.out('c-p', '$' + f(p, 2));
    var t = X.train({ mtpa: mt, shipM3: ship, density: 0.45, hv: hv, avail: av, price: p });
    ch = X.chain(STAGES, p);
    document.getElementById('c-stats').innerHTML =
      ESC.stat('Gas equivalent', f(t.bcm, 2) + ' bcm/y', 'nameplate, at ' + f(X.bcmPerMt(hv), 3) + ' bcm per MMt') +
      ESC.stat('Gas per tonne', f(1000 * X.bcmPerMt(hv), 0) + ' m³', 'at ' + f(hv, 0) + ' Btu/ft³; ' + f(t.perT, 2) + ' MMBtu') +
      ESC.stat('Cargoes a year', f(t.cargoes, 1), f(t.cargoMMBtu / 1e6, 2) + 'm MMBtu each') +
      ESC.stat('Cargo value', '$' + f(t.cargoValue / 1e6, 1) + 'm', 'at the delivered price') +
      ESC.stat('Wellhead netback', (ch.netback < 0 ? '−$' : '$') + f(Math.abs(ch.netback), 2), ch.margin >= 0 ? 'covers the $2.50 production cost' : 'below the $2.50 production cost');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('c-chart'), function () {
    var o = C.base({ yTitle: '$/MMBtu', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return '$' + f(c.raw, 2) + '/MMBtu'; } };
    var nbv = ch ? ch.netback : 4;
    return { type: 'bar', data: { labels: ['Regasification', 'Shipping', 'Liquefaction', 'Wellhead netback'],
      datasets: [C.barDs('Share of delivered price', [0.5, 1.5, 4.0, +nbv.toFixed(2)], 0, { backgroundColor: [C.series(1), C.series(2), C.series(3), nbv >= 2.5 ? C.series(0) : C.series(5)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
