/* C5 M5 widget: missing-money calculator for a peaker */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var VC = 92.5;
  var I = ESC.inputs('m-', ['oc', 'r', 'cap', 'h', 'eas'], paint);
  var fc = 0, sr = 0, eas = 0, mm = 0;
  function paint() {
    var oc = +I.oc.value, r = +I.r.value, cap = +I.cap.value, h = +I.h.value; eas = +I.eas.value * 1000;
    ESC.out('m-oc', '$' + oc);
    ESC.out('m-r', f(100 * r, 1) + '%');
    ESC.out('m-cap', '$' + f(cap, 0));
    ESC.out('m-h', h);
    ESC.out('m-eas', '$' + I.eas.value + 'k');
    fc = X.annualFixed(oc, r, 30, 10); sr = X.scarcityRevenue(cap, VC, h); mm = X.missingMoney(fc, sr + eas);
    var need = (fc - eas) / Math.max(1e-9, cap - VC);
    document.getElementById('m-stats').innerHTML =
      ESC.stat('Fixed cost', '$' + f(fc / 1e3, 1) + 'k', 'per MW-year') +
      ESC.stat('Scarcity revenue', '$' + f(sr / 1e3, 1) + 'k', h + ' h at $' + f(cap, 0)) +
      ESC.stat('Missing money', '$' + f(mm / 1e3, 1) + 'k', '≈ $' + f(mm / 365, 0) + '/MW-day capacity price') +
      ESC.stat('Break-even scarcity hours', f(Math.max(0, need), 1), 'at this cap');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('m-chart'), function () {
    var o = C.base({ legend: true, mode: 'index', yTitle: '$k per MW-year' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 1) + 'k'; } };
    var g = function (lab, d, i) { return C.barDs(lab, d.map(function (x) { return +(x / 1e3).toFixed(2); }), i, { stack: 's', borderRadius: 0, maxBarThickness: 90, borderColor: C.v('--surface'), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 } }); };
    return { type: 'bar', data: { labels: ['Cost', 'Revenue'], datasets: [
      g('Fixed cost', [fc, 0], 4), g('Other energy & ancillary', [0, Math.min(eas, fc)], 0), g('Scarcity rent', [0, Math.min(sr, Math.max(0, fc - eas))], 1), g('Missing money', [0, mm], 3)] }, options: o };
  });
  paint();
})();
