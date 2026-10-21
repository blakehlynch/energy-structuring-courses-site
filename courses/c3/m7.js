/* C3 M7 widget: credit exposure profile through a cargo's life */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;
  var I = ESC.inputs('c-', ['sec', 'vol', 'px', 'bl', 'cr', 'mv'], paint, ['input', 'change']);
  var res = null;
  function paint() {
    var vol = +I.vol.value * 1e6, px = +I.px.value, bl = +I.bl.value, cr = +I.cr.value, mv = +I.mv.value;
    ESC.out('c-vol', f(vol / 1e6, 1));
    ESC.out('c-px', '$' + f(px, 0));
    ESC.out('c-bl', bl);
    ESC.out('c-cr', cr);
    ESC.out('c-mv', (mv >= 0 ? '+' : '−') + '$' + f(Math.abs(mv), 1));
    res = X.exposureProfile({ volume: vol, price: px, diff: 0, dealDay: 0, blDay: bl, creditDays: cr, priceMove: mv, security: I.sec.value, pcgShare: 0.5 });
    var lc = X.lcCost(res.value * 1e6, 0.0012, 0);
    var pre = Math.max(0, -mv) * vol / 1e6;
    document.getElementById('c-stats').innerHTML =
      ESC.stat('Cargo value', '$' + f(res.value, 1) + 'm', f(vol / 1e6, 1) + ' m bbl at $' + f(px, 0)) +
      ESC.stat('Peak unsecured', '$' + f(res.peakUnsecured, 1) + 'm', 'payment due day ' + res.payDay) +
      ESC.stat('Pre-delivery risk', '$' + f(pre, 1) + 'm', mv < 0 ? 'replacement loss if buyer walks' : 'none: prices rose') +
      ESC.stat('Indicative LC fee', '$' + f(lc / 1e3, 0) + 'k', 'at 0.12% of value');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('c-chart'), function () {
    var pts = res ? res.points : [];
    var o = C.base({ legend: true, xTitle: 'Day from deal', yTitle: '$ million' });
    o.scales.y.min = 0;
    o.plugins.tooltip.callbacks = { title: function (c) { return 'Day ' + c[0].label; }, label: function (c) { return c.dataset.label + ': $' + f(c.raw, 1) + 'm'; } };
    return { type: 'line', data: { labels: pts.map(function (p) { return p.day; }), datasets: [
      C.lineDs('Gross exposure', pts.map(function (p) { return +p.gross.toFixed(2); }), 0, { stepped: true, borderColor: C.v('--muted'), backgroundColor: C.v('--muted'), borderDash: [5, 4] }),
      C.lineDs('Unsecured exposure', pts.map(function (p) { return +p.unsecured.toFixed(2); }), 3, { stepped: true, fill: 'origin', backgroundColor: C.wash(C.series(3), 0.18) })] }, options: o };
  });
  paint();
})();
