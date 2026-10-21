/* C7 M5 widget: swing option explorer */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C7;
  var I = ESC.inputs('w-', ['k', 'v', 'm', 's'], paint);
  var res = null, K = 5, cache = {};
  function solve(v, m, s) {
    var key = v + '|' + m + '|' + s;
    if (!cache[key]) cache[key] = X.swingGrid({ F: 3.5, K: 3.5 * s, sigma: v, kappa: m, days: 31, rights: 31, grid: 81 });
    return cache[key];
  }
  function paint() {
    K = +I.k.value; var v = +I.v.value, m = +I.m.value, s = +I.s.value;
    ESC.out('w-k', K);
    ESC.out('w-v', Math.round(100 * v) + '%');
    ESC.out('w-m', m + (m > 0 ? ' (half-life ' + f(365 * Math.log(2) / m, 0) + ' d)' : ''));
    ESC.out('w-s', f(s, 2) + ' ($' + f(3.5 * s, 2) + ')');
    res = solve(v, m, s);
    var per = res.byRights[K - 1] / K;
    document.getElementById('w-stats').innerHTML =
      ESC.stat('Value per right', '$' + f(per, 4), K + ' rights → $' + f(res.byRights[K - 1], 4) + ' total') +
      ESC.stat('American bound (1 right)', '$' + f(res.byRights[0], 4), 'upper bound per right') +
      ESC.stat('Average daily European', '$' + f(res.euroAvg, 4), 'lower bound per right') +
      ESC.stat('Premium over dailies', f(res.euroAvg > 0 ? 100 * (per / res.euroAvg - 1) : 0, 0) + '%', 'per right');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('w-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Number of swing rights', yTitle: '$/MMBtu per right', mode: 'index' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + ' rights'; }, label: function (c) { return c.raw === null ? null : c.dataset.label + ': $' + f(c.raw, 4); } };
    var labels = [], per = [], eu = [], am = [], cur = [];
    for (var r = 1; r <= 31; r++) { labels.push(r); per.push(res ? +(res.byRights[r - 1] / r).toFixed(4) : null); eu.push(res ? +res.euroAvg.toFixed(4) : null); am.push(res ? +res.byRights[0].toFixed(4) : null); cur.push(r === K && res ? +(res.byRights[r - 1] / r).toFixed(4) : null); }
    return { type: 'line', data: { labels: labels, datasets: [
      C.lineDs('Value per right', per, 0, { pointRadius: 2 }),
      C.lineDs('American bound', am, 3, { borderDash: [6, 4] }),
      C.lineDs('Daily European', eu, 4, { borderDash: [2, 3] }),
      C.lineDs('Selected', cur, 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
