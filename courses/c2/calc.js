/* Course 2 calculation library — single source of truth for calculators, worked examples and tests.
   Works in the browser (window.C2) and in Node (module.exports). */
(function (root) {
  'use strict';
  var GAL_PER_BBL = 42;
  var BBL_PER_M3 = 6.28981; // 1 m3 = 6.28981 US barrels

  // ---------- units and density ----------
  function apiFromSG(sg) { return 141.5 / sg - 131.5; }
  function sgFromAPI(api) { return 141.5 / (api + 131.5); }
  function bblPerTonne(sg) { return BBL_PER_M3 / sg; }             // approx: treats SG as t/m3
  function perBblFromPerTonne(pricePerTonne, sg) { return pricePerTonne / bblPerTonne(sg); }
  function perTonneFromPerBbl(pricePerBbl, sg) { return pricePerBbl * bblPerTonne(sg); }
  function perBblFromPerGal(pricePerGal) { return pricePerGal * GAL_PER_BBL; }

  // ---------- crude blending (volume basis) ----------
  // comps: [{vol, api, sulfur}] ; density blends by volume, sulfur (wt%) by mass
  function blendCrudes(comps) {
    var v = 0, vsg = 0, mS = 0;
    comps.forEach(function (c) { var sg = sgFromAPI(c.api); v += c.vol; vsg += c.vol * sg; mS += c.vol * sg * c.sulfur; });
    var sg = vsg / v;
    var naiveApi = comps.reduce(function (a, c) { return a + c.vol * c.api; }, 0) / v;
    var volS = comps.reduce(function (a, c) { return a + c.vol * c.sulfur; }, 0) / v;
    return { vol: v, sg: sg, api: apiFromSG(sg), sulfur: mS / vsg, naiveApi: naiveApi, volAvgSulfur: volS };
  }
  // linear blend of any volume-additive vector (e.g. cut yields in vol%)
  function blendLinear(comps, field) {
    var v = 0, s = 0;
    comps.forEach(function (c) { v += c.vol; s += c.vol * c[field]; });
    return s / v;
  }

  // ---------- gasoline blending ----------
  function rvpIndex(rvp) { return Math.pow(rvp, 1.25); }
  function rvpFromIndex(ix) { return Math.pow(ix, 0.8); }
  // comps: [{vol, rvp}]
  function blendRVP(comps) {
    var v = 0, ix = 0;
    comps.forEach(function (c) { v += c.vol; ix += c.vol * rvpIndex(c.rvp); });
    return rvpFromIndex(ix / v);
  }
  // blending octane numbers are, by construction, volume-linear
  function blendOctane(comps, field) { return blendLinear(comps, field || 'aki'); }
  // barrels of butane W added to baseVol to reach targetRVP
  function butaneForRVP(baseVol, baseRVP, butaneRVP, targetRVP) {
    var bt = rvpIndex(targetRVP);
    return baseVol * (bt - rvpIndex(baseRVP)) / (rvpIndex(butaneRVP) - bt);
  }
  // ---------- Refutas Viscosity Blending Index (VBI) for fuel oil cutter stocks ----------
  function vbiFromCst(cst) { return 14.534 * Math.log(Math.log(cst + 0.8)) + 10.975; }
  function cstFromVbi(vbi) { return Math.exp(Math.exp((vbi - 10.975) / 14.534)) - 0.8; }
  function blendViscosity(comps) { // comps: [{vol, cst}]
    var v = 0, vb = 0, lin = 0;
    comps.forEach(function (c) { v += c.vol; vb += c.vol * vbiFromCst(c.cst); lin += c.vol * c.cst; });
    return { vbi: vb / v, cst: cstFromVbi(vb / v), naiveLinearCst: lin / v };
  }
  function cutterShareForVisc(residCst, cutterCst, targetCst) {
    var vr = vbiFromCst(residCst), vc = vbiFromCst(cutterCst), vt = vbiFromCst(targetCst);
    var shareVbi = (vr - vt) / (vr - vc);
    var shareLin = (residCst - targetCst) / (residCst - cutterCst);
    return { vbiResid: vr, vbiCutter: vc, vbiTarget: vt, cutterFrac: shareVbi, naiveLinearFrac: shareLin };
  }

  // ---------- small dense LP solver (Big-M simplex), for blending ----------
  // minimize c·x  s.t. rows: {a:[..], op:'<='|'>='|'=', b}, x >= 0. Returns {status, x, obj}.
  function lpMinimize(c, rows) {
    var n = c.length, M = 1e6, i, j;
    var cons = rows.map(function (r) { return r.b < 0 ? { a: r.a.map(function (v) { return -v; }), op: r.op === '<=' ? '>=' : r.op === '>=' ? '<=' : '=', b: -r.b } : r; });
    var m = cons.length;
    var nSlack = cons.filter(function (r) { return r.op !== '='; }).length;
    var nArt = cons.filter(function (r) { return r.op !== '<='; }).length;
    var N = n + nSlack + nArt;
    var T = [], basis = [], cost = new Array(N).fill(0);
    for (j = 0; j < n; j++) cost[j] = c[j];
    var sIdx = n, aIdx = n + nSlack;
    for (i = 0; i < m; i++) {
      var row = new Array(N + 1).fill(0), r = cons[i];
      for (j = 0; j < n; j++) row[j] = r.a[j];
      if (r.op === '<=') { row[sIdx] = 1; basis.push(sIdx); sIdx++; }
      else if (r.op === '>=') { row[sIdx] = -1; sIdx++; row[aIdx] = 1; cost[aIdx] = M; basis.push(aIdx); aIdx++; }
      else { row[aIdx] = 1; cost[aIdx] = M; basis.push(aIdx); aIdx++; }
      row[N] = r.b; T.push(row);
    }
    for (var it = 0; it < 500; it++) {
      // reduced costs
      var enter = -1, best = -1e-9;
      for (j = 0; j < N; j++) {
        var z = 0; for (i = 0; i < m; i++) z += cost[basis[i]] * T[i][j];
        var rc = cost[j] - z;
        if (rc < best) { best = rc; enter = j; }
      }
      if (enter < 0) break;
      var leave = -1, ratio = Infinity;
      for (i = 0; i < m; i++) if (T[i][enter] > 1e-12) { var q = T[i][N] / T[i][enter]; if (q < ratio - 1e-12) { ratio = q; leave = i; } }
      if (leave < 0) return { status: 'unbounded' };
      var pv = T[leave][enter];
      for (j = 0; j <= N; j++) T[leave][j] /= pv;
      for (i = 0; i < m; i++) if (i !== leave && Math.abs(T[i][enter]) > 1e-15) { var fct = T[i][enter]; for (j = 0; j <= N; j++) T[i][j] -= fct * T[leave][j]; }
      basis[leave] = enter;
    }
    var x = new Array(n).fill(0);
    for (i = 0; i < m; i++) { if (basis[i] < n) x[basis[i]] = T[i][N]; if (basis[i] >= n + nSlack && T[i][N] > 1e-7) return { status: 'infeasible' }; }
    var obj = 0; for (j = 0; j < n; j++) obj += c[j] * x[j];
    return { status: 'optimal', x: x, obj: obj };
  }
  function solveGasolineLP(comps, rvpMax, akiMin) {
    var n = comps.length;
    var rows = [
      { a: comps.map(function () { return 1; }), op: '=', b: 100 },
      { a: comps.map(function (k) { return k.aki; }), op: '>=', b: 100 * akiMin },
      { a: comps.map(function (k) { return rvpIndex(k.rvp); }), op: '<=', b: 100 * rvpIndex(rvpMax) }
    ];
    comps.forEach(function (k, i) { var a = new Array(n).fill(0); a[i] = 1; rows.push({ a: a, op: '<=', b: k.max }); });
    return lpMinimize(comps.map(function (k) { return k.cost; }), rows);
  }
  // comps: [{name, rvp, aki, cost, max}] ; blend 100 bbl at minimum cost meeting RVP <= rvpMax and AKI >= akiMin
  function optimizeGasoline(comps, rvpMax, akiMin) {
    var res = solveGasolineLP(comps, rvpMax, akiMin);
    if (res.status !== 'optimal') return res;
    var parts = comps.map(function (k, i) { return { vol: res.x[i], rvp: k.rvp, aki: k.aki }; }).filter(function (p) { return p.vol > 1e-9; });
    res.rvp = blendRVP(parts); res.aki = blendOctane(parts); res.costPerBbl = res.obj / 100;
    // shadow prices (marginal cost per bbl of tightening/relaxing AKI by 1 point or RVP by 1 psi)
    var eps = 1e-3;
    var rAki = solveGasolineLP(comps, rvpMax, akiMin + eps);
    var rRvp = solveGasolineLP(comps, rvpMax - eps, akiMin);
    res.shadowAKI = rAki.status === 'optimal' ? Math.max(0, (rAki.obj / 100 - res.costPerBbl) / eps) : 0;
    res.shadowRVP = rRvp.status === 'optimal' ? Math.max(0, (rRvp.obj / 100 - res.costPerBbl) / eps) : 0;
    return res;
  }

  // ---------- refinery complexity ----------
  // units: [{cap, cf}] (cap in same units as adu)
  function nelsonIndex(adu, units) {
    return 1 + units.reduce(function (a, u) { return a + (u.cap / adu) * u.cf; }, 0);
  }
  function conversionCapacity(adu, fcc, hydrocracker, coker) { return (fcc + hydrocracker + coker) / adu; }
  function classify(ci) {
    if (ci < 2) return 'Topping (very simple)';
    if (ci < 5) return 'Hydroskimming (simple)';
    if (ci < 14) return 'Cracking / conversion (complex)';
    return 'Coking / deep conversion (very complex)';
  }

  // Stylized yield model for teaching (all coefficients are illustrative assumptions, not assay data).
  // crude cuts are vol% of crude: lpg, naph, kero, gasoil, vgo, resid. Capacities in kb/d, crude rate in kb/d.
  var STYLE = {
    fcc:   { gasoline: 0.58, diesel: 0.18, lpg: 0.20, fuelOil: 0.08, gain: 0.04 },   // per bbl VGO fed (sums to 1+gain)
    coker: { gasoline: 0.15, diesel: 0.30, vgo: 0.25, lpg: 0.05, coke: 0.25 },        // per bbl resid fed (coke in bbl-equivalent)
    hc:    { gasoline: 0.25, jetDiesel: 0.85, gain: 0.10 },                           // per bbl VGO fed
    reformerOctaneUplift: true
  };
  var CRUDES = { // illustrative atmospheric cut yields, vol% (not assay data)
    light: { lpg: 3, naph: 32, kero: 14, gasoil: 22, vgo: 21, resid: 8, sour: false },
    medium: { lpg: 2, naph: 20, kero: 11, gasoil: 19, vgo: 26, resid: 22, sour: true },
    heavy: { lpg: 1, naph: 10, kero: 7, gasoil: 15, vgo: 27, resid: 40, sour: true }
  };
  function stylizedYields(cuts, rate, caps) {
    // everything flows by cut; the vacuum unit gates what conversion units can see; leftovers go to fuel oil
    var crude = rate;
    var vol = function (pct) { return crude * pct / 100; };
    var out = { lpg: vol(cuts.lpg), gasoline: vol(cuts.naph), jet: vol(cuts.kero), diesel: vol(cuts.gasoil), fuelOil: 0, coke: 0 };
    var resid = vol(cuts.resid);
    var vgo = vol(cuts.vgo);
    if (caps.vdu !== undefined) {
      var atm = vgo + resid, fed = Math.min(caps.vdu, atm), frac = atm > 0 ? fed / atm : 0;
      out.fuelOil += atm * (1 - frac); vgo *= frac; resid *= frac;
    }
    // coker on resid
    var ck = Math.min(caps.coker || 0, resid); resid -= ck;
    out.gasoline += ck * STYLE.coker.gasoline; out.diesel += ck * STYLE.coker.diesel; out.lpg += ck * STYLE.coker.lpg; out.coke += ck * STYLE.coker.coke;
    vgo += ck * STYLE.coker.vgo;
    // hydrocracker first on VGO (diesel/jet focused), then FCC
    var hc = Math.min(caps.hc || 0, vgo); vgo -= hc;
    out.gasoline += hc * STYLE.hc.gasoline; out.diesel += hc * STYLE.hc.jetDiesel;
    var fc = Math.min(caps.fcc || 0, vgo); vgo -= fc;
    out.gasoline += fc * STYLE.fcc.gasoline; out.diesel += fc * STYLE.fcc.diesel; out.lpg += fc * STYLE.fcc.lpg; out.fuelOil += fc * STYLE.fcc.fuelOil;
    // alkylation turns FCC light olefins (part of the FCC LPG) into gasoline, 1:1 by volume (illustrative)
    var alk = Math.min(caps.alk || 0, fc * STYLE.fcc.lpg * 0.6);
    out.lpg -= alk; out.gasoline += alk;
    // unconverted VGO and resid go to the fuel-oil pool
    out.fuelOil += vgo + resid;
    var tot = 0; Object.keys(out).forEach(function (k) { tot += out[k]; });
    var pct = {}; Object.keys(out).forEach(function (k) { pct[k] = 100 * out[k] / crude; });
    pct.total = 100 * tot / crude;
    return pct;
  }

  // ---------- margins ----------
  // yields: {product: fraction of crude volume}; prices: {product: $/bbl}
  function gpw(yields, prices) {
    return Object.keys(yields).reduce(function (a, k) { return a + yields[k] * (prices[k] || 0); }, 0);
  }
  function marginStack(o) { // {yields, prices, crude, variable, fixed}
    var g = gpw(o.yields, o.prices);
    var gross = g - o.crude;
    var net = gross - (o.variable || 0);
    return { gpw: g, gross: gross, net: net, netback: net - (o.fixed || 0) };
  }
  // generic X-Y-Z crack: (sum of product legs - nCrude*crude)/nCrude, all $/bbl
  function crack(nCrude, legs, crudePrice) {
    var s = legs.reduce(function (a, l) { return a + l.n * l.price; }, 0);
    return (s - nCrude * crudePrice) / nCrude;
  }
  function swapSettlement(fixed, floating, volume, side) { // side 'sell' = receive fixed
    return (side === 'buy' ? (floating - fixed) : (fixed - floating)) * volume;
  }

  // ---------- value-in-use ----------
  // breakeven crude price at a refinery = GPW - crude-specific variable costs - delivery costs
  function breakevenCrude(yields, prices, varCost, freight) { return gpw(yields, prices) - (varCost || 0) - (freight || 0); }
  // breakeven differential of crude B vs marker A at the same refinery
  function valueInUseDiff(a, b, prices) {
    return breakevenCrude(b.yields, prices, b.varCost, b.freight) - breakevenCrude(a.yields, prices, a.varCost, a.freight);
  }
  // sensitivity of the differential to each product price = yield difference
  function diffSensitivity(a, b) {
    var keys = {}; Object.keys(a.yields).concat(Object.keys(b.yields)).forEach(function (k) { keys[k] = 1; });
    var out = {}; Object.keys(keys).forEach(function (k) { out[k] = (b.yields[k] || 0) - (a.yields[k] || 0); });
    return out;
  }

  // ---------- probability tools ----------
  function erf(x) { // Abramowitz–Stegun 7.1.26
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function normPdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  // E[max(C - k, 0)] with C ~ Normal(m, s): value of running only when the crack covers variable cost
  function runOptionNormal(m, s, k) {
    if (s <= 0) return Math.max(m - k, 0);
    var d = (m - k) / s;
    return (m - k) * normCdf(d) + s * normPdf(d);
  }
  // two-leg crack spread volatility from product & crude lognormal volatilities and correlation rho over horizon T
  function crackVolFromCorr(fProd, sigProd, fCrude, sigCrude, rho, T) {
    var dt = T === undefined ? 1 : T;
    var sP = fProd * sigProd * Math.sqrt(dt), sC = fCrude * sigCrude * Math.sqrt(dt);
    return Math.sqrt(Math.max(0, sP * sP + sC * sC - 2 * rho * sP * sC));
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussian(rnd) {
    var u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function runOptionMC(m, s, k, n, seed) {
    var rnd = mulberry32(seed || 7), acc = 0;
    for (var i = 0; i < n; i++) acc += Math.max(m + s * gaussian(rnd) - k, 0);
    return acc / n;
  }

  // ---------- mean-reverting crack simulation and hedge P&L ----------
  // Ornstein–Uhlenbeck, exact discretisation: x' = mu + (x - mu) e^{-k dt} + sigma sqrt((1-e^{-2k dt})/(2k)) Z
  function simulateOU(o) {
    var rnd = mulberry32(o.seed || 11);
    var e = Math.exp(-o.kappa * o.dt);
    var sd = o.kappa > 0 ? o.sigma * Math.sqrt((1 - e * e) / (2 * o.kappa)) : o.sigma * Math.sqrt(o.dt);
    var paths = [];
    for (var p = 0; p < o.n; p++) {
      var x = o.x0, path = [];
      for (var t = 0; t < o.steps; t++) { x = o.mu + (x - o.mu) * e + sd * gaussian(rnd); path.push(x); }
      paths.push(path);
    }
    return paths;
  }
  function ouExpected(x0, mu, kappa, t) { return mu + (x0 - mu) * Math.exp(-kappa * t); }
  // monthly margin over a horizon; hedge = sell crack swaps at their fair (expected) level for a fraction h of volume
  function hedgeOutcomes(o) { // {x0, mu, kappa, sigma, months, volume, opex, hedge, n, seed}
    var dt = 1 / 12;
    var paths = simulateOU({ x0: o.x0, mu: o.mu, kappa: o.kappa, sigma: o.sigma, dt: dt, steps: o.months, n: o.n, seed: o.seed });
    var fixed = []; for (var t = 1; t <= o.months; t++) fixed.push(ouExpected(o.x0, o.mu, o.kappa, t * dt));
    var un = [], he = [];
    paths.forEach(function (p) {
      var u = 0, h = 0;
      p.forEach(function (c, t) {
        var phys = o.volume * (c - o.opex);
        u += phys;
        h += phys + o.hedge * o.volume * (fixed[t] - c);
      });
      un.push(u); he.push(h);
    });
    return { unhedged: un, hedged: he, swapLevels: fixed, samplePaths: paths.slice(0, 12) };
  }
  function stats(a) {
    var n = a.length, m = a.reduce(function (x, y) { return x + y; }, 0) / n;
    var v = a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / (n - 1);
    var s = a.slice().sort(function (x, y) { return x - y; });
    var q = function (p) { var i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
    return { mean: m, sd: Math.sqrt(v), p5: q(0.05), p50: q(0.5), p95: q(0.95), min: s[0], max: s[n - 1], probNeg: s.filter(function (x) { return x < 0; }).length / n };
  }

  var api = {
    GAL_PER_BBL: GAL_PER_BBL, BBL_PER_M3: BBL_PER_M3,
    apiFromSG: apiFromSG, sgFromAPI: sgFromAPI, bblPerTonne: bblPerTonne, perBblFromPerTonne: perBblFromPerTonne,
    perTonneFromPerBbl: perTonneFromPerBbl, perBblFromPerGal: perBblFromPerGal,
    blendCrudes: blendCrudes, blendLinear: blendLinear,
    rvpIndex: rvpIndex, rvpFromIndex: rvpFromIndex, blendRVP: blendRVP, blendOctane: blendOctane, butaneForRVP: butaneForRVP,
    vbiFromCst: vbiFromCst, cstFromVbi: cstFromVbi, blendViscosity: blendViscosity, cutterShareForVisc: cutterShareForVisc,
    lpMinimize: lpMinimize, optimizeGasoline: optimizeGasoline, GASOLINE_COMPONENTS: [
      { name: 'Butane', rvp: 52, aki: 91, cost: 50, max: 10 },
      { name: 'Light straight-run naphtha', rvp: 12, aki: 68, cost: 66, max: 25 },
      { name: 'Isomerate', rvp: 13, aki: 85, cost: 80, max: 20 },
      { name: 'FCC naphtha', rvp: 5, aki: 86.5, cost: 84, max: 45 },
      { name: 'Reformate', rvp: 3, aki: 93, cost: 90, max: 40 },
      { name: 'Alkylate', rvp: 5, aki: 94.5, cost: 97, max: 20 }],
    nelsonIndex: nelsonIndex, conversionCapacity: conversionCapacity, classify: classify, stylizedYields: stylizedYields, STYLE: STYLE, CRUDES: CRUDES,
    OGJ_CF: { vdu: 2, fcc: 6, hc: 6, coker: 6, ref: 5, ht: 2, alk: 10 },
    REF_PRICES: { lpg: 34, gasoline: 101, jet: 107, diesel: 110, fuelOil: 64, coke: 8 },
    // illustrative value-in-use yield vectors (fractions of crude volume) and crude-specific processing costs ($/bbl)
    VIU: {
      coking: {
        light: { yields: { lpg: 0.04, naphtha: 0, gasoline: 0.48, jet: 0.10, diesel: 0.30, fuelOil: 0.08, coke: 0 }, varCost: 2.40 },
        medium: { yields: { lpg: 0.04, naphtha: 0, gasoline: 0.44, jet: 0.09, diesel: 0.34, fuelOil: 0.05, coke: 0.05 }, varCost: 3.00 },
        heavy: { yields: { lpg: 0.03, naphtha: 0, gasoline: 0.36, jet: 0.07, diesel: 0.33, fuelOil: 0.13, coke: 0.10 }, varCost: 3.70 },
        condensate: { yields: { lpg: 0.08, naphtha: 0.45, gasoline: 0.20, jet: 0.10, diesel: 0.15, fuelOil: 0.02, coke: 0 }, varCost: 2.20 }
      },
      cracking: {
        light: { yields: { lpg: 0.04, naphtha: 0, gasoline: 0.48, jet: 0.10, diesel: 0.30, fuelOil: 0.08, coke: 0 }, varCost: 2.40 },
        medium: { yields: { lpg: 0.03, naphtha: 0, gasoline: 0.42, jet: 0.09, diesel: 0.30, fuelOil: 0.17, coke: 0 }, varCost: 2.90 },
        heavy: { yields: { lpg: 0.02, naphtha: 0, gasoline: 0.32, jet: 0.07, diesel: 0.27, fuelOil: 0.33, coke: 0 }, varCost: 3.40 },
        condensate: { yields: { lpg: 0.08, naphtha: 0.45, gasoline: 0.20, jet: 0.10, diesel: 0.15, fuelOil: 0.02, coke: 0 }, varCost: 2.20 }
      }
    },
    gpw: gpw, marginStack: marginStack, crack: crack, swapSettlement: swapSettlement,
    breakevenCrude: breakevenCrude, valueInUseDiff: valueInUseDiff, diffSensitivity: diffSensitivity,
    normCdf: normCdf, normPdf: normPdf, runOptionNormal: runOptionNormal, crackVolFromCorr: crackVolFromCorr, runOptionMC: runOptionMC,
    mulberry32: mulberry32, gaussian: gaussian, simulateOU: simulateOU, ouExpected: ouExpected, hedgeOutcomes: hedgeOutcomes, stats: stats
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C2 = api;
})(typeof window !== 'undefined' ? window : this);
