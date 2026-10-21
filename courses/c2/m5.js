/* Module 5 widget: value-in-use calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C2;
  var NAMES = { lpg: 'LPG', naphtha: 'Naphtha', gasoline: 'Gasoline', jet: 'Jet', diesel: 'Diesel', fuelOil: 'Fuel oil', coke: 'Coke' };
  var CRUDE = { light: 'Light sweet (marker)', medium: 'Medium sour', heavy: 'Heavy sour', condensate: 'Condensate' };
  var ids = ['marker', 'fA', 'fB', 'gas', 'dsl', 'jet', 'nap', 'fo', 'lpg', 'coke'];
  var I = ESC.inputs('v-', ids, paint);
  var refSel = document.getElementById('v-ref'), candSel = document.getElementById('v-cand');
  refSel.addEventListener('change', paint); candSel.addEventListener('change', paint);
  var state = null;
  function prices(fo) {
    return { lpg: +I.lpg.value, naphtha: +I.nap.value, gasoline: +I.gas.value, jet: +I.jet.value, diesel: +I.dsl.value, fuelOil: fo === undefined ? +I.fo.value : fo, coke: +I.coke.value };
  }
  function crudes(ref) {
    var set = X.VIU[ref], cand = candSel.value;
    return {
      a: { yields: set.light.yields, varCost: set.light.varCost, freight: +I.fA.value },
      b: { yields: set[cand].yields, varCost: set[cand].varCost, freight: +I.fB.value }
    };
  }
  function sgn(v) { return (v < 0 ? '−$' : '+$') + f(Math.abs(v), 2); }
  function paint() {
    ids.forEach(function (k) { ESC.out('v-' + k, '$' + f(+I[k].value, k === 'fA' || k === 'fB' || k === 'marker' ? 2 : 0)); });
    var ref = refSel.value, other = ref === 'coking' ? 'cracking' : 'coking';
    var P = prices(), cr = crudes(ref), cr2 = crudes(other);
    var vA = X.breakevenCrude(cr.a.yields, P, cr.a.varCost, cr.a.freight), vB = X.breakevenCrude(cr.b.yields, P, cr.b.varCost, cr.b.freight);
    var d = vB - vA, d2 = X.valueInUseDiff(cr2.a, cr2.b, P);
    var sens = X.diffSensitivity(cr.a, cr.b);
    state = { P: P, cr: cr, d: d, sens: sens, ref: ref };
    document.getElementById('v-stats').innerHTML =
      ESC.stat('Marker value-in-use', '$' + f(vA, 2), 'GPW $' + f(X.gpw(cr.a.yields, P), 2) + ' − costs') +
      ESC.stat(CRUDE[candSel.value] + ' value-in-use', '$' + f(vB, 2), 'GPW $' + f(X.gpw(cr.b.yields, P), 2) + ' − costs') +
      ESC.stat('Breakeven differential', sgn(d) + '/bbl', 'candidate vs marker at a ' + ref + ' refinery') +
      ESC.stat('Implied candidate price', '$' + f(+I.marker.value + d, 2), 'marker $' + f(+I.marker.value, 2) + ' ' + sgn(d)) +
      ESC.stat('Same crude, ' + other + ' refinery', sgn(d2) + '/bbl', 'configuration changes the value');
    var keys = Object.keys(NAMES);
    document.getElementById('v-table').innerHTML = '<table><tr><th>Crude</th>' + keys.map(function (k) { return '<th class="num">' + NAMES[k] + '</th>'; }).join('') + '<th class="num">Proc. cost</th></tr>' +
      ['coking', 'cracking'].map(function (r) {
        return ['light', 'medium', 'heavy', 'condensate'].map(function (c) {
          var y = X.VIU[r][c];
          return '<tr><td>' + r + ': ' + CRUDE[c] + '</td>' + keys.map(function (k) { return '<td class="num">' + f(100 * y.yields[k], 0) + '</td>'; }).join('') + '<td class="num">' + f(y.varCost, 2) + '</td></tr>';
        }).join('');
      }).join('') + '</table>';
    contrib.rebuild(); sweep.rebuild();
  }
  var contrib = C.make(document.getElementById('v-contrib'), function () {
    if (!state) return { type: 'bar', data: { labels: [], datasets: [] }, options: C.base({}) };
    var keys = Object.keys(NAMES).filter(function (k) { return Math.abs(state.sens[k]) > 1e-9; });
    var labels = keys.map(function (k) { return NAMES[k]; }).concat(['Processing cost', 'Freight', 'Total differential']);
    var vals = keys.map(function (k) { return state.sens[k] * state.P[k]; })
      .concat([-(state.cr.b.varCost - state.cr.a.varCost), -(state.cr.b.freight - state.cr.a.freight), state.d]);
    var pos = vals.map(function (v) { return v >= 0 ? +v.toFixed(3) : null; }), neg = vals.map(function (v) { return v < 0 ? +v.toFixed(3) : null; });
    var o = C.base({ legend: true, mode: 'index', xTitle: '$/bbl contribution to candidate − marker' });
    o.indexAxis = 'y'; o.scales.y.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.raw === null ? null : c.dataset.label + ': ' + sgn(c.raw); } };
    return { type: 'bar', data: { labels: labels, datasets: [C.barDs('Adds value to candidate', pos, 0), C.barDs('Reduces value of candidate', neg, 1)] }, options: Object.assign(o, { datasets: { bar: { grouped: false } } }) };
  });
  var sweep = C.make(document.getElementById('v-sweep'), function () {
    var fos = []; for (var v = 20; v <= 120; v += 5) fos.push(v);
    var line = function (ref) { return fos.map(function (fo) { var cr = crudes(ref); return +X.valueInUseDiff(cr.a, cr.b, prices(fo)).toFixed(3); }); };
    var o = C.base({ legend: true, mode: 'index', xTitle: 'Fuel oil price, $/bbl', yTitle: 'Breakeven differential, $/bbl' });
    o.plugins.tooltip.callbacks = { title: function (it) { return 'Fuel oil $' + it[0].label; }, label: function (c) { return c.dataset.label + ': ' + sgn(c.raw); } };
    return { type: 'line', data: { labels: fos, datasets: [C.lineDs('Coking refinery', line('coking'), 0), C.lineDs('Cracking refinery', line('cracking'), 1)] }, options: o };
  });
  paint();
})();
