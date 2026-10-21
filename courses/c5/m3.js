/* C5 M3 widget: two-settlement calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C5;
  var I = ESC.inputs('t-', ['q', 'pda', 'act', 'prt'], paint);
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x), 0); }
  var r = null;
  function paint() {
    var q = +I.q.value, pda = +I.pda.value, act = +I.act.value, prt = +I.prt.value;
    ESC.out('t-q', q);
    ESC.out('t-pda', '$' + pda);
    ESC.out('t-act', act);
    ESC.out('t-prt', '$' + prt);
    r = X.twoSettlement({ daQ: q, daP: pda, actual: act, rtP: prt });
    var dev = act - q;
    document.getElementById('t-stats').innerHTML =
      ESC.stat('Day-ahead settlement', money(r.da), q + ' MWh at $' + pda) +
      ESC.stat('Real-time settlement', money(r.rt), (dev >= 0 ? 'sold ' : 'bought ') + Math.abs(dev) + ' MWh at $' + prt) +
      ESC.stat('Total', money(r.total), act > 0 ? 'realised $' + f(r.avg, 2) + '/MWh' : 'no output');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('t-chart'), function () {
    var o = C.base({ yTitle: '$', mode: 'nearest' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return money(c.raw); } };
    var d = r ? [r.da, r.rt, r.total] : [0, 0, 0];
    return { type: 'bar', data: { labels: ['Day-ahead', 'Real-time', 'Total'], datasets: [C.barDs('Settlement', d.map(function (x) { return Math.round(x); }), 0, { backgroundColor: [C.series(0), C.series(1), C.series(2)], borderSkipped: false })] }, options: o };
  });
  paint();
})();
