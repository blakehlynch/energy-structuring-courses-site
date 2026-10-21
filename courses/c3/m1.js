/* C3 M1 widget: grade differential builder */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;
  var ids = ['api', 'vapi', 's', 'vs', 'fb', 'fg'];
  var I = ESC.inputs('g-', ids, paint);
  function sgn(x, d) { return (x >= 0 ? '+' : '−') + f(Math.abs(x), d); }
  var parts = [0, 0, 0, 0];
  function paint() {
    var api = +I.api.value, vapi = +I.vapi.value, s = +I.s.value, vs = +I.vs.value, fb = +I.fb.value, fg = +I.fg.value;
    ESC.out('g-api', sgn(api, 1));
    ESC.out('g-vapi', '$' + f(vapi, 2));
    ESC.out('g-s', sgn(s, 2) + '%');
    ESC.out('g-vs', '$' + f(vs, 2));
    ESC.out('g-fb', '$' + f(fb, 2));
    ESC.out('g-fg', '$' + f(fg, 2));
    var qApi = api * vapi, qS = -s * vs, quality = qApi + qS;
    var fob = X.relativeFob({ benchFob: 80, qualityAdj: quality, freightBench: fb, freightGrade: fg }), diff = fob - 80;
    parts = [qApi, qS, fb - fg, diff];
    document.getElementById('g-stats').innerHTML =
      ESC.stat('Quality value', sgn(quality, 2), 'gravity ' + sgn(qApi, 2) + ', sulphur ' + sgn(qS, 2)) +
      ESC.stat('Freight advantage', sgn(fb - fg, 2), 'marker freight minus grade freight') +
      ESC.stat('Differential to marker', sgn(diff, 2) + ' $/bbl', 'FOB value $' + f(fob, 2) + ' with marker at $80');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('g-chart'), function () {
    var labels = ['Gravity', 'Sulphur', 'Freight', 'Differential'];
    var o = C.base({ yTitle: '$/bbl', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return sgn(c.raw, 2) + ' $/bbl'; } };
    var cols = parts.map(function (p, i) { return i === 3 ? C.series(0) : (p >= 0 ? C.series(1) : C.series(3)); });
    return { type: 'bar', data: { labels: labels, datasets: [C.barDs('Contribution', parts.map(function (p) { return +p.toFixed(3); }), 0, { backgroundColor: cols, borderSkipped: false })] }, options: o };
  });
  paint();
})();
