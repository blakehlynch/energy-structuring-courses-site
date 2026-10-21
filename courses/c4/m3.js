/* C4 M3 widget: borrowing-base calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C4;
  var I = ESC.inputs('b-', ['inv', 'hdg', 'lc', 'ins', 'oth', 'shk', 'drw'], paint);
  var parts = [], drawn = 0, base = 0;
  function paint() {
    var inv = +I.inv.value * 1e6, hdg = +I.hdg.value, lc = +I.lc.value * 1e6, ins = +I.ins.value * 1e6, oth = +I.oth.value * 1e6, shk = +I.shk.value; drawn = +I.drw.value;
    ['inv', 'lc', 'ins', 'oth', 'drw'].forEach(function (k) { ESC.out('b-' + k, '$' + I[k].value + 'm'); });
    ESC.out('b-hdg', Math.round(100 * hdg) + '%');
    ESC.out('b-shk', (shk >= 0 ? '+' : '−') + Math.round(100 * Math.abs(shk)) + '%');
    var items = [
      { name: 'Hedged stock', value: inv * hdg, advance: 0.90, priceExposed: false },
      { name: 'Unhedged stock', value: inv * (1 - hdg), advance: 0.70, priceExposed: true },
      { name: 'LC receivables', value: lc, advance: 0.95, priceExposed: false },
      { name: 'Insured receivables', value: ins, advance: 0.85, priceExposed: false },
      { name: 'Other receivables', value: oth, advance: 0.60, priceExposed: false },
      { name: 'Cash', value: 20e6, advance: 1.0, priceExposed: false }];
    base = X.borrowingBaseShock(items, shk) / 1e6;
    parts = items.map(function (it) { return { name: it.name, v: it.value * (it.priceExposed ? 1 + shk : 1) * it.advance / 1e6 }; });
    var gross = items.reduce(function (a, it) { return a + it.value * (it.priceExposed ? 1 + shk : 1); }, 0) / 1e6;
    document.getElementById('b-stats').innerHTML =
      ESC.stat('Borrowing base', '$' + f(base, 1) + 'm', 'from $' + f(gross, 0) + 'm gross collateral') +
      ESC.stat('Blended advance rate', f(100 * base / Math.max(gross, 1e-9), 1) + '%', 'weighted by collateral mix') +
      ESC.stat(base >= drawn ? 'Headroom' : 'Shortfall', '$' + f(Math.abs(base - drawn), 1) + 'm', base >= drawn ? 'available to draw' : 'repay or add collateral');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('b-chart'), function () {
    var o = C.base({ legend: true, mode: 'index', yTitle: '$ m' });
    o.indexAxis = 'y'; o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 1) + 'm'; } };
    var ds = parts.map(function (p, i) { return C.barDs(p.name, [+p.v.toFixed(2), 0], i, { stack: 's', borderRadius: 0, maxBarThickness: 40, borderColor: C.v('--surface'), borderWidth: { left: 0, right: 2, top: 0, bottom: 0 } }); });
    ds.push(C.barDs('Drawn', [0, drawn], 7, { stack: 's', borderRadius: 0, maxBarThickness: 40, backgroundColor: C.v('--muted') }));
    return { type: 'bar', data: { labels: ['Borrowing base', 'Drawn'], datasets: ds }, options: o };
  });
  paint();
})();
