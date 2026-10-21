/* Course 12 calculation library — market and counterparty risk: VaR and ES, portfolio VaR, backtesting, liquidity and stress, exposure, CVA, wrong-way risk, FVA, MVA and KVA. Browser: window.C12; Node: module.exports. */
(function (root) {
  'use strict';

  // Hart's double-precision normal CDF (West 2005)
  function ncdf(x) {
    var a = Math.abs(x), c = 0;
    if (a <= 37) {
      var e = Math.exp(-a * a / 2), b;
      if (a < 7.07106781186547) {
        b = 3.52624965998911e-2 * a + 0.700383064443688; b = b * a + 6.37396220353165; b = b * a + 33.912866078383;
        b = b * a + 112.079291497871; b = b * a + 221.213596169931; b = b * a + 220.206867912376;
        c = e * b;
        b = 8.83883476483184e-2 * a + 1.75566716318264; b = b * a + 16.064177579207; b = b * a + 86.7807322029461;
        b = b * a + 296.564248779674; b = b * a + 637.333633378831; b = b * a + 793.826512519948; b = b * a + 440.413735824752;
        c = c / b;
      } else {
        b = a + 0.65; b = a + 4 / b; b = a + 3 / b; b = a + 2 / b; b = a + 1 / b; c = e / b / 2.506628274631;
      }
    }
    return x > 0 ? 1 - c : c;
  }
  function npdf(x) { return Math.exp(-x * x / 2) / 2.5066282746310002; }
  // inverse normal: Acklam's rational approximation polished by two Newton steps
  function ninv(p) {
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var q, r, x;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    for (var k = 0; k < 2; k++) x -= (ncdf(x) - p) / npdf(x);
    return x;
  }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function lgamma(x) {
    var g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    var s = 1.000000000190015; for (var j = 0; j < 6; j++) s += g[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  // regularised incomplete beta by continued fraction (Numerical Recipes)
  function betacf(a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, m, m2, aa, del, h;
    if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; h = d;
    for (m = 1; m <= 300; m++) {
      m2 = 2 * m; aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  // Student t with nu degrees of freedom
  function tcdf(t, nu) { var x = nu / (nu + t * t), p = 0.5 * ibeta(x, nu / 2, 0.5); return t > 0 ? 1 - p : p; }
  function tpdf(t, nu) { return Math.exp(lgamma((nu + 1) / 2) - lgamma(nu / 2)) / Math.sqrt(nu * Math.PI) * Math.pow(1 + t * t / nu, -(nu + 1) / 2); }
  function tinv(p, nu) {
    var lo = -200, hi = 200;
    for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2; if (tcdf(mid, nu) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  // ---------- M1 VaR and expected shortfall ----------
  // losses are positive numbers; sigma is the standard deviation of value changes per day
  function varNormal(pos, sigma, c, days) { return ninv(c) * sigma * Math.sqrt(days || 1) * pos; }
  function esNormal(pos, sigma, c, days) { return npdf(ninv(c)) / (1 - c) * sigma * Math.sqrt(days || 1) * pos; }
  // Student t scaled to the same standard deviation (nu > 2)
  function varT(pos, sigma, c, nu, days) { return tinv(c, nu) * Math.sqrt((nu - 2) / nu) * sigma * Math.sqrt(days || 1) * pos; }
  function esT(pos, sigma, c, nu, days) {
    var q = tinv(c, nu);
    return (nu + q * q) / (nu - 1) * tpdf(q, nu) / (1 - c) * Math.sqrt((nu - 2) / nu) * sigma * Math.sqrt(days || 1) * pos;
  }
  function convert(c1, d1, c2, d2) { return ninv(c2) / ninv(c1) * Math.sqrt(d2 / d1); }

  // ---------- M2 portfolio VaR ----------
  // x: dollar exposures; s: daily volatilities; R: correlation matrix
  function portfolio(x, s, R, c) {
    var n = x.length, z = ninv(c), Sx = [], v = 0, i, j;
    for (i = 0; i < n; i++) { var t = 0; for (j = 0; j < n; j++) t += R[i][j] * s[i] * s[j] * x[j]; Sx.push(t); v += x[i] * t; }
    var sd = Math.sqrt(v), VaR = z * sd;
    var indiv = x.map(function (xi, k) { return z * s[k] * Math.abs(xi); });
    var marginal = Sx.map(function (t) { return z * t / sd; });
    var component = marginal.map(function (m, k) { return m * x[k]; });
    return { sd: sd, var: VaR, undiversified: sum(indiv), individual: indiv, marginal: marginal, component: component,
      share: component.map(function (cv) { return cv / VaR; }) };
  }
  // exposure in asset i that minimises portfolio variance given the others
  function bestHedge(x, s, R, i) {
    var t = 0; for (var j = 0; j < x.length; j++) if (j !== i) t += R[i][j] * s[i] * s[j] * x[j];
    return -t / (s[i] * s[i]);
  }
  // Jorion eq. 10.11: monotonic payoff, gamma in units of the underlying per $ of price
  function deltaGammaVaR(delta, gamma, S, sigma, c) {
    var m = ninv(c) * sigma * S;
    return { linear: Math.abs(delta) * m, total: Math.abs(delta) * m - 0.5 * gamma * m * m };
  }
  function seasonalScale(r, sNow, sThen) { return r * sNow / sThen; }

  // ---------- M3 backtesting, liquidity and stress ----------
  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
  function binomPmf(k, n, p) { return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)); }
  function binomAtLeast(k, n, p) { var s = 0; for (var i = k; i <= n; i++) s += binomPmf(i, n, p); return s; }
  function zTest(N, T, p) { return (N - p * T) / Math.sqrt(p * (1 - p) * T); }
  function kupiec(N, T, p) {
    var ph = N / T;
    var l0 = (T - N) * Math.log(1 - p) + N * Math.log(p);
    var l1 = (N === T ? 0 : (T - N) * Math.log(1 - ph)) + (N === 0 ? 0 : N * Math.log(ph));
    return -2 * (l0 - l1);
  }
  // normal losses; a model claims confidence cClaimed but its VaR is really the cActual quantile (cActual < cClaimed
  // understates risk). Returns the probability that a day's loss exceeds the model's cTest VaR, i.e. the exception rate
  // a cTest backtest actually faces. Jorion's 97% model reported as 99%: exceptionProb(0.97, 0.99, 0.95) = 9.2%
  function exceptionProb(cActual, cClaimed, cTest) { return ncdf(-ninv(cTest) / convert(cActual, 1, cClaimed, 1)); }
  function baselZone(N) {
    if (N <= 4) return { zone: 'Green', plus: 0 };
    if (N >= 10) return { zone: 'Red', plus: 1 };
    return { zone: 'Yellow', plus: [0.40, 0.50, 0.65, 0.75, 0.85][N - 5] };
  }
  function lvar(VaR, pos, spread) { return VaR + 0.5 * pos * spread; }
  // variance of uniform liquidation over n days, in units of one day's variance (Jorion eq. 13.8)
  function liquidationDays(n) { return (n - 1) * (2 * n - 1) / (6 * n); }

  // ---------- M4 exposure of a monthly commodity swap ----------
  // par fixed-for-floating swap, Q per month for M months; one-factor forward with volatility sig and mean reversion kappa
  // returns monthly grid t_k (after the k-th settlement) with the value standard deviation s(t)
  function swapProfile(o) {
    var M = Math.round(12 * o.years), kap = o.kappa || 0, out = [];
    for (var k = 0; k <= M; k++) {
      var t = k / 12, A = 0;
      for (var m = k + 1; m <= M; m++) A += Math.exp(-kap * (m / 12 - t));
      var B = kap > 0 ? Math.sqrt((1 - Math.exp(-2 * kap * t)) / (2 * kap)) : Math.sqrt(t);
      out.push({ t: t, rem: M - k, s: o.Q * o.F * o.sig * A * B, sMpor: o.Q * o.F * o.sig * A * Math.sqrt((o.mporDays || 10) / 252) });
    }
    return out;
  }
  function epeNormal(mu, s) { return s > 0 ? mu * ncdf(mu / s) + s * npdf(mu / s) : Math.max(mu, 0); }
  function eneNormal(mu, s) { return mu - epeNormal(mu, s); }
  function pfeNormal(mu, s, c) { return mu + ninv(c) * s; }
  // collateral with threshold L called on the value one margin period earlier: exposure = max(min(V_prev, L) + dV, 0)
  function epeCollateral(s, sM, L) {
    var s1 = Math.sqrt(Math.max(0, s * s - sM * sM));
    if (s1 <= 0) return epeNormal(0, sM);
    var n = 400, lo = -8 * s1, h = 16 * s1 / n, acc = 0;
    for (var i = 0; i <= n; i++) {
      var x = lo + i * h, a = Math.min(x, L), w = (i === 0 || i === n) ? 1 : (i % 2 ? 4 : 2);
      acc += w * epeNormal(a, sM) * npdf(x / s1) / s1;
    }
    return acc * h / 3;
  }
  function exposure(o) {
    var prof = swapProfile(o), c = o.conf || 0.95;
    return prof.map(function (p) {
      var e = epeNormal(0, p.s), pfe = Math.max(0, pfeNormal(0, p.s, c));
      var ec = o.threshold === undefined ? e : epeCollateral(p.s, p.sMpor, o.threshold);
      var pc = o.threshold === undefined ? pfe : Math.min(pfe, o.threshold + ninv(c) * p.sMpor);
      return { t: p.t, rem: p.rem, s: p.s, sMpor: p.sMpor, epe: e, pfe: pfe, epeC: ec, pfeC: Math.max(0, pc) };
    });
  }
  function profileStats(ex, key) {
    var best = ex[0], tot = 0;
    ex.forEach(function (e) { if (e[key] > best[key]) best = e; });
    for (var i = 1; i < ex.length; i++) tot += ex[i][key];
    return { peak: best[key], tPeak: best.t, average: tot / (ex.length - 1) };
  }

  // ---------- M5 CVA and wrong-way risk ----------
  // Gregory eq. 12.1: unconditional default probability between t1 and t2 from a flat spread
  function pdInterval(t1, t2, spread, lgd) { return Math.exp(-spread * t1 / lgd) - Math.exp(-spread * t2 / lgd); }
  function cumPd(t, spread, lgd) { return 1 - Math.exp(-spread * t / lgd); }
  // EPE conditional on default at t under a one-factor Gaussian link with wrong-way correlation rho
  function epeWwr(s, t, spread, lgd, rho) {
    var F = cumPd(t, spread, lgd);
    if (F <= 0 || rho === 0) return epeNormal(0, s);
    var c = ninv(F);
    return epeNormal(-rho * c * s, Math.sqrt(1 - rho * rho) * s);
  }
  // Gregory eq. 17.3 with risk-free discounting of the interval-end EPE
  function cva(ex, o) {
    var tot = 0, key = o.key || 'epe';
    if (o.rho && key !== 'epe') throw new Error('cva: wrong-way risk is only modelled on the uncollateralised profile');
    for (var i = 1; i < ex.length; i++) {
      var pd = pdInterval(ex[i - 1].t, ex[i].t, o.spread, o.lgd), df = Math.exp(-(o.r || 0) * ex[i].t);
      var epe = o.rho ? epeWwr(ex[i].s, ex[i].t, o.spread, o.lgd, o.rho) : ex[i][key];
      tot += o.lgd * epe * pd * df;
    }
    return tot;
  }
  function cvaApprox(ex, o) { return profileStats(ex, o.key || 'epe').average * o.spread * (ex[ex.length - 1].t); }

  // ---------- M6 funding, margin and capital ----------
  function costIntegral(ex, rate, fn, r) {
    var tot = 0;
    for (var i = 1; i < ex.length; i++) tot += fn(ex[i]) * rate * (ex[i].t - ex[i - 1].t) * Math.exp(-(r || 0) * ex[i].t);
    return tot;
  }
  function fca(ex, fs, r, key) { return costIntegral(ex, fs, function (e) { return e[key || 'epe']; }, r); }
  // initial margin as a 99% margin-period VaR of the remaining position
  function eim(e, c) { return ninv(c || 0.99) * e.sMpor; }
  function mva(ex, fs, r, c) { return costIntegral(ex, fs, function (e) { return eim(e, c); }, r); }
  // capital = ratio × alpha × EPE (an IMM-style simplification); KVA = cost of capital on that profile
  function kva(ex, cc, r, o) { o = o || {}; var ratio = o.ratio || 0.08, alpha = o.alpha || 1.4, key = o.key || 'epe';
    return costIntegral(ex, cc, function (e) { return ratio * alpha * e[key]; }, r); }
  // variation margin a counterparty may have to post over a horizon: c-quantile of the change in swap value
  function marginAtRisk(o, c, months) {
    var M = Math.round(12 * o.years), kap = o.kappa || 0, A = 0;
    for (var m = 1; m <= M; m++) A += Math.exp(-kap * m / 12);
    return ninv(c) * o.Q * o.F * o.sig * A * Math.sqrt(months / 12);
  }

  var api = { ncdf: ncdf, npdf: npdf, ninv: ninv, sum: sum, lgamma: lgamma, ibeta: ibeta, tcdf: tcdf, tpdf: tpdf, tinv: tinv,
    varNormal: varNormal, esNormal: esNormal, varT: varT, esT: esT, convert: convert,
    portfolio: portfolio, bestHedge: bestHedge, deltaGammaVaR: deltaGammaVaR, seasonalScale: seasonalScale,
    binomPmf: binomPmf, binomAtLeast: binomAtLeast, zTest: zTest, kupiec: kupiec, exceptionProb: exceptionProb, baselZone: baselZone, lvar: lvar, liquidationDays: liquidationDays,
    swapProfile: swapProfile, epeNormal: epeNormal, eneNormal: eneNormal, pfeNormal: pfeNormal, epeCollateral: epeCollateral, exposure: exposure, profileStats: profileStats,
    pdInterval: pdInterval, cumPd: cumPd, epeWwr: epeWwr, cva: cva, cvaApprox: cvaApprox,
    fca: fca, eim: eim, mva: mva, kva: kva, marginAtRisk: marginAtRisk };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C12 = api;
})(typeof window !== 'undefined' ? window : this);
