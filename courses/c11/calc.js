/* Course 11 calculation library — natural gas and LNG: units, chain costs, transport options, liquefaction tariffs, SPA pricing, voyages, cargo flexibility. Browser: window.C11; Node: module.exports. */
(function (root) {
  'use strict';

  var CF_PER_M3 = 35.3147;     // cubic feet per cubic metre
  var BCM_PER_MT = 1.316;      // bcm of gas per million tonnes of LNG (Mokhatab table 1-2)
  var HV_REF = 1100;           // Btu per standard cubic foot assumed for regasified LNG
  // energy per tonne is set by mass and barely moves with composition, so it is fixed at Mokhatab's factor and HV_REF
  var MMBTU_PER_T = BCM_PER_MT * CF_PER_M3 * HV_REF / 1000;

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
  function normals(seed) {
    var u = rng(seed), spare = null;
    return function () {
      if (spare !== null) { var t = spare; spare = null; return t; }
      var a = u() || 1e-12, b = u(), m = Math.sqrt(-2 * Math.log(a));
      spare = m * Math.sin(2 * Math.PI * b); return m * Math.cos(2 * Math.PI * b);
    };
  }
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
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }

  // ---------- M1 units and the chain ----------
  function mmbtuPerTonne() { return MMBTU_PER_T; }
  // richer gas has more Btu per cubic foot, so the same tonne regasifies to fewer bcm
  function bcmPerMt(hv) { return MMBTU_PER_T * 1000 / (CF_PER_M3 * (hv || HV_REF)); }
  function pencePerThermToUsd(p, fx) { return p / 100 * 10 * fx; }   // 10 therms = 1 MMBtu
  function train(o) {
    var perT = mmbtuPerTonne(), bcmT = bcmPerMt(o.hv), tonnes = o.mtpa * 1e6 * o.avail, cargoT = o.shipM3 * o.density;
    return { bcm: o.mtpa * bcmT, bcmProduced: o.mtpa * o.avail * bcmT, perT: perT, tonnes: tonnes, mmbtu: tonnes * perT,
      cargoT: cargoT, cargoMMBtu: cargoT * perT, cargoes: tonnes / cargoT, cargoValue: cargoT * perT * (o.price || 0) };
  }
  // delivered cost stack and wellhead netback from a delivered (DES) price
  function chain(stages, desPrice) {
    var total = sum(stages.map(function (s) { return s.cost; }));
    var down = sum(stages.filter(function (s) { return s.name !== 'Production'; }).map(function (s) { return s.cost; }));
    return { total: total, shares: stages.map(function (s) { return s.cost / total; }), netback: desPrice - down, margin: desPrice - total };
  }

  // ---------- M2 hubs and transport ----------
  // Kirk's approximation for a call on F1 − H·F2 − K (Margrabe when K = 0)
  function kirk(F1, F2, H, K, T, s1, s2, rho, r) {
    var df = Math.exp(-(r || 0) * T);
    var b = H * F2 + K;
    if (T <= 0) return df * Math.max(0, F1 - b);
    var w = H * F2 / b;
    var sig = Math.sqrt(s1 * s1 - 2 * rho * s1 * s2 * w + s2 * s2 * w * w), sv = sig * Math.sqrt(T);
    if (sv <= 0) return df * Math.max(0, F1 - b);
    var d1 = (Math.log(F1 / b) + sv * sv / 2) / sv, d2 = d1 - sv;
    return df * (F1 * ncdf(d1) - b * ncdf(d2));
  }
  // firm transport from a supply hub to a market area: buy at the hub plus fuel retention and commodity charge, sell at the market (intrinsic is discounted like the option)
  function transport(o) {
    var H = 1 + o.fuel, intrinsic = Math.exp(-o.r * o.T) * Math.max(0, o.market - H * o.hub - o.commodity);
    var value = kirk(o.market, o.hub, H, o.commodity, o.T, o.sMarket, o.sHub, o.rho, o.r);
    return { intrinsic: intrinsic, value: value, extrinsic: value - intrinsic, net: value - o.reservation };
  }

  // ---------- M3 project economics ----------
  function crf(r, n) { return r / (1 - Math.pow(1 + r, -n)); }
  // cost-of-service liquefaction fee: annualised capital charge plus opex over the energy actually produced
  function tariff(o) {
    var capex = o.capexPerT * o.mtpa * 1e6, capCharge = capex * crf(o.r, o.life), opex = capex * o.opexPct;
    var mmbtu = o.mtpa * 1e6 * o.avail * mmbtuPerTonne();
    return { capex: capex, capCharge: capCharge, opex: opex, mmbtu: mmbtu, fee: (capCharge + opex) / mmbtu, capFee: capCharge / mmbtu, opexFee: opex / mmbtu };
  }
  function usFob(hh, fee, mult) { return (mult === undefined ? 1.15 : mult) * hh + fee; }

  // ---------- M4 SPA pricing ----------
  function oilLinked(oil, slope, c) { return slope * oil + c; }
  // S-curve: the base slope applies between lo and hi; a flatter outer slope applies beyond either kink
  function sCurve(oil, o) {
    if (oil > o.hi) return o.slope * o.hi + o.c + o.outer * (oil - o.hi);
    if (oil < o.lo) return o.slope * o.lo + o.c - o.outer * (o.lo - oil);
    return o.slope * oil + o.c;
  }
  // European base-period formula P_n = P_0 × Σ W_i × F_in / F_i0
  function baseIndex(P0, weights, ratios) { return P0 * sum(weights.map(function (w, i) { return w * ratios[i]; })); }
  function topShortfall(acq, dqt, taken) { return Math.max(0, acq * (1 - dqt) - taken); }
  function parity(mmbtuPerBbl) { return 1 / mmbtuPerBbl; }

  // ---------- M5 shipping ----------
  // round voyage: laden and ballast legs at service speed plus port days; boil-off on both legs (the heel covers the ballast leg)
  function voyage(o) {
    var laden = o.nm / (o.kn * 24), sea = 2 * laden, rt = sea + o.portDays;
    var e0 = o.cargoM3 * o.density * mmbtuPerTonne();
    var boil = o.bor * sea * e0, delivered = e0 - boil;
    var hire = o.hire * rt, boilCost = boil * o.gas, port = o.port;
    var total = hire + boilCost + port;
    return { ladenDays: laden, seaDays: sea, rtDays: rt, e0: e0, boil: boil, delivered: delivered,
      hire: hire, boilCost: boilCost, portCost: port, total: total, perMMBtu: total / delivered,
      hirePer: hire / delivered, boilPer: boilCost / delivered, portPer: port / delivered,
      cargoesPerShip: (o.yearDays || 350) / rt };
  }
  function shipsNeeded(cargoes, cargoesPerShip) { return cargoes / cargoesPerShip; }

  // ---------- M6 terminals, netbacks and flexibility ----------
  function regasCost(price, fee, fuelPct) { return fee + fuelPct * price; }
  // netback to the loading port: hub sales pay regas (fee plus vaporiser fuel); DES sales do not
  function netbacks(o) {
    var eu = o.ttf - regasCost(o.ttf, o.regasFee, o.regasFuel) - o.shipEu;
    var as = o.jkm - o.shipAs;
    return { eu: eu, as: as, best: Math.max(eu, as), dest: as > eu ? 'Asia' : 'Europe', spread: as - eu,
      marginEu: eu - o.mult * o.hh, marginAs: as - o.mult * o.hh };
  }
  // US cargo as an option: lift if (1 − fuel)·TTF − regas fee − shipping exceeds 1.15·HH; the tolling fee is sunk
  function liftOption(o) {
    var F1 = (1 - o.regasFuel) * o.ttf, K = o.regasFee + o.shipEu;
    var intrinsic = Math.exp(-o.r * o.T) * Math.max(0, F1 - o.mult * o.hh - K);
    var value = kirk(F1, o.hh, o.mult, K, o.T, o.sTtf, o.sHh, o.rho, o.r);
    return { intrinsic: intrinsic, value: value, extrinsic: value - intrinsic, net: value - o.fee };
  }
  // destination choice by Monte Carlo: correlated lognormal forwards for HH, TTF and JKM at loading
  function bestOf(o) {
    var z = normals(o.seed || 7), n = o.paths || 20000, T = o.T, sq = Math.sqrt(T);
    // Cholesky of [[1, rTJ, rTH], [rTJ, 1, rJH], [rTH, rJH, 1]] for (TTF, JKM, HH)
    var a = o.rTJ, b = o.rTH, c = o.rJH;
    var l22 = Math.sqrt(1 - a * a), l32 = (c - a * b) / l22, l33 = Math.sqrt(Math.max(0, 1 - b * b - l32 * l32));
    var sEu = 0, sAs = 0, sBest = 0, nAs = 0, nLift = 0;
    for (var p = 0; p < n; p++) {
      var e1 = z(), e2 = z(), e3 = z();
      var x1 = e1, x2 = a * e1 + l22 * e2, x3 = b * e1 + l32 * e2 + l33 * e3;
      var ttf = o.ttf * Math.exp(-0.5 * o.sTtf * o.sTtf * T + o.sTtf * sq * x1);
      var jkm = o.jkm * Math.exp(-0.5 * o.sJkm * o.sJkm * T + o.sJkm * sq * x2);
      var hh = o.hh * Math.exp(-0.5 * o.sHh * o.sHh * T + o.sHh * sq * x3);
      var nb = netbacks({ ttf: ttf, jkm: jkm, hh: hh, regasFee: o.regasFee, regasFuel: o.regasFuel, shipEu: o.shipEu, shipAs: o.shipAs, mult: o.mult });
      var eu = Math.max(0, nb.marginEu), as = Math.max(0, nb.marginAs), best = Math.max(eu, as);
      sEu += eu; sAs += as; sBest += best;
      if (best > 0) { nLift++; if (nb.marginAs > nb.marginEu) nAs++; }
    }
    var df = Math.exp(-(o.r || 0) * T);
    return { eu: df * sEu / n, as: df * sAs / n, best: df * sBest / n, pLift: nLift / n, pAsia: nLift ? nAs / nLift : 0 };
  }

  var api = { CF_PER_M3: CF_PER_M3, BCM_PER_MT: BCM_PER_MT, HV_REF: HV_REF, rng: rng, normals: normals, ncdf: ncdf, sum: sum,
    mmbtuPerTonne: mmbtuPerTonne, bcmPerMt: bcmPerMt, pencePerThermToUsd: pencePerThermToUsd, train: train, chain: chain,
    kirk: kirk, transport: transport,
    crf: crf, tariff: tariff, usFob: usFob,
    oilLinked: oilLinked, sCurve: sCurve, baseIndex: baseIndex, topShortfall: topShortfall, parity: parity,
    voyage: voyage, shipsNeeded: shipsNeeded,
    regasCost: regasCost, netbacks: netbacks, liftOption: liftOption, bestOf: bestOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C11 = api;
})(typeof window !== 'undefined' ? window : this);
