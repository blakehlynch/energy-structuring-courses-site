/* Course 6 calculation library — forward curves and stochastic price models. Browser: window.C6; Node: module.exports. */
(function (root) {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
  // standard normals by Box–Muller from the seeded uniform generator
  function normals(seed) {
    var u = rng(seed), spare = null;
    return function () {
      if (spare !== null) { var t = spare; spare = null; return t; }
      var a = u() || 1e-12, b = u(), m = Math.sqrt(-2 * Math.log(a));
      spare = m * Math.sin(2 * Math.PI * b); return m * Math.cos(2 * Math.PI * b);
    };
  }
  // normal CDF (Abramowitz & Stegun 26.2.17, |error| < 7.5e-8)
  function ncdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
    var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }
  function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function sd(a) { var m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
  function corr(a, b) { var ma = mean(a), mb = mean(b), s = 0, sa = 0, sb = 0; for (var i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) * (a[i] - ma); sb += (b[i] - mb) * (b[i] - mb); } return s / Math.sqrt(sa * sb); }
  function quantile(a, q) { var s = a.slice().sort(function (x, y) { return x - y; }), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
  function exKurt(a) { var m = mean(a), v = 0, k = 0; a.forEach(function (x) { var d = (x - m) * (x - m); v += d; k += d * d; }); v /= a.length; k /= a.length; return k / (v * v) - 3; }

  // ---------- M1 carry and convenience yield ----------
  // full cost of carry with continuous rates: F = S e^{(r + w − δ)T}
  function carryForward(S, r, w, d, T) { return S * Math.exp((r + w - d) * T); }
  // convenience yield implied by an observed forward (net of storage w): δ = r + w − ln(F/S)/T
  function impliedConvYield(S, F, r, w, T) { return r + w - Math.log(F / S) / T; }
  // annualised forward yield between two tenors
  function forwardYield(F1, F2, T1, T2) { return Math.log(F2 / F1) / (T2 - T1); }
  // cash-and-carry: buy spot, pay storage c ($/unit/yr), fund at r, sell forward; profit per unit at T
  function cashCarry(S, F, r, c, T) { return F - S * Math.exp(r * T) - c * T; }
  // time spread captured by storage: buy month 1, sell month 2; costs in $/unit, financing on the purchase price
  function storageSpread(F1, F2, r, dt, cost) { return F2 - F1 * Math.exp(r * dt) - cost; }
  // rolling a long position through a static curve: value multiplier after n rolls from F1 into F2
  function rollDecay(F1, F2, n) { return Math.pow(F1 / F2, n); }

  // ---------- M2 curve building ----------
  // scale a seasonal shape so each quoted block (e.g. a season strip) prices back exactly (weighted by days or hours)
  function shapeToQuotes(quotes, shape, weights) {
    var out = shape.slice();
    quotes.forEach(function (q) {
      var sw = 0, sws = 0;
      q.months.forEach(function (m) { sw += weights[m]; sws += weights[m] * shape[m]; });
      q.months.forEach(function (m) { out[m] = q.price * shape[m] * sw / sws; });
    });
    return out;
  }
  function stripAverage(curve, months, weights) { var sw = 0, s = 0; months.forEach(function (m) { sw += weights[m]; s += weights[m] * curve[m]; }); return s / sw; }
  // a simple winter-peaked gas shape: cosine bump centred on January, amplitude a
  function gasShape(a) { var s = []; for (var m = 0; m < 12; m++) s.push(1 + a * Math.cos(2 * Math.PI * m / 12)); return s; }
  // power from fuel (the arbitrage/heat-rate approach): P = HR × gas + adder
  function heatRateCurve(gas, hr, adder) { return gas.map(function (g) { return hr * g + (adder || 0); }); }
  // off-peak price implied by baseload and peak quotes with hours hp and ho
  function offPeakFromBase(base, peak, hp, ho) { return (base * (hp + ho) - peak * hp) / ho; }

  // ---------- M3 mean reversion, Schwartz one-factor, jumps ----------
  function halfLife(a) { return Math.log(2) / a; }
  // log-OU path with optional Merton-style jumps: dx = a(lnL − x)dt + σ dz + J dq; returns prices
  function mrPath(o) { // {S0, L, a, sigma, dt, n, seed, jf (jumps/yr), jm (mean log jump), jv (jump vol)}
    var z = normals(o.seed || 11), u = rng((o.seed || 11) + 7), x = Math.log(o.S0), lnL = Math.log(o.L), out = [o.S0], jumps = 0;
    for (var i = 0; i < o.n; i++) {
      x += o.a * (lnL - x) * o.dt + o.sigma * Math.sqrt(o.dt) * z();
      if (o.jf && u() < o.jf * o.dt) { x += (o.jm || 0) + (o.jv || 0) * z(); jumps++; }
      out.push(Math.exp(x));
    }
    out.jumps = jumps;
    return out;
  }
  // regression of Δx on x (Clewlow & Strickland §2.9): Δx = a0 + a1 x + e → a = −a1/dt, level = exp(−a0/a1)
  function estimateMR(prices, dt) {
    var x = prices.map(Math.log), X = [], Y = [];
    for (var i = 1; i < x.length; i++) { X.push(x[i - 1]); Y.push(x[i] - x[i - 1]); }
    var mx = mean(X), my = mean(Y), sxy = 0, sxx = 0;
    for (var j = 0; j < X.length; j++) { sxy += (X[j] - mx) * (Y[j] - my); sxx += (X[j] - mx) * (X[j] - mx); }
    var a1 = sxy / sxx, a0 = my - a1 * mx;
    var res = Y.map(function (y, k) { return y - a0 - a1 * X[k]; });
    return { a: -a1 / dt, level: Math.exp(-a0 / a1), sigma: sd(res) / Math.sqrt(dt) };
  }
  // Schwartz (1997) one-factor forward: ln F = e^{−aτ} ln S + (1 − e^{−aτ}) α̂ + σ²/(4a)(1 − e^{−2aτ}), α̂ = μ − σ²/(2a) − λ
  function schwartzF(S, tau, a, mu, sigma, lambda) {
    var ah = mu - sigma * sigma / (2 * a) - (lambda || 0), e = Math.exp(-a * tau);
    return Math.exp(e * Math.log(S) + (1 - e) * ah + sigma * sigma / (4 * a) * (1 - e * e));
  }
  function schwartzFinf(a, mu, sigma, lambda) { return Math.exp(mu - (lambda || 0) - sigma * sigma / (4 * a)); }
  function schwartzVol(sigma, a, tau) { return sigma * Math.exp(-a * tau); }
  // recursive filter for jumps (Clewlow & Strickland §2.10): flag |r| > k·sd, re-estimate sd without them, repeat
  function recursiveFilter(returns, k, dt) {
    var flagged = returns.map(function () { return false; }), s = sd(returns), it = 0;
    for (; it < 50; it++) {
      var lim = k * s, changed = false;
      returns.forEach(function (r, i) { if (!flagged[i] && Math.abs(r) > lim) { flagged[i] = true; changed = true; } });
      var keep = returns.filter(function (_, i) { return !flagged[i]; });
      s = sd(keep);
      if (!changed) break;
    }
    var J = returns.filter(function (_, i) { return flagged[i]; });
    return { sigma: s / Math.sqrt(dt), jumps: J.length, freq: J.length / (returns.length * dt), meanJump: J.length ? mean(J) : 0, jumpVol: J.length > 1 ? sd(J) : 0, iterations: it + 1 };
  }
  function logReturns(p) { var r = []; for (var i = 1; i < p.length; i++) r.push(Math.log(p[i] / p[i - 1])); return r; }

  // ---------- M4 factor models and PCA ----------
  // two-exponential local volatility by tenor (Swindle eq. 5.10)
  function volTS(tau, s1, b1, b2, lam) { return Math.sqrt(s1 * s1 * (Math.exp(-2 * b1 * tau) + lam * Math.exp(-2 * b2 * tau))); }
  // instantaneous covariance of log returns for independent exponential factors [{s, b}], plus optional idiosyncratic noise
  function covMatrix(taus, factors, noise) {
    return taus.map(function (ti, i) { return taus.map(function (tj, j) {
      var c = 0; factors.forEach(function (f) { c += f.s * f.s * Math.exp(-f.b * (ti + tj)); });
      return c + (i === j ? (noise || 0) * (noise || 0) : 0);
    }); });
  }
  function corrFromCov(C, i, j) { return C[i][j] / Math.sqrt(C[i][i] * C[j][j]); }
  // cyclic Jacobi eigen-decomposition of a symmetric matrix; eigenvalues sorted descending with matching column vectors
  function eigSym(A0) {
    var n = A0.length, A = A0.map(function (r) { return r.slice(); }), V = A0.map(function (_, i) { return A0.map(function (__, j) { return i === j ? 1 : 0; }); });
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-22) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        var th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (var k = 0; k < n; k++) { var akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (k = 0; k < n; k++) { var apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (k = 0; k < n; k++) { var vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    var idx = A.map(function (_, i) { return i; }).sort(function (i, j) { return A[j][j] - A[i][i]; });
    return { values: idx.map(function (i) { return A[i][i]; }), vectors: idx.map(function (i) { var v = V.map(function (r) { return r[i]; }); var sgn = v.reduce(function (s, x) { return s + x; }, 0) < 0 ? -1 : 1; return v.map(function (x) { return sgn * x; }); }) };
  }
  // PCA of a covariance matrix: shares of variance and factor volatility functions v·√λ (Clewlow & Strickland §8.6.1)
  function pca(C) {
    var e = eigSym(C), tot = e.values.reduce(function (s, x) { return s + Math.max(0, x); }, 0);
    return { values: e.values, share: e.values.map(function (x) { return Math.max(0, x) / tot; }), loadings: e.vectors.map(function (v, k) { var r = Math.sqrt(Math.max(0, e.values[k])); return v.map(function (x) { return x * r; }); }) };
  }
  // simulate daily log returns from the factor model and estimate the sample covariance (annualised)
  function sampleCov(taus, factors, noise, n, dt, seed) {
    var z = normals(seed || 5), R = [];
    for (var d = 0; d < n; d++) {
      var zs = factors.map(function () { return z(); });
      R.push(taus.map(function (t) { var r = 0; factors.forEach(function (f, k) { r += f.s * Math.exp(-f.b * t) * zs[k]; }); return (r + (noise || 0) * z()) * Math.sqrt(dt); }));
    }
    var m = taus.map(function (_, i) { return mean(R.map(function (r) { return r[i]; })); });
    return taus.map(function (_, i) { return taus.map(function (__, j) { var s = 0; R.forEach(function (r) { s += (r[i] - m[i]) * (r[j] - m[j]); }); return s / (n - 1) / dt; }); });
  }
  // minimum-variance hedge ratio of contract T with liquid contract S (Swindle eq. 5.8)
  function hedgeRatio(FT, FS, sT, sS, rho) { return FT / FS * sT / sS * rho; }

  // ---------- M5 volatility, skew, correlation ----------
  function black76(F, K, T, sigma, r, type) {
    var df = Math.exp(-(r || 0) * T), sv = sigma * Math.sqrt(T), d1 = (Math.log(F / K) + sv * sv / 2) / sv, d2 = d1 - sv;
    return type === 'put' ? df * (K * ncdf(-d2) - F * ncdf(-d1)) : df * (F * ncdf(d1) - K * ncdf(d2));
  }
  // integral of e^{−2β(T−s)} over s in [0, τ]  (Swindle eq. 7.9)
  function phiInt(T, tau, b) { return (Math.exp(-2 * b * (T - tau)) - Math.exp(-2 * b * T)) / (2 * b); }
  // term (implied) volatility over [0, τ] for delivery T under the two-exponential local vol
  function termVol(s1, b1, b2, lam, T, tau) { return Math.sqrt(s1 * s1 * (phiInt(T, tau, b1) + lam * phiInt(T, tau, b2)) / tau); }
  // calibrate σ1 so the vanilla option expiring at Te reprices at implied vol iv
  function calibS1(iv, b1, b2, lam, T, Te) { return Math.sqrt(iv * iv * Te / (phiInt(T, Te, b1) + lam * phiInt(T, Te, b2))); }
  // simple quadratic smile in log-moneyness k = ln(K/F)  (illustrative parameterisation)
  function skewVol(atm, slope, curv, F, K) { var k = Math.log(K / F); return Math.max(0.01, atm + slope * k + curv * k * k); }
  function bisect(f, lo, hi) { var flo = f(lo); for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2, fm = f(mid); if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; } return (lo + hi) / 2; }
  // costless collar: put strike whose value equals the call's, each priced at its own skew vol
  function collarPutStrike(F, Kc, T, r, atm, slope, curv) {
    var call = black76(F, Kc, T, skewVol(atm, slope, curv, F, Kc), r, 'call');
    return bisect(function (Kp) { return black76(F, Kp, T, skewVol(atm, slope, curv, F, Kp), r, 'put') - call; }, F * 0.3, F);
  }
  // Margrabe: call on F1 − H·F2 with zero strike (Swindle eq. 9.5–9.7)
  function margrabe(F1, F2, H, T, s1, s2, rho, r) {
    var sv = Math.sqrt(T * (s1 * s1 + s2 * s2 - 2 * rho * s1 * s2)), d1 = (Math.log(F1 / (H * F2)) + sv * sv / 2) / sv;
    return Math.exp(-(r || 0) * T) * (F1 * ncdf(d1) - H * F2 * ncdf(d1 - sv));
  }
  function impliedCorr(price, F1, F2, H, T, s1, s2, r) { return bisect(function (rho) { return -(margrabe(F1, F2, H, T, s1, s2, rho, r) - price); }, -0.999, 0.999); }

  // ---------- Upper-graduate desk models: negative prices & HJM Samuelson vol ----------
  // Bachelier (normal model) for negative power/gas/crude prices
  function bachelier(F, K, T, sigmaN, r, type) {
    var df = Math.exp(-(r || 0) * T);
    var sT = sigmaN * Math.sqrt(T);
    var d = (F - K) / sT;
    var pdf = Math.exp(-0.5 * d * d) / Math.sqrt(2 * Math.PI);
    var call = df * ((F - K) * ncdf(d) + sT * pdf);
    return type === 'put' ? call - df * (F - K) : call;
  }
  // Shifted Black-76 model (displacement by shift s so F + s > 0, K + s > 0)
  function shiftedBlack76(F, K, shift, T, sigma, r, type) {
    return black76(F + shift, K + shift, T, sigma, r, type);
  }
  // HJM Samuelson integrated forward curve volatility over [0, T]
  function samuelsonIntegratedVol(sigma0, alpha, T) {
    if (alpha === 0 || T === 0) return sigma0;
    var v2 = (sigma0 * sigma0 / (2 * alpha * T)) * (1 - Math.exp(-2 * alpha * T));
    return Math.sqrt(v2);
  }

  // ---------- M6 hybrid (stack-based) power model ----------
  // stack transformation: price = gas × heat rate rising with utilisation + scarcity adder near capacity
  function stackPrice(load, gas, o) { // o {cap, h0, h1, adder, u0, capPrice, k}
    var u = load / o.cap, p = gas * (o.h0 + o.h1 * Math.min(u, 1)) + (o.adder || 0);
    if (u > o.u0) p += o.capPrice * Math.pow(Math.min(1, (u - o.u0) / (1 - o.u0)), o.k);
    return Math.min(p, o.capPrice);
  }
  // terminal distribution of power for one delivery period: load and gas drivers mapped through the stack
  function hybrid(o) { // {n, seed, loadMean, loadVol, gasF, gasVol, T, rho, stack}
    var z = normals(o.seed || 21), L = [], G = [], P = [];
    for (var i = 0; i < o.n; i++) {
      var z1 = z(), z2 = o.rho * z1 + Math.sqrt(1 - o.rho * o.rho) * z();
      var load = o.loadMean * (1 + o.loadVol * z1), sv = o.gasVol * Math.sqrt(o.T), gas = o.gasF * Math.exp(sv * z2 - sv * sv / 2);
      L.push(load); G.push(gas); P.push(stackPrice(load, gas, o.stack));
    }
    var spikes = P.filter(function (p, i) { return L[i] / o.stack.cap > o.stack.u0; }).length;
    return { load: L, gas: G, price: P, mean: mean(P), sd: sd(P), p50: quantile(P, 0.5), p99: quantile(P, 0.99), kurt: exKurt(P), corrPG: corr(P, G), spikeShare: spikes / o.n,
      atMean: stackPrice(o.loadMean, o.gasF, o.stack), ihr: mean(P) / o.gasF };
  }
  // multiplicative adjustment so the model distribution reprices the market forward (a minimal version of quote matching)
  function matchForward(prices, F) { var k = F / mean(prices); return { k: k, prices: prices.map(function (p) { return p * k; }) }; }

  var api = { rng: rng, normals: normals, ncdf: ncdf, mean: mean, sd: sd, corr: corr, quantile: quantile, exKurt: exKurt,
    carryForward: carryForward, impliedConvYield: impliedConvYield, forwardYield: forwardYield, cashCarry: cashCarry, storageSpread: storageSpread, rollDecay: rollDecay,
    shapeToQuotes: shapeToQuotes, stripAverage: stripAverage, gasShape: gasShape, heatRateCurve: heatRateCurve, offPeakFromBase: offPeakFromBase,
    halfLife: halfLife, mrPath: mrPath, estimateMR: estimateMR, schwartzF: schwartzF, schwartzFinf: schwartzFinf, schwartzVol: schwartzVol, recursiveFilter: recursiveFilter, logReturns: logReturns,
    volTS: volTS, covMatrix: covMatrix, corrFromCov: corrFromCov, eigSym: eigSym, pca: pca, sampleCov: sampleCov, hedgeRatio: hedgeRatio,
    black76: black76, bachelier: bachelier, shiftedBlack76: shiftedBlack76, samuelsonIntegratedVol: samuelsonIntegratedVol,
    phiInt: phiInt, termVol: termVol, calibS1: calibS1, skewVol: skewVol, bisect: bisect, collarPutStrike: collarPutStrike, margrabe: margrabe, impliedCorr: impliedCorr,
    stackPrice: stackPrice, hybrid: hybrid, matchForward: matchForward };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C6 = api;
})(typeof window !== 'undefined' ? window : this);
