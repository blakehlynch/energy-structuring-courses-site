/* C4 M4 widget: prepayment cash waterfall */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var I = ESC.inputs('p-', ['amt', 'ten', 'rate', 'vol', 'px', 'shk', 'top'], paint);
  var res = null;
  function paint() {
    var amt = +I.amt.value * 1e6, ten = +I.ten.value, rate = +I.rate.value, vol = +I.vol.value * 1e3, px = +I.px.value, shk = +I.shk.value, top = +I.top.value;
    ESC.out('p-amt', '$' + I.amt.value + 'm');
    ESC.out('p-ten', ten);
    ESC.out('p-rate', f(100 * rate, 2) + '%');
    ESC.out('p-vol', I.vol.value);
    ESC.out('p-px', '$' + px);
    ESC.out('p-shk', Math.round(100 * shk) + '%');
    ESC.out('p-top', Math.round(100 * top) + '%');
    var prices = []; for (var m = 0; m < ten; m++) prices.push(px * (1 - shk * Math.min(1, m / 6)));
    res = X.prepaySchedule({ amount: amt, ratePa: rate, months: ten, volume: vol, prices: prices, topUp: true, maxTopUpPct: top });
    var be = X.breakevenPrice(res.payment, vol);
    document.getElementById('p-stats').innerHTML =
      ESC.stat('Debt service', '$' + f(res.payment / 1e6, 2) + 'm/mo', 'breakeven price $' + f(be, 2)) +
      ESC.stat('Cover at signing', f(vol * px / res.payment, 2) + '×', 'contract value $' + f(vol * px * ten / 1e6, 0) + 'm') +
      ESC.stat('Minimum cover', f(res.minCover, 2) + '×', 'after top-ups') +
      ESC.stat(res.shortfall > 1 ? 'Uncovered shortfall' : 'Top-up volume', res.shortfall > 1 ? '$' + f(res.shortfall / 1e6, 1) + 'm' : f(res.topUpVolume / 1e3, 0) + ' kbbl', res.shortfall > 1 ? 'reserve / extension / risk-sharing' : 'extra barrels over the tenor');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('p-chart'), function () {
    var rows = res ? res.rows : [];
    var o = C.base({ legend: true, mode: 'index', xTitle: 'Month', yTitle: '$ m' });
    o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2) + 'm'; } };
    return { type: 'bar', data: { labels: rows.map(function (r) { return r.month; }), datasets: [
      C.barDs('Contract deliveries', rows.map(function (r) { return +((r.revenue - r.topUp * r.price) / 1e6).toFixed(3); }), 0, { stack: 'v', borderRadius: 0, maxBarThickness: 18 }),
      C.barDs('Top-up deliveries', rows.map(function (r) { return +(r.topUp * r.price / 1e6).toFixed(3); }), 1, { stack: 'v', borderRadius: 0, maxBarThickness: 18 }),
      Object.assign(C.lineDs('Debt service', rows.map(function (r) { return +(r.debtService / 1e6).toFixed(3); }), 3), { type: 'line', stepped: true, stack: 'ds' })] }, options: o };
  });
  paint();
})();
