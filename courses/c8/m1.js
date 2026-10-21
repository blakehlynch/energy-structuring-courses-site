/* C8 M1 widget: the value of waiting */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C8;
  var I = ESC.inputs('w-', ['u', 'd', 'i', 'q'], paint);
  function money(x) { return (x < 0 ? '−$' : '$') + f(Math.abs(x), 2); }
  var xs = [], now = [], wait = [];
  function paint() {
    var u = +I.u.value, d = +I.d.value, inv = +I.i.value, q = +I.q.value;
    ESC.out('w-u', '$' + u);
    ESC.out('w-d', '$' + d);
    ESC.out('w-i', '$' + inv);
    ESC.out('w-q', f(q, 2));
    var r = X.waitExample({ P0: 50, up: u, down: d, q: q, I: inv, r: 0.08 });
    xs = []; now = []; wait = [];
    for (var c = 200; c <= 1000; c += 20) { var s = X.waitExample({ P0: 50, up: u, down: d, q: q, I: c, r: 0.08 }); xs.push(c); now.push(+s.npvNow.toFixed(2)); wait.push(+s.npvWait.toFixed(2)); }
    document.getElementById('w-stats').innerHTML =
      ESC.stat('NPV of investing now', money(r.npvNow), 'value $' + f(r.V0, 2)) +
      ESC.stat('NPV of waiting a year', money(r.npvWait), 'invest only if up') +
      ESC.stat('Value of the option to wait', money(r.option), r.option > 0 ? 'wait' : 'invest now');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('w-chart'), function () {
    var o = C.base({ legend: true, xTitle: 'Investment cost ($)', yTitle: 'NPV ($)' });
    o.plugins.tooltip.callbacks = { title: function (c) { return 'Cost $' + c[0].label; }, label: function (c) { return c.dataset.label + ': ' + money(c.raw); } };
    o.scales.x.ticks.callback = function (v, i) { return xs[i] % 200 === 0 ? '$' + xs[i] : null; };
    return { type: 'line', data: { labels: xs, datasets: [C.lineDs('Invest now', now, 0), C.lineDs('Wait a year', wait, 2)] }, options: o };
  });
  paint();
})();
