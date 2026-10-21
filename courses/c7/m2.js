/* C7 M2 widget: spark-spread strip */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C7;
  var P = [52, 48, 45, 40, 38, 47, 62, 66, 48, 40, 44, 50], G = [4.8, 4.7, 4.4, 4.0, 3.9, 4.0, 4.1, 4.1, 4.0, 4.0, 4.3, 4.7];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], T = P.map(function (_, i) { return (i + 1.5) / 12; });
  var I = ESC.inputs('p-', ['h', 'vp', 'vg', 'r'], paint);
  var ss = [];
  function paint() {
    var h = +I.h.value, vp = +I.vp.value, vg = +I.vg.value, r = +I.r.value;
    ESC.out('p-h', f(h, 1));
    ESC.out('p-vp', Math.round(100 * vp) + '%');
    ESC.out('p-vg', Math.round(100 * vg) + '%');
    ESC.out('p-r', f(r, 2));
    ss = X.sparkStrip(P, G, T, h, 3, vp, vg, r, 0.04);
    var tot = X.sum(ss.map(function (s) { return s.value; })), intr = X.sum(ss.map(function (s) { return s.intrinsic; }));
    var best = ss.reduce(function (b, s, i) { return s.value - s.intrinsic > b.e ? { e: s.value - s.intrinsic, i: i } : b; }, { e: -1, i: 0 });
    document.getElementById('p-stats').innerHTML =
      ESC.stat('Average value', '$' + f(tot / 12, 2) + '/MWh', 'intrinsic $' + f(intr / 12, 2)) +
      ESC.stat('Extrinsic share', f(tot > 0 ? 100 * (1 - intr / tot) : 0, 1) + '%', 'optionality') +
      ESC.stat('Most extrinsic month', MON[best.i], '$' + f(best.e, 2) + ' time value');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('p-chart'), function () {
    var o = C.base({ legend: true, yTitle: '$/MWh', mode: 'index' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); } };
    return { type: 'bar', data: { labels: MON, datasets: [
      C.barDs('Intrinsic', ss.map(function (s) { return +s.intrinsic.toFixed(2); }), 0, { borderSkipped: false, borderRadius: 0 }),
      C.barDs('Extrinsic', ss.map(function (s) { return +(s.value - s.intrinsic).toFixed(2); }), 1, { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: false })] }, options: o };
  });
  paint();
})();
