/* C6 M3 widgets: Schwartz one-factor curve; mean-reverting jump simulator with estimation */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C6;

  // ---- Schwartz curve ----
  var S = ESC.inputs('s-', ['s', 'l', 'a', 'v'], paintS);
  var tenors = [], fwd = [];
  for (var i = 0; i <= 60; i++) tenors.push(i / 12);
  function paintS() {
    var s = +S.s.value, L = +S.l.value, a = +S.a.value, v = +S.v.value, mu = Math.log(L);
    ESC.out('s-s', '$' + s);
    ESC.out('s-l', '$' + L);
    ESC.out('s-a', f(a, 1) + ' (half-life ' + f(365 * X.halfLife(a), 0) + ' d)');
    ESC.out('s-v', Math.round(100 * v) + '%');
    fwd = tenors.map(function (t) { return X.schwartzF(s, t, a, mu, v, 0); });
    document.getElementById('s-stats').innerHTML =
      ESC.stat('1-year forward', '$' + f(X.schwartzF(s, 1, a, mu, v, 0), 2), 'spot $' + s) +
      ESC.stat('Long-run forward', '$' + f(X.schwartzFinf(a, mu, v, 0), 2), 'vs level $' + L) +
      ESC.stat('Forward vol at 1 year', f(100 * X.schwartzVol(v, a, 1), 1) + '%', 'σe^(−α)');
    chS.rebuild();
  }
  var chS = C.make(document.getElementById('s-chart'), function () {
    var o = C.base({ xTitle: 'Years to delivery', yTitle: '$', mode: 'index' });
    o.plugins.tooltip.callbacks = { title: function (c) { return f(+c[0].label, 2) + ' years'; }, label: function (c) { return 'Forward: $' + f(c.raw, 2); } };
    o.scales.x.ticks.callback = function (val, idx) { return idx % 12 === 0 ? idx / 12 : null; };
    return { type: 'line', data: { labels: tenors, datasets: [C.lineDs('Forward', fwd.map(function (x) { return +x.toFixed(3); }), 0)] }, options: o };
  });
  paintS();

  // ---- simulator ----
  var M = ESC.inputs('m-', ['a', 'v', 'j', 'k'], paintM);
  var path = [];
  function paintM() {
    var a = +M.a.value, v = +M.v.value, j = +M.j.value, k = +M.k.value;
    ESC.out('m-a', f(a, 1));
    ESC.out('m-v', Math.round(100 * v) + '%');
    ESC.out('m-j', j);
    ESC.out('m-k', '+' + f(k, 2));
    path = X.mrPath({ S0: 60, L: 50, a: a, sigma: v, dt: 1 / 365, n: 730, seed: 11, jf: j, jm: k, jv: 0.15 });
    var est = X.estimateMR(path, 1 / 365), rf = X.recursiveFilter(X.logReturns(path), 3, 1 / 365);
    document.getElementById('m-stats').innerHTML =
      ESC.stat('Estimated α', f(est.a, 2), 'true ' + f(a, 1) + '; half-life ' + f(365 * X.halfLife(Math.max(est.a, 1e-6)), 1) + ' d') +
      ESC.stat('Estimated level', '$' + f(est.level, 2), 'true $50') +
      ESC.stat('Jumps flagged', String(rf.jumps), 'simulated ' + path.jumps) +
      ESC.stat('Diffusion vol (filtered)', f(100 * rf.sigma, 1) + '%', 'true ' + Math.round(100 * v) + '%; unfiltered ' + f(100 * est.sigma, 1) + '%');
    chM.rebuild();
  }
  var chM = C.make(document.getElementById('m-chart'), function () {
    var o = C.base({ xTitle: 'Day', yTitle: '$' });
    o.plugins.tooltip.callbacks = { title: function (c) { return 'Day ' + c[0].label; }, label: function (c) { return 'Price: $' + f(c.raw, 2); } };
    return { type: 'line', data: { labels: path.map(function (_, d) { return d; }), datasets: [C.lineDs('Spot', path.map(function (x) { return +x.toFixed(2); }), 0, { borderWidth: 1.5 }),
      C.lineDs('Long-run level', path.map(function () { return 50; }), 4, { borderDash: [6, 4], borderWidth: 1.5 })] }, options: o };
  });
  paintM();
})();
