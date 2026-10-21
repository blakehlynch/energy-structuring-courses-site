/* C4 M6 widget: receivables securitisation loss layers */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var I = ESC.inputs('s-', ['pool', 'def', 'lgd', 'dil', 'sub', 'res'], paint);
  var t = null, cap = null;
  function paint() {
    var pool = +I.pool.value * 1e6, def = +I.def.value, lgd = +I.lgd.value, dil = +I.dil.value, sub = +I.sub.value, res = +I.res.value * 1e6;
    ESC.out('s-pool', '$' + I.pool.value + 'm');
    ESC.out('s-def', Math.round(100 * def) + '%');
    ESC.out('s-lgd', Math.round(100 * lgd) + '%');
    ESC.out('s-dil', f(100 * dil, 1) + '%');
    ESC.out('s-sub', Math.round(100 * sub) + '%');
    ESC.out('s-res', '$' + I.res.value + 'm');
    var loss = X.poolLoss(pool, def, lgd, dil);
    t = X.tranches(loss, pool, sub, res);
    cap = { res: res, jr: pool * sub, sr: pool * (1 - sub) };
    document.getElementById('s-stats').innerHTML =
      ESC.stat('Pool loss', '$' + f(loss / 1e6, 1) + 'm', f(100 * loss / pool, 1) + '% of pool') +
      ESC.stat('Junior loss', '$' + f(t.junior / 1e6, 1) + 'm', f(100 * t.junior / Math.max(cap.jr, 1), 0) + '% of junior notes') +
      ESC.stat('Senior loss', '$' + f(t.senior / 1e6, 1) + 'm', t.senior > 0 ? f(100 * t.seniorPct, 1) + '% of senior notes' : 'senior notes intact');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('s-chart'), function () {
    var o = C.base({ legend: true, mode: 'index', yTitle: '$ m' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 1) + 'm'; } };
    var lost = t ? [t.reserve, t.junior, t.senior] : [0, 0, 0], caps = cap ? [cap.res, cap.jr, cap.sr] : [0, 0, 0];
    var g = function (lab, d, i, extra) { return C.barDs(lab, d.map(function (x) { return +(x / 1e6).toFixed(2); }), i, Object.assign({ stack: 's', borderRadius: 0, maxBarThickness: 70, borderColor: C.v('--surface'), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 } }, extra || {})); };
    return { type: 'bar', data: { labels: ['Cash reserve', 'Junior notes', 'Senior notes'], datasets: [
      g('Loss absorbed', lost, 3),
      g('Remaining', [caps[0] - lost[0], caps[1] - lost[1], caps[2] - lost[2]], 0, { backgroundColor: C.wash(C.series(0), 0.35) })] }, options: o };
  });
  paint();
})();
