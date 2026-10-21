/* C11 M4 widget: oil slope, S-curve and Henry Hub-linked LNG */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C11;
  var FEE = 3.10, MARGIN = 0.75, SHIP = 2.50;
  var I = ESC.inputs('f-', ['oil', 'b', 'c', 'lo', 'hi', 'out', 'hh'], paint);
  var OIL = [];
  for (var k = 20; k <= 150; k += 5) OIL.push(k);
  var sc = null, us = 0;
  function paint() {
    ESC.out('f-oil', '$' + I.oil.value);
    ESC.out('f-b', f(+I.b.value, 2) + '%');
    ESC.out('f-c', '$' + f(+I.c.value, 2));
    ESC.out('f-lo', '$' + I.lo.value);
    ESC.out('f-hi', '$' + I.hi.value);
    ESC.out('f-out', f(+I.out.value, 1) + '%');
    ESC.out('f-hh', '$' + f(+I.hh.value, 2));
    var lo = Math.min(+I.lo.value, +I.hi.value), hi = Math.max(+I.lo.value, +I.hi.value);
    sc = { slope: +I.b.value / 100, c: +I.c.value, lo: lo, hi: hi, outer: +I.out.value / 100 };
    var oil = +I.oil.value, line = X.oilLinked(oil, sc.slope, sc.c), s = X.sCurve(oil, sc);
    us = X.usFob(+I.hh.value, FEE) + MARGIN + SHIP;
    var cheaper = s < us ? 'Oil-linked' : 'US LNG';
    document.getElementById('f-stats').innerHTML =
      ESC.stat('Straight slope', '$' + f(line, 3), f(+I.b.value, 2) + '% × $' + oil + ' + $' + f(sc.c, 2)) +
      ESC.stat('With S-curve', '$' + f(s, 3), oil >= lo && oil <= hi ? 'inside the band' : (oil > hi ? 'buyer protected above $' + hi : 'seller protected below $' + lo)) +
      ESC.stat('US LNG delivered Asia', '$' + f(us, 2), '1.15 × HH + fee + margin + shipping') +
      ESC.stat('Cheaper source', cheaper, 'difference $' + f(Math.abs(s - us), 2));
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('f-chart'), function () {
    var o = C.base({ xTitle: 'Crude ($/bbl)', yTitle: '$/MMBtu', legend: true });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); } };
    var s = sc || { slope: 0.1485, c: 0.5, lo: 50, hi: 90, outer: 0.07 };
    return { type: 'line', data: { labels: OIL.map(String), datasets: [
      C.lineDs('Straight slope', OIL.map(function (x) { return +X.oilLinked(x, s.slope, s.c).toFixed(3); }), 0, { borderDash: [5, 4] }),
      C.lineDs('S-curve', OIL.map(function (x) { return +X.sCurve(x, s).toFixed(3); }), 1),
      C.lineDs('US LNG delivered', OIL.map(function () { return +us.toFixed(3); }), 2)] }, options: o };
  });
  paint();
})();
