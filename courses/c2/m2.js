/* Module 2 widget: gasoline blending optimiser (LP) */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C2;
  var comps = X.GASOLINE_COMPONENTS.map(function (c) { return Object.assign({}, c); });
  var tbody = document.querySelector('#b-table tbody');
  comps.forEach(function (c, i) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + c.name + '</td>' + ['rvp', 'aki', 'cost', 'max'].map(function (k) {
      return '<td class="num"><input class="num-in" style="width:76px" type="number" step="any" min="0" data-i="' + i + '" data-k="' + k + '" value="' + c[k] + '" aria-label="' + c.name + ' ' + k + '"></td>';
    }).join('') + '<td class="num" id="b-opt-' + i + '">–</td>';
    tbody.appendChild(tr);
  });
  tbody.addEventListener('input', function (e) { var t = e.target; comps[+t.dataset.i][t.dataset.k] = Math.max(0, parseFloat(t.value) || 0); paint(); });
  var season = document.getElementById('b-season'), grade = document.getElementById('b-grade');
  season.addEventListener('change', paint); grade.addEventListener('change', paint);
  var res = null, alt = null, altLabel = '';
  function paint() {
    var cap = +season.value, aki = +grade.value;
    document.getElementById('b-rvp-out').textContent = cap + ' psi';
    document.getElementById('b-aki-out').textContent = aki;
    res = X.optimizeGasoline(comps, cap, aki);
    var altCap = cap === 13.5 ? 9 : 13.5; altLabel = cap === 13.5 ? 'Summer 9.0 psi' : 'Winter 13.5 psi';
    alt = X.optimizeGasoline(comps, altCap, aki);
    var st = document.getElementById('b-stats');
    if (res.status !== 'optimal') {
      comps.forEach(function (_, i) { document.getElementById('b-opt-' + i).textContent = '–'; });
      st.innerHTML = '<div class="stat"><div class="label">Result</div><div class="value">Infeasible</div><div class="sub">No mix of the available components meets both specs. Raise availability of high-octane, low-RVP components.</div></div>';
      document.getElementById('b-note').textContent = '';
      chart.rebuild(); return;
    }
    comps.forEach(function (_, i) { document.getElementById('b-opt-' + i).textContent = f(res.x[i], 1); });
    var bindR = res.rvp > cap - 0.01, bindA = res.aki < aki + 0.01;
    st.innerHTML =
      ESC.stat('Blend cost', '$' + f(res.costPerBbl, 2) + '/bbl', f(100 * res.costPerBbl / 42, 1) + '¢/gal') +
      ESC.stat('Blend RVP', f(res.rvp, 2) + ' psi', bindR ? 'binding at the cap' : 'slack: cap not binding') +
      ESC.stat('Blend AKI', f(res.aki, 2), bindA ? 'binding at the minimum' : 'giveaway ' + f(res.aki - aki, 2)) +
      (alt.status === 'optimal' ? ESC.stat('vs ' + altLabel, (res.costPerBbl - alt.costPerBbl >= 0 ? '+' : '−') + '$' + f(Math.abs(res.costPerBbl - alt.costPerBbl), 2) + '/bbl', f(Math.abs(100 * (res.costPerBbl - alt.costPerBbl) / 42), 1) + '¢/gal seasonal cost gap') : '');
    var but = res.x[0];
    document.getElementById('b-note').textContent = 'Butane used: ' + f(but, 1) + ' of a possible ' + comps[0].max + ' bbl per 100. ' +
      'LP shadow prices: AKI $' + f(res.shadowAKI || 0, 2) + '/bbl per octane pt, RVP $' + f(res.shadowRVP || 0, 2) + '/bbl per psi. ' +
      (bindR ? 'The RVP cap is binding, so loosening it (winter) would let in more cheap butane and naphtha.' : 'RVP is not binding here; octane or availability limits drive the recipe.');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('b-chart'), function () {
    var labels = comps.map(function (c) { return c.name; });
    var ds = [];
    if (res && res.status === 'optimal') ds.push(C.barDs('Selected season', res.x.map(function (v) { return +v.toFixed(2); }), 0));
    if (alt && alt.status === 'optimal') ds.push(C.barDs(altLabel, alt.x.map(function (v) { return +v.toFixed(2); }), 1));
    var o = C.base({ legend: true, mode: 'index', xTitle: 'bbl per 100 bbl of finished gasoline' });
    o.indexAxis = 'y';
    o.scales.x.min = 0;
    o.scales.y.grid = { display: false };
    o.scales.x.border = { display: false }; o.scales.y.border = { color: C.v('--axis') };
    return { type: 'bar', data: { labels: labels, datasets: ds }, options: o };
  });
  paint();
})();
