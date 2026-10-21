/* C1 M2 widgets: drilling treadmill; supply stack */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C1;
  var BLUES = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

  // ---------- treadmill ----------
  var T = ESC.inputs('t-', ['wells', 'cut', 'q0', 'D', 'b', 'cost'], paintT);
  var YEARS = 15, cohorts = null;
  function paintT() {
    var w = +T.wells.value, cut = +T.cut.value, q0 = +T.q0.value, D = +T.D.value, b = +T.b.value, cost = +T.cost.value;
    ESC.out('t-wells', w);
    ESC.out('t-cut', cut);
    ESC.out('t-q0', q0);
    ESC.out('t-D', f(D, 1));
    ESC.out('t-b', f(b, 1));
    ESC.out('t-cost', '$' + f(cost, 1));
    cohorts = [];
    for (var c = 0; c < YEARS; c++) {
      var row = [];
      for (var y = 0; y < YEARS; y++) row.push(c < cut && y >= c ? w * X.arpsRate(q0, D, b, y - c + 0.5) / 1e6 : 0);
      cohorts.push(row);
    }
    var tot = []; for (var y2 = 0; y2 < YEARS; y2++) tot.push(cohorts.reduce(function (a, r) { return a + r[y2]; }, 0));
    var peak = Math.max.apply(null, tot), afterStop = cut < YEARS ? tot[Math.min(YEARS - 1, cut)] : null;
    var need = X.wellsToHold(1e6, q0, D, b, 20);
    document.getElementById('t-stats').innerHTML =
      ESC.stat('First-year decline', f(100 * X.firstYearDecline(D, b), 1) + '%', 'per well') +
      ESC.stat('Peak basin output', f(peak, 2) + ' mb/d', 'during the drilling program') +
      ESC.stat('Wells to hold 1 mb/d', f(need, 0) + '/yr', '≈ $' + f(need * cost / 1000, 1) + 'bn a year') +
      (afterStop !== null ? ESC.stat('One year after drilling stops', f(afterStop, 2) + ' mb/d', f(100 * (afterStop / tot[cut - 1] - 1), 0) + '% vs last drilling year') : ESC.stat('Capex at this program', '$' + f(w * cost / 1000, 1) + 'bn/yr', w + ' wells × $' + cost + 'm'));
    chartT.rebuild();
  }
  var chartT = C.make(document.getElementById('t-chart'), function () {
    var labels = []; for (var y = 1; y <= YEARS; y++) labels.push('Y' + y);
    var ds = (cohorts || []).map(function (row, i) {
      var col = BLUES[Math.min(BLUES.length - 1, 2 + i % 11)];
      return { label: 'Cohort Y' + (i + 1), data: row.map(function (v) { return +v.toFixed(4); }), fill: true, backgroundColor: col, borderColor: C.v('--surface'), borderWidth: 1, pointRadius: 0, stack: 'p', tension: 0 };
    }).filter(function (d) { return d.data.some(function (v) { return v > 0; }); });
    ds.forEach(function (d, i) { d.fill = i === 0 ? 'origin' : '-1'; });
    var o = C.base({ legend: false, mode: 'index', xTitle: 'Year', yTitle: 'Production (mb/d)' });
    o.scales.y.stacked = true; o.scales.y.min = 0;
    o.plugins.tooltip.callbacks = { label: function (c) { return c.raw > 0.0005 ? c.dataset.label + ': ' + f(c.raw, 3) + ' mb/d' : null; },
      footer: function (it) { return 'Total ' + f(it.reduce(function (a, c) { return a + c.raw; }, 0), 3) + ' mb/d'; } };
    return { type: 'line', data: { labels: labels, datasets: ds }, options: o };
  });
  paintT();

  // ---------- supply stack ----------
  var S = ESC.inputs('s-', ['dem', 'shale', 'opec'], paintS);
  var stackNow = null, clear = null;
  function paintS() {
    var dem = +S.dem.value, sh = +S.shale.value, op = +S.opec.value;
    ESC.out('s-dem', f(dem, 1));
    ESC.out('s-shale', (sh >= 0 ? '+' : '') + sh);
    ESC.out('s-opec', f(op, 1));
    stackNow = X.STACK.map(function (s) {
      var o = Object.assign({}, s);
      if (/shale/.test(s.name)) o.cost = s.cost + sh;
      if (/Middle East/.test(s.name)) o.capacity = Math.max(0, s.capacity - op);
      return o;
    }).sort(function (a, b) { return a.cost - b.cost; });
    clear = X.clearStack(stackNow, dem);
    var total = stackNow.reduce(function (a, s) { return a + s.capacity; }, 0);
    document.getElementById('s-stats').innerHTML =
      ESC.stat('Clearing price', isFinite(clear.price) ? '$' + clear.price + '/bbl' : 'Shortage', 'full-cycle cost of the marginal segment') +
      ESC.stat('Marginal segment', clear.marginal, 'last segment needed') +
      ESC.stat('Spare in marginal segment', f(clear.spare, 1) + ' mb/d', 'room before the next step up') +
      ESC.stat('Total stack capacity', f(total, 1) + ' mb/d', op > 0 ? f(op, 1) + ' mb/d of low-cost supply withheld' : 'nothing withheld');
    chartS.rebuild();
  }
  var marker = {
    id: 'demandLine',
    afterDraw: function (ch) {
      if (!clear) return;
      var x = ch.scales.x, y = ch.scales.y, a = ch.chartArea, ctx = ch.ctx, dem = +S.dem.value;
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = C.series(1);
      var px = x.getPixelForValue(dem); ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
      if (isFinite(clear.price)) { var py = y.getPixelForValue(clear.price); ctx.strokeStyle = C.v('--axis'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(px, py); ctx.stroke(); }
      ctx.fillStyle = C.v('--ink-2'); ctx.font = '12px system-ui, sans-serif'; ctx.fillText('demand ' + f(dem, 1), px + 6, a.top + 14);
      ctx.restore();
    }
  };
  var chartS = C.make(document.getElementById('s-chart'), function () {
    var pts = [], cum = 0;
    (stackNow || []).forEach(function (s) { pts.push({ x: cum, y: s.cost, name: s.name }); cum += s.capacity; pts.push({ x: cum, y: s.cost, name: s.name }); });
    var o = C.base({ legend: false, mode: 'nearest', xTitle: 'Cumulative capacity (mb/d)', yTitle: 'Full-cycle cost ($/bbl)' });
    o.scales.x.type = 'linear'; o.scales.x.min = 0; o.scales.x.max = 100; o.scales.y.min = 0;
    o.interaction = { mode: 'nearest', intersect: false, axis: 'x' };
    o.plugins.tooltip.callbacks = { title: function (it) { return it[0].raw.name; }, label: function (c) { return '$' + c.raw.y + '/bbl · up to ' + f(c.raw.x, 1) + ' mb/d'; } };
    return { type: 'line', data: { datasets: [C.lineDs('Supply stack', pts, 0, { fill: true, backgroundColor: C.wash(C.series(0), 0.10), stepped: false })] }, options: o, plugins: [marker] };
  });
  paintS();
})();
