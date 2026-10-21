/* Course 3 calculation library — physical oil trading. Browser: window.C3; Node: module.exports. */
(function (root) {
  'use strict';

  var BBL_PER_T = { crude: 7.33, gasoil: 7.45, jet: 7.88, gasoline: 8.33, naphtha: 8.9, fuelOil: 6.35 }; // Downey Table 17-1 style factors (crude: generic 7.33)

  // deterministic pseudo-random numbers (so widgets and tests agree)
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
  function normals(n, seed) { var r = rng(seed), out = []; for (var i = 0; i < n; i++) { var u = Math.max(r(), 1e-12), v = r(); out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); } return out; }

  // ---------- M1 benchmarks and differentials ----------
  // mean of a set of [low, high] quotes, then mean of those means (Platts-style "mean of means")
  function meanOfMeans(pairs) { var s = 0; pairs.forEach(function (p) { s += (p[0] + p[1]) / 2; }); return s / pairs.length; }
  // basket formula: sum(w_i * P_i) + constant
  function formulaPrice(weights, prices, constant) { var s = constant || 0; for (var k in weights) s += weights[k] * prices[k]; return s; }
  // sulphur de-escalator: centsPer01 cents/bbl for each 0.1% (or part, pro rata) above threshold
  function sulphurDeescalator(sulphurPct, thresholdPct, centsPer01) { return Math.max(0, sulphurPct - thresholdPct) / 0.1 * centsPer01 / 100; }
  // FOB value of a grade relative to a benchmark sold into the same refining market:
  // grade FOB = benchmark FOB + quality value difference + (benchmark freight − grade freight)
  function relativeFob(o) { return o.benchFob + o.qualityAdj + o.freightBench - o.freightGrade; }
  // Platts MOC partials convergence to a full physical cargo between one pair of counterparties
  // (North Sea Brent: 100 kbbl partials, 6 = one 600 kbbl cargo; Dubai/Oman: 25 kbbl partials, 20 = one 500 kbbl cargo)
  function partialsToCargo(partialsCount, partialSizeKbbl, fullCargoKbbl) {
    var size = partialSizeKbbl || 100, full = fullCargoKbbl || 600;
    var partialsNeeded = full / size;
    var converged = Math.floor(partialsCount / partialsNeeded);
    var remainingPartials = partialsCount % partialsNeeded;
    return { partialsNeeded: partialsNeeded, convergedCargoes: converged, remainingPartials: remainingPartials, convergedVolumeBbl: converged * full * 1000 };
  }
  // NYMEX WTI Calendar Month Average (CMA) roll: the prompt contract expires around the 20th, so a month's trading days
  // price partly against M1 (d1 days) and partly against M2 (d2 days): CMA = (d1/D)*M1 + (d2/D)*M2, roughly 2/3 M1 + 1/3 M2
  function cmaRoll(m1Price, m2Price, d1Days, d2Days) {
    var d1 = d1Days === undefined ? 14 : d1Days, d2 = d2Days === undefined ? 7 : d2Days, totalDays = d1 + d2;
    var w1 = d1 / totalDays, w2 = d2 / totalDays;
    var cma = w1 * m1Price + w2 * m2Price;
    return { w1: w1, w2: w2, cma: cma, rollCostPerBbl: cma - m1Price };
  }

  // ---------- M2 pricing windows ----------
  function windowAverage(prices, from, to) { var s = 0, n = 0; for (var i = from; i <= to; i++) { s += prices[i]; n++; } return s / n; }
  // price path with drift ($/bbl per day) and daily volatility ($/bbl), seeded
  function pricePath(start, days, drift, vol, seed) { var z = normals(days, seed), p = [start]; for (var i = 1; i < days; i++) p.push(p[i - 1] + drift + vol * z[i]); return p; }
  // cargo margin when purchase and sale are priced over different windows of the same benchmark;
  // hedge: sell futures daily through the purchase window, buy back daily through the sale window
  function windowMargin(o) { // {spot[], fut[], buyFrom, buyTo, sellFrom, sellTo, buyDiff, sellDiff}
    var pb = windowAverage(o.spot, o.buyFrom, o.buyTo) + o.buyDiff, ps = windowAverage(o.spot, o.sellFrom, o.sellTo) + o.sellDiff;
    var hedge = windowAverage(o.fut, o.buyFrom, o.buyTo) - windowAverage(o.fut, o.sellFrom, o.sellTo);
    return { buy: pb, sell: ps, unhedged: ps - pb, hedge: hedge, hedged: ps - pb + hedge };
  }
  // trader's fixed sale vs back-to-back (formula) sale on a formula purchase
  function fixedVsBackToBack(o) { // {purchaseQuote, purchasePrem, fixedSale, b2bPrem}
    var cost = o.purchaseQuote + o.purchasePrem;
    return { cost: cost, fixedMargin: o.fixedSale - cost, b2bMargin: o.b2bPrem - o.purchasePrem };
  }

  // ---------- M3 paper markets ----------
  // fixed-for-floating swap, monthly average settlement; positive = paid to the fixed-price payer
  function swapSettlement(fixed, floats, volume) { var avg = floats.reduce(function (a, b) { return a + b; }, 0) / floats.length; return { avg: avg, perUnit: avg - fixed, payment: (avg - fixed) * volume }; }
  // hedged forward sale at benchmark + diff: sell futures at F0 now, buy back at F1 at pricing; basisChange moves the physical diff
  function hedgedSale(o) { // {diff, F0, F1, basisChange, ratio}
    var r = o.ratio === undefined ? 1 : o.ratio;
    var physical = o.F1 + o.diff + (o.basisChange || 0), hedge = r * (o.F0 - o.F1);
    return { physical: physical, hedge: hedge, net: physical + hedge, locked: o.F0 + o.diff };
  }
  // P&L of a hedged long physical position (bought at fixed price, priced later) per bbl
  function hedgePnL(o) { // {flatMove, basisMove, ratio, volume}
    var phys = (o.flatMove + o.basisMove) * o.volume, fut = -o.ratio * o.flatMove * o.volume;
    return { physical: phys, futures: fut, net: phys + fut };
  }
  // Brent CFD lock (Schofield ch.5 logic): buying a CFD for the pricing week and a forward month locks forward Dated = fwd0 + cfd0
  function cfdLock(o) { // {cfd0, fwd0, datedAvg, cfdSettle}
    var cfdPnL = o.cfdSettle - o.cfd0, fwdClose = o.datedAvg - o.cfdSettle, fwdPnL = fwdClose - o.fwd0;
    return { locked: o.fwd0 + o.cfd0, cfdPnL: cfdPnL, fwdClose: fwdClose, fwdPnL: fwdPnL, netCost: o.datedAvg - cfdPnL - fwdPnL };
  }
  // minimum-variance hedge ratio h* = rho × sigma_spot / sigma_futures (Hull ch.3)
  function minVarRatio(rho, sS, sF) { return rho * sS / sF; }
  // variation margin flows for a futures position (lots of lotSize); side +1 long, −1 short
  function variationMargin(settles, lots, lotSize, side) { var flows = [], cum = 0; for (var i = 1; i < settles.length; i++) { var f = side * (settles[i] - settles[i - 1]) * lots * lotSize; cum += f; flows.push({ day: i, flow: f, cum: cum }); } return flows; }
  // bookout circle: each party pays its seller vol × (purchase − base); returns per-party net (= vol × (sale − purchase))
  function bookout(prices, base, volume) { // prices[i] = price at which party i buys from party i−1 (circular)
    var n = prices.length, pays = prices.map(function (p) { return volume * (p - base); });
    return prices.map(function (p, i) { var sale = prices[(i + 1) % n]; return { paysSeller: pays[i], receivesFromBuyer: pays[(i + 1) % n], net: volume * (sale - p) }; });
  }

  // ---------- M4 laytime and demurrage ----------
  // times in hours from an arbitrary origin; laytime starts at NOR + notice (or berthing if earlier, when allowed)
  function laytime(o) { // {nor, notice, allowed, completed, excluded, rate (USD/day), berthedAt?, despatchRate?}
    var start = o.nor + o.notice;
    if (o.berthedAt !== undefined && o.berthedAt < start) start = o.berthedAt;
    var used = Math.max(0, o.completed - start - (o.excluded || 0)), excess = used - o.allowed;
    var dem = excess > 0 ? excess / 24 * o.rate : 0, desp = excess < 0 && o.despatchRate ? -excess / 24 * o.despatchRate : 0;
    return { start: start, used: used, excess: excess, demurrage: dem, despatch: desp };
  }
  // supply vs charter-party demurrage: shipper claims from supplier for load-port excess over supply laytime,
  // and pays the owner for total port time over the charter-party allowance
  function demurrageMismatch(o) { // {loadHours, dischargeHours, supplyLaytime, cpLaytime, rate}
    var supplyClaim = Math.max(0, o.loadHours - o.supplyLaytime) / 24 * o.rate;
    var cpDue = Math.max(0, o.loadHours + o.dischargeHours - o.cpLaytime) / 24 * o.rate;
    return { supplyClaim: supplyClaim, cpDue: cpDue, net: supplyClaim - cpDue };
  }

  // CIF from CFR when cargo is insured for 110% of CIF value at rate insPct: CIF = CFR / (1 − 1.1·rate)
  function cifFromCfr(cfr, insPct) { return cfr / (1 - 1.1 * insPct); }

  // ---------- M5 freight ----------
  function worldscale(flat, ws, tonnes, bblPerT) { var perT = flat * ws / 100; return { perTonne: perT, total: perT * tonnes, perBbl: perT / (bblPerT || BBL_PER_T.crude) }; }
  // round voyage: laden + ballast at the same speed; bunkers at sea and in port
  function voyage(o) { // {distance nm one way, speed kn, portDays, seaCons t/d, portCons t/d, bunker $/t, portCosts $, canal $}
    var seaDays = 2 * o.distance / (o.speed * 24), days = seaDays + o.portDays;
    var bunkers = (seaDays * o.seaCons + o.portDays * o.portCons) * o.bunker;
    return { seaDays: seaDays, days: days, bunkers: bunkers, voyageCost: bunkers + o.portCosts + (o.canal || 0) };
  }
  function tce(revenue, voyageCost, days) { return (revenue - voyageCost) / days; }
  // Stopford's cube rule: sea consumption scales with (speed / reference speed)^3
  function tceAtSpeed(o, revenue, speed) { // o as voyage() with seaCons measured at o.speed
    var v = voyage(Object.assign({}, o, { speed: speed, seaCons: o.seaCons * Math.pow(speed / o.speed, 3) }));
    return { tce: tce(revenue, v.voyageCost, v.days), days: v.days, voyageCost: v.voyageCost };
  }
  function bestSpeed(o, revenue, lo, hi, step) { var best = lo, bt = -Infinity; for (var s = lo; s <= hi + 1e-9; s += step) { var t = tceAtSpeed(o, revenue, s).tce; if (t > bt) { bt = t; best = s; } } return { speed: best, tce: bt }; }
  // Long's rule of thumb: within a route and size band, cargo size × WS is roughly constant
  function sizeAdjustedWS(ws1, t1, t2) { return ws1 * t1 / t2; }

  // ---------- M6 arbitrage and netbacks ----------
  // delivered margin of moving a cargo bought FOB to a destination priced on a (possibly different) marker
  function arb(o) { // {fob, dest, freight, insurancePct, lossPct, financeRate, days, other} all $/bbl except pcts
    var insurance = o.fob * (o.insurancePct || 0), losses = o.dest * (o.lossPct || 0), finance = o.fob * (o.financeRate || 0) * (o.days || 0) / 360;
    var landed = o.fob + o.freight + insurance + finance + (o.other || 0);
    return { insurance: insurance, losses: losses, finance: finance, landed: landed, margin: o.dest - losses - landed };
  }
  // netback to the load port: destination value less freight and costs
  function netback(dest, freight, costs) { return dest - freight - (costs || 0); }
  // highest freight ($/bbl) at which the arb still breaks even
  function breakevenFreight(o) { var a = arb(Object.assign({}, o, { freight: 0 })); return a.margin; }
  // floating storage economics: daily time-charter hire, cargo financing, insurance and other operating costs (bunkers at anchor, hull cleaning)
  function floatingStorageBreakeven(dailyHire, cargoBbl, months, financingRate, spotPrice, insurancePerMo, otherPerMo) {
    var bblMonthHire = (dailyHire * 30.4167) / cargoBbl;
    var finPerMo = spotPrice * (financingRate / 12);
    var totalCostPerMo = bblMonthHire + finPerMo + (insurancePerMo || 0) + (otherPerMo || 0);
    return { bblMonthHire: bblMonthHire, finPerMo: finPerMo, totalCostPerMo: totalCostPerMo, totalContangoNeeded: totalCostPerMo * months };
  }
  // convert $/bbl freight to Worldscale points on a route with flat rate (USD/t)
  function wsFromPerBbl(perBbl, flat, bblPerT) { return perBbl * (bblPerT || BBL_PER_T.crude) / flat * 100; }

  // ---------- M7 operations and credit ----------
  // re-allocate bills of lading pro rata to out-turn so every receiver bears the same percentage loss
  function blReallocation(loaded, outturns) { var tot = outturns.reduce(function (a, b) { return a + b; }, 0); return outturns.map(function (x) { return loaded * x / tot; }); }
  function lcCost(value, feePct, confirmPct) { return value * (feePct + (confirmPct || 0)); }
  // expected credit loss over a short tenor: EAD × LGD × P(default within tenor), annual PD scaled geometrically
  function expectedLoss(ead, lgd, pdAnnual, days) { return ead * lgd * (1 - Math.pow(1 - pdAnnual, days / 365)); }
  // credit exposure over a sale's life (USD m per day index); price risk before B/L is replacement cost
  function exposureProfile(o) { // {volume bbl, price, diff, dealDay, blDay, creditDays, priceMove ($/bbl move by B/L), security: 'open'|'lc'|'standby'|'pcg', coverage}
    var pts = [], value = o.volume * (o.price + o.diff) / 1e6, payDay = o.blDay + o.creditDays;
    var cover = { open: 0, lc: 1, standby: 1, pcg: o.pcgShare === undefined ? 0.5 : o.pcgShare }[o.security] || 0;
    for (var d = 0; d <= payDay + 5; d++) {
      var gross = 0;
      if (d >= o.dealDay && d < o.blDay) gross = Math.max(0, -o.priceMove) * o.volume / 1e6 * Math.min(1, (d - o.dealDay) / Math.max(1, o.blDay - o.dealDay - 1));
      else if (d >= o.blDay && d <= payDay) gross = value;
      var secured = (d >= o.blDay && d <= payDay) ? gross * cover : 0;
      pts.push({ day: d, gross: gross, unsecured: gross - secured });
    }
    return { value: value, payDay: payDay, peakUnsecured: Math.max.apply(null, pts.map(function (p) { return p.unsecured; })), points: pts };
  }

  var api = { BBL_PER_T: BBL_PER_T, rng: rng, normals: normals,
    meanOfMeans: meanOfMeans, formulaPrice: formulaPrice, sulphurDeescalator: sulphurDeescalator, relativeFob: relativeFob,
    partialsToCargo: partialsToCargo, cmaRoll: cmaRoll, floatingStorageBreakeven: floatingStorageBreakeven,
    windowAverage: windowAverage, pricePath: pricePath, windowMargin: windowMargin, fixedVsBackToBack: fixedVsBackToBack,
    swapSettlement: swapSettlement, hedgedSale: hedgedSale, hedgePnL: hedgePnL, cfdLock: cfdLock, minVarRatio: minVarRatio, variationMargin: variationMargin, bookout: bookout,
    laytime: laytime, demurrageMismatch: demurrageMismatch, cifFromCfr: cifFromCfr,
    worldscale: worldscale, voyage: voyage, tce: tce, tceAtSpeed: tceAtSpeed, bestSpeed: bestSpeed, sizeAdjustedWS: sizeAdjustedWS,
    arb: arb, netback: netback, breakevenFreight: breakevenFreight, wsFromPerBbl: wsFromPerBbl,
    blReallocation: blReallocation, lcCost: lcCost, expectedLoss: expectedLoss, exposureProfile: exposureProfile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C3 = api;
})(typeof window !== 'undefined' ? window : this);
