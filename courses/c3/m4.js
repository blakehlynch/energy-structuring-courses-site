/* C3 M4 widgets: Incoterms responsibility map; laytime and demurrage calculator */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C3;

  // ---- Incoterms map (oil-trade reading; S = seller, B = buyer) ----
  var ROWS = ['Export clearance', 'Charters the vessel / nominates', 'Pays main freight', 'Marine cargo insurance', 'Risk passes to buyer', 'Laytime with the ship at discharge', 'Import clearance and duties', 'Exposed to freight-rate moves after the sale'];
  var T = {
    FOB: [['S', ''], ['B', 'buyer nominates vessel for terminal approval'], ['B', ''], ['B', ''], ['—', 'at the load port (flange or ship’s rail)'], ['B', 'buyer is charterer'], ['B', ''], ['B', '']],
    CFR: [['S', ''], ['S', ''], ['S', ''], ['B', 'buyer insures from loading'], ['—', 'at the load port, although seller pays freight'], ['S', 'seller is charterer; receiver’s discharge time usually passed back to buyer'], ['B', ''], ['S', '']],
    CIF: [['S', ''], ['S', ''], ['S', ''], ['S', 'seller insures for buyer’s benefit'], ['—', 'at the load port, although seller pays freight and insurance'], ['S', 'as CFR'], ['B', ''], ['S', '']],
    DES: [['S', ''], ['S', ''], ['S', ''], ['S', 'seller’s own risk in transit'], ['—', 'at the discharge port (DAP in current Incoterms)'], ['S', ''], ['B', ''], ['S', '']],
    DDP: [['S', ''], ['S', ''], ['S', ''], ['S', ''], ['—', 'at the named place of destination'], ['S', ''], ['S', 'seller also pays import duties'], ['S', '']]
  };
  var seg = document.getElementById('i-seg'), tb = document.querySelector('#i-table tbody'), cur = 'FOB';
  Object.keys(T).forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.setAttribute('aria-pressed', k === cur ? 'true' : 'false');
    b.addEventListener('click', function () { cur = k; Array.prototype.forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', c.textContent === k ? 'true' : 'false'); }); table(); });
    seg.appendChild(b);
  });
  function table() {
    tb.innerHTML = ROWS.map(function (r, i) {
      var v = T[cur][i], who = v[0] === 'S' ? 'Seller' : v[0] === 'B' ? 'Buyer' : '';
      return '<tr><td>' + r + '</td><td class="' + (v[0] === 'S' ? 'who-seller' : 'who-buyer') + '">' + (who || '—') + '</td><td>' + v[1] + '</td></tr>';
    }).join('');
  }
  table();

  // ---- laytime calculator ----
  var I = ESC.inputs('l-', ['nor', 'notice', 'allowed', 'done', 'excl', 'rate'], paint);
  var seg2 = [0, 0, 0, 0, 0];
  function paint() {
    var nor = +I.nor.value, notice = +I.notice.value, allowed = +I.allowed.value, done = +I.done.value, excl = +I.excl.value, rate = +I.rate.value * 1000;
    ['nor', 'notice', 'allowed', 'done', 'excl'].forEach(function (k) { ESC.out('l-' + k, I[k].value + ' h'); });
    ESC.out('l-rate', '$' + I.rate.value + 'k');
    var r = X.laytime({ nor: nor, notice: notice, allowed: allowed, completed: done, excluded: excl, rate: rate });
    var lay = Math.min(Math.max(0, r.used), allowed), dem = Math.max(0, r.excess);
    seg2 = [nor, Math.min(notice, Math.max(0, done - nor)), Math.min(excl, Math.max(0, done - r.start)), lay, dem];
    document.getElementById('l-stats').innerHTML =
      ESC.stat('Laytime starts', 'hour ' + f(r.start, 0), 'NOR + ' + notice + ' h notice') +
      ESC.stat('Laytime used', f(r.used, 0) + ' h', 'of ' + allowed + ' h allowed; ' + excl + ' h excluded') +
      ESC.stat(r.excess > 0 ? 'On demurrage' : 'Time saved', f(Math.abs(r.excess), 0) + ' h', r.excess > 0 ? 'beyond allowed laytime' : 'inside allowed laytime') +
      ESC.stat('Demurrage due', '$' + f(r.demurrage, 0), 'at $' + f(rate, 0) + ' per day, pro rata');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('l-chart'), function () {
    var names = ['Before NOR', 'Notice period', 'Excluded time', 'Laytime used', 'Demurrage'];
    var o = C.base({ legend: true, mode: 'nearest', xTitle: 'Hours from arrival' });
    o.indexAxis = 'y'; o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.grid = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + ': ' + f(c.raw, 0) + ' h'; } };
    var colors = [C.v('--grid'), C.series(4), C.series(5), C.series(0), C.series(3)];
    var ds = names.map(function (n, i) { return C.barDs(n, [seg2[i]], i, { backgroundColor: colors[i], stack: 's', borderRadius: 0, maxBarThickness: 46, borderColor: C.v('--surface'), borderWidth: { left: 0, right: 2, top: 0, bottom: 0 } }); });
    return { type: 'bar', data: { labels: ['Port call'], datasets: ds }, options: o };
  });
  paint();
})();
