/* C7 M3 widget: toll dispatch simulator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C7;
  var I = ESC.inputs('t-', ['h', 'sc', 'q', 'v'], paint);
  var MWH = 21 * 16 * 400, res = null, paths = null, lastV = null;
  function paint() {
    var h = +I.h.value, sc = +I.sc.value * 1000, q = +I.q.value, v = +I.v.value;
    ESC.out('t-h', f(h, 1));
    ESC.out('t-sc', '$' + f(sc / 1000, 0) + 'k');
    ESC.out('t-q', q);
    ESC.out('t-v', Math.round(100 * v) + '%');
    if (lastV !== v) { paths = X.tollPaths({ paths: 300, days: 21, seed: 9, Pon: 45, Poff: 30, G: 4.5, sOn: v, sOff: 0.25, sG: 0.10, rhoPG: 0.5, rhoOnOff: 0.6 }); lastV = v; }
    var u = { cap: 400, qmin: q, hr: h, hrMin: h + 0.8, vom: 3, sc: sc, hOn: 16, hOff: 8 };
    res = X.tollSummary(paths, u, 0);
    document.getElementById('t-stats').innerHTML =
      ESC.stat('Constrained value', '$' + f(res.dp / MWH, 2) + '/MWh', '$' + f(res.dp / 1e3, 0) + 'k for the month') +
      ESC.stat('Lost to constraints', f(res.strip > 0 ? 100 * (1 - res.dp / res.strip) : 0, 1) + '%', 'vs spread-option strip $' + f(res.strip / MWH, 2)) +
      ESC.stat('Run days / starts', f(res.runsDP, 1) + ' / ' + f(res.startsDP, 1), 'perfect-foresight dispatch') +
      ESC.stat('Simple rule captures', f(res.dp > 0 ? 100 * res.heur / res.dp : 0, 1) + '%', 'day-ahead myopic rule');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('t-chart'), function () {
    var o = C.base({ yTitle: '$/MWh', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return '$' + f(c.raw, 2) + '/MWh'; } };
    var d = res ? [res.strip, res.dp, res.heur].map(function (x) { return +(x / MWH).toFixed(2); }) : [0, 0, 0];
    return { type: 'bar', data: { labels: ['Spread-option strip', 'Perfect-foresight dispatch', 'Day-ahead rule'], datasets: [C.barDs('Value', d, 0, { backgroundColor: [C.series(0), C.series(1), C.series(2)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
