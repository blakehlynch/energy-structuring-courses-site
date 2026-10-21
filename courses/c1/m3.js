/* C1 M3 widget: theory-of-storage explorer */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C1;
  var I = ESC.inputs('st-', ['days', 'spot', 'r', 'q', 'vlcc'], paint);
  var cur = null, full = null;
  function paint() {
    var days = +I.days.value, spot = +I.spot.value, r = +I.r.value, q = +I.q.value, vl = +I.vlcc.value;
    ESC.out('st-days', f(days, 1) + ' days');
    ESC.out('st-spot', '$' + spot);
    ESC.out('st-r', f(100 * r, 2) + '%');
    ESC.out('st-q', '$' + f(q, 2));
    ESC.out('st-vlcc', '$' + f(vl, 0));
    cur = X.curveFromInventory(spot, days, r, q, 12);
    full = []; for (var m = 0; m <= 12; m++) full.push(X.fullCarryForward(spot, r, q * 12 / spot, m / 12));
    var F6 = cur.curve[6];
    var on = X.cashAndCarry({ spot: spot, forward: F6, months: 6, storagePerMonth: q, rate: r, insurancePerMonth: 0.03, lossFrac: 0.002 });
    var fs = X.floatingStoragePerBblMonth(vl, 2e6);
    var fl = X.cashAndCarry({ spot: spot, forward: F6, months: 6, storagePerMonth: fs, rate: r, insurancePerMonth: 0.03, lossFrac: 0.002 });
    var shape = cur.netYield > 0.002 ? 'Contango' : cur.netYield < -0.002 ? 'Backwardation' : 'Flat';
    document.getElementById('st-stats').innerHTML =
      ESC.stat('Curve shape', shape, 'net carry yield ' + f(100 * cur.netYield, 1) + '%/yr') +
      ESC.stat('Convenience yield', f(100 * cur.convYield, 1) + '%/yr', 'storage yield ' + f(100 * cur.storageYield, 1) + '%') +
      ESC.stat('6-month spread', (F6 - spot >= 0 ? '+$' : '−$') + f(Math.abs(F6 - spot), 2), 'F(6m) − spot') +
      ESC.stat('Cash-and-carry, onshore', (on.profit >= 0 ? '+$' : '−$') + f(Math.abs(on.profit), 2) + '/bbl', '6 months, incl. insurance & losses') +
      ESC.stat('Cash-and-carry, VLCC', (fl.profit >= 0 ? '+$' : '−$') + f(Math.abs(fl.profit), 2) + '/bbl', 'ship storage $' + f(fs, 2) + '/bbl/month');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('st-chart'), function () {
    var labels = []; for (var m = 0; m <= 12; m++) labels.push(m === 0 ? 'Spot' : 'M' + m);
    var ds = cur ? [C.lineDs('Forward curve (model)', cur.curve.map(function (v) { return +v.toFixed(2); }), 0, { pointRadius: 3 }),
      C.lineDs('Full-carry ceiling', full.map(function (v) { return +v.toFixed(2); }), 1)] : [];
    var o = C.base({ legend: true, mode: 'index', xTitle: 'Delivery month', yTitle: '$/bbl' });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); } };
    return { type: 'line', data: { labels: labels, datasets: ds }, options: o };
  });
  paint();
})();
