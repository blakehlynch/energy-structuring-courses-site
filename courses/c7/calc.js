/* Course 7 calculation library — structured products: swaps, Asians, spreads, tolling, storage, swing, hedging. Browser: window.C7; Node: module.exports. */
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
  function black76(F, K, T, sigma, r, type) {
    var df = Math.exp(-(r || 0) * T);
    if (T <= 0 || sigma <= 0) return df * Math.max(0, type === 'put' ? K - F : F - K);
    var sv = sigma * Math.sqrt(T), d1 = (Math.log(F / K) + sv * sv / 2) / sv, d2 = d1 - sv;
    return type === 'put' ? df * (K * ncdf(-d2) - F * ncdf(-d1)) : df * (F * ncdf(d1) - K * ncdf(d2));
  }
  function bisect(f, lo, hi) { var flo = f(lo); for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2, fm = f(mid); if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; } return (lo + hi) / 2; }

  // ---------- M1 swaps and Asians ----------
  // fixed price of a strip swap: volume- and discount-weighted average forward
  function swapPrice(F, vol, df) { var n = 0, d = 0; F.forEach(function (f, i) { n += vol[i] * df[i] * f; d += vol[i] * df[i]; }); return n / d; }
  function swapMtm(fixed, F, vol, df) { var v = 0; F.forEach(function (f, i) { v += vol[i] * df[i] * (f - fixed); }); return v; }
  // Levy moment-matched arithmetic Asian on a flat forward with fixings at times t[] (years), paid at Tp
  function asianLevy(F, K, t, sigma, r, Tp, type) {
    var n = t.length, m1 = F, m2 = 0;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) m2 += Math.exp(sigma * sigma * Math.min(t[i], t[j]));
    m2 *= F * F / (n * n);
    var vT = Math.log(m2 / (m1 * m1));
    return black76(m1, K, 1, Math.sqrt(vT), 0, type) * Math.exp(-(r || 0) * Tp);
  }
  function asianVolEquiv(t, sigma) { var n = t.length, m2 = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) m2 += Math.exp(sigma * sigma * Math.min(t[i], t[j])); return Math.sqrt(Math.log(m2 / (n * n)) / t[n - 1]); }
  // Monte Carlo arithmetic Asian (driftless lognormal fixings) for verification
  function asianMC(F, K, t, sigma, r, Tp, paths, seed) {
    var z = normals(seed || 3), s = 0;
    for (var p = 0; p < paths; p++) {
      var x = 0, prev = 0, a = 0;
      for (var i = 0; i < t.length; i++) { var dt = t[i] - prev; x += -0.5 * sigma * sigma * dt + sigma * Math.sqrt(dt) * z(); prev = t[i]; a += F * Math.exp(x); }
      s += Math.max(0, a / t.length - K);
    }
    return s / paths * Math.exp(-(r || 0) * Tp);
  }
  function dailyFixings(T1, days) { var t = []; for (var d = 0; d < days; d++) t.push(T1 + d / 365); return t; }
  // participation swap: buyer pays R but keeps P of any fall below R → solve R so value is zero (monthly fixings)
  function participationPrice(F, vol, df, T, sigma, P) {
    return bisect(function (R) { var v = 0; F.forEach(function (f, i) { v += vol[i] * df[i] * (f - R) + P * vol[i] * df[i] * black76(f, R, T[i], sigma, 0, 'put'); }); return v; }, Math.min.apply(null, F) * 0.5, Math.max.apply(null, F) * 2);
  }

  // ---------- M2 spreads ----------
  // Kirk's approximation: call on F1 − H·F2 − K (Margrabe when K = 0)
  function kirk(F1, F2, H, K, T, s1, s2, rho, r) {
    var b = H * F2 + K, w = H * F2 / b, sv = Math.sqrt(T * (s1 * s1 + w * w * s2 * s2 - 2 * rho * s1 * w * s2));
    var d1 = (Math.log(F1 / b) + sv * sv / 2) / sv;
    return Math.exp(-(r || 0) * T) * (F1 * ncdf(d1) - b * ncdf(d1 - sv));
  }
  function kirkDeltas(F1, F2, H, K, T, s1, s2, rho, r) { var h1 = F1 * 1e-4, h2 = F2 * 1e-4; return { d1: (kirk(F1 + h1, F2, H, K, T, s1, s2, rho, r) - kirk(F1 - h1, F2, H, K, T, s1, s2, rho, r)) / (2 * h1), d2: (kirk(F1, F2 + h2, H, K, T, s1, s2, rho, r) - kirk(F1, F2 - h2, H, K, T, s1, s2, rho, r)) / (2 * h2) }; }
  // monthly spark-spread strip: arrays of power and gas forwards and expiries
  function sparkStrip(P, G, T, H, vom, sp, sg, rho, r) {
    return P.map(function (p, i) { var v = kirk(p, G[i], H, vom, T[i], sp, sg, rho, r), intr = Math.max(0, p - H * G[i] - vom) * Math.exp(-(r || 0) * T[i]); return { value: v, intrinsic: intr, ihr: p / G[i] }; });
  }
  // 3-2-1 crack in $/bbl from crude $/bbl and products in $/gal
  function crack321(crude, gasolineGal, distGal) { return (2 * gasolineGal * 42 + distGal * 42 - 3 * crude) / 3; }
  // gas-equivalent delta of a power position (MWh) by price ratio or by regression slope dF/dG
  function gasEquivalent(mwh, slope) { return mwh * slope; }

  // ---------- M3 tolling with start costs (daily on-peak block, overnight min-load or shut) ----------
  // simulate daily prices for one month around forwards; returns arrays per path
  function tollPaths(o) { // {paths, days, seed, Pon, Poff, G, sOn, sOff, sG, rhoPG, rhoOnOff}
    var z = normals(o.seed || 9), out = [];
    for (var p = 0; p < o.paths; p++) {
      var d = [];
      for (var k = 0; k < o.days; k++) {
        var z1 = z(), z2 = z(), z3 = z();
        var zg = z1, zon = o.rhoPG * z1 + Math.sqrt(1 - o.rhoPG * o.rhoPG) * z2;
        var zoff = o.rhoOnOff * zon + Math.sqrt(1 - o.rhoOnOff * o.rhoOnOff) * z3;
        d.push({ g: o.G * Math.exp(o.sG * zg - o.sG * o.sG / 2), on: o.Pon * Math.exp(o.sOn * zon - o.sOn * o.sOn / 2), off: o.Poff * Math.exp(o.sOff * zoff - o.sOff * o.sOff / 2) });
      }
      out.push(d);
    }
    return out;
  }
  // unit economics per day: on-peak block margin at full load; overnight margin at minimum load
  function tollDay(day, u) {
    return { on: u.hOn * u.cap * (day.on - u.hr * day.g - u.vom), night: u.hOff * u.qmin * (day.off - u.hrMin * day.g - u.vom) };
  }
  // perfect-foresight dispatch on one path (upper bound for the operator): state = unit on/off after each on-peak block
  function tollDP(path, u) {
    // V[d].on: best value having run in day d−1's block (unit hot at block end); V[d].off: did not run day d−1
    var n = path.length, NEG = -1e15, V = [{ on: NEG, off: 0 }], choice = [], starts = 0;
    for (var d = 0; d < n; d++) {
      var m = tollDay(path[d], u), prev = V[d];
      var keep = prev.on + (d > 0 ? tollDay(path[d - 1], u).night : 0); // stay at minimum load overnight
      var restart = Math.max(prev.on, prev.off) - u.sc;                  // shut overnight (or was off) and start again
      V.push({ on: Math.max(keep, restart) + m.on, off: Math.max(prev.on, prev.off) });
      choice.push({ kept: keep >= restart, fromOn: prev.on >= prev.off });
    }
    var state = V[n].on > V[n].off ? 'on' : 'off', runs = 0;
    for (d = n - 1; d >= 0; d--) {
      if (state === 'on') { runs++; if (choice[d].kept) state = 'on'; else { starts++; state = choice[d].fromOn ? 'on' : 'off'; } }
      else state = choice[d].fromOn ? 'on' : 'off';
    }
    return { value: Math.max(V[n].on, V[n].off), runs: runs, starts: starts };
  }
  // myopic rule using only today's (day-ahead) prices: a cold unit starts if today's block beats the start cost by a hurdle;
  // a hot unit runs while today's block is positive; overnight it stays at minimum load if the night margin is positive, or if it
  // ran profitably today (persistence: tomorrow is likely similar) and the overnight loss is smaller than a restart
  function tollHeuristic(path, u, startHurdle) {
    var v = 0, hot = false, runs = 0, starts = 0;
    for (var d = 0; d < path.length; d++) {
      var m = tollDay(path[d], u);
      if (hot) {
        if (m.on > 0) { v += m.on; runs++; }
        else hot = false;
      } else if (m.on - u.sc > (startHurdle || 0)) { v += m.on - u.sc; runs++; starts++; hot = true; }
      if (hot && d < path.length - 1) {
        if (m.night >= 0 || (m.on > 0 && -m.night <= u.sc)) v += m.night;
        else hot = false;
      }
    }
    return { value: v, runs: runs, starts: starts };
  }
  function tollStrip(path, u) { var v = 0; path.forEach(function (day) { v += Math.max(0, tollDay(day, u).on); }); return v; }
  function tollSummary(paths, u, hurdle) {
    var a = { strip: 0, dp: 0, heur: 0, runsDP: 0, startsDP: 0, runsH: 0, startsH: 0 };
    paths.forEach(function (p) { var s = tollStrip(p, u), d = tollDP(p, u), h = tollHeuristic(p, u, hurdle); a.strip += s; a.dp += d.value; a.heur += h.value; a.runsDP += d.runs; a.startsDP += d.starts; a.runsH += h.runs; a.startsH += h.starts; });
    Object.keys(a).forEach(function (k) { a[k] /= paths.length; });
    return a;
  }
  // monthly capacity payment ($/kW-month) equivalent to present value V over months with discount factors
  function capacityPayment(V, mw, dfs) { return V / (1000 * mw * sum(dfs)); }
  // dual-fuel lower bound: best of single-fuel spread values per month
  function dualFuelBound(v1, v2) { return v1.map(function (x, i) { return Math.max(x, v2[i]); }); }

  // ---------- M4 storage: intrinsic DP and rolling intrinsic ----------
  // facility {cap, step, inj (per day), wd (per day), ci, cw}; months: forwards F[], days n[]; start/end inventory s0/sEnd (units)
  function storageDP(F, n, f, s0, sEnd) {
    var N = Math.round(f.cap / f.step), M = F.length, NEG = -1e18;
    var V = []; for (var m = 0; m <= M; m++) V.push(new Array(N + 1).fill(NEG));
    var endK = Math.round((sEnd || 0) / f.step); V[M][endK] = 0;
    var pol = []; for (m = 0; m < M; m++) pol.push(new Array(N + 1).fill(0));
    for (m = M - 1; m >= 0; m--) {
      var imax = Math.floor(f.inj * n[m] / f.step + 1e-9), wmax = Math.floor(f.wd * n[m] / f.step + 1e-9);
      for (var k = 0; k <= N; k++) {
        var best = NEG, bj = k;
        for (var j = Math.max(0, k - wmax); j <= Math.min(N, k + imax); j++) {
          if (V[m + 1][j] <= NEG / 2) continue;
          var dq = (j - k) * f.step, cash = dq > 0 ? -dq * (F[m] + f.ci) : -dq * (F[m] - f.cw);
          var v = cash + V[m + 1][j];
          if (v > best) { best = v; bj = j; }
        }
        V[m][k] = best; pol[m][k] = bj;
      }
    }
    var k0 = Math.round((s0 || 0) / f.step), sched = [], inv = [k0 * f.step];
    for (m = 0; m < M; m++) { var nk = pol[m][k0]; sched.push((nk - k0) * f.step); k0 = nk; inv.push(k0 * f.step); }
    return { value: V[0][Math.round((s0 || 0) / f.step)], schedule: sched, inventory: inv };
  }
  function scheduleValue(sched, F, f) { var v = 0; sched.forEach(function (q, m) { v += q > 0 ? -q * (F[m] + f.ci) : -q * (F[m] - f.cw); }); return v; }
  // simulate forward-curve evolution month by month (two exponential factors) and run rolling intrinsic
  function rollingIntrinsic(F0, n, f, o) { // o {paths, seed, s1, b1, s2, b2, lead (years to first delivery)}
    var z = normals(o.seed || 17), M = F0.length, dt = 1 / 12, tot = 0, base = storageDP(F0, n, f, 0, 0).value, gains = [];
    for (var p = 0; p < o.paths; p++) {
      var F = F0.slice(), sched = storageDP(F, n, f, 0, 0).schedule, inv = 0, gain = 0;
      for (var t = 0; t < M; t++) {
        if (t > 0) { // evolve the remaining curve over one month
          var z1 = z(), z2 = z();
          for (var m = t; m < M; m++) {
            var tau = o.lead + (m - t + 1) * dt, a1 = o.s1 * Math.exp(-o.b1 * tau), a2 = o.s2 * Math.exp(-o.b2 * tau);
            F[m] *= Math.exp((a1 * z1 + a2 * z2) * Math.sqrt(dt) - 0.5 * (a1 * a1 + a2 * a2) * dt);
          }
          var Fr = F.slice(t), nr = n.slice(t), opt = storageDP(Fr, nr, f, inv, 0), old = scheduleValue(sched.slice(t), Fr, f);
          if (opt.value > old + 1e-6) { gain += opt.value - old; sched = sched.slice(0, t).concat(opt.schedule); }
        }
        inv += sched[t];
      }
      gains.push(gain); tot += gain;
    }
    return { intrinsic: base, extrinsic: tot / o.paths, total: base + tot / o.paths, gains: gains };
  }
  // CSO-style time spread: value of storing one unit from month i to j (call on Fj − Fi − cost)
  function csoValue(Fi, Fj, cost, T, si, sj, rho, r) { return kirk(Fj, Fi, 1, cost, T, sj, si, rho, r); }

  // ---------- M5 swing and variable volume ----------
  // swing call on daily spot (log-OU around the month's forward) with k exercise rights, solved by DP on a price grid
  function swingGrid(o) { // {F, K, sigma (annual), kappa (annual), days, rights, grid}
    var dt = 1 / 365, G = o.grid || 81, k = o.kappa, s = o.sigma;
    var statVar = k > 1e-9 ? s * s / (2 * k) : s * s * o.days * dt, mu = Math.log(o.F) - (k > 1e-9 ? s * s / (4 * k) : 0);
    var half = 4 * Math.sqrt(statVar), x0 = Math.log(o.F), h = 2 * half / (G - 1), xs = [];
    for (var i = 0; i < G; i++) xs.push(x0 - half + i * h);
    // transition probabilities on the grid (discretised normal)
    var Pm = xs.map(function (x) {
      var m = k > 1e-9 ? x + k * (mu - x) * dt : x - 0.5 * s * s * dt, sd = s * Math.sqrt(dt), row = [], tot = 0;
      for (var j = 0; j < G; j++) { var lo = j === 0 ? -Infinity : (xs[j] - h / 2 - m) / sd, hi = j === G - 1 ? Infinity : (xs[j] + h / 2 - m) / sd; var pj = (hi === Infinity ? 1 : ncdf(hi)) - (lo === -Infinity ? 0 : ncdf(lo)); row.push(pj); tot += pj; }
      return row.map(function (v) { return v / tot; });
    });
    var pay = xs.map(function (x) { return Math.max(0, Math.exp(x) - o.K); });
    var R = o.rights, V = []; for (var r = 0; r <= R; r++) V.push(new Array(G).fill(0));
    var euro = 0, dist = new Array(G).fill(0); dist[Math.round((G - 1) / 2)] = 1;
    // European value per day (expected payoff on each delivery day d = 1..days)
    for (var d = 1; d <= o.days; d++) {
      var nd = new Array(G).fill(0); for (i = 0; i < G; i++) if (dist[i]) for (var j = 0; j < G; j++) nd[j] += dist[i] * Pm[i][j];
      dist = nd; var ev = 0; for (j = 0; j < G; j++) ev += dist[j] * pay[j]; euro += ev;
    }
    for (d = o.days; d >= 1; d--) {
      var NV = []; for (r = 0; r <= R; r++) NV.push(new Array(G).fill(0));
      for (i = 0; i < G; i++) for (r = 0; r <= R; r++) NV[r][i] = Math.max(V[r][i], r > 0 ? pay[i] + V[r - 1][i] : -Infinity);
      // expectation one step back (from day d−1 state to day d)
      var EV = []; for (r = 0; r <= R; r++) { EV.push(new Array(G).fill(0)); for (i = 0; i < G; i++) { var e = 0; for (j = 0; j < G; j++) e += Pm[i][j] * NV[r][j]; EV[r][i] = e; } }
      V = EV;
    }
    var c = Math.round((G - 1) / 2), by = [];
    for (r = 1; r <= R; r++) by.push(V[r][c]);
    return { value: V[R][c], perRight: V[R][c] / R, euroAvg: euro / o.days, euroSum: euro, byRights: by };
  }
  // load-following uplift under an exponential stack p = p* e^{λL}, L ~ N(μ, σ²): fixed price / forward = 1 + λσ²/μ
  function loadUplift(lambda, mu, sd) { return 1 + lambda * sd * sd / mu; }
  // unit-contingent: P&L of availability surprise on a fixed-price sale when market has moved
  function ucSurprise(mw, hours, availDiff, pFixed, pMkt) { return mw * hours * availDiff * (pMkt - pFixed); }

  // ---------- M6 hedging books ----------
  // hierarchical book: nodes {id, parent, beta, pos}; benchmark has parent null; returns benchmark-equivalent delta and P&L attribution
  function hierarchy(nodes, moves) {
    var by = {}; nodes.forEach(function (n) { by[n.id] = n; });
    var eq = {}; nodes.forEach(function (n) { eq[n.id] = n.pos; });
    // accumulate children into parents (process deepest first)
    var depth = function (n) { var d = 0; while (n.parent) { n = by[n.parent]; d++; } return d; };
    var order = nodes.slice().sort(function (a, b) { return depth(b) - depth(a); });
    var total = {}; nodes.forEach(function (n) { total[n.id] = n.pos; });
    order.forEach(function (n) { if (n.parent) total[n.parent] += n.beta * total[n.id]; });
    // residual move at each node = own move − beta × parent move
    var attr = {}, pnl = 0;
    nodes.forEach(function (n) { var res = moves[n.id] - (n.parent ? n.beta * moves[n.parent] : 0); attr[n.id] = total[n.id] * res; pnl += n.pos * moves[n.id]; });
    return { totalDelta: total, attribution: attr, pnl: pnl };
  }
  // minimum-variance hedge ratio (arithmetic moves)
  function mvRatio(sP, sG, rho) { return rho * sP / sG; }
  function hedgedVar(sP, sG, rho, h) { return sP * sP + h * h * sG * sG - 2 * h * rho * sP * sG; }

  // ---------- Upper-graduate desk extensions ----------
  // M4: Least-Squares Monte Carlo (LSMC / Boogert & de Jong) storage valuation
  function solveOLS3(X, Y) {
    var s0 = X.length, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
    for (var i = 0; i < s0; i++) {
      var x = X[i], x2 = x * x, y = Y[i];
      s1 += x; s2 += x2; s3 += x * x2; s4 += x2 * x2;
      t0 += y; t1 += x * y; t2 += x2 * y;
    }
    var D = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
    if (Math.abs(D) < 1e-12) return [t0 / (s0 || 1), 0, 0];
    var D0 = t0 * (s2 * s4 - s3 * s3) - s1 * (t1 * s4 - s3 * t2) + s2 * (t1 * s3 - s2 * t2);
    var D1 = s0 * (t1 * s4 - s3 * t2) - t0 * (s1 * s4 - s3 * s2) + s2 * (s1 * t2 - t1 * s2);
    var D2 = s0 * (s2 * t2 - t1 * s3) - s1 * (s1 * t2 - t1 * s2) + t0 * (s1 * s3 - s2 * s2);
    return [D0 / D, D1 / D, D2 / D];
  }
  // Longstaff-Schwartz storage valuation: regressions on price choose the action at each inventory level,
  // but each path is valued with the cash flows it actually realises under that policy (low-biased, not in-sample fitted values)
  // spot: ln S_t = ln F_t + X_t - Var(X_t)/2 with X an OU factor (speed kappa), so E[S_t] = F_t; kappa = 0 is GBM, under which the
  // whole curve scales with spot, the best action never depends on the price level and extrinsic value is zero
  function storageLsmc(F0, f, o) { // f: { cap, inj, wd, ci, cw, step }, o: { paths, seed, vol, kappa, dt, r }
    var paths = o.paths || 2000, dt = o.dt || 1 / 12, vol = o.vol === undefined ? 0.40 : o.vol, r = o.r === undefined ? 0.04 : o.r;
    var df = Math.exp(-r * dt), M = F0.length, z = normals(o.seed || 19), k = o.kappa || 0;
    var decay = Math.exp(-k * dt), sdStep = vol * Math.sqrt(k > 0 ? (1 - Math.exp(-2 * k * dt)) / (2 * k) : dt);
    var step = f.step || Math.min(f.inj, f.wd) / 5, nL = Math.round(f.cap / step) + 1, levels = [], i, j, p, t;
    for (i = 0; i < nL; i++) levels.push(i * step);
    var P = [];
    for (p = 0; p < paths; p++) {
      var path = [F0[0]], x = 0, vx = 0;
      for (t = 1; t < M; t++) {
        x = x * decay + sdStep * z(); vx = vx * decay * decay + sdStep * sdStep;
        path.push(F0[t] * Math.exp(x - 0.5 * vx));
      }
      P.push(path);
    }
    function cash(price, dq) { return dq > 0 ? -dq * (price + (f.ci || 0)) : -dq * (price - (f.cw || 0)); }
    function feasible(i, j) { var dq = levels[j] - levels[i]; return dq <= f.inj + 1e-9 && -dq <= f.wd + 1e-9; }
    // intrinsic: the same grid optimised once against today's curve; keep the schedule as a control variate
    var W = levels.map(function () { return 0; }), act = [];
    for (t = M - 1; t >= 0; t--) {
      var pick = [];
      W = levels.map(function (_, i) {
        var best = -1e18, bj = i;
        for (var j = 0; j < nL; j++) if (feasible(i, j)) { var v = cash(F0[t], levels[j] - levels[i]) + (t < M - 1 ? df * W[j] : 0); if (v > best) { best = v; bj = j; } }
        pick.push(bj); return best;
      });
      act[t] = pick;
    }
    var sched = [], lev = 0;
    for (t = 0; t < M; t++) { var nx = act[t][lev]; sched.push(levels[nx] - levels[lev]); lev = nx; }
    // CF[p][j]: realised value from the next date onward for path p, holding inventory level j after today's action
    var CF = [];
    for (p = 0; p < paths; p++) CF.push(new Array(nL).fill(0));
    for (t = M - 1; t >= 0; t--) {
      var models = [];
      for (j = 0; j < nL; j++) {
        var X = [], Y = [];
        for (p = 0; p < paths; p++) { X.push(P[p][t]); Y.push(CF[p][j]); }
        models.push(t < M - 1 ? solveOLS3(X, Y) : [0, 0, 0]);
      }
      var next = [];
      for (p = 0; p < paths; p++) {
        var pt = P[p][t], row = [];
        for (i = 0; i < nL; i++) {
          var bestJ = i, bestEst = -1e18;
          for (j = 0; j < nL; j++) {
            if (!feasible(i, j)) continue;
            var m = models[j], est = cash(pt, levels[j] - levels[i]) + df * (m[0] + m[1] * pt + m[2] * pt * pt);
            if (est > bestEst) { bestEst = est; bestJ = j; }
          }
          row.push(cash(pt, levels[bestJ] - levels[i]) + df * CF[p][bestJ]);
        }
        next.push(row);
      }
      CF = next;
    }
    // control variate: the intrinsic schedule's realised value has expectation W[0] exactly, so subtract its sampling error
    var raw = 0, cv = 0;
    for (p = 0; p < paths; p++) {
      raw += CF[p][0];
      for (t = 0; t < M; t++) cv += Math.pow(df, t) * cash(P[p][t], sched[t]);
    }
    raw /= paths; cv /= paths;
    var value = raw - cv + W[0];
    return { value: value, raw: raw, intrinsic: W[0], extrinsic: value - W[0], paths: paths, levels: nL };
  }

  // M5: Joint volumetric and price quanto option
  function quantoOption(Fp, Kp, expVol, sigmaP, sigmaV, rho, T, r, type) {
    var df = Math.exp(-(r || 0) * T);
    var quantoAdj = Math.exp(rho * sigmaP * sigmaV * T);
    var FpStar = Fp * quantoAdj;
    var optPerUnit = black76(FpStar, Kp, T, sigmaP, 0, type || 'put');
    var vanillaPerUnit = black76(Fp, Kp, T, sigmaP, 0, type || 'put');
    var totalQuantoValue = df * expVol * optPerUnit;
    var totalVanillaValue = df * expVol * vanillaPerUnit;
    return {
      adjForward: FpStar,
      quantoPerUnit: df * optPerUnit,
      vanillaPerUnit: df * vanillaPerUnit,
      totalQuanto: totalQuantoValue,
      totalVanilla: totalVanillaValue,
      quantoWedge: totalQuantoValue - totalVanillaValue
    };
  }

  // M6: Second-order Greeks & cross-gamma P&L attribution
  // units: vega per vol point with dVol in vol points; vRho per unit correlation; theta per day with dt in days
  function crossGreeksPnl(greeks, moves) {
    var linear1 = greeks.d1 * moves.dS1;
    var linear2 = greeks.d2 * moves.dS2;
    var gamma1 = 0.5 * greeks.g11 * moves.dS1 * moves.dS1;
    var gamma2 = 0.5 * greeks.g22 * moves.dS2 * moves.dS2;
    var crossGamma = greeks.g12 * moves.dS1 * moves.dS2;
    var vegaPnl = (greeks.vega || 0) * (moves.dVol || 0);
    var corrPnl = (greeks.vRho || 0) * (moves.dRho || 0);
    var thetaPnl = (greeks.theta || 0) * (moves.dt || 0);
    var totalTaylor = linear1 + linear2 + gamma1 + gamma2 + crossGamma + vegaPnl + corrPnl + thetaPnl;
    return {
      linear: linear1 + linear2,
      ownGamma: gamma1 + gamma2,
      crossGamma: crossGamma,
      vegaPnl: vegaPnl,
      corrPnl: corrPnl,
      thetaPnl: thetaPnl,
      totalPnl: totalTaylor
    };
  }

  var api = { rng: rng, normals: normals, ncdf: ncdf, sum: sum, mean: mean, black76: black76, bisect: bisect,
    swapPrice: swapPrice, swapMtm: swapMtm, asianLevy: asianLevy, asianVolEquiv: asianVolEquiv, asianMC: asianMC, dailyFixings: dailyFixings, participationPrice: participationPrice,
    kirk: kirk, kirkDeltas: kirkDeltas, sparkStrip: sparkStrip, crack321: crack321, gasEquivalent: gasEquivalent,
    tollPaths: tollPaths, tollDay: tollDay, tollDP: tollDP, tollHeuristic: tollHeuristic, tollStrip: tollStrip, tollSummary: tollSummary, capacityPayment: capacityPayment, dualFuelBound: dualFuelBound,
    storageDP: storageDP, scheduleValue: scheduleValue, rollingIntrinsic: rollingIntrinsic, csoValue: csoValue, storageLsmc: storageLsmc,
    swingGrid: swingGrid, loadUplift: loadUplift, ucSurprise: ucSurprise, quantoOption: quantoOption,
    hierarchy: hierarchy, mvRatio: mvRatio, hedgedVar: hedgedVar, crossGreeksPnl: crossGreeksPnl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C7 = api;
})(typeof window !== 'undefined' ? window : this);
