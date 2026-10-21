/* C6 M1 widget: carry curve builder */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C6;
  var I = ESC.inputs('c-', ['s', 'r', 'w', 'd', 'm'], paint);
  function pct(x, d) { return (x < 0 ? '−' : '') + f(100 * Math.abs(x), d === undefined ? 1 : d) + '%'; }
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x), 2); }
  var curve = [], mkt = 0;
  function paint() {
    var S = +I.s.value, r = +I.r.value, w = +I.w.value, d = +I.d.value; mkt = +I.m.value;
    ESC.out('c-s', '$' + S);
    ESC.out('c-r', pct(r));
    ESC.out('c-w', pct(w));
    ESC.out('c-d', pct(d));
    ESC.out('c-m', '$' + mkt);
    curve = []; for (var m = 0; m <= 24; m++) curve.push(X.carryForward(S, r, w, d, m / 12));
    var net = r + w - d, impl = X.impliedConvYield(S, mkt, r, w, 1);
    document.getElementById('c-stats').innerHTML =
      ESC.stat('Model 12-month forward', '$' + f(curve[12], 2), net >= 0 ? 'contango: net carry ' + pct(net) : 'backwardation: net carry ' + pct(net)) +
      ESC.stat('Implied convenience yield', pct(impl, 2), 'from the market quote $' + mkt) +
      ESC.stat('Quote minus full carry', money(mkt - X.carryForward(S, r, w, 0, 1)), 'positive → cash-and-carry profit per bbl');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('c-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Months forward', yTitle: '$/bbl' });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 2); } };
    var labels = curve.map(function (_, m) { return m; });
    return { type: 'line', data: { labels: labels, datasets: [
      C.lineDs('Model forward', curve.map(function (x) { return +x.toFixed(2); }), 0),
      C.lineDs('Market 12-month quote', labels.map(function (m) { return m === 12 ? mkt : null; }), 2, { showLine: false, pointRadius: 7, pointStyle: 'rectRot', pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
