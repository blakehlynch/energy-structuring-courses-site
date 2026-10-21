/* C4 M1 widget: trading-house funding needs */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var I = ESC.inputs('f-', ['to', 'dio', 'dso', 'dpo', 'vol', 'mv'], paint);
  var r = null, wc = 0, mg = 0;
  function paint() {
    var to = +I.to.value * 1e9, dio = +I.dio.value, dso = +I.dso.value, dpo = +I.dpo.value, vol = +I.vol.value * 1e6, mv = +I.mv.value;
    ESC.out('f-to', '$' + I.to.value + 'bn');
    ['dio', 'dso', 'dpo'].forEach(function (k) { ESC.out('f-' + k, I[k].value + ' d'); });
    ESC.out('f-vol', I.vol.value);
    ESC.out('f-mv', '+$' + I.mv.value);
    wc = Math.max(0, X.workingCapital(to, dio, dso, dpo)); mg = X.marginNeed(vol, mv);
    r = X.fundingHeadroom({ wc: wc, margin: mg, transactional: 2.2e9, rcf: 1.0e9 });
    document.getElementById('f-stats').innerHTML =
      ESC.stat('Working capital', '$' + f(wc / 1e9, 2) + 'bn', '$' + f(to / 365 / 1e6, 0) + 'm per day of cycle') +
      ESC.stat('Stressed margin', '$' + f(mg / 1e6, 0) + 'm', 'variation margin on short hedges') +
      ESC.stat(r.headroom >= 0 ? 'Headroom' : 'Funding gap', '$' + f(Math.abs(r.headroom) / 1e6, 0) + 'm', r.headroom >= 0 ? 'unused committed lines' : 'needs new lines, asset sales or smaller book');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('f-chart'), function () {
    var o = C.base({ legend: true, mode: 'index', yTitle: '$ bn' });
    o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2) + 'bn'; } };
    var g = function (lab, d, i) { return C.barDs(lab, d, i, { stack: 's', borderRadius: 0, maxBarThickness: 90, borderColor: C.v('--surface'), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 } }); };
    return { type: 'bar', data: { labels: ['Needs', 'Facilities'], datasets: [
      g('Working capital', [+(wc / 1e9).toFixed(3), 0], 0), g('Margin calls', [+(mg / 1e9).toFixed(3), 0], 3),
      g('Transactional lines', [0, 2.2], 1), g('Committed revolver', [0, 1.0], 2)] }, options: o };
  });
  paint();
})();
