/* C1 M6 widget: long-run demand and replacement explorer */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C1;
  var I = ESC.inputs('d-', ['road', 'ev', 'eff', 'oth', 'dec'], paint);
  var res = null, legacy = 0;
  function paint() {
    var road = +I.road.value, ev = +I.ev.value, eff = +I.eff.value, oth = +I.oth.value / 100, dec = +I.dec.value;
    ESC.out('d-road', Math.round(100 * road) + '%');
    ESC.out('d-ev', Math.round(100 * ev) + '%');
    ESC.out('d-eff', Math.round(100 * eff) + '%');
    ESC.out('d-oth', (oth >= 0 ? '+' : '') + f(100 * oth, 1) + '%');
    ESC.out('d-dec', f(100 * dec, 1) + '%');
    res = X.demandPath({ base: 100, roadShare: road, evShare: ev, iceEff: eff, otherGrowth: oth, years: 30 });
    legacy = 100 * Math.exp(-dec * 30);
    document.getElementById('d-stats').innerHTML =
      ESC.stat('2050 demand', f(res.total, 1) + ' mb/d', (res.change >= 0 ? '+' : '') + f(res.change, 1) + ' vs 100 today') +
      ESC.stat('Road fuels 2050', f(res.road, 1) + ' mb/d', 'from ' + f(100 * road, 0) + ' today') +
      ESC.stat('Today’s fields in 2050', f(legacy, 1) + ' mb/d', 'after 30 years of ' + f(100 * dec, 1) + '% decline') +
      ESC.stat('New supply needed by 2050', f(Math.max(0, res.total - legacy), 1) + ' mb/d', 'replacement of ' + f(X.declineReplacement(100, dec), 2) + ' bn bbl/yr at the start');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('d-chart'), function () {
    var labels = ['Today', '2050 demand'];
    var o = C.base({ legend: true, mode: 'index', yTitle: 'mb/d' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false }; o.scales.y.min = 0;
    var g = function (lab, data, i) { return C.barDs(lab, data, i, { stack: 's', borderRadius: 0, maxBarThickness: 80, borderColor: C.v('--surface'), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 } }); };
    var ds = res ? [g('Supply from today’s fields', [100, +Math.min(legacy, res.total).toFixed(1)], 0), g('New supply required', [0, +Math.max(0, res.total - legacy).toFixed(1)], 1)] : [];
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': ' + f(c.raw, 1) + ' mb/d'; } };
    return { type: 'bar', data: { labels: labels, datasets: ds }, options: o };
  });
  paint();
})();
