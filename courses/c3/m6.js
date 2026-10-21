/* C3 M6 widget: destination comparator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;
  var I = ESC.inputs('a-', ['fob', 'da', 'fa', 'db', 'fb', 'r'], paint);
  function sgn(x, d) { return (x >= 0 ? '+' : '−') + f(Math.abs(x), d); }
  var A = null, B = null, oA = null, oB = null;
  function paint() {
    var fob = +I.fob.value, r = +I.r.value;
    ['fob', 'da', 'fa', 'db', 'fb'].forEach(function (k) { ESC.out('a-' + k, '$' + f(+I[k].value, 2)); });
    ESC.out('a-r', f(100 * r, 1) + '%');
    oA = { fob: fob, dest: +I.da.value, freight: +I.fa.value, insurancePct: 0.0005, lossPct: 0.002, financeRate: r, days: 40, other: 0.05 };
    oB = { fob: fob, dest: +I.db.value, freight: +I.fb.value, insurancePct: 0.0005, lossPct: 0.002, financeRate: r, days: 55, other: 0.05 };
    A = X.arb(oA); B = X.arb(oB);
    var best = A.margin >= B.margin ? 'A' : 'B', bm = Math.max(A.margin, B.margin);
    document.getElementById('a-stats').innerHTML =
      ESC.stat('Margin via A', sgn(A.margin, 2) + ' $/bbl', 'breakeven freight $' + f(X.breakevenFreight(oA), 2)) +
      ESC.stat('Margin via B', sgn(B.margin, 2) + ' $/bbl', 'breakeven freight $' + f(X.breakevenFreight(oB), 2)) +
      ESC.stat('Decision', bm > 0 ? 'Ship to ' + best : 'Arb shut', bm > 0 ? 'advantage ' + f(Math.abs(A.margin - B.margin), 2) + ' $/bbl' : 'sell locally / FOB') +
      ESC.stat('Netback to origin', '$' + f(Math.max(X.netback(oA.dest, oA.freight, A.insurance + A.losses + A.finance + 0.05), X.netback(oB.dest, oB.freight, B.insurance + B.losses + B.finance + 0.05)), 2), 'best destination less all costs');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('a-chart'), function () {
    var o = C.base({ legend: true, mode: 'index', yTitle: '$/bbl' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    var lo = Math.floor(Math.min(+I.fob.value, +I.da.value, +I.db.value) - 2);
    o.scales.y.min = lo;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': ' + f(c.raw, 2); } };
    var g = function (lab, d, i) { return C.barDs(lab, d.map(function (x) { return +x.toFixed(3); }), i, { stack: 's', borderRadius: 0, maxBarThickness: 90, borderColor: C.v('--surface'), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 } }); };
    var ds = A ? [
      g('FOB cost', [oA.fob, oB.fob], 0),
      g('Freight', [oA.freight, oB.freight], 1),
      g('Insurance, losses, finance, other', [A.insurance + A.losses + A.finance + 0.05, B.insurance + B.losses + B.finance + 0.05], 2),
      g('Margin', [Math.max(0, A.margin), Math.max(0, B.margin)], 3)] : [];
    return { type: 'bar', data: { labels: ['Destination A', 'Destination B'], datasets: ds }, options: o };
  });
  paint();
})();
