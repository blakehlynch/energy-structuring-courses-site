/* C7 M1 widget: Asian versus European */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C7;
  var I = ESC.inputs('a-', ['v', 's', 'n', 'k'], paint);
  var F = 4.7, xs = [], as = [], es = [];
  function vals(v, sm, n, K) {
    var t = X.dailyFixings(sm === 0 ? 1 / 365 : sm / 12, n), Tp = t[0] + 1 / 12;
    return { a: X.asianLevy(F, K, t, v, 0.04, Tp), e: X.black76(F, K, t[n - 1], v, 0.04, 'call'), veq: X.asianVolEquiv(t, v) };
  }
  function paint() {
    var v = +I.v.value, sm = +I.s.value, n = +I.n.value, k = +I.k.value, K = F * k;
    ESC.out('a-v', Math.round(100 * v) + '%');
    ESC.out('a-s', sm);
    ESC.out('a-n', n);
    ESC.out('a-k', f(k, 2) + ' ($' + f(K, 2) + ')');
    var r = vals(v, sm, n, K);
    xs = []; as = []; es = [];
    for (var m = 0; m <= 18; m++) { var q = vals(v, m, n, K); xs.push(m); as.push(q.a); es.push(q.e); }
    document.getElementById('a-stats').innerHTML =
      ESC.stat('Asian call', '$' + f(r.a, 4), 'Levy moment match') +
      ESC.stat('European call', '$' + f(r.e, 4), 'expiring at the last fixing') +
      ESC.stat('Asian / European', f(100 * r.a / r.e, 0) + '%', 'equivalent vol ' + f(100 * r.veq, 1) + '%');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('a-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Months until averaging starts', yTitle: '$/MMBtu' });
    o.plugins.tooltip.callbacks = { title: function (c) { return c[0].label + ' months'; }, label: function (c) { return c.dataset.label + ': $' + f(c.raw, 4); } };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('Asian', as.map(function (x) { return +x.toFixed(4); }), 0, { pointRadius: 2 }), C.lineDs('European', es.map(function (x) { return +x.toFixed(4); }), 2, { pointRadius: 2 })] }, options: o };
  });
  paint();
})();
