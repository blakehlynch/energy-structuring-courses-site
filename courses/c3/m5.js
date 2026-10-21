/* C3 M5 widget: voyage economics and TCE vs speed */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;
  var I = ESC.inputs('v-', ['ws', 'flat', 't', 'dist', 'spd', 'bunk'], paint);
  var curve = [], cur = null, best = null;
  function paint() {
    var ws = +I.ws.value, flat = +I.flat.value, t = +I.t.value * 1000, dist = +I.dist.value, spd = +I.spd.value, bunk = +I.bunk.value;
    ESC.out('v-ws', 'WS ' + f(ws, 1));
    ESC.out('v-flat', '$' + f(flat, 2));
    ESC.out('v-t', f(t / 1000, 0));
    ESC.out('v-dist', f(dist, 0));
    ESC.out('v-spd', f(spd, 1));
    ESC.out('v-bunk', '$' + f(bunk, 0));
    var base = { distance: dist, speed: 13, portDays: 4, seaCons: 70, portCons: 15, bunker: bunk, portCosts: 250000, canal: 0 };
    var w = X.worldscale(flat, ws, t);
    cur = X.tceAtSpeed(base, w.total, spd);
    best = X.bestSpeed(base, w.total, 8, 16, 0.1);
    curve = []; for (var s = 9; s <= 16.001; s += 0.5) curve.push({ s: s, t: X.tceAtSpeed(base, w.total, s).tce });
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Freight', '$' + f(w.total / 1e6, 2) + 'm', '$' + f(w.perTonne, 2) + '/t · $' + f(w.perBbl, 2) + '/bbl') +
      ESC.stat('Voyage', f(cur.days, 1) + ' days', 'voyage cost $' + f(cur.voyageCost / 1e6, 2) + 'm') +
      ESC.stat('TCE', '$' + f(cur.tce, 0) + '/day', 'at ' + f(spd, 1) + ' knots') +
      ESC.stat('Best speed', f(best.speed, 1) + ' kn', 'TCE $' + f(best.tce, 0) + '/day');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('v-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Speed (knots)', yTitle: 'TCE ($/day)', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 9; o.scales.x.max = 16;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 0) + '/day at ' + f(c.raw.x, 1) + ' kn'; } };
    return { type: 'line', data: { datasets: [
      C.lineDs('TCE by speed', curve.map(function (p) { return { x: p.s, y: Math.round(p.t) }; }), 0),
      C.lineDs('Current speed', cur ? [{ x: +I.spd.value, y: Math.round(cur.tce) }] : [], 1, { showLine: false, pointRadius: 7, pointHoverRadius: 8, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paint();
})();
