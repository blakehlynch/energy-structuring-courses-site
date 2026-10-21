/* Module 4 widgets: crack calculator + margin waterfall; crack hedge simulator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C2;
  function money(v, d) { return (v < 0 ? '−$' : '$') + f(Math.abs(v), d === undefined ? 2 : d); }

  // ---------- crack calculator ----------
  var K = ESC.inputs('k-', ['crude', 'gas', 'dsl', 'fo', 'var', 'fix', 'fy'], paintK);
  var recipe = document.getElementById('k-recipe'); recipe.addEventListener('change', paintK);
  var wf = null;
  function paintK() {
    var crude = +K.crude.value, g = +K.gas.value, d = +K.dsl.value, fo = +K.fo.value, vc = +K.var.value, fc = +K.fix.value, fy = +K.fy.value / 100;
    ESC.out('k-crude', '$' + f(crude, 2));
    ESC.out('k-gas', '$' + f(g, 2) + ' (' + f(g * 42, 2) + '/bbl)');
    ESC.out('k-dsl', '$' + f(d, 2) + ' (' + f(d * 42, 2) + '/bbl)');
    ESC.out('k-fo', '$' + f(fo, 2));
    ESC.out('k-var', '$' + f(vc, 2));
    ESC.out('k-fix', '$' + f(fc, 2));
    ESC.out('k-fy', f(fy * 100, 0) + '%');
    var r = recipe.value.split(',').map(Number);
    var gb = X.perBblFromPerGal(g), db = X.perBblFromPerGal(d);
    var crack = X.crack(r[0], [{ n: r[1], price: gb }, { n: r[2], price: db }, { n: r[3], price: fo }], crude);
    var rest = 1.01 - 0.03 - 0.10 - fy;
    var yields = { lpg: 0.03, gasoline: rest * 5 / 8, jet: 0.10, diesel: rest * 3 / 8, fuelOil: fy };
    var prices = { lpg: X.perBblFromPerGal(0.80), gasoline: gb, jet: X.perBblFromPerGal(d - 0.10), diesel: db, fuelOil: fo };
    var ms = X.marginStack({ yields: yields, prices: prices, crude: crude, variable: vc, fixed: fc });
    wf = ms; wf.crude = crude; wf.vc = vc; wf.fc = fc;
    var name = recipe.options[recipe.selectedIndex].text.split(' ')[0];
    document.getElementById('k-stats').innerHTML =
      ESC.stat(name + ' crack', money(crack), 'per bbl of crude') +
      ESC.stat('Gasoline / diesel crack', money(gb - crude) + ' / ' + money(db - crude), 'single-product cracks') +
      ESC.stat('Plant gross margin', money(ms.gross), 'GPW ' + money(ms.gpw) + ' − crude') +
      ESC.stat('Plant netback', money(ms.netback), 'after variable and fixed costs') +
      ESC.stat('Crack − plant gross margin', money(crack - ms.gross), 'gap from yields and by-products');
    if (wfChart) wfChart.rebuild();
  }
  var wfChart = C.make(document.getElementById('k-chart'), function () {
    var m = wf || { gpw: 0, crude: 0, vc: 0, fc: 0, netback: 0, gross: 0, net: 0 };
    var labels = ['Gross product worth', 'Crude', 'Gross margin', 'Variable cost', 'Fixed cost', 'Netback'];
    var totals = [[0, m.gpw], null, [0, m.gross], null, null, [0, m.netback]];
    var costs = [null, [m.gross, m.gpw], null, [m.net, m.gross], [m.netback, m.net], null];
    var o = C.base({ legend: true, mode: 'index', yTitle: '$ per bbl of crude' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { if (!c.raw) return null; var v = c.raw[1] - c.raw[0]; return c.dataset.label + ': $' + f(v, 2); } };
    return { type: 'bar', data: { labels: labels, datasets: [
      C.barDs('Value / subtotal', totals, 0, { borderSkipped: false, borderRadius: 4 }),
      C.barDs('Cost deducted', costs, 1, { borderSkipped: false, borderRadius: 4 })
    ] }, options: Object.assign(o, { datasets: { bar: { grouped: false } } }) };
  });
  paintK();

  // ---------- hedge simulator ----------
  var H = ESC.inputs('h-', ['x0', 'mu', 'hl', 'sig', 'opex', 'h'], schedule);
  var VOL = 150000 * 365 / 12, sim = null, timer = null;
  function schedule() { label(); clearTimeout(timer); timer = setTimeout(run, 60); }
  function label() {
    ESC.out('h-x0', '$' + f(+H.x0.value, 1));
    ESC.out('h-mu', '$' + f(+H.mu.value, 1));
    ESC.out('h-hl', H.hl.value + ' mo');
    ESC.out('h-sig', '$' + H.sig.value);
    ESC.out('h-opex', '$' + f(+H.opex.value, 1));
    ESC.out('h-h', Math.round(100 * H.h.value) + '%');
  }
  function run() {
    var kappa = Math.log(2) / (+H.hl.value / 12);
    sim = X.hedgeOutcomes({ x0: +H.x0.value, mu: +H.mu.value, kappa: kappa, sigma: +H.sig.value, months: 12, volume: VOL, opex: +H.opex.value, hedge: +H.h.value, n: 2000, seed: 20261018 });
    sim.u = X.stats(sim.unhedged.map(function (v) { return v / 1e6; }));
    sim.hh = X.stats(sim.hedged.map(function (v) { return v / 1e6; }));
    document.getElementById('h-stats').innerHTML =
      ESC.stat('Expected margin', '$' + f(sim.u.mean, 0) + 'm', 'unhedged ≈ hedged ($' + f(sim.hh.mean, 0) + 'm): swaps sold at fair value') +
      ESC.stat('Std deviation', '$' + f(sim.u.sd, 0) + 'm → $' + f(sim.hh.sd, 0) + 'm', 'unhedged → hedged') +
      ESC.stat('5th percentile', '$' + f(sim.u.p5, 0) + 'm → $' + f(sim.hh.p5, 0) + 'm', 'bad-year margin') +
      ESC.stat('P(annual margin < 0)', f(100 * sim.u.probNeg, 1) + '% → ' + f(100 * sim.hh.probNeg, 1) + '%', 'unhedged → hedged');
    paths.rebuild(); hist.rebuild();
  }
  var paths = C.make(document.getElementById('h-paths'), function () {
    var ds = [];
    if (sim) {
      sim.samplePaths.forEach(function (p, i) {
        ds.push(C.lineDs(i === 0 ? 'Sample simulated paths' : '_path' + i, [+H.x0.value].concat(p), 0, { borderColor: C.wash(C.v('--muted'), 0.55), backgroundColor: C.v('--muted'), borderWidth: 1, pointHoverRadius: 0 }));
      });
      ds.push(C.lineDs('Swap level sold (fair forward)', [+H.x0.value].concat(sim.swapLevels), 1, { borderWidth: 2 }));
      ds.push(C.lineDs('Long-run level', new Array(13).fill(+H.mu.value), 2, { borderWidth: 2 }));
    }
    var o = C.base({ legend: true, mode: 'nearest', xTitle: 'Month', yTitle: 'Crack, $/bbl' });
    o.plugins.legend.labels.filter = function (it) { return it.text.charAt(0) !== '_'; };
    o.plugins.tooltip.filter = function (it) { return it.dataset.label.charAt(0) !== '_'; };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': $' + f(c.raw, 2); } };
    return { type: 'line', data: { labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], datasets: ds }, options: o };
  });
  var hist = C.make(document.getElementById('h-hist'), function () {
    if (!sim) return { type: 'bar', data: { labels: [], datasets: [] }, options: C.base({}) };
    var all = sim.unhedged.concat(sim.hedged).map(function (v) { return v / 1e6; });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), nb = 24, w = (hi - lo) / nb || 1;
    var bins = function (arr) { var b = new Array(nb).fill(0); arr.forEach(function (v) { var i = Math.min(nb - 1, Math.floor((v / 1e6 - lo) / w)); b[i]++; }); return b.map(function (c) { return 100 * c / arr.length; }); };
    var labels = []; for (var i = 0; i < nb; i++) labels.push(f(lo + (i + 0.5) * w, 0));
    var o = C.base({ legend: true, mode: 'index', xTitle: 'Annual margin over variable cost, $ million', yTitle: '% of paths' });
    o.scales.x.grid = { display: false };
    o.plugins.tooltip.callbacks = { title: function (it) { return '≈ $' + it[0].label + 'm'; }, label: function (c) { return c.dataset.label + ': ' + f(c.raw, 1) + '%'; } };
    return { type: 'bar', data: { labels: labels, datasets: [C.barDs('Unhedged', bins(sim.unhedged), 0, { maxBarThickness: 12 }), C.barDs('Hedged', bins(sim.hedged), 1, { maxBarThickness: 12 })] }, options: o };
  });
  label(); run();
})();
