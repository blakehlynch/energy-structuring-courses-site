/* C5 M7 widget: withholding and forward contracts */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var BASE = [{ name: 'Nuclear', q: 3000, p: 9 }, { name: 'CCGT', q: 4000, p: 26 }, { name: 'Coal', q: 2500, p: 28 }, { name: 'CT', q: 1500, p: 42 }, { name: 'Oil', q: 500, p: 95 }];
  var I = ESC.inputs('w-', ['d', 'k', 'w', 'f'], paint);
  function money(x) { return (x < 0 ? '−$' : '+$') + f(Math.abs(x) / 1e3, 1) + 'k'; }
  var before = [], after = [], D = 0;
  function steps(offers) { var s = offers.slice().sort(function (a, b) { return a.p - b.p; }), cum = 0, pts = [{ x: 0, y: s[0].p }]; s.forEach(function (o) { cum += o.q; pts.push({ x: cum, y: o.p }); }); return pts; }
  function paint() {
    D = +I.d.value; var K = +I.k.value, w = Math.min(+I.w.value, K), F = +I.f.value;
    ESC.out('w-d', f(D, 0));
    ESC.out('w-k', f(K, 0));
    ESC.out('w-w', f(w, 0));
    ESC.out('w-f', f(F, 0));
    var offW = BASE.map(function (o) { return o.name === 'CCGT' ? { name: o.name, q: o.q - w, p: o.p } : o; });
    var m0 = X.meritOrder(BASE, D), m1 = X.meritOrder(offW, D);
    var P0 = m0.price, P1 = m1.short > 0 ? 1000 : m1.price;
    var gain = X.withholdingGain({ P0: P0, P1: P1, K: K, w: w, F: F, mc: 26 });
    var rsi = X.rsi(11500, K, D);
    before = steps(BASE); after = steps(offW);
    document.getElementById('w-stats').innerHTML =
      ESC.stat('Price without withholding', '$' + f(P0, 0), 'marginal plant sets price') +
      ESC.stat('Price with withholding', m1.short > 0 ? '$1,000 (cap)' : '$' + f(P1, 0), m1.short > 0 ? 'load shed: capped price' : f(w, 0) + ' MW withheld') +
      ESC.stat('Change in hourly profit', money(gain), gain > 0 ? 'withholding pays' : 'withholding does not pay') +
      ESC.stat('Residual supply index', f(rsi, 2), rsi < 1 ? 'pivotal' : 'not pivotal');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('w-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Cumulative capacity (MW)', yTitle: '$/MWh', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0; o.scales.x.max = 12000; o.scales.y.min = 0; o.scales.y.max = 110;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + c.raw.y + ' up to ' + f(c.raw.x, 0) + ' MW'; } };
    return { type: 'line', data: { datasets: [
      C.lineDs('Stack (all offered)', before, 0, { stepped: 'before' }),
      C.lineDs('Stack after withholding', after, 3, { stepped: 'before', borderDash: [6, 4] }),
      C.lineDs('Demand', [{ x: D, y: 0 }, { x: D, y: 110 }], 1, { borderDash: [2, 3] })] }, options: o };
  });
  paint();
})();
