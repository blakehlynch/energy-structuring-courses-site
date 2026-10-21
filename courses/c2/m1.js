/* Module 1 widget: crude quality lab (blend up to three grades) */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt;
  var PRESETS = [
    { name: 'WTI', api: 39.6, s: 0.24, src: 'Downey, ch.2' },
    { name: 'Brent', api: 37.6, s: 0.40, src: 'Kaiser, §3.2 (BP assay)' },
    { name: 'Ekofisk', api: 38.4, s: 0.22, src: 'Kaiser, §12.3' },
    { name: 'Hibernia', api: 35.0, s: 0.53, src: 'Kaiser, §4.7' },
    { name: 'Agbami', api: 48.0, s: 0.05, src: 'Kaiser, §3.2 and §4.7' },
    { name: 'Arab Light', api: 33.0, s: 1.90, src: 'Kaiser, §1.6' },
    { name: 'Dubai', api: 31.0, s: 2.00, src: 'Trafigura CD, ch.8' },
    { name: 'Maya', api: 20.5, s: 3.70, src: 'Kaiser, Box 12.2 (API) and §4.8 (sulfur)' },
    { name: 'Peregrino', api: 13.4, s: 1.89, src: 'Kaiser, §4.7' }
  ];
  var ROWS = [
    { preset: 'Ekofisk', vol: 60, cuts: [32, 14, 22, 22, 10] },
    { preset: 'Maya', vol: 40, cuts: [10, 7, 16, 27, 40] },
    { preset: 'Custom', vol: 0, api: 30, s: 1.0, cuts: [22, 11, 20, 25, 22] }
  ];
  var tbody = document.querySelector('#blend-table tbody');
  var opts = PRESETS.map(function (p) { return '<option>' + p.name + '</option>'; }).join('') + '<option>Custom</option>';
  ROWS.forEach(function (r, i) {
    var p = PRESETS.filter(function (x) { return x.name === r.preset; })[0];
    if (p) { r.api = p.api; r.s = p.s; }
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><select class="sel" data-i="' + i + '" data-k="preset" aria-label="Grade ' + (i + 1) + '">' + opts + '</select></td>' +
      '<td class="num"><input class="num-in" type="number" min="0" step="5" data-i="' + i + '" data-k="vol" value="' + r.vol + '" aria-label="Volume grade ' + (i + 1) + '"></td>' +
      '<td class="num"><input class="num-in" type="number" step="0.1" data-i="' + i + '" data-k="api" value="' + r.api + '" aria-label="API grade ' + (i + 1) + '"></td>' +
      '<td class="num"><input class="num-in" type="number" step="0.05" min="0" data-i="' + i + '" data-k="s" value="' + r.s + '" aria-label="Sulfur grade ' + (i + 1) + '"></td>' +
      r.cuts.map(function (c, j) { return '<td class="num"><input class="num-in" style="width:64px" type="number" min="0" step="1" data-i="' + i + '" data-k="c' + j + '" value="' + c + '" aria-label="Cut ' + j + ' grade ' + (i + 1) + '"></td>'; }).join('');
    tbody.appendChild(tr);
    tr.querySelector('select').value = r.preset;
  });
  document.getElementById('preset-sources').innerHTML = '<table><tr><th>Grade</th><th class="num">API</th><th class="num">S wt%</th><th>Source</th></tr>' +
    PRESETS.map(function (p) { return '<tr><td>' + p.name + '</td><td class="num">' + p.api + '</td><td class="num">' + p.s + '</td><td>' + p.src + '</td></tr>'; }).join('') + '</table>';

  function onEdit(e) {
    var t = e.target, i = +t.dataset.i, k = t.dataset.k, r = ROWS[i];
    if (!k || (e.type === 'change' && k !== 'preset')) return;
    if (k === 'preset') {
      var p = PRESETS.filter(function (x) { return x.name === t.value; })[0];
      r.preset = t.value;
      if (p) { r.api = p.api; r.s = p.s; var row = t.closest('tr'); row.querySelector('[data-k=api]').value = p.api; row.querySelector('[data-k=s]').value = p.s; }
    } else if (k === 'vol') r.vol = Math.max(0, +t.value || 0);
    else if (k === 'api') { r.api = +t.value; r.preset = 'Custom'; t.closest('tr').querySelector('select').value = 'Custom'; }
    else if (k === 's') { r.s = Math.max(0, +t.value); r.preset = 'Custom'; t.closest('tr').querySelector('select').value = 'Custom'; }
    else r.cuts[+k.slice(1)] = Math.max(0, +t.value || 0);
    paint();
  }
  tbody.addEventListener('input', onEdit);
  tbody.addEventListener('change', onEdit);

  function cls(api, s) {
    var d = api >= 35 ? 'light' : api >= 25 ? 'medium' : 'heavy';
    var q = s < 0.5 ? 'sweet' : s <= 1.0 ? 'medium sour' : 'sour';
    return d + ' ' + q;
  }
  var lastBlend = null;
  function compute() {
    var comps = ROWS.filter(function (r) { return r.vol > 0; }).map(function (r) { return { vol: r.vol, api: r.api, sulfur: r.s, cuts: r.cuts }; });
    if (!comps.length) return null;
    var b = window.C2.blendCrudes(comps);
    var cuts = [0, 1, 2, 3, 4].map(function (j) { return window.C2.blendLinear(comps.map(function (c) { return { vol: c.vol, v: c.cuts[j] }; }), 'v'); });
    b.cuts = cuts; return b;
  }
  var statsEl = document.getElementById('blend-stats');
  function paint() {
    var b = compute(); lastBlend = b;
    if (!b) { statsEl.innerHTML = '<div class="stat"><div class="label">Blend</div><div class="value">–</div><div class="sub">Enter a positive volume</div></div>'; chart.rebuild(); return; }
    var cutSum = b.cuts.reduce(function (a, x) { return a + x; }, 0);
    statsEl.innerHTML =
      ESC.stat('Blend API', f(b.api, 1) + ' °API', 'SG ' + f(b.sg, 4)) +
      ESC.stat('Blend sulfur', f(b.sulfur, 2) + ' wt%', 'mass-weighted') +
      ESC.stat('Class', cls(b.api, b.s === undefined ? b.sulfur : b.sulfur), '25/35 °API and 0.5/1.0 wt% conventions') +
      ESC.stat('Naive API error', (b.naiveApi - b.api >= 0 ? '+' : '') + f(b.naiveApi - b.api, 2) + '°', 'if you averaged API directly') +
      ESC.stat('Blend cuts (vol%)', b.cuts.map(function (x) { return f(x, 0); }).join(' / '), 'naph/kero/gasoil/VGO/resid' + (Math.abs(cutSum - 100) > 0.5 ? ' · sum ' + f(cutSum, 0) + '%' : ''));
    chart.rebuild();
  }

  // threshold lines + labels drawn as a tiny plugin (hairline, recessive)
  var thresholds = {
    id: 'thresholds',
    afterDraw: function (ch) {
      var ctx = ch.ctx, x = ch.scales.x, y = ch.scales.y, a = ch.chartArea;
      ctx.save(); ctx.strokeStyle = C.v('--axis'); ctx.lineWidth = 1; ctx.fillStyle = C.v('--muted'); ctx.font = '11px system-ui, sans-serif';
      [0.5, 1.0].forEach(function (s) { var px = x.getPixelForValue(s); ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); ctx.fillText(s + '% S', px + 4, a.top + 12); });
      [25, 35].forEach(function (api) { var py = y.getPixelForValue(api); ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); ctx.fillText(api + '°API', a.right - 46, py - 4); });
      ctx.restore();
    }
  };
  var chart = C.make(document.getElementById('quality-chart'), function () {
    var b = lastBlend;
    var used = ROWS.filter(function (r) { return r.vol > 0; });
    var ds = [
      { label: 'Reference grades', data: PRESETS.map(function (p) { return { x: p.s, y: p.api, name: p.name }; }), backgroundColor: C.v('--muted'), borderColor: C.v('--surface'), borderWidth: 2, pointRadius: 5, pointHoverRadius: 7 },
      { label: 'Blend components', data: used.map(function (r) { return { x: r.s, y: r.api, name: r.preset }; }), backgroundColor: C.series(0), borderColor: C.v('--surface'), borderWidth: 2, pointRadius: 7, pointHoverRadius: 9 },
      { label: 'Blend', data: b ? [{ x: b.sulfur, y: b.api, name: 'Blend' }] : [], backgroundColor: C.series(1), borderColor: C.v('--surface'), borderWidth: 2, pointRadius: 9, pointHoverRadius: 11, pointStyle: 'rectRot' }
    ];
    var o = C.base({ legend: true, mode: 'nearest', xTitle: 'Sulfur (wt%)', yTitle: 'API gravity (°)',
      tooltipCallbacks: { label: function (c) { return c.raw.name + ': ' + f(c.raw.y, 1) + '°API, ' + f(c.raw.x, 2) + '% S'; } } });
    o.interaction = { mode: 'nearest', intersect: true };
    o.scales.x.type = 'linear'; o.scales.x.min = 0; o.scales.x.max = 4;
    o.scales.y.min = 10; o.scales.y.max = 50;
    return { type: 'scatter', data: { datasets: ds }, options: o, plugins: [thresholds] };
  });
  paint();
})();
