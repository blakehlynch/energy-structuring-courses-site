/* Course 1 calculation library — petroleum fundamentals. Browser: window.C1; Node: module.exports. */
(function (root) {
  'use strict';

  // ---------- units ----------
  var U = { GAL_PER_BBL: 42, MMBTU_PER_BBL: 5.8, CF_PER_BOE: 5800, BBL_PER_TONNE_CRUDE: 7.33, MMBTU_PER_MWH_CCGT: 7 };
  function boeFromGasMcf(mcf) { return mcf * 1000 / U.CF_PER_BOE; }
  function annualFromDaily(mbpd) { return mbpd * 365; }

  // ---------- retail price decomposition (EIA method as described by Kaiser Box 4.4) ----------
  // crude = refiner crude cost / 42; refining = spot product − crude/42; taxes given; distribution = retail − rest
  function retailBreakdown(o) { // {crude $/bbl, spot $/gal, taxes $/gal, retail $/gal}
    var crude = o.crude / 42, refining = o.spot - crude, dist = o.retail - o.spot - o.taxes;
    return { crude: crude, refining: refining, taxes: o.taxes, distribution: dist, total: o.retail,
      shares: { crude: crude / o.retail, refining: refining / o.retail, taxes: o.taxes / o.retail, distribution: dist / o.retail } };
  }

  // ---------- reserves categories ----------
  function reservesFromPercentiles(p90, p50, p10) {
    return { proved: p90, probable: p50 - p90, possible: p10 - p50, '1P': p90, '2P': p50, '3P': p10 };
  }

  // ---------- production sharing contract (Clews ch.6 mechanism) ----------
  // per-period: royalty on gross; cost oil = min(opex + unrecovered capex, cap * gross revenue); profit oil split
  function pscSplit(o) { // {revenue, royaltyRate, opex, unrecoveredCapex, costCap (fraction of gross), contractorProfitShare, taxRate}
    var royalty = o.revenue * o.royaltyRate;
    var capLimit = o.costCap * o.revenue;
    var costOil = Math.min(o.opex + o.unrecoveredCapex, capLimit);
    var capexRecovered = Math.max(0, costOil - o.opex);
    var profitOil = o.revenue - royalty - costOil;
    var cProfit = profitOil * o.contractorProfitShare;
    var tax = cProfit * (o.taxRate || 0);
    var contractorGross = costOil + cProfit - tax;
    return { royalty: royalty, costOil: costOil, capexRecovered: capexRecovered, carryForward: o.unrecoveredCapex - capexRecovered,
      profitOil: profitOil, contractorProfit: cProfit, govProfit: profitOil - cProfit, tax: tax,
      contractorTake: contractorGross, governmentTake: royalty + (profitOil - cProfit) + tax,
      contractorCash: contractorGross - o.opex };
  }
  // portfolio reserve sub-additivity across independent fields: sum of individual P90s vs portfolio P90
  function portfolioP90(fields) { // fields: [{p50, p90}] under Gaussian approximation (P90 = P50 - 1.2816 * sd)
    var sumP90 = 0, sumP50 = 0, varSum = 0, z90 = 1.2815515655446004;
    fields.forEach(function (f) {
      sumP90 += f.p90; sumP50 += f.p50;
      var sd = (f.p50 - f.p90) / z90;
      varSum += sd * sd;
    });
    var portSd = Math.sqrt(varSum);
    var portP90 = sumP50 - z90 * portSd;
    return { sum1P: sumP90, port2P: sumP50, port1P: portP90, uplift: portP90 - sumP90, upliftPct: 100 * (portP90 - sumP90) / sumP90 };
  }
  // R-factor sliding-scale PSC: contractor profit-oil share steps down as cumulative receipts / cumulative outlays (R = cumRev / cumCost) crosses thresholds
  function rFactorPsc(o) { // {cumReceipts, cumOutlays, tiers:[{maxR, share}], revenue, royaltyRate, opex, unrecoveredCapex, costCap, taxRate}
    var R = o.cumReceipts / Math.max(1e-9, o.cumOutlays);
    var share = o.tiers[o.tiers.length - 1].share;
    for (var i = 0; i < o.tiers.length; i++) {
      if (R < o.tiers[i].maxR) { share = o.tiers[i].share; break; }
    }
    var res = pscSplit(Object.assign({}, o, { contractorProfitShare: share }));
    res.R = R; res.contractorShare = share;
    return res;
  }

  // ---------- decline curves and the drilling treadmill ----------
  // Arps: b=0 exponential, 0<b<1 hyperbolic; D nominal annual decline
  function arpsRate(q0, D, b, t) { return b === 0 ? q0 * Math.exp(-D * t) : q0 / Math.pow(1 + b * D * t, 1 / b); }
  function arpsCum(q0, D, b, t, steps) { // numerical, rate per year → volume
    steps = steps || 1000; var dt = t / steps, s = 0;
    for (var i = 0; i < steps; i++) s += arpsRate(q0, D, b, (i + 0.5) * dt) * dt;
    return s;
  }
  // field/basin production from annual well cohorts; returns arrays by year
  function treadmill(o) { // {years, wellsPerYear (array or number), q0 (b/d per well), D, b, legacy (b/d at t0), legacyDecline}
    var prod = [], n = o.years;
    for (var y = 0; y < n; y++) {
      var total = (o.legacy || 0) * Math.exp(-(o.legacyDecline || 0) * (y + 0.5));
      for (var c = 0; c <= y; c++) {
        var w = Array.isArray(o.wellsPerYear) ? o.wellsPerYear[c] : o.wellsPerYear;
        // average rate in year y of a cohort brought on (uniformly) during year c
        total += w * arpsRate(o.q0, o.D, o.b, Math.max(0, y - c) + 0.5);
      }
      prod.push(total);
    }
    return prod;
  }
  // wells needed per year to hold production flat at the level reached when a flat program has run long
  function firstYearDecline(D, b) { return 1 - arpsRate(1, D, b, 1); }
  // wells per year to hold a flat production level once the program has run `years` years (sum of average annual rates of past cohorts)
  function wellsToHold(target, q0, D, b, years) {
    var s = 0; for (var k = 0; k < years; k++) s += arpsRate(q0, D, b, k + 0.5);
    return target / s;
  }

  // ---------- supply stack ----------
  // segments: [{name, capacity (mb/d), cost ($/bbl)}] sorted by cost; demand (mb/d) → marginal segment and price
  function clearStack(segments, demand) {
    var s = segments.slice().sort(function (a, b) { return a.cost - b.cost; }), cum = 0;
    for (var i = 0; i < s.length; i++) {
      cum += s[i].capacity;
      if (cum >= demand) return { price: s[i].cost, marginal: s[i].name, used: demand, spare: cum - demand, index: i };
    }
    return { price: Infinity, marginal: 'shortage', used: cum, spare: 0, index: s.length };
  }

  // ---------- price shocks with elasticities (McNally ch.3 framing) ----------
  // linear approximation: %ΔP ≈ shortfall% / (eS − eD)   (eD negative)
  function shockLinear(shortfallFrac, eS, eD) { return shortfallFrac / (eS - eD); }
  // constant-elasticity curves: Qd = Q0 (P/P0)^eD ; Qs = (Q0 − N)(P/P0)^eS  → P/P0 = (Q0/(Q0−N))^(1/(eS−eD))
  function shockConstElast(shortfallFrac, eS, eD) { return Math.pow(1 / (1 - shortfallFrac), 1 / (eS - eD)) - 1; }
  // disruption with buffers (all in mb/d): net shortfall after spare capacity, strategic and commercial stock draws
  function netShortfall(o) { // {disruption, spare, spareShare (0..1 usable), spr, stocks}
    var off = Math.min(o.spare * (o.spareShare === undefined ? 1 : o.spareShare), o.disruption);
    var rem = o.disruption - off;
    var spr = Math.min(o.spr || 0, rem); rem -= spr;
    var st = Math.min(o.stocks || 0, rem); rem -= st;
    return { net: rem, fromSpare: off, fromSPR: spr, fromStocks: st };
  }
  function shockScenario(o) { // {base mb/d, disruption, spare, spareShare, spr, stocks, eS, eD, cap (max multiple of P0)}
    var n = netShortfall(o), f = n.net / o.base;
    var lin = shockLinear(f, o.eS, o.eD), ce = f > 0 ? shockConstElast(f, o.eS, o.eD) : 0;
    if (o.cap) { lin = Math.min(lin, o.cap - 1); ce = Math.min(ce, o.cap - 1); }
    return { net: n, frac: f, linear: lin, constElast: ce };
  }

  // ---------- theory of storage / carry ----------
  function forwardYield(F1, F2, dtYears) { return Math.log(F2 / F1) / dtYears; }
  function fullCarryForward(spot, r, q, T) { return spot * Math.exp((r + q) * T); } // q as a yield on value
  // stylised convenience yield as a function of inventory in days of forward cover (illustrative)
  function convenienceYield(days, p) { // p {yMax, k, dRef}
    p = p || { yMax: 0.60, k: 0.12, dRef: 55 };
    return p.yMax * Math.exp(-p.k * (days - p.dRef + 10));
  }
  function curveFromInventory(spot, days, r, storagePerBblMonth, months, p) {
    var y = convenienceYield(days, p), q = storagePerBblMonth * 12 / spot, out = [];
    for (var m = 0; m <= months; m++) out.push(spot * Math.exp((r + q - y) * m / 12));
    return { curve: out, convYield: y, storageYield: q, netYield: r + q - y };
  }
  // cash-and-carry: buy spot, store, sell forward; financing simple interest on purchase price
  function cashAndCarry(o) { // {spot, forward, months, storagePerMonth ($/bbl), rate (annual), lossFrac, insurancePerMonth}
    var fin = o.spot * o.rate * o.months / 12;
    var store = (o.storagePerMonth + (o.insurancePerMonth || 0)) * o.months;
    var loss = o.spot * (o.lossFrac || 0);
    var cost = fin + store + loss;
    return { carryEarned: o.forward - o.spot, financing: fin, storage: store, losses: loss, totalCost: cost, profit: o.forward - o.spot - cost, breakevenSpread: cost };
  }
  function floatingStoragePerBblMonth(dailyRate, cargoBbl) { return dailyRate * 30 / cargoBbl; }
  function usableCover(stocks, minOperating, dailyUse) { return { headline: stocks / dailyUse, usable: (stocks - minOperating) / dailyUse }; }

  // ---------- boom-bust investment cycle (stylised) ----------
  // annual: demand grows g; price clears short-run with elasticity eps (combined); projects sanctioned on price signal arrive after `lag` years;
  // capacity declines at rate delta; optional spare buffer held by a swing producer absorbs imbalance up to buffer*capacity.
  function cycleSim(o) { // {years, g, eps, lag, delta, beta, P0, floor, ceiling, buffer, d0, shock: {year, size}}
    var C = [o.d0 * (1 + (o.buffer || 0))], D = [], P = [], pipeline = [];
    for (var i = 0; i < o.lag; i++) pipeline.push(o.d0 * (o.delta + o.g));
    for (var t = 0; t < o.years; t++) {
      var d = o.d0 * Math.pow(1 + o.g, t) * (o.shock && t >= o.shock.year && t < o.shock.year + (o.shock.len || 1) ? (1 + o.shock.size) : 1);
      D.push(d);
      var cap = C[t];
      // a swing producer (if any) withholds output to keep supply = demand, up to a maximum it will tolerate (2 × normal spare)
      var maxWithhold = 2 * (o.buffer || 0) * d;
      var withhold = Math.max(0, Math.min(cap - d, maxWithhold));
      var supply = cap - withhold;
      var p = o.P0 * Math.pow(d / Math.max(1e-9, supply), 1 / o.eps);
      p = Math.max(o.floor, Math.min(o.ceiling, p));
      P.push(p);
      var sanction = cap * (o.delta + o.g + o.beta * Math.log(p / o.P0));
      pipeline.push(Math.max(0, sanction));
      var arriving = pipeline.shift();
      C.push(cap * (1 - o.delta) + arriving);
    }
    return { P: P, D: D, C: C.slice(0, o.years) };
  }

  // ---------- cartel arithmetic ----------
  // revenue of a swing producer that cuts output by x to lift price, given market shortfall response
  function swingRevenue(o) { // {q (own mb/d), Q (market mb/d), P0, cut (mb/d), eTotal}
    var priceUp = Math.pow(o.Q / (o.Q - o.cut), 1 / o.eTotal);
    var before = o.q * o.P0, after = (o.q - o.cut) * o.P0 * priceUp;
    return { priceMultiple: priceUp, revenueBefore: before, revenueAfter: after, change: after - before };
  }
  function cheatGain(o) { // {quota, extra, P (with discipline), dP per mb/d extra} — gain to one member that overproduces
    var pNew = o.P - o.dPperMbd * o.extra;
    return { honest: o.quota * o.P, cheat: (o.quota + o.extra) * pNew, gain: (o.quota + o.extra) * pNew - o.quota * o.P, priceAfter: pNew };
  }

  // ---------- long-run demand sketch (illustrative) ----------
  // cars and light trucks share of demand, EV share of the fleet, efficiency gain on remaining ICE, growth of other uses
  function demandPath(o) { // {base, roadShare, evShare, iceEff, otherGrowth (annual), years}
    var road = o.base * o.roadShare, other = o.base - road;
    var roadNew = road * (1 - o.evShare) * (1 - o.iceEff);
    var otherNew = other * Math.pow(1 + o.otherGrowth, o.years);
    return { road: roadNew, other: otherNew, total: roadNew + otherNew, change: roadNew + otherNew - o.base };
  }
  function declineReplacement(productionMbd, declineRate) { return productionMbd * 365 * declineRate / 1000; } // billion bbl/yr
  var api = { U: U, demandPath: demandPath, declineReplacement: declineReplacement, boeFromGasMcf: boeFromGasMcf, annualFromDaily: annualFromDaily, retailBreakdown: retailBreakdown,
    reservesFromPercentiles: reservesFromPercentiles, pscSplit: pscSplit, portfolioP90: portfolioP90, rFactorPsc: rFactorPsc, arpsRate: arpsRate, arpsCum: arpsCum, treadmill: treadmill,
    firstYearDecline: firstYearDecline, wellsToHold: wellsToHold, clearStack: clearStack, shockLinear: shockLinear, shockConstElast: shockConstElast,
    netShortfall: netShortfall, shockScenario: shockScenario, forwardYield: forwardYield, fullCarryForward: fullCarryForward,
    convenienceYield: convenienceYield, curveFromInventory: curveFromInventory, cashAndCarry: cashAndCarry,
    floatingStoragePerBblMonth: floatingStoragePerBblMonth, usableCover: usableCover, cycleSim: cycleSim,
    swingRevenue: swingRevenue, cheatGain: cheatGain,
    STACK: [ // illustrative full-cycle breakevens and capacities (mb/d), shaped after Kaiser §4.6.3's ordering; not data
      { name: 'Middle East onshore', capacity: 28, cost: 15 },
      { name: 'Other OPEC conventional', capacity: 12, cost: 30 },
      { name: 'Russia / FSU', capacity: 13, cost: 38 },
      { name: 'Non-OPEC conventional onshore', capacity: 12, cost: 42 },
      { name: 'Shallow offshore', capacity: 9, cost: 45 },
      { name: 'US shale / tight oil', capacity: 10, cost: 52 },
      { name: 'Deepwater', capacity: 9, cost: 58 },
      { name: 'Heavy oil / oil sands', capacity: 4, cost: 72 },
      { name: 'Arctic / frontier', capacity: 2, cost: 85 }] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C1 = api;
})(typeof window !== 'undefined' ? window : this);
