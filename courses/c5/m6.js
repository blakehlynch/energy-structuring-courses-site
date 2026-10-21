/* C5 M6 widget: battery arbitrage on a solar-heavy day */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var I = ESC.inputs('b-', ['sol', 'k', 'eta', 'pk'], paint);
  var P = [], ab = null;
  function paint() {
    var sol = +I.sol.value, k = +I.k.value, eta = +I.eta.value, pk = +I.pk.value;
    ESC.out('b-sol', Math.round(100 * sol) + '%');
    ESC.out('b-k', k + ' h');
    ESC.out('b-eta', Math.round(100 * eta) + '%');
    ESC.out('b-pk', '$' + pk);
    P = X.dailyPrices({ base: 15, peak: pk, solar: sol });
    ab = X.arbitrage(P, k, 1, eta);
    var shape = P.map(function (_, h) { return (h >= 7 && h <= 18) ? Math.sin(Math.PI * (h - 6) / 13) : 0; });
    var avg = P.reduce(function (a, b) { return a + b; }, 0) / 24;
    document.getElementById('b-stats').innerHTML =
      ESC.stat('Daily margin', '$' + f(ab.profit, 0), 'per MW (' + k + ' MWh)') +
      ESC.stat('Annualised', '$' + f(ab.profit * 365 / 1e3, 0) + 'k', 'per MW-year if every day alike') +
      ESC.stat('Price range', '$' + f(Math.min.apply(null, P), 0) + '–$' + f(Math.max.apply(null, P), 0), 'average $' + f(avg, 0)) +
      ESC.stat('Solar capture rate', f(100 * X.captureRate(P, shape), 0) + '%', 'of daily average price');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('b-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Hour of day', yTitle: '$/MWh' });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 1); } };
    var labels = P.map(function (_, h) { return h; });
    var mark = function (set) { return P.map(function (p, h) { return set && set.indexOf(h) >= 0 ? +p.toFixed(2) : null; }); };
    return { type: 'line', data: { labels: labels, datasets: [
      C.lineDs('Price', P.map(function (p) { return +p.toFixed(2); }), 0),
      C.lineDs('Charge', mark(ab && ab.charge), 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 }),
      C.lineDs('Discharge', mark(ab && ab.discharge), 3, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
