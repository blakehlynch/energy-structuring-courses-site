/* C12 M1 widget: VaR and expected shortfall, normal versus Student t */
(function () {
  'use strict';
  var C = window.ESCChart, f = window.ESC.fmt, X = window.C12;
  var I = ESC.inputs('r-', ['pos', 'sig', 'c', 'h', 'nu'], paint);
  var st = null;
  function k(x) { return '$' + f(x / 1e3, 1) + 'k'; }
  function paint() {
    var pos = +I.pos.value * 1e6, sig = +I.sig.value / 100, c = +I.c.value / 100, h = +I.h.value, nu = +I.nu.value;
    ESC.out('r-pos', '$' + f(pos / 1e6, 1) + 'm');
    ESC.out('r-sig', f(100 * sig, 1) + '%');
    ESC.out('r-c', f(100 * c, 1) + '%');
    ESC.out('r-h', h + (h === 1 ? ' day' : ' days'));
    ESC.out('r-nu', String(nu));
    st = { sd: sig * Math.sqrt(h) * pos, nu: nu,
      vn: X.varNormal(pos, sig, c, h), en: X.esNormal(pos, sig, c, h), vt: X.varT(pos, sig, c, nu, h), et: X.esT(pos, sig, c, nu, h) };
    document.getElementById('r-stats').innerHTML =
      ESC.stat('Normal VaR', k(st.vn), f(X.ninv(c), 3) + ' × σ') +
      ESC.stat('Normal ES', k(st.en), 'average loss beyond VaR') +
      ESC.stat('Student t VaR', k(st.vt), f(100 * (st.vt / st.vn - 1), 1) + '% vs normal') +
      ESC.stat('Student t ES', k(st.et), f(100 * (st.et / st.en - 1), 1) + '% vs normal');
    chart.rebuild();
  }
  var chart = C.make(document.getElementById('r-chart'), function () {
    var o = C.base({ xTitle: 'Loss ($k)', yTitle: 'Density', legend: true, mode: 'nearest' });
    o.scales.y.ticks = { display: false };
    o.plugins.tooltip.callbacks = { label: function (c) { return c.dataset.label + (c.dataset.label.indexOf('VaR') >= 0 ? '' : ': ' + f(c.raw, 3)); } };
    var lab = [], dn = [], dt = [], vN = [], vT = [];
    if (st) {
      var sc = Math.sqrt((st.nu - 2) / st.nu), n = 60, top = Math.max(5 * st.sd, 1.1 * st.vt);
      for (var i = 0; i <= n; i++) {
        var L = top * i / n, z = L / st.sd;
        lab.push(f(L / 1e3, 0));
        dn.push(+X.npdf(z).toFixed(4));
        dt.push(+(X.tpdf(z / sc, st.nu) / sc).toFixed(4));
        vN.push(Math.abs(L - st.vn) <= top / n / 2 ? +X.npdf(z).toFixed(4) : null);
        vT.push(Math.abs(L - st.vt) <= top / n / 2 ? +(X.tpdf(z / sc, st.nu) / sc).toFixed(4) : null);
      }
    }
    return { type: 'line', data: { labels: lab, datasets: [C.lineDs('Normal', dn, 0), C.lineDs('Student t', dt, 1),
      C.lineDs('Normal VaR', vN, 0, { showLine: false, pointRadius: 7, pointStyle: 'triangle' }),
      C.lineDs('Student t VaR', vT, 1, { showLine: false, pointRadius: 7, pointStyle: 'triangle' })] }, options: o };
  });
  paint();
})();
