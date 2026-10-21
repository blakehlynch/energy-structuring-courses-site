/* C6 M5 widgets: early-expiry term volatility; Margrabe spark spread */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C6;

  // ---- term volatility (F 70, delivery 2.05y, listed expiry 2.0y, β1 0.05, r 4%) ----
  var T = 2.05, TE = 2.0, B1 = 0.05, F = 70, R = 0.04;
  var V = ESC.inputs('v-', ['iv', 'b2', 'l', 't'], paintV);
  var grid = [], tvs = [], cur = null;
  for (var g = 0.1; g <= 2.0001; g += 0.05) grid.push(+g.toFixed(2));
  function strad(v, t) { return X.black76(F, F, t, v, R, 'call') + X.black76(F, F, t, v, R, 'put'); }
  function paintV() {
    var iv = +V.iv.value, b2 = +V.b2.value, l = +V.l.value, ts = +V.t.value;
    ESC.out('v-iv', Math.round(100 * iv) + '%');
    ESC.out('v-b2', f(b2, 1));
    ESC.out('v-l', f(l, 2));
    ESC.out('v-t', f(ts, 2));
    var s1 = X.calibS1(iv, B1, b2, l, T, TE), tv = X.termVol(s1, B1, b2, l, T, ts);
    tvs = grid.map(function (t) { return 100 * X.termVol(s1, B1, b2, l, T, t); });
    cur = { t: ts, v: 100 * tv };
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Term vol to T*', f(100 * tv, 2) + '%', 'listed ' + f(100 * iv, 0) + '% at 2.0y') +
      ESC.stat('Ratio', f(tv / iv, 3), 'term / listed') +
      ESC.stat('ATM straddle', '$' + f(strad(tv, ts), 2), 'vs $' + f(strad(iv, ts), 2) + ' at listed vol') +
      ESC.stat('Calibrated σ₁', f(100 * s1, 1) + '%', 'slow-factor local vol');
    chV.rebuild();
  }
  var chV = C.make(document.getElementById('v-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Requested expiry T* (years)', yTitle: 'Volatility %', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0; o.scales.x.max = 2;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': ' + f(c.raw.y, 2) + '% at ' + f(c.raw.x, 2) + 'y'; } };
    return { type: 'line', data: { datasets: [
      C.lineDs('Term volatility', tvs.length ? grid.map(function (t, i) { return { x: t, y: +tvs[i].toFixed(3) }; }) : [], 0),
      C.lineDs('Requested expiry', cur ? [{ x: cur.t, y: +cur.v.toFixed(3) }] : [], 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paintV();

  // ---- spark spread (power 30, gas 4, 6 months) ----
  var K = ESC.inputs('k-', ['sp', 'sg', 'r', 'h'], paintK);
  var rhos = [], vals = [], kc = null;
  for (var q = -0.5; q <= 0.9901; q += 0.01) rhos.push(+q.toFixed(2));
  function paintK() {
    var sp = +K.sp.value, sg = +K.sg.value, rho = +K.r.value, h = +K.h.value;
    ESC.out('k-sp', Math.round(100 * sp) + '%');
    ESC.out('k-sg', Math.round(100 * sg) + '%');
    ESC.out('k-r', f(rho, 2));
    ESC.out('k-h', f(h, 1));
    var v = X.margrabe(30, 4, h, 0.5, sp, sg, rho, R), sv = Math.sqrt(Math.max(0, sp * sp + sg * sg - 2 * rho * sp * sg));
    vals = rhos.map(function (r) { return X.margrabe(30, 4, h, 0.5, sp, sg, r, R); });
    kc = { x: rho, y: v };
    document.getElementById('k-stats').innerHTML =
      ESC.stat('Option value', '$' + f(v, 2) + '/MWh', 'intrinsic $' + f(Math.max(0, 30 - h * 4), 2)) +
      ESC.stat('Spread volatility', f(100 * sv, 1) + '%', '√(σP² + σG² − 2ρσPσG)') +
      ESC.stat('Correlation sensitivity', '$' + f((X.margrabe(30, 4, h, 0.5, sp, sg, Math.max(-0.99, rho - 0.05), R) - X.margrabe(30, 4, h, 0.5, sp, sg, Math.min(0.999, rho + 0.05), R)) / 10, 3), 'value lost per +0.01 ρ');
    chK.rebuild();
  }
  var chK = C.make(document.getElementById('k-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Correlation ρ', yTitle: '$/MWh', mode: 'nearest' });
    o.scales.x.type = 'linear'; o.scales.x.min = -0.5; o.scales.x.max = 1;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw.y, 2) + ' at ρ ' + f(c.raw.x, 2); } };
    return { type: 'line', data: { datasets: [
      C.lineDs('Margrabe value', vals.length ? rhos.map(function (r, i) { return { x: r, y: +vals[i].toFixed(3) }; }) : [], 0),
      C.lineDs('Current ρ', kc ? [{ x: kc.x, y: +kc.y.toFixed(3) }] : [], 2, { showLine: false, pointRadius: 7, pointBorderColor: C.v('--surface'), pointBorderWidth: 2 })] }, options: o };
  });
  paintK();
})();
