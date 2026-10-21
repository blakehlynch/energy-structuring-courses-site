/* Course 10 calculation library — capstone deal pricers. Browser: window.C10; Node: module.exports. */
(function (root) {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
  function normals(seed) {
    var u = rng(seed), spare = null;
    return function () {
      if (spare !== null) { var t = spare; spare = null; return t; }
      var a = u() || 1e-12, b = u(), m = Math.sqrt(-2 * Math.log(a));
      spare = m * Math.sin(2 * Math.PI * b); return m * Math.cos(2 * Math.PI * b);
    };
  }
  function ncdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
    var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function mean(a) { return sum(a) / a.length; }
  function quantile(a, q) { var s = a.slice().sort(function (x, y) { return x - y; }), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
  function annuityFactor(r, n) { return (1 - Math.pow(1 + r, -n)) / r; }
  function irr(cfs) { var lo = -0.99, hi = 1, f = function (r) { var v = 0; cfs.forEach(function (c, t) { v += c / Math.pow(1 + r, t); }); return v; }; if (f(lo) * f(hi) > 0) return NaN; for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; }

  // ---------- Case 1 refinery supply and offtake intermediation ----------
  // trader owns crude from loading to delivery into the refinery, buys products at the gate and holds them until sold
  function intermediation(o) { // {kbd, crude ($/bbl), crudeDays, productDays, productPrice, fundRate, advance (bank advance rate), roe, hedgeCost ($/bbl), pd, lgd, opCost ($/bbl)}
    var bblYr = o.kbd * 1000 * 365;
    var inv = o.kbd * 1000 * (o.crudeDays * o.crude + o.productDays * o.productPrice); // average working capital ($)
    var debt = inv * o.advance, equity = inv - debt;
    var funding = debt * o.fundRate, capitalCharge = equity * o.roe, el = inv * o.pd * o.lgd;
    var feeNeeded = (funding + capitalCharge + el) / bblYr + o.hedgeCost + o.opCost;
    return { bblYr: bblYr, inventory: inv, debt: debt, equity: equity, funding: funding, capitalCharge: capitalCharge, el: el, feeNeeded: feeNeeded,
      fundingPerBbl: funding / bblYr, capitalPerBbl: capitalCharge / bblYr, elPerBbl: el / bblYr };
  }

  // ---------- Case 2 CCGT toll ----------
  function kirk(F1, F2, H, K, T, s1, s2, rho, r) {
    var b = H * F2 + K, w = H * F2 / b, sv = Math.sqrt(T * (s1 * s1 + w * w * s2 * s2 - 2 * rho * s1 * w * s2));
    var d1 = (Math.log(F1 / b) + sv * sv / 2) / sv;
    return Math.exp(-(r || 0) * T) * (F1 * ncdf(d1) - b * ncdf(d1 - sv));
  }
  function tollDeal(o) { // {mw, hr, vom, power[], gas[], hours[], sp, sg, rho, haircut (share of extrinsic lost to constraints), capPay ($/kW-mo), r}
    var opt = 0, intr = 0, dfSum = 0, rows = [];
    o.power.forEach(function (p, i) {
      var T = (i + 1.5) / 12, df = Math.exp(-o.r * T), v = kirk(p, o.gas[i], o.hr, o.vom, T, o.sp, o.sg, o.rho, o.r), iv = Math.max(0, p - o.hr * o.gas[i] - o.vom) * df;
      var adj = iv + (v - iv) * (1 - o.haircut), mwh = o.mw * o.hours[i];
      opt += adj * mwh; intr += iv * mwh; dfSum += df; rows.push({ value: adj, intrinsic: iv, mwh: mwh });
    });
    // capacity payments are discounted on the same monthly timing as the option values, so NPV and break-even compare like with like
    var costNominal = o.capPay * o.mw * 1000 * o.power.length, cost = o.capPay * o.mw * 1000 * dfSum, be = opt / (o.mw * 1000 * dfSum);
    return { value: opt, intrinsic: intr, cost: cost, costNominal: costNominal, npv: opt - cost, breakeven: be, rows: rows };
  }

  // ---------- Case 3 storage lease ----------
  function storageDP(F, n, f) {
    var N = Math.round(f.cap / f.step), M = F.length, NEG = -1e18, V = [], m, k, j;
    for (m = 0; m <= M; m++) V.push(new Array(N + 1).fill(NEG)); V[M][0] = 0;
    for (m = M - 1; m >= 0; m--) {
      var imax = Math.floor(f.inj * n[m] / f.step + 1e-9), wmax = Math.floor(f.wd * n[m] / f.step + 1e-9);
      for (k = 0; k <= N; k++) { var best = NEG; for (j = Math.max(0, k - wmax); j <= Math.min(N, k + imax); j++) { if (V[m + 1][j] <= NEG / 2) continue; var dq = (j - k) * f.step, cash = dq > 0 ? -dq * (F[m] + f.ci) : -dq * (F[m] - f.cw); if (cash + V[m + 1][j] > best) best = cash + V[m + 1][j]; } V[m][k] = best; }
    }
    return V[0][0];
  }
  function storageLease(o) { // {F[], n[], fac, extrinsicPct (model estimate as % of intrinsic), capture (share of extrinsic bid), margin (required $), fee (offered $)}
    var intr = storageDP(o.F, o.n, o.fac), ext = intr * o.extrinsicPct;
    var bid = intr + ext * o.capture - o.margin;
    return { intrinsic: intr, extrinsic: ext, bid: bid, perUnit: bid / o.fac.cap, npvAtFee: intr + ext * o.capture - o.fee };
  }

  // ---------- Case 4 solar PPA: shape, basis, volume ----------
  function solarPPA(o) { // {ppa, hubBase, capture (capture rate vs baseload), basisMean, basisSd, mwh, volSd, priceSd, rhoVP, paths, seed}
    var z = normals(o.seed || 61), res = [];
    for (var k = 0; k < o.paths; k++) {
      var zp = z(), zv = o.rhoVP * zp + Math.sqrt(1 - o.rhoVP * o.rhoVP) * z(), zb = z();
      var base = o.hubBase * Math.exp(o.priceSd * zp - 0.5 * o.priceSd * o.priceSd), cap = base * o.capture;
      var node = cap - (o.basisMean + o.basisSd * zb), vol = o.mwh * Math.max(0, 1 + o.volSd * zv);
      res.push(vol * (node - o.ppa)); // buyer receives node revenue for its share of output, pays PPA price (virtual PPA settlement)
    }
    var expected = o.mwh * (o.hubBase * o.capture - o.basisMean - o.ppa);
    return { expected: expected, mean: mean(res), p5: quantile(res, 0.05), p95: quantile(res, 0.95), shapeCost: o.mwh * o.hubBase * (1 - o.capture), basisCost: o.mwh * o.basisMean };
  }

  // ---------- Case 5 project-financed terminal ----------
  function terminalDeal(o) { // {capex, opexFixed, capacity (m bbl/yr), contracted (share), tariff, spotUtil, spotTariff, life, tenor, kd, dscrC, dscrM}
    var cRev = o.capacity * o.contracted * o.tariff, mRev = o.capacity * (1 - o.contracted) * o.spotUtil * o.spotTariff;
    var cfadsC = cRev - o.opexFixed * o.contracted, cfadsM = mRev - o.opexFixed * (1 - o.contracted);
    var dsMax = Math.max(0, cfadsC) / o.dscrC + Math.max(0, cfadsM) / o.dscrM;
    var debt = Math.min(dsMax * annuityFactor(o.kd, o.tenor), 0.85 * o.capex), ds = debt / annuityFactor(o.kd, o.tenor);
    var cf = [-(o.capex - debt)];
    for (var t = 1; t <= o.life; t++) cf.push(cfadsC + cfadsM - (t <= o.tenor ? ds : 0));
    return { cRev: cRev, mRev: mRev, cfads: cfadsC + cfadsM, debt: debt, gearing: debt / o.capex, ds: ds, dscr: (cfadsC + cfadsM) / ds, irr: irr(cf) };
  }
  // tariff at which equity NPV at the target return is zero (equity NPV rises with the tariff)
  function tariffForIrr(o, target) {
    var npv = function (tf) { var d = terminalDeal(Object.assign({}, o, { tariff: tf })), v = -(o.capex - d.debt); for (var t = 1; t <= o.life; t++) v += (d.cfads - (t <= o.tenor ? d.ds : 0)) / Math.pow(1 + target, t); return v; };
    var lo = 0.01, hi = 20; for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (npv(m) < 0) lo = m; else hi = m; } return (lo + hi) / 2;
  }

  var api = { rng: rng, normals: normals, ncdf: ncdf, sum: sum, mean: mean, quantile: quantile, annuityFactor: annuityFactor, irr: irr,
    intermediation: intermediation, kirk: kirk, tollDeal: tollDeal, storageDP: storageDP, storageLease: storageLease, solarPPA: solarPPA, terminalDeal: terminalDeal, tariffForIrr: tariffForIrr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C10 = api;
})(typeof window !== 'undefined' ? window : this);
