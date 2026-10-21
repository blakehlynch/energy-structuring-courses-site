/* C11 M6 widget: flexible US cargo — cancel, Europe or Asia */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C11;
  var VB = { kn: 19.5, portDays: 4, hire: 70000, bor: 0.001, gas: 8, cargoM3: 174000, density: 0.45 };   // Module 5 worked examples 1 and 2
  var SHIP_EU = X.voyage(Object.assign({ nm: 4900, port: 0.5e6 }, VB)).perMMBtu, SHIP_AS = X.voyage(Object.assign({ nm: 9200, port: 1.5e6 }, VB)).perMMBtu;
  var I = ESC.inputs('x-', ['ttf', 'jkm', 'hh', 's', 'r', 'fee'], paint);
  var bo = null, nb = null, timer = null;
  // the 40,000-path simulation reruns only once the slider pauses, so dragging stays smooth
  function paint() { clearTimeout(timer); timer = setTimeout(simulate, 120); readouts(); }
  function readouts() {
    var ttf = +I.ttf.value, jkm = +I.jkm.value, hh = +I.hh.value, s = +I.s.value / 100, r = +I.r.value, fee = +I.fee.value;
    ESC.out('x-ttf', '$' + f(ttf, 2));
    ESC.out('x-jkm', '$' + f(jkm, 2));
    ESC.out('x-hh', '$' + f(hh, 2));
    ESC.out('x-s', Math.round(100 * s) + '%');
    ESC.out('x-r', f(r, 2));
    ESC.out('x-fee', '$' + f(fee, 2));
  }
  function simulate() {
    var ttf = +I.ttf.value, jkm = +I.jkm.value, hh = +I.hh.value, s = +I.s.value / 100, r = +I.r.value, fee = +I.fee.value;
    var base = { regasFee: 0.35, regasFuel: 0.0175, shipEu: SHIP_EU, shipAs: SHIP_AS, mult: 1.15 };
    nb = X.netbacks(Object.assign({ ttf: ttf, jkm: jkm, hh: hh }, base));
    bo = X.bestOf(Object.assign({ ttf: ttf, jkm: jkm, hh: hh, sTtf: s, sJkm: s + 0.05, sHh: 0.40, rTJ: r, rTH: 0.30, rJH: 0.30, T: 0.5, r: 0.04, paths: 40000, seed: 7 }, base));
    var intr = Math.max(0, nb.marginEu, nb.marginAs);
    document.getElementById('x-stats').innerHTML =
      ESC.stat('Intrinsic margin', '$' + f(intr, 3), intr > 0 ? 'today\'s best: ' + nb.dest : 'cancel at today\'s forwards') +
      ESC.stat('Single-destination options', 'EU $' + f(bo.eu, 3) + ' · Asia $' + f(bo.as, 3), 'per MMBtu') +
      ESC.stat('Best of Europe, Asia, cancel', '$' + f(bo.best, 3), 'uplift $' + f(bo.best - Math.max(bo.eu, bo.as), 3)) +
      ESC.stat('Value net of fee', (bo.best - fee < 0 ? '−$' : '$') + f(Math.abs(bo.best - fee), 3), 'lifted in ' + f(100 * bo.pLift, 0) + '% of scenarios');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('x-chart'), function () {
    var o = C.base({ yTitle: '$/MMBtu', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return '$' + f(c.raw, 3) + '/MMBtu'; } };
    var d = bo ? [Math.max(0, nb.marginEu, nb.marginAs), bo.eu, bo.as, bo.best, +I.fee.value] : [0, 0, 0, 0, 0];
    return { type: 'bar', data: { labels: ['Intrinsic', 'Europe only', 'Asia only', 'Best of', 'Fee'],
      datasets: [C.barDs('Value', d.map(function (x) { return +x.toFixed(3); }), 0, { backgroundColor: [C.series(7), C.series(0), C.series(1), C.series(2), C.series(5)], borderSkipped: false })] }, options: o };
  });
  readouts(); simulate();
})();
