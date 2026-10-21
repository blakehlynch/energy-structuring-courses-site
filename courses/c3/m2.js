/* C3 M2 widget: pricing-window exposure (B/L day 10, discharge day 35) */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;
  var BUY = { bl2: [8, 12], after: [11, 15], month: [0, 21] }, SELL = { dis: [33, 37], after: [36, 40], month: [23, 44] };
  var I = {}; ['buy', 'sell', 'drift', 'vol', 'seed', 'bd', 'sd'].forEach(function (k) {
    I[k] = document.getElementById('p-' + k); I[k].addEventListener('input', paint); I[k].addEventListener('change', paint);
  });
  function sgn(x, d) { return (x >= 0 ? '+' : '−') + f(Math.abs(x), d); }
  var spot = [], bw = BUY.bl2, sw = SELL.dis;
  function paint() {
    var drift = +I.drift.value, vol = +I.vol.value, seed = +I.seed.value, bd = +I.bd.value, sd = +I.sd.value;
    bw = BUY[I.buy.value]; sw = SELL[I.sell.value];
    ESC.out('p-drift', sgn(drift, 2));
    ESC.out('p-vol', '$' + f(vol, 1));
    ESC.out('p-seed', '#' + seed);
    ESC.out('p-bd', sgn(bd, 2));
    ESC.out('p-sd', sgn(sd, 2));
    spot = X.pricePath(80, 45, drift, vol, seed);
    var nz = X.normals(45, seed + 1000), fut = spot.map(function (p, i) { return p + 0.2 * nz[i]; });
    var r = X.windowMargin({ spot: spot, fut: fut, buyFrom: bw[0], buyTo: bw[1], sellFrom: sw[0], sellTo: sw[1], buyDiff: bd, sellDiff: sd });
    document.getElementById('p-stats').innerHTML =
      ESC.stat('Purchase price', '$' + f(r.buy, 2), 'window days ' + bw[0] + '–' + bw[1]) +
      ESC.stat('Sale price', '$' + f(r.sell, 2), 'window days ' + sw[0] + '–' + sw[1]) +
      ESC.stat('Unhedged margin', sgn(r.unhedged, 2) + ' $/bbl', 'differentials alone: ' + sgn(sd - bd, 2)) +
      ESC.stat('Hedged margin', sgn(r.hedged, 2) + ' $/bbl', 'futures leg ' + sgn(r.hedge, 2));
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('p-chart'), function () {
    var labels = spot.map(function (_, i) { return i; });
    var inW = function (w) { return spot.map(function (p, i) { return i >= w[0] && i <= w[1] ? +p.toFixed(2) : null; }); };
    var o = C.base({ legend: true, xTitle: 'Trading day', yTitle: 'Marker ($/bbl)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return 'Day ' + c[0].label; }, label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 2); } };
    return { type: 'line', data: { labels: labels, datasets: [
      C.lineDs('Marker', spot.map(function (p) { return +p.toFixed(2); }), 0, { borderColor: C.v('--muted'), backgroundColor: C.v('--muted') }),
      C.lineDs('Purchase window', inW(bw), 1, { borderWidth: 5, spanGaps: false }),
      C.lineDs('Sale window', inW(sw), 2, { borderWidth: 5, spanGaps: false })] }, options: o };
  });
  paint();
})();
