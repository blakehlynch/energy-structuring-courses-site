/* Course 9 calculation library — project finance and offtake structuring. Browser: window.C9; Node: module.exports. */
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
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function mean(a) { return sum(a) / a.length; }
  function quantile(a, q) { var s = a.slice().sort(function (x, y) { return x - y; }), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
  function annuityFactor(r, n) { return r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r; }
  function pv(cfs, r) { var v = 0; cfs.forEach(function (c, t) { v += c / Math.pow(1 + r, t + 1); }); return v; }
  function irr(cfs) { // cfs[0] at t=0
    var lo = -0.99, hi = 1.0, f = function (r) { var v = 0; cfs.forEach(function (c, t) { v += c / Math.pow(1 + r, t); }); return v; };
    if (f(lo) * f(hi) > 0) return NaN;
    for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }

  // ---------- M1 why project finance ----------
  // one-period illustration: investment, annual net revenue before interest, debt share, debt rate, tax
  function leverageReturn(o) { // {cost, revenue, debtShare, kd, tax}
    var debt = o.cost * o.debtShare, equity = o.cost - debt, profit = o.revenue - debt * o.kd, after = profit * (1 - (o.tax || 0));
    return { equity: equity, profit: profit, roe: after / equity };
  }
  // revenue needed for a target equity return
  function requiredRevenue(o) { var debt = o.cost * o.debtShare, equity = o.cost - debt; return debt * o.kd + o.ke * equity / (1 - (o.tax || 0)); }
  function portfolioRisk(wA, sA, sB, rho) { var wB = 1 - wA; return Math.sqrt(wA * wA * sA * sA + wB * wB * sB * sB + 2 * wA * wB * sA * sB * rho); }

  // ---------- M2 offtake: PPA tariff and revenue risk ----------
  // capacity charge ($/kW-month) to recover fixed O&M, debt service and target equity return on capex
  function capacityCharge(o) { // {capex ($m), mw, debtShare, kd, tenor, ke, life, fixedOM ($m/yr)}
    var debt = o.capex * o.debtShare, eq = o.capex - debt;
    var ds = debt / annuityFactor(o.kd, o.tenor), er = eq / annuityFactor(o.ke, o.life);
    var annual = ds + er + o.fixedOM;
    return { debtService: ds, equityReturn: er, annual: annual, perKwMonth: annual * 1e6 / (o.mw * 1000 * 12) };
  }
  // availability deduction: capacity charge scaled by shortfall below the required availability
  function availabilityPayment(cc, avail, required) { return avail >= required ? cc : cc * avail / required; }
  // simulate CFADS and DSCR under different revenue structures for one year
  function revenueRisk(o) { // {type: 'ppa'|'cfd'|'collar'|'merchant', mwh, price (expected), vol, strike, floor, cap, opex, fuelShare, ds, paths, seed}
    var z = normals(o.seed || 41), d = [];
    for (var k = 0; k < o.paths; k++) {
      var p = o.price * Math.exp(o.vol * z() - 0.5 * o.vol * o.vol), real;
      if (o.type === 'ppa' || o.type === 'cfd') real = o.strike; else if (o.type === 'collar') real = Math.min(o.cap, Math.max(o.floor, p)); else real = p;
      var rev = real * o.mwh / 1e6, cf = rev - o.opex;
      d.push(cf / o.ds);
    }
    return { mean: mean(d), p5: quantile(d, 0.05), p50: quantile(d, 0.5), pBelow1: d.filter(function (x) { return x < 1; }).length / d.length, dist: d };
  }

  // ---------- M3 construction risk ----------
  // simulate overrun (lognormal % of budget) and delay (months); EPC LDs cover delay revenue loss up to a cap; contingency covers overruns
  function constructionRisk(o) { // {capex, overrunMean, overrunVol, delayMean (months), monthlyRevenueLoss, ldRate (per month), ldCap (% capex), contingency (% capex), paths, seed}
    var z = normals(o.seed || 51), u = rng((o.seed || 51) + 3), short = 0, lossSum = 0, losses = [];
    for (var k = 0; k < o.paths; k++) {
      var over = o.capex * Math.max(0, o.overrunMean * Math.exp(o.overrunVol * z() - 0.5 * o.overrunVol * o.overrunVol));
      var delay = -o.delayMean * Math.log(1 - u() + 1e-12); // exponential delay
      var loss = delay * o.monthlyRevenueLoss, ld = Math.min(delay * o.ldRate, o.ldCap * o.capex);
      var need = over + Math.max(0, loss - ld), gap = Math.max(0, need - o.contingency * o.capex);
      if (gap > 0) short++; lossSum += gap; losses.push(gap);
    }
    return { pShortfall: short / o.paths, expectedGap: lossSum / o.paths, p95Gap: quantile(losses, 0.95) };
  }

  // ---------- M4 debt sizing, cover ratios, sculpting ----------
  // debt capacity and schedules for a CFADS profile, target DSCR and tenor (annual periods, debt drawn at t=0 of operations)
  function sizeDebt(cfads, dscr, kd, tenor, profile) { // profile: 'annuity' | 'sculpted' | 'level'
    var n = Math.min(tenor, cfads.length), D, ds = [], prin = [], bal = [], i;
    if (profile === 'sculpted') {
      for (i = 0; i < n; i++) ds.push(cfads[i] / dscr);
      D = pv(ds, kd);
    } else if (profile === 'annuity') {
      var minC = Math.min.apply(null, cfads.slice(0, n)); var A = minC / dscr; D = A * annuityFactor(kd, n);
      for (i = 0; i < n; i++) ds.push(A);
    } else { // level principal: binding year is year 1 (highest debt service) → solve D from min over years
      var best = Infinity;
      for (i = 0; i < n; i++) { var cap = cfads[i] / dscr / (1 / n + kd * (1 - i / n)); if (cap < best) best = cap; }
      D = best; for (i = 0; i < n; i++) ds.push(D / n + kd * D * (1 - i / n));
    }
    var b = D;
    for (i = 0; i < n; i++) { var int = b * kd, p = ds[i] - int; prin.push(p); b -= p; bal.push(b); }
    var dscrs = ds.map(function (x, j) { return cfads[j] / x; });
    var wal = 0; prin.forEach(function (p, j) { wal += p * (j + 1); }); wal /= D;
    var llcr = pv(cfads.slice(0, n), kd) / D, plcr = pv(cfads, kd) / D;
    return { debt: D, ds: ds, principal: prin, balance: bal, dscr: dscrs, minDscr: Math.min.apply(null, dscrs), avgDscr: mean(dscrs), llcr: llcr, plcr: plcr, wal: wal };
  }
  function equityIrr(capex, debt, cfads, ds) { var cf = [-(capex - debt)]; cfads.forEach(function (c, t) { cf.push(c - (ds[t] || 0)); }); return irr(cf); }
  function debtFromAdscr(cf, dscr, r, n) { return cf / dscr * annuityFactor(r, n); }
  // Interest During Construction (IDC) & upfront fee circularity:
  // Total Project Cost TPC = BaseCapex + IDC + UpfrontFee = BaseCapex + D * (rate * avgDrawYears + feeRate)
  // Sizing debt with target gearing g = D / TPC: D = g * BaseCapex / (1 - g * (rate * avgDrawYears + feeRate))
  function sizeDebtWithIDC(baseCapex, gearing, interestRate, avgDrawYears, upfrontFeeRate) {
    var idcFactor = interestRate * avgDrawYears + (upfrontFeeRate || 0);
    var debt = gearing * baseCapex / (1 - gearing * idcFactor);
    var idc = debt * (interestRate * avgDrawYears);
    var fee = debt * (upfrontFeeRate || 0);
    var tpc = baseCapex + idc + fee;
    var equity = tpc - debt;
    return { baseCapex: baseCapex, debt: debt, equity: equity, idc: idc, fee: fee, tpc: tpc, gearing: debt / tpc };
  }
  // Partnership flip tax equity sizing (US ITC model): before the flip the investor takes 99% of the ITC and of the MACRS tax shield
  // plus a share of cash; the contribution is sized so those flows earn exactly the target (flip) IRR by the target flip year,
  // after which its share drops to 5%. Simplified: tax benefits are assumed usable in the year earned, and post-flip flows are ignored.
  function taxEquityFlip(capex, itcRate, annualCash, taxRate, targetIrr, flipYears, cashShare) {
    var share = cashShare === undefined ? 0.20 : cashShare;
    var itcAmount = capex * itcRate;
    var taxBasis = capex - 0.5 * itcAmount; // ITC reduces depreciable basis by half the credit
    var macrs = [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576]; // 5-year MACRS, half-year convention
    var flows = [];
    for (var yr = 1; yr <= flipYears; yr++) {
      var itc = yr === 1 ? 0.99 * itcAmount : 0;
      var dep = yr <= macrs.length ? macrs[yr - 1] * taxBasis : 0;
      flows.push(itc + 0.99 * dep * taxRate + share * annualCash);
    }
    var teContrib = pv(flows, targetIrr);
    var teCfs = [-teContrib].concat(flows);
    return { teContribution: teContrib, itcAmount: itcAmount, taxBasis: taxBasis, teCfs: teCfs, achievedIrr: irr(teCfs),
      teShareOfCapex: teContrib / capex, sponsorCash: (1 - share) * annualCash };
  }
  // ---------- M5 petroleum structures ----------
  // reserve-based borrowing base: NPV of proved production at the bank price deck, divided by a cover ratio, limited to tail
  // field-life (PLCR) base = NPV / cover; loan-life (LLCR) base = NPV to the start of the reserve tail / coverLlcr; the smaller binds
  function borrowingBase(o) { // {prod[] (mmbbl/yr), price[], opex ($/bbl), tax (share of net), disc, cover, coverLlcr, tailShare}
    var cf = o.prod.map(function (q, t) { return Math.max(0, q * ((o.price[t] || o.price[o.price.length - 1]) - o.opex) * (1 - o.tax)); });
    var npv = pv(cf, o.disc), total = sum(o.prod), cum = 0, tailYear = o.prod.length;
    for (var t = 0; t < o.prod.length; t++) { cum += o.prod[t]; if (cum >= (1 - o.tailShare) * total) { tailYear = t + 1; break; } }
    var npvToTail = pv(cf.slice(0, tailYear), o.disc);
    var llcrBase = npvToTail / (o.coverLlcr || o.cover);
    return { npv: npv, base: npv / o.cover, llcrBase: llcrBase, binding: Math.min(npv / o.cover, llcrBase), npvToTail: npvToTail, tailYear: tailYear, cf: cf };
  }
  // break-even price: lowest flat price at which every year's cash flow covers debt service (given $m debt service and bbl production)
  function breakevenPrice(prod, opex, tax, ds) { var be = 0; prod.forEach(function (q, t) { if (ds[t] > 0 && q > 0) be = Math.max(be, opex + ds[t] / (q * (1 - tax))); }); return be; }
  // LNG Sale & Purchase Agreement (SPA) pricing comparison, $/MMBtu:
  // 1. US Gulf Coast Henry Hub-linked FOB: P = 1.15 * HH + liquefaction fee; delivered = FOB + shipping
  // 2. Asian oil-linked DES: P = alpha * Brent + beta, with an S-curve halving the slope beyond the floor and ceiling kinks
  function lngSpaPricing(hhPrice, liqFee, brentPrice, alpha, beta, brentFloor, brentCeil, shipping) {
    var usFob = 1.15 * hhPrice + liqFee, usDes = usFob + (shipping || 0);
    var slope = alpha || 0.135, constant = beta || 0.50;
    var effBrent = brentPrice;
    if (brentFloor && effBrent < brentFloor) effBrent = brentFloor + 0.5 * (effBrent - brentFloor);
    else if (brentCeil && effBrent > brentCeil) effBrent = brentCeil + 0.5 * (effBrent - brentCeil);
    var oilLinked = slope * effBrent + constant;
    return { usFob: usFob, usDes: usDes, oilLinkedPrice: oilLinked, straightLine: slope * brentPrice + constant, spread: oilLinked - usDes };
  }
  // cost-of-service tariff for a pipeline: revenue requirement / throughput
  function costOfService(o) { // {rateBase, allowedReturn, depreciation, opex, tax, throughput}
    var ret = o.rateBase * o.allowedReturn, taxAllow = ret * o.tax / (1 - o.tax) * (o.equityShare || 0.5);
    var req = o.opex + o.depreciation + ret + taxAllow;
    return { requirement: req, tariff: req / o.throughput, ret: ret, taxAllow: taxAllow };
  }

  // ---------- M6 cash waterfall ----------
  function waterfall(o) { // {cfads[], ds[], dsraMonths, lockup, sweep (share of excess when locked), dsraInit}
    var dsra = o.dsraInit, rows = [], defaulted = -1, sweptTotal = 0, trap = 0;
    for (var t = 0; t < o.cfads.length; t++) {
      var c = o.cfads[t], due = o.ds[t] || 0, paid = Math.min(c, due), short = due - paid, draw = Math.min(dsra, short);
      dsra -= draw; paid += draw; if (paid < due - 1e-9 && defaulted < 0) defaulted = t;
      var cash = Math.max(0, c - Math.min(c, due));
      var target = (o.dsraMonths / 12) * (o.ds[t + 1] || 0), top = Math.min(cash, Math.max(0, target - dsra)); dsra += top; cash -= top;
      if (dsra > target) { cash += dsra - target; dsra = target; } // release any excess (and the whole reserve after the last payment)
      var ratio = due > 0 ? c / due : Infinity, locked = ratio < o.lockup, sweep = 0, dist = 0;
      if (locked) { sweep = cash * (o.sweep || 0); cash -= sweep; sweptTotal += sweep; trap += cash; cash = 0; } // remainder held in a lock-up account
      else { dist = cash + trap; trap = 0; cash = 0; } // cured: lock-up account released with current cash
      rows.push({ t: t + 1, cfads: c, ds: due, dscr: ratio, dsraDraw: draw, dsraTop: top, dsra: dsra, locked: locked, sweep: sweep, trapped: trap, dist: dist });
    }
    return { rows: rows, defaultYear: defaulted >= 0 ? defaulted + 1 : null, distributions: sum(rows.map(function (r) { return r.dist; })), swept: sweptTotal, lockups: rows.filter(function (r) { return r.locked; }).length };
  }
  // waterfall with active debt balance reduction: swept cash prepays principal, reducing future annuity debt service over remaining tenor
  function waterfallPrepay(o) { // {cfads[], debtInit, kd, dsraMonths, lockup, sweep, dsraInit}
    var n = o.cfads.length, bal = o.debtInit, dsra = o.dsraInit, rows = [], sweptTotal = 0, trap = 0, defaulted = -1;
    for (var t = 0; t < n; t++) {
      var rem = n - t, due = bal > 1e-9 ? bal / annuityFactor(o.kd, rem) : 0;
      var interest = bal * o.kd, schedPrin = Math.max(0, due - interest);
      var c = o.cfads[t], paid = Math.min(c, due), short = due - paid, draw = Math.min(dsra, short);
      dsra -= draw; paid += draw; if (paid < due - 1e-9 && defaulted < 0) defaulted = t; // unpaid amounts stay in the balance and are re-amortised
      var prinPaid = paid - interest; bal = Math.max(0, bal - prinPaid);
      var cash = Math.max(0, c - Math.min(c, due));
      var nextDue = (t + 1 < n && bal > 1e-9) ? bal / annuityFactor(o.kd, n - t - 1) : 0;
      var target = (o.dsraMonths / 12) * nextDue, top = Math.min(cash, Math.max(0, target - dsra)); dsra += top; cash -= top;
      if (dsra > target) { cash += dsra - target; dsra = target; }
      var ratio = due > 0 ? c / due : Infinity, locked = ratio < o.lockup, sweep = 0, dist = 0;
      if (locked) { sweep = Math.min(bal, cash * (o.sweep || 0)); bal -= sweep; cash -= sweep; sweptTotal += sweep; trap += cash; cash = 0; }
      else { dist = cash + trap; trap = 0; cash = 0; }
      rows.push({ t: t + 1, cfads: c, ds: due, dscr: ratio, bal: bal, sweep: sweep, dist: dist });
    }
    return { rows: rows, defaultYear: defaulted >= 0 ? defaulted + 1 : null, distributions: sum(rows.map(function (r) { return r.dist; })), swept: sweptTotal, finalDs: rows[n - 1].ds };
  }

  var api = { rng: rng, normals: normals, sum: sum, mean: mean, quantile: quantile, annuityFactor: annuityFactor, pv: pv, irr: irr,
    leverageReturn: leverageReturn, requiredRevenue: requiredRevenue, portfolioRisk: portfolioRisk,
    capacityCharge: capacityCharge, availabilityPayment: availabilityPayment, revenueRisk: revenueRisk, constructionRisk: constructionRisk,
    sizeDebt: sizeDebt, equityIrr: equityIrr, debtFromAdscr: debtFromAdscr, sizeDebtWithIDC: sizeDebtWithIDC, taxEquityFlip: taxEquityFlip, lngSpaPricing: lngSpaPricing,
    borrowingBase: borrowingBase, breakevenPrice: breakevenPrice, costOfService: costOfService, waterfall: waterfall, waterfallPrepay: waterfallPrepay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C9 = api;
})(typeof window !== 'undefined' ? window : this);
