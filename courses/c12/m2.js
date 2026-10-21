/* C12 M2 widget: spark book VaR, component VaR and best hedge */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C12;
  var I = ESC.inputs('b-', ['p', 'g', 'sp', 'sg', 'r'], paint);
  var GAS = [], curve = [], cur = null, hedge = 0;
  for (var k = 0; k <= 1500; k += 25) GAS.push(k);
  function k$(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x) / 1e3, 1) + 'k'; }
  function book(gasK) {
    var s = [+I.sp.value / 100, +I.sg.value / 100], r = +I.r.value;
    return X.portfolio([+I.p.value * 1000 * 50, -gasK * 1000 * 3], s, [[1, r], [r, 1]], 0.95);
  }
  function paint() {
    ESC.out('b-p', f(+I.p.value, 0) + 'k');
    ESC.out('b-g', f(+I.g.value, 0) + 'k');
    ESC.out('b-sp', f(+I.sp.value, 1) + '%');
    ESC.out('b-sg', f(+I.sg.value, 1) + '%');
    ESC.out('b-r', f(+I.r.value, 2));
    cur = book(+I.g.value);
    var s = [+I.sp.value / 100, +I.sg.value / 100], r = +I.r.value;
    hedge = -X.bestHedge([+I.p.value * 1000 * 50, 0], s, [[1, r], [r, 1]], 1) / 3;
    curve = GAS.map(function (g) { return book(g).var; });
    var best = book(hedge / 1000);
    document.getElementById('b-stats').innerHTML =
      ESC.stat('Diversified VaR', k$(cur.var), 'undiversified ' + k$(cur.undiversified)) +
      ESC.stat('Component VaR: power', k$(cur.component[0]), f(100 * cur.share[0], 0) + '% of VaR') +
      ESC.stat('Component VaR: gas', k$(cur.component[1]), cur.component[1] < 0 ? 'acts as a hedge' : 'adds risk') +
      ESC.stat('Best gas hedge', f(hedge / 1e3, 0) + 'k MMBtu short', 'VaR ' + k$(best.var));
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('b-chart'), function () {
    var o = C.base({ xTitle: 'Gas short (000 MMBtu)', yTitle: '95% VaR ($k)', legend: true });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 1) + 'k'; } };
    var at = GAS.map(function (g) { return g === +I.g.value && cur ? +(cur.var / 1e3).toFixed(1) : null; });
    return { type: 'line', data: { labels: GAS.map(String), datasets: [
      C.lineDs('VaR', curve.map(function (v) { return +(v / 1e3).toFixed(2); }), 0),
      C.lineDs('Current hedge', at, 3, { showLine: false, pointRadius: 6 })] }, options: o };
  });
  paint();
})();
