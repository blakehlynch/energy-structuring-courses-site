/* Course 5 calculation library — electricity market design and price formation. Browser: window.C5; Node: module.exports. */
(function (root) {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }

  // ---------- M1 load shape ----------
  // synthetic hourly load (MW): base × (1 + seasonal + daily) + noise; deterministic by seed
  function synthLoad(o) { // {mean, seasonal (fraction), daily (fraction), noise (fraction), seed}
    var r = rng(o.seed || 3), out = [];
    for (var h = 0; h < 8760; h++) {
      var day = Math.floor(h / 24), hr = h % 24;
      var season = o.seasonal * Math.cos(2 * Math.PI * (day - 200) / 365);          // summer peak around day 200
      var daily = o.daily * Math.sin(Math.PI * (hr - 6) / 16) * (hr >= 6 && hr <= 22 ? 1 : -0.4);
      var noise = o.noise * (r() + r() + r() - 1.5);
      out.push(o.mean * (1 + season + daily + noise));
    }
    return out;
  }
  function ldc(load) { return load.slice().sort(function (a, b) { return b - a; }); }
  function loadFactor(load) { var s = 0, m = -Infinity; load.forEach(function (x) { s += x; if (x > m) m = x; }); return s / load.length / m; }
  function hoursAbove(load, level) { var n = 0; load.forEach(function (x) { if (x >= level) n++; }); return n; }
  function capacityFactor(mwh, mw, hours) { return mwh / (mw * (hours || 8760)); }

  // ---------- M2 costs, screening curves, merit order ----------
  // capital recovery factor and annualised fixed cost ($/MW-yr) from overnight cost ($/kW)
  function crf(r, years) { return r / (1 - Math.pow(1 + r, -years)); }
  function annualFixed(overnightPerKw, r, years, fixedOmPerKwYr) { return (overnightPerKw * crf(r, years) + (fixedOmPerKwYr || 0)) * 1000; }
  function variableCost(heatRate, fuel, vom, co2Intensity, co2Price) { return heatRate * fuel + (vom || 0) + (co2Intensity || 0) * (co2Price || 0); } // $/MWh; heat rate MMBtu/MWh
  // screening curve: annual cost of 1 MW run at capacity factor cf ($/MW-yr)
  function screening(fc, vc, cf) { return fc + vc * cf * 8760; }
  // capacity factor at which two technologies cost the same
  function breakevenCF(fc1, vc1, fc2, vc2) { return (fc2 - fc1) / ((vc1 - vc2) * 8760); }
  // optimal mix against a load-duration curve: techs sorted baseload→peaker (falling FC, rising VC)
  function optimalMix(techs, ldcArr) {
    var n = ldcArr.length, bounds = [], active = [0];
    for (var i = 1; i < techs.length; i++) {
      while (active.length >= 2) {
        var p1 = active[active.length - 2], p2 = active[active.length - 1];
        if (breakevenCF(techs[p2].fc, techs[p2].vc, techs[i].fc, techs[i].vc) >= breakevenCF(techs[p1].fc, techs[p1].vc, techs[p2].fc, techs[p2].vc)) active.pop();
        else break;
      }
      active.push(i);
    }
    // boundary k separates techs 0..k from k+1..: use the active (lower-envelope) techs either side, so a dominated tech gets zero width
    for (var k = 0; k < techs.length - 1; k++) {
      var lo = -1, hi = -1;
      active.forEach(function (a) { if (a <= k) lo = a; else if (hi < 0) hi = a; });
      bounds.push(lo < 0 ? 1 : hi < 0 ? 0 : Math.min(1, Math.max(0, breakevenCF(techs[lo].fc, techs[lo].vc, techs[hi].fc, techs[hi].vc))));
    }
    function L(d) { var idx = Math.min(n - 1, Math.max(0, Math.round(d * n) - 1)); return ldcArr[idx]; }
    var levels = bounds.map(function (b) { return b >= 1 ? 0 : b <= 0 ? ldcArr[0] : L(b); }), caps = new Array(techs.length).fill(0), prev = 0;
    for (var m = 0; m < active.length; m++) {
      var idxT = active[m], nextT = m + 1 < active.length ? active[m + 1] : -1;
      var bActive = nextT >= 0 ? Math.min(1, Math.max(0, breakevenCF(techs[idxT].fc, techs[idxT].vc, techs[nextT].fc, techs[nextT].vc))) : 0;
      var top = nextT >= 0 ? (bActive >= 1 ? 0 : bActive <= 0 ? ldcArr[0] : L(bActive)) : ldcArr[0];
      caps[idxT] = Math.max(0, top - prev); prev = Math.max(prev, top);
    }
    return { bounds: bounds, levels: levels, caps: caps };
  }
  // uniform-price merit order: offers [{q, p}] sorted; inelastic demand D
  function meritOrder(offers, D) {
    var s = offers.slice().sort(function (a, b) { return a.p - b.p; }), cum = 0, price = null, acc = [];
    for (var i = 0; i < s.length; i++) { var take = Math.min(s[i].q, Math.max(0, D - cum)); if (take > 0) { acc.push({ q: take, p: s[i].p, name: s[i].name }); price = s[i].p; } cum += s[i].q; if (cum >= D) break; }
    var served = acc.reduce(function (a, b) { return a + b.q; }, 0);
    return { price: price, accepted: acc, served: served, short: Math.max(0, D - served), uniformCost: price * served, payAsBid: acc.reduce(function (a, b) { return a + b.q * b.p; }, 0) };
  }

  // ---------- M3 two-settlement ----------
  function twoSettlement(o) { // {daQ, daP, actual, rtP}
    var da = o.daQ * o.daP, rt = (o.actual - o.daQ) * o.rtP;
    return { da: da, rt: rt, total: da + rt, avg: (da + rt) / (o.actual || 1) };
  }
  // contract for difference against the spot (financial hedge)
  function cfd(strike, spot, q) { return (strike - spot) * q; }

  // ---------- M4 two-zone LMP ----------
  // zones with linear supply π = a + b·P and fixed demand; flow A→B limited to F
  function twoZone(o) { // {aA, bA, dA, aB, bB, dB, F}
    var D = o.dA + o.dB;
    var PA = (o.aB - o.aA + o.bB * D) / (o.bA + o.bB);           // unconstrained: equal prices
    PA = Math.min(D, Math.max(0, PA));
    var flow = PA - o.dA, constrained = false;
    if (flow > o.F) { flow = o.F; constrained = true; } else if (flow < -o.F) { flow = -o.F; constrained = true; }
    PA = o.dA + flow; var PB = o.dB - flow;
    var piA = o.aA + o.bA * PA, piB = o.aB + o.bB * PB;
    return { PA: PA, PB: PB, flow: flow, piA: piA, piB: piB, constrained: constrained,
      rent: (piB - piA) * flow, payments: piA * o.dA + piB * o.dB, revenues: piA * PA + piB * PB };
  }
  function ftrPayoff(q, piFrom, piTo) { return q * (piTo - piFrom); }

  // ---------- M5 scarcity and capacity ----------
  // optimal hours of load shedding when price = VOLL in shortage (Stoft): D = FC_peaker / (VOLL − VC)
  function sheddingHours(fcPerMwYr, voll, vc) { return fcPerMwYr / (voll - vc); }
  // net revenue of a peaker from scarcity pricing at a cap, for h hours
  function scarcityRevenue(cap, vc, hours) { return Math.max(0, cap - vc) * hours; }
  function missingMoney(fcPerMwYr, eas) { return Math.max(0, fcPerMwYr - eas); }
  // capacity element of the old England & Wales pool: VOLL × LoLP
  function capacityElement(voll, lolp) { return voll * lolp; }
  // fixed-cost recovery from a linear price-duration spike: height above VC × duration / 2
  function spikeRecovery(peak, vc, duration) { return Math.max(0, peak - vc) * duration / 2; }

  // ---------- M6 storage and renewables ----------
  // daily arbitrage: charge in the k cheapest hours, discharge in the k dearest (non-overlapping), energy-limited
  function arbitrage(prices, k, mw, eta) {
    var idx = prices.map(function (p, i) { return i; });
    var lo = idx.slice().sort(function (a, b) { return prices[a] - prices[b]; }).slice(0, k);
    var hi = idx.slice().sort(function (a, b) { return prices[b] - prices[a]; }).filter(function (i) { return lo.indexOf(i) < 0; }).slice(0, k);
    var buy = lo.reduce(function (a, i) { return a + prices[i]; }, 0) * mw, sell = hi.reduce(function (a, i) { return a + prices[i]; }, 0) * mw * eta;
    return { charge: lo, discharge: hi, cost: buy, revenue: sell, profit: sell - buy };
  }
  // duck-curve style daily price: base shape lowered at midday by solar share
  function dailyPrices(o) { // {base, peak, solar}
    var out = [];
    for (var h = 0; h < 24; h++) {
      var demand = 0.75 + 0.25 * Math.sin(Math.PI * (h - 5) / 18) + (h >= 17 && h <= 21 ? 0.25 : 0);
      var sun = (h >= 7 && h <= 18) ? Math.sin(Math.PI * (h - 6) / 13) : 0;
      var net = Math.max(0.05, demand - o.solar * sun);
      out.push(o.base + (o.peak - o.base) * Math.pow(net, 2.2));
    }
    return out;
  }
  function captureRate(prices, profile) { var pv = 0, p = 0, s = 0; prices.forEach(function (x, i) { pv += x * profile[i]; s += profile[i]; p += x; }); return (pv / s) / (p / prices.length); }
  // opportunity-cost reserve price: margin forgone by backing a unit down to hold reserve
  function reserveOpportunity(price, mc) { return Math.max(0, price - mc); }

  // ---------- Upper-graduate desk extensions ----------
  // M3: Unit commitment non-convexity & make-whole uplift payment
  function makeWholeUplift(o) { // { startCost, noLoadCost, mc, q, hours, clearingPrice }
    var totalCost = (o.startCost || 0) + ((o.noLoadCost || 0) + o.mc * o.q) * o.hours;
    var marketRevenue = o.clearingPrice * o.q * o.hours;
    var uplift = Math.max(0, totalCost - marketRevenue);
    return { totalCost: totalCost, marketRevenue: marketRevenue, uplift: uplift, shortfallPerMwh: uplift / (o.q * o.hours || 1) };
  }

  // M4: 3-bus PTDF transmission network & LMP decomposition
  function threeBusPtdfLmp(refLmp, mu, ptdfs) { // ptdfs = { A: 1/3, B: -1/3, C: 0 }
    return {
      lmpA: refLmp - ptdfs.A * mu,
      lmpB: refLmp - ptdfs.B * mu,
      lmpC: refLmp - (ptdfs.C || 0) * mu,
      spreadBA: (ptdfs.A - ptdfs.B) * mu
    };
  }

  // M5: Hogan Operating Reserve Demand Curve (ORDC) scarcity adder
  function phi(z) {
    var b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
    var p = 0.2316419;
    var t = 1.0 / (1.0 + p * Math.abs(z));
    var poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
    var pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    var cdf = 1.0 - pdf * poly;
    return z >= 0 ? cdf : 1.0 - cdf;
  }
  function ordcAdder(reserves, minContingency, sigma, voll, lambda) {
    var z = (minContingency - reserves) / sigma;
    var lolp = reserves <= minContingency ? 1 : phi(z); // at or below the minimum contingency level, loss of load is treated as certain
    var adder = Math.max(0, voll - (lambda || 0)) * lolp;
    return { z: z, lolp: lolp, adder: adder, totalPrice: (lambda || 0) + adder };
  }

  // M7: Allaz & Vila (1993) Cournot forward contracting game, linear demand P = a - bQ, constant cost c, one forward stage
  // spot stage given forwards: q_i = ((a - c)/b + 2 f_i - f_j) / 3; forward stage FOC gives f = (a - c)/(5b), q = 2(a - c)/(5b)
  function allazVilaDuopoly(a, b, c) {
    var qCournot = (a - c) / (3 * b);
    var totCournot = 2 * qCournot;
    var pCournot = a - b * totCournot;
    var piCournot = (pCournot - c) * qCournot;

    var fForward = (a - c) / (5 * b);
    var qSpot = ((a - c) / b + fForward) / 3;
    var totAV = 2 * qSpot;
    var pAV = a - b * totAV;
    var piAV = (pAV - c) * qSpot;

    return {
      cournot: { qPerFirm: qCournot, totalQ: totCournot, price: pCournot, profitPerFirm: piCournot },
      allazVila: { forwardSales: fForward, qPerFirm: qSpot, totalQ: totAV, price: pAV, profitPerFirm: piAV }
    };
  }

  // ---------- M7 market power ----------
  function hhi(shares) { return shares.reduce(function (a, s) { return a + s * s; }, 0); }
  function lerner(share, elasticity) { return share / elasticity; }
  function priceFromLerner(mc, L) { return L >= 1 ? Infinity : mc / (1 - L); }
  // withholding: firm with capacity K (MW), forward-contracted F, marginal cost mc; price moves P0→P1 when it withholds w
  // (K − w − F < 0 means withholding leaves the firm net short its forward sales, so the price rise costs it money)
  function withholdingGain(o) { return (o.P1 - o.P0) * (o.K - o.w - o.F) - o.w * Math.max(0, o.P0 - o.mc); }
  // residual supply index: (total supply − firm's supply) / demand (outside the texts; common screen)
  function rsi(totalSupply, firmSupply, demand) { return (totalSupply - firmSupply) / demand; }

  var api = { rng: rng, synthLoad: synthLoad, ldc: ldc, loadFactor: loadFactor, hoursAbove: hoursAbove, capacityFactor: capacityFactor,
    crf: crf, annualFixed: annualFixed, variableCost: variableCost, screening: screening, breakevenCF: breakevenCF, optimalMix: optimalMix, meritOrder: meritOrder,
    twoSettlement: twoSettlement, cfd: cfd, makeWholeUplift: makeWholeUplift,
    twoZone: twoZone, ftrPayoff: ftrPayoff, threeBusPtdfLmp: threeBusPtdfLmp,
    sheddingHours: sheddingHours, scarcityRevenue: scarcityRevenue, missingMoney: missingMoney, capacityElement: capacityElement, spikeRecovery: spikeRecovery, ordcAdder: ordcAdder,
    arbitrage: arbitrage, dailyPrices: dailyPrices, captureRate: captureRate, reserveOpportunity: reserveOpportunity,
    hhi: hhi, lerner: lerner, priceFromLerner: priceFromLerner, withholdingGain: withholdingGain, rsi: rsi, allazVilaDuopoly: allazVilaDuopoly };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C5 = api;
})(typeof window !== 'undefined' ? window : this);
