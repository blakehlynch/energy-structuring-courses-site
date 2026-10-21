/* Module 3 widget: refinery builder (Nelson index + stylised yields) */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C2;
  var ids = ['adu', 'vdu', 'fcc', 'hc', 'coker', 'ref', 'ht', 'alk'];
  var inputs = ESC.inputs('r-', ids, paint);
  var crudeSel = document.getElementById('r-crude'); crudeSel.addEventListener('change', paint);
  var PRODUCTS = [['gasoline', 'Gasoline'], ['jet', 'Jet/kero'], ['diesel', 'Diesel'], ['lpg', 'LPG'], ['fuelOil', 'Fuel oil*'], ['coke', 'Coke†']];
  var cur = null, base = null;
  function caps() { var c = {}; ids.forEach(function (k) { c[k] = +inputs[k].value; }); return c; }
  function paint() {
    var c = caps();
    ids.forEach(function (k) { ESC.out('r-' + k, c[k] + ' kb/d'); });
    var cf = X.OGJ_CF;
    var units = ['vdu', 'fcc', 'hc', 'coker', 'ref', 'ht', 'alk'].map(function (k) { return { cap: c[k], cf: cf[k] }; });
    var ci = X.nelsonIndex(c.adu, units);
    var conv = X.conversionCapacity(c.adu, c.fcc, c.hc, c.coker);
    var crude = X.CRUDES[crudeSel.value];
    cur = X.stylizedYields(crude, c.adu, { vdu: c.vdu, fcc: c.fcc, hc: c.hc, coker: c.coker, alk: c.alk });
    base = X.stylizedYields(crude, c.adu, { vdu: 0, fcc: 0, hc: 0, coker: 0, alk: 0 });
    var frac = function (y) { var o = {}; PRODUCTS.forEach(function (p) { o[p[0]] = y[p[0]] / 100; }); return o; };
    var gpw = X.gpw(frac(cur), X.REF_PRICES), gpw0 = X.gpw(frac(base), X.REF_PRICES);
    var light = cur.gasoline + cur.jet + cur.diesel;
    var warn = [];
    if (c.vdu < (crude.vgo + crude.resid) / 100 * c.adu && (c.fcc + c.hc + c.coker) > 0) warn.push('vacuum unit too small to feed conversion fully');
    if (c.fcc + c.hc > c.vdu + 1e-9 && c.vdu > 0) warn.push('cracking capacity exceeds vacuum capacity');
    var distill = (cur.gasoline + cur.jet + cur.diesel) / 100 * c.adu;
    if (crude.sour && c.ht === 0) warn.push('no hydrotreating: sour crude cannot make on-spec fuels');
    else if (crude.sour && c.ht < 0.7 * distill) warn.push('hydrotreating looks short for a sour diet (products may miss sulfur specs)');
    document.getElementById('r-stats').innerHTML =
      ESC.stat('Nelson index', f(ci, 2), X.classify(ci)) +
      ESC.stat('Conversion capacity', f(100 * conv, 0) + '%', '(FCC + HC + coker) / crude unit') +
      ESC.stat('Light products', f(light, 1) + '%', 'gasoline + jet + diesel, vol% of crude') +
      ESC.stat('Fuel oil', f(cur.fuelOil, 1) + '%', 'vs ' + f(base.fuelOil, 1) + '% with no conversion') +
      ESC.stat('Gross product worth', '$' + f(gpw, 2) + '/bbl', '+$' + f(gpw - gpw0, 2) + ' vs no conversion, at reference prices') +
      (warn.length ? ESC.stat('Check', '⚠', warn.join('; ')) : '');
    document.getElementById('r-table').innerHTML =
      '<p>Reference prices ($/bbl): ' + Object.keys(X.REF_PRICES).map(function (k) { return k + ' ' + X.REF_PRICES[k]; }).join(', ') +
      '. FCC per bbl VGO: 58% gasoline, 18% diesel, 20% LPG, 8% fuel oil (4% volume gain). Hydrocracker per bbl VGO: 25% naphtha/gasoline, 85% jet/diesel (10% gain). Coker per bbl residue: 15% naphtha, 30% gasoil, 25% VGO (recycled to crackers), 5% LPG, 25% coke. Alkylation converts up to 60% of FCC LPG into gasoline. Reformer and hydrotreaters change quality (octane, sulfur), not volumes, in this model.</p>' +
      '<table><tr><th>Product</th><th class="num">Configured, vol%</th><th class="num">No conversion, vol%</th></tr>' +
      PRODUCTS.map(function (p) { return '<tr><td>' + p[1] + '</td><td class="num">' + f(cur[p[0]], 1) + '</td><td class="num">' + f(base[p[0]], 1) + '</td></tr>'; }).join('') +
      '<tr><td>Total (volume gain above 100)</td><td class="num">' + f(cur.total, 1) + '</td><td class="num">' + f(base.total, 1) + '</td></tr></table>';
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('r-chart'), function () {
    var labels = PRODUCTS.map(function (p) { return p[1]; });
    var ds = [];
    if (cur) {
      ds.push(C.barDs('Configured refinery', PRODUCTS.map(function (p) { return +cur[p[0]].toFixed(1); }), 0));
      ds.push(C.barDs('Same crude, no conversion', PRODUCTS.map(function (p) { return +base[p[0]].toFixed(1); }), 1));
    }
    var o = C.base({ legend: true, mode: 'index', yTitle: 'vol% of crude' });
    o.scales.y.min = 0; o.scales.x.grid = { display: false }; o.scales.x.ticks.autoSkip = false;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': ' + f(c.raw, 1) + '%'; } };
    return { type: 'bar', data: { labels: labels, datasets: ds }, options: o };
  });
  paint();
})();
