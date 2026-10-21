/* C1 M4 widget: disruption shock simulator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C1;
  var H = { sr: [0.04, -0.06], mr: [0.15, -0.12], lr: [0.35, -0.25] };
  var I = {}; ['dis', 'spare', 'share', 'spr', 'stk', 'h', 'p0', 'cap'].forEach(function (k) { I[k] = document.getElementById('k-' + k); I[k].addEventListener(k === 'h' ? 'change' : 'input', paint); });
  function params(dis) {
    var e = H[I.h.value];
    return { base: 102, disruption: dis, spare: +I.spare.value, spareShare: +I.share.value, spr: +I.spr.value, stocks: +I.stk.value, eS: e[0], eD: e[1], cap: +I.cap.value / +I.p0.value };
  }
  function paint() {
    ESC.out('k-dis', f(+I.dis.value, 1));
    ESC.out('k-spare', f(+I.spare.value, 1));
    ESC.out('k-share', Math.round(100 * I.share.value) + '%');
    ESC.out('k-spr', f(+I.spr.value, 1));
    ESC.out('k-stk', f(+I.stk.value, 1));
    ESC.out('k-p0', '$' + I.p0.value);
    ESC.out('k-cap', '$' + I.cap.value);
    var r = X.shockScenario(params(+I.dis.value)), p0 = +I.p0.value;
    var capped = r.constElast >= (+I.cap.value / p0 - 1) - 1e-9 && r.frac > 0;
    document.getElementById('k-stats').innerHTML =
      ESC.stat('Net shortfall', f(r.net.net, 2) + ' mb/d', f(100 * r.frac, 2) + '% of 102 mb/d') +
      ESC.stat('Absorbed by buffers', f(r.net.fromSpare + r.net.fromSPR + r.net.fromStocks, 2) + ' mb/d', 'spare ' + f(r.net.fromSpare, 2) + ' · SPR ' + f(r.net.fromSPR, 2) + ' · stocks ' + f(r.net.fromStocks, 2)) +
      ESC.stat('Price (linear approx.)', '$' + f(p0 * (1 + r.linear), 0), '+' + f(100 * r.linear, 1) + '%') +
      ESC.stat('Price (constant elasticity)', '$' + f(p0 * (1 + r.constElast), 0), '+' + f(100 * r.constElast, 1) + '%' + (capped ? ' · at ceiling' : ''));
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('k-chart'), function () {
    var xs = []; for (var d = 0; d <= 20; d += 1) xs.push(d);
    var p0 = +I.p0.value;
    var lin = xs.map(function (d) { return +(p0 * (1 + X.shockScenario(params(d)).linear)).toFixed(1); });
    var ce = xs.map(function (d) { return +(p0 * (1 + X.shockScenario(params(d)).constElast)).toFixed(1); });
    var o = C.base({ legend: true, mode: 'index', xTitle: 'Gross disruption (mb/d)', yTitle: 'Post-shock price ($/bbl)' });
    o.plugins.tooltip.callbacks = { title: function (it) { return it[0].label + ' mb/d disrupted'; }, label: function (c) { return c.dataset.label + ': $' + f(c.raw, 0); } };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('Constant elasticity', ce, 0), C.lineDs('Linear approximation', lin, 1)] }, options: o };
  });
  paint();
})();
