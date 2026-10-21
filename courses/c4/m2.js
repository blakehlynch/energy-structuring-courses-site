/* C4 M2 widget: LC discounting calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var I = ESC.inputs('d-', ['face', 'days', 'base', 'mrg', 'conv'], paint, ['input', 'change']);
  var rate = 0;
  function paint() {
    var face = +I.face.value * 1e6, days = +I.days.value; rate = +I.base.value + +I.mrg.value;
    ESC.out('d-face', '$' + I.face.value + 'm');
    ESC.out('d-days', days);
    ESC.out('d-base', f(100 * +I.base.value, 2) + '%');
    ESC.out('d-mrg', f(100 * +I.mrg.value, 2) + '%');
    var straight = I.conv.value === 'straight';
    var p = straight ? X.straightDiscount(face, rate, days) : X.discountToYield(face, rate, days);
    var y = X.impliedYield(face, p, days);
    document.getElementById('d-stats').innerHTML =
      ESC.stat('Cash today', '$' + f(p / 1e6, 3) + 'm', 'at ' + f(100 * rate, 2) + '% ' + (straight ? 'straight discount' : 'to yield')) +
      ESC.stat('Cost of early cash', '$' + f((face - p) / 1e3, 0) + 'k', f(100 * (face - p) / face, 2) + '% of face') +
      ESC.stat('True yield to buyer', f(100 * y, 2) + '%', 'simple, actual/360');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('d-chart'), function () {
    var ten = []; for (var d = 30; d <= 360; d += 30) ten.push(d);
    var o = C.base({ legend: true, xTitle: 'Days to maturity', yTitle: 'Proceeds per $100' });
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); } };
    return { type: 'line', data: { labels: ten, datasets: [
      C.lineDs('Straight discount', ten.map(function (d) { return +X.straightDiscount(100, rate, d).toFixed(3); }), 0),
      C.lineDs('Discount to yield', ten.map(function (d) { return +X.discountToYield(100, rate, d).toFixed(3); }), 1)] }, options: o };
  });
  paint();
})();
