/* Course 8 calculation library — real options and the valuation of flexibility. Browser: window.C8; Node: module.exports. */
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
  function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function sd(a) { var m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
  function bs(S, K, T, r, sigma, q, type) {
    var sv = sigma * Math.sqrt(T), d1 = (Math.log(S / K) + (r - (q || 0) + sigma * sigma / 2) * T) / sv, d2 = d1 - sv;
    return type === 'put' ? K * Math.exp(-r * T) * ncdf(-d2) - S * Math.exp(-(q || 0) * T) * ncdf(-d1) : S * Math.exp(-(q || 0) * T) * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2);
  }

  // ---------- M1 NPV, decision trees, real options ----------
  // perpetual-margin project: invest I for one unit a year forever, first unit now; margin today P0 then permanently up/down
  function waitExample(o) { // {P0, up, down, q, I, r}
    var pv = function (P, first) { return P * (1 + o.r) / o.r * (first ? 1 : 1); }; // Σ_{t≥0} P/(1+r)^t
    var EP1 = o.q * o.up + (1 - o.q) * o.down;
    var nowV = o.P0 + EP1 / o.r; // P0 now + expected perpetual from year 1
    var npvNow = nowV - o.I;
    var up1 = o.up * (1 + o.r) / o.r - o.I, dn1 = o.down * (1 + o.r) / o.r - o.I; // value at t=1 of investing then
    var npvWait = (o.q * Math.max(up1, 0) + (1 - o.q) * Math.max(dn1, 0)) / (1 + o.r);
    return { V0: nowV, npvNow: npvNow, npvWait: npvWait, option: npvWait - npvNow, up1: up1, dn1: dn1 };
  }
  // one-period replication with a twin security (price S0, payoffs Su/Sd) and a riskless bond
  function replicate(Cu, Cd, Su, Sd, S0, rf) { var m = (Cu - Cd) / (Su - Sd), B = (Cu - m * Su) / (1 + rf); return { m: m, B: B, value: m * S0 + B }; }
  function impliedRate(expected, value) { return expected / value - 1; }

  // ---------- M2 lattices ----------
  function crr(sigma, dt, r, delta) { var u = Math.exp(sigma * Math.sqrt(dt)), d = 1 / u; return { u: u, d: d, p: (Math.exp((r - (delta || 0)) * dt) - d) / (u - d), disc: Math.exp(-r * dt) }; }
  // project value V (already owned) with American abandonment / expansion / contraction; or an undeveloped project (defer)
  // Nodes carry W = value of the project plus its remaining options. An owned project pays out δ·V each year (its free cash flow),
  // so holding = payout + discounted expected W; exercising abandonment/expansion/contraction ends the remaining options.
  function realLattice(o) { // {V0, sigma, r, delta, T, n, defer:{I}, abandon:{S}, expand:{x, I}, contract:{c, S}}
    var dt = o.T / o.n, k = crr(o.sigma, dt, o.r, o.delta), n = o.n, W = [], i, j, payout = 1 - Math.exp(-(o.delta || 0) * dt);
    function alts(v) {
      var a = [];
      if (o.defer) a.push(v - o.defer.I);
      if (o.abandon) a.push(o.abandon.S);
      if (o.expand) a.push(v * (1 + o.expand.x) - o.expand.I);
      if (o.contract) a.push(v * (1 - o.contract.c) + o.contract.S);
      return a.length ? Math.max.apply(null, a) : -Infinity;
    }
    for (j = 0; j <= n; j++) { var vT = o.V0 * Math.pow(k.u, j) * Math.pow(k.d, n - j); W.push(Math.max(o.defer ? 0 : vT, alts(vT))); }
    for (i = n - 1; i >= 0; i--) {
      var NW = [];
      for (j = 0; j <= i; j++) {
        var v = o.V0 * Math.pow(k.u, j) * Math.pow(k.d, i - j), cont = k.disc * (k.p * W[j + 1] + (1 - k.p) * W[j]);
        var hold = o.defer ? cont : payout * v + cont;
        NW.push(Math.max(hold, alts(v)));
      }
      W = NW;
    }
    var base = o.defer ? Math.max(0, o.V0 - o.defer.I) : o.V0;
    return { value: W[0], base: base, option: W[0] - base, p: k.p, u: k.u };
  }
  // European check on the same lattice
  function latticeEuro(S, K, T, r, sigma, q, n, type) {
    var dt = T / n, k = crr(sigma, dt, r, q), V = [];
    for (var j = 0; j <= n; j++) { var s = S * Math.pow(k.u, j) * Math.pow(k.d, n - j); V.push(Math.max(0, type === 'put' ? K - s : s - K)); }
    for (var i = n - 1; i >= 0; i--) { var NV = []; for (j = 0; j <= i; j++) NV.push(k.disc * (k.p * V[j + 1] + (1 - k.p) * V[j])); V = NV; }
    return V[0];
  }
  // sequential compound: pay I1 at T1 for the right to invest I2 at T2 (both European, CRR lattice)
  function compoundSeq(o) { // {V0, sigma, r, delta, T1, I1, T2, I2, n}
    var dt = o.T2 / o.n, k = crr(o.sigma, dt, o.r, o.delta), n1 = Math.round(o.T1 / dt), V = [], j, i;
    for (j = 0; j <= o.n; j++) V.push(Math.max(0, o.V0 * Math.pow(k.u, j) * Math.pow(k.d, o.n - j) - o.I2));
    for (i = o.n - 1; i >= 0; i--) {
      var NV = [];
      for (j = 0; j <= i; j++) { var c = k.disc * (k.p * V[j + 1] + (1 - k.p) * V[j]); NV.push(i === n1 ? Math.max(0, c - o.I1) : c); }
      V = NV;
    }
    var stage2Now = latticeEuro(o.V0, o.I2, o.T2, o.r, o.sigma, o.delta, o.n, 'call');
    return { value: V[0], stage2: stage2Now, npvCommitted: o.V0 * Math.exp(-o.delta * o.T2) - o.I2 * Math.exp(-o.r * o.T2) - o.I1 * Math.exp(-o.r * o.T1) };
  }

  // ---------- M3 investment timing (McDonald–Siegel / Dixit–Pindyck ch.5) ----------
  function beta1(r, delta, sigma) { var a = 0.5 - (r - delta) / (sigma * sigma); return a + Math.sqrt(a * a + 2 * r / (sigma * sigma)); }
  function beta2(r, delta, sigma) { var a = 0.5 - (r - delta) / (sigma * sigma); return a - Math.sqrt(a * a + 2 * r / (sigma * sigma)); }
  function timing(V, I, r, delta, sigma) {
    var b = beta1(r, delta, sigma), Vs = b / (b - 1) * I, A = (Vs - I) / Math.pow(Vs, b);
    return { beta: b, Vstar: Vs, multiple: b / (b - 1), F: V >= Vs ? V - I : A * Math.pow(V, b), A: A, npv: V - I, invest: V >= Vs };
  }

  // ---------- M4 entry, exit, lay-up (Dixit–Pindyck ch.7) ----------
  // active firm earns (P − C) per year; P is GBM with yield δ; invest cost I, exit cost E. Solve PH, PL by Newton.
  function entryExit(o) { // {C, I, E, r, delta, sigma}
    var b1 = beta1(o.r, o.delta, o.sigma), b2 = beta2(o.r, o.delta, o.sigma), r = o.r, d = o.delta, C = o.C;
    function coef(PH) { // from value matching and smooth pasting at PH: A1 PH^b1 − B2 PH^b2 = PH/d − C/r − I ; b1 A1 PH^(b1−1) − b2 B2 PH^(b2−1) = 1/d
      var a11 = Math.pow(PH, b1), a12 = -Math.pow(PH, b2), a21 = b1 * Math.pow(PH, b1 - 1), a22 = -b2 * Math.pow(PH, b2 - 1);
      var y1 = PH / d - C / r - o.I, y2 = 1 / d, det = a11 * a22 - a12 * a21;
      return { A1: (y1 * a22 - a12 * y2) / det, B2: (a11 * y2 - a21 * y1) / det };
    }
    function resid(PH, PL) { var c = coef(PH); return [c.A1 * Math.pow(PL, b1) - c.B2 * Math.pow(PL, b2) - (PL / d - C / r + o.E), b1 * c.A1 * Math.pow(PL, b1 - 1) - b2 * c.B2 * Math.pow(PL, b2 - 1) - 1 / d]; }
    // damped Newton in log prices, started from the one-sided (entry-only, exit-only) triggers
    function scaled(PH, PL) { var f = resid(PH, PL); return [f[0] / (PL / d + 1), f[1] * d]; }
    var g = [Math.log(b1 / (b1 - 1) * d * (C / r + o.I)), Math.log(Math.max(1e-6, b2 / (b2 - 1) * d * (C / r - o.E)))];
    if (!isFinite(g[1])) g[1] = Math.log(Math.max(1e-3, C - r * o.E) * 0.5);
    for (var it = 0; it < 300; it++) {
      var PH = Math.exp(g[0]), PL = Math.exp(g[1]), f = scaled(PH, PL), h = 1e-7;
      var f0 = scaled(Math.exp(g[0] + h), PL), f1 = scaled(PH, Math.exp(g[1] + h));
      var J = [[(f0[0] - f[0]) / h, (f1[0] - f[0]) / h], [(f0[1] - f[1]) / h, (f1[1] - f[1]) / h]], det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      var s0 = (f[0] * J[1][1] - J[0][1] * f[1]) / det, s1 = (J[0][0] * f[1] - J[1][0] * f[0]) / det;
      var m = Math.max(Math.abs(s0), Math.abs(s1)), k = m > 0.3 ? 0.3 / m : 1;
      g = [g[0] - k * s0, g[1] - k * s1];
      if (g[1] >= g[0]) g[1] = g[0] - 0.1;
      if (m < 1e-12) break;
    }
    var c = coef(Math.exp(g[0]));
    return { PH: Math.exp(g[0]), PL: Math.exp(g[1]), A1: c.A1, B2: c.B2, WH: C + r * o.I, WL: C - r * o.E, b1: b1, b2: b2 };
  }
  // lattice with three operating states: active (earn P − C), mothballed (pay M), scrapped/idle (0; may re-enter by paying I if allowed)
  function mothball(o) { // {P0, C, r, delta, sigma, T, n, I, E (scrap from active), M (mothball upkeep / yr), EM (cost to mothball), R (reactivate), ES (scrap from mothball), allowMothball, start:'active'|'idle'}
    var dt = o.T / o.n, k = crr(o.sigma, dt, o.r, o.delta), n = o.n, A = [], Mb = [], Id = [], j, i;
    for (j = 0; j <= n; j++) { A.push(0); Mb.push(-1e12); Id.push(0); }
    // terminal: no value beyond horizon (long horizon makes this immaterial)
    var big = -1e12;
    for (j = 0; j <= n; j++) { A[j] = Math.max(0, -o.E); Mb[j] = o.allowMothball ? Math.max(-o.ES, big) : big; Id[j] = 0; }
    for (i = n - 1; i >= 0; i--) {
      var NA = [], NM = [], NI = [];
      for (j = 0; j <= i; j++) {
        var P = o.P0 * Math.pow(k.u, j) * Math.pow(k.d, i - j);
        var cA = (P - o.C) * dt + k.disc * (k.p * A[j + 1] + (1 - k.p) * A[j]);
        var cM = o.allowMothball ? -o.M * dt + k.disc * (k.p * Mb[j + 1] + (1 - k.p) * Mb[j]) : big;
        var cI = k.disc * (k.p * Id[j + 1] + (1 - k.p) * Id[j]);
        var vA = Math.max(cA, cI - o.E, o.allowMothball ? cM - o.EM : big);
        var vM = o.allowMothball ? Math.max(cM, cA - o.R, cI - o.ES) : big;
        var vI = o.reenter ? Math.max(cI, cA - o.I) : cI;
        NA.push(vA); NM.push(vM); NI.push(vI);
      }
      A = NA; Mb = NM; Id = NI;
    }
    return { active: A[0], mothballed: Mb[0], idle: Id[0] };
  }

  // ---------- M5 volatility estimation and staged cases ----------
  // Copeland-style consolidated volatility: simulate year-1 price shock with AR(1) persistence and recompute PV
  function consolidatedVol(o) { // {prices[], qty[], vc[], fixed, wacc, sdP (lognormal sd of price), rho (autocorrelation of log errors), paths, seed}
    var z = normals(o.seed || 31), T = o.prices.length;
    function pvFrom(t0, pr) { var v = 0; for (var t = t0; t < T; t++) v += (pr[t] - o.vc[t]) * o.qty[t] - o.fixed; return v; }
    function disc(cfs, t0) { var v = 0; for (var t = t0; t < T; t++) v += cfs[t] / Math.pow(1 + o.wacc, t - t0 + 1); return v; }
    var cf0 = o.prices.map(function (p, t) { return (p - o.vc[t]) * o.qty[t] - o.fixed; });
    var PV0 = disc(cf0, 0), zs = [], clamped = 0;
    if (!(PV0 > 0)) return { PV0: PV0, sigma: NaN, meanRet: NaN, clamped: 0 }; // log returns are undefined for a non-positive base value
    for (var k = 0; k < o.paths; k++) {
      var e = z() * o.sdP, pr = o.prices.map(function (p, t) { var et = e * Math.pow(o.rho, t); return p * Math.exp(et - 0.5 * o.sdP * o.sdP * Math.pow(o.rho, 2 * t)); });
      var cf = pr.map(function (p, t) { return (p - o.vc[t]) * o.qty[t] - o.fixed; });
      var PV1 = disc(cf, 1);
      var V1 = PV1 + cf[0];
      if (V1 <= 1e-4 * PV0) clamped++; // value wiped out on this draw: floor it so the log exists, and report how often
      zs.push(Math.log(Math.max(1e-4 * PV0, V1) / PV0));
    }
    return { PV0: PV0, sigma: sd(zs), meanRet: mean(zs), clamped: clamped };
  }

  var api = { rng: rng, normals: normals, ncdf: ncdf, mean: mean, sd: sd, bs: bs,
    waitExample: waitExample, replicate: replicate, impliedRate: impliedRate,
    crr: crr, realLattice: realLattice, latticeEuro: latticeEuro, compoundSeq: compoundSeq,
    beta1: beta1, beta2: beta2, timing: timing, entryExit: entryExit, mothball: mothball, consolidatedVol: consolidatedVol };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C8 = api;
})(typeof window !== 'undefined' ? window : this);
