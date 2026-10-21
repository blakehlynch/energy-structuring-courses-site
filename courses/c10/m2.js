/* C10 M2 widget: toll bid calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C10;
  var P = [52, 48, 45, 40, 38, 47, 62, 66, 48, 40, 44, 50], G = [4.8, 4.7, 4.4, 4.0, 3.9, 4.0, 4.1, 4.1, 4.0, 4.0, 4.3, 4.7];
  var H = P.map(function (_, i) { return 16 * [22, 20, 21, 21, 22, 21, 21, 23, 20, 22, 21, 21][i]; });
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var I = ESC.inputs('t-', ['h', 'c', 'x', 'r'], paint);
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x) / 1e6, 1) + 'm'; }
  var R = null;
  function paint() {
    var h = +I.h.value, c = +I.c.value, x = +I.x.value, r = +I.r.value;
    ESC.out('t-h', f(h, 1));
    ESC.out('t-c', '$' + f(c, 2));
    ESC.out('t-x', Math.round(100 * x) + '%');
    ESC.out('t-r', f(r, 2));
    R = X.tollDeal({ mw: 500, hr: h, vom: 3, power: P, gas: G, hours: H, sp: 0.45, sg: 0.35, rho: r, haircut: x, capPay: c, r: 0.05 });
    document.getElementById('t-stats').innerHTML =
      ESC.stat('Toll value', money(R.value), 'intrinsic ' + money(R.intrinsic)) +
      ESC.stat('NPV at this payment', money(R.npv), 'PV of payments ' + money(R.cost)) +
      ESC.stat('Break-even payment', '$' + f(R.breakeven, 2) + '/kW-mo', R.npv >= 0 ? 'bid is in the money' : 'too expensive');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('t-chart'), function () {
    var o = C.base({ legend: true, yTitle: '$m', mode: 'index' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2) + 'm'; } };
    var rows = R ? R.rows : [];
    return { type: 'bar', data: { labels: MON, datasets: [
      C.barDs('Intrinsic', rows.map(function (q) { return +(q.intrinsic * q.mwh / 1e6).toFixed(3); }), 0, { borderRadius: 0 }),
      C.barDs('Extrinsic (after haircut)', rows.map(function (q) { return +((q.value - q.intrinsic) * q.mwh / 1e6).toFixed(3); }), 1, { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: false })] }, options: o };
  });
  paint();
})();
