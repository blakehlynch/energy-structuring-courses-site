/* C6 M4 widget: two-factor exponential volatility, correlation and PCA */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C6;
  var I = ESC.inputs('p-', ['s', 'b1', 'b2', 'l'], paint);
  var taus = []; for (var i = 1; i <= 24; i++) taus.push(i / 12);
  var vols = [], P = null;
  function paint() {
    var s = +I.s.value, b1 = +I.b1.value, b2 = +I.b2.value, l = +I.l.value;
    ESC.out('p-s', Math.round(100 * s) + '%');
    ESC.out('p-b1', f(b1, 2));
    ESC.out('p-b2', f(b2, 1));
    ESC.out('p-l', f(l, 2));
    var fac = [{ s: s, b: b1 }, { s: s * Math.sqrt(l), b: b2 }];
    var Cv = X.covMatrix(taus, fac, 0); P = X.pca(Cv);
    vols = taus.map(function (_, k) { return Math.sqrt(Cv[k][k]); });
    var h = X.hedgeRatio(72, 75, vols[23], vols[1], X.corrFromCov(Cv, 1, 23));
    document.getElementById('p-stats').innerHTML =
      ESC.stat('First component', f(100 * P.share[0], 1) + '%', 'of total variance') +
      ESC.stat('Corr. 1m vs 24m', f(X.corrFromCov(Cv, 0, 23), 3), '12m vs 24m ' + f(X.corrFromCov(Cv, 11, 23), 3)) +
      ESC.stat('Vol 1m / 24m', f(100 * vols[0], 1) + '% / ' + f(100 * vols[23], 1) + '%', 'Samuelson effect') +
      ESC.stat('Hedge ratio 24m with 2m', f(h, 3), 'per bbl, prices 72 and 75');
    chV.rebuild(); chL.rebuild();
  }
  var labels = taus.map(function (_, k) { return k + 1; });
  var chV = C.make(document.getElementById('p-vol'), function () {
    var o = C.base({ xTitle: 'Tenor (months)', yTitle: 'Volatility %' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + ' months'; }, label: function (c) { return 'Vol: ' + f(c.raw, 1) + '%'; } };
    o.scales.y.min = 0;
    return { type: 'line', data: { labels: labels, datasets: [C.lineDs('Volatility', vols.map(function (v) { return +(100 * v).toFixed(2); }), 0, { pointRadius: 2 })] }, options: o };
  });
  var chL = C.make(document.getElementById('p-load'), function () {
    var o = C.base({ legend: true, xTitle: 'Tenor (months)', yTitle: 'Loading (vol %)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + ' months'; }, label: function (c) { return c.dataset.label + ': ' + f(c.raw, 1); } };
    var ld = function (k) { return P ? P.loadings[k].map(function (x) { return +(100 * x).toFixed(2); }) : []; };
    return { type: 'line', data: { labels: labels, datasets: [
      C.lineDs('PC1 shift (' + (P ? f(100 * P.share[0], 1) : '') + '%)', ld(0), 1, { pointRadius: 2 }),
      C.lineDs('PC2 tilt (' + (P ? f(100 * P.share[1], 1) : '') + '%)', ld(1), 2, { pointRadius: 2 })] }, options: o };
  });
  paint();
})();
