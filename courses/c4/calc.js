/* Course 4 calculation library — trade and structured commodity finance. Browser: window.C4; Node: module.exports. */
(function (root) {
  'use strict';

  // ---------- M1 funding needs ----------
  // working capital tied up in the trade cycle: daily turnover × (inventory days + receivable days − payable days)
  function workingCapital(turnover, dio, dso, dpo) { return turnover / 365 * (dio + dso - dpo); }
  // variation margin on a short futures hedge when prices rise by `move`
  function marginNeed(volume, move) { return Math.max(0, volume * move); }
  function fundingHeadroom(o) { // {wc, margin, transactional, rcf}
    var need = o.wc + o.margin, lines = o.transactional + o.rcf;
    return { need: need, lines: lines, headroom: lines - need, rcfUse: Math.max(0, need - o.transactional) };
  }

  // ---------- M2 LCs and discounting ----------
  // seller-side LC costs: confirmation quarterly in advance on the confirmed amount; negotiation/payment fee flat
  function lcSellerCost(o) { // {amount, confirmPa, months, negotiationPct}
    var quarters = Math.ceil(o.months / 3), confirm = o.amount * o.confirmPa / 4 * quarters, neg = o.amount * o.negotiationPct;
    return { quarters: quarters, confirmation: confirm, negotiation: neg, total: confirm + neg, pct: (confirm + neg) / o.amount };
  }
  // discounting a deferred-payment obligation: straight discount and discount-to-yield (money-market basis)
  function straightDiscount(face, rate, days, basis) { return face * (1 - rate * days / (basis || 360)); }
  function discountToYield(face, rate, days, basis) { return face / (1 + rate * days / (basis || 360)); }
  // effective simple yield earned by a buyer paying `price` for `face` in `days`
  function impliedYield(face, price, days, basis) { return (face / price - 1) * (basis || 360) / days; }

  // ---------- M3 inventory, borrowing base, RBL, repo ----------
  function borrowingBase(items) { var s = 0; items.forEach(function (it) { s += it.value * it.advance; }); return s; }
  // apply a price shock to unhedged commodity collateral, then recompute
  function borrowingBaseShock(items, shock) {
    return borrowingBase(items.map(function (it) { return { value: it.value * (it.priceExposed ? 1 + shock : 1), advance: it.advance }; }));
  }
  // reserve-based lending: categories valued then discounted for development/production risk (Rutten ch.20 ranges)
  function rblBase(o) { return o.pdp * (1 - o.dPdp) + o.pdnp * (1 - o.dPdnp) + o.pud * (1 - o.dPud); }
  // repo: bank buys at value × (1 − haircut), client repurchases after `days` at that price plus funding
  function repo(o) { var buy = o.value * (1 - o.haircut), back = buy * (1 + o.rate * o.days / 360); return { purchase: buy, repurchase: back, cost: back - buy }; }
  // past-due and concentration eligibility filters for a receivables borrowing base; the obligor cap is a share of the pool
  // left after past-due exclusions (a single pass: facilities that re-apply the cap to the post-cap pool iterate further)
  function eligibleReceivablesPool(invoices, obligorCapPct, maxPastDueDays) { // invoices: [{obligor, amount, pastDueDays, advance}]
    var capPct = obligorCapPct === undefined ? 0.20 : obligorCapPct, maxDays = maxPastDueDays === undefined ? 60 : maxPastDueDays;
    var current = invoices.filter(function (inv) { return inv.pastDueDays <= maxDays; });
    var capTotal = current.reduce(function (a, b) { return a + b.amount; }, 0) * capPct;
    var obligorTotals = {}, eligible = [], excludedPastDue = 0, excludedConc = 0, base = 0;
    invoices.forEach(function (inv) {
      if (inv.pastDueDays > maxDays) { excludedPastDue += inv.amount; return; }
      var current = obligorTotals[inv.obligor] || 0;
      var room = Math.max(0, capTotal - current);
      var allowed = Math.min(inv.amount, room);
      excludedConc += (inv.amount - allowed);
      obligorTotals[inv.obligor] = current + allowed;
      if (allowed > 0) {
        eligible.push({ obligor: inv.obligor, amount: allowed, advance: inv.advance });
        base += allowed * inv.advance;
      }
    });
    return { capPerObligor: capTotal, excludedPastDue: excludedPastDue, excludedConc: excludedConc, borrowingBase: base };
  }

  // ---------- M4 pre-export and prepayment ----------
  function annuity(amount, ratePa, months) { var r = ratePa / 12; return r === 0 ? amount / months : amount * r / (1 - Math.pow(1 + r, -months)); }
  // monthly schedule for a prepayment repaid by deliveries; price path may vary; top-up volume restores debt service
  function prepaySchedule(o) { // {amount, ratePa, months, volume (bbl/month), prices[] or price, topUp:boolean, maxTopUpPct}
    var pay = annuity(o.amount, o.ratePa, o.months), rows = [], minCover = Infinity, shortfall = 0, topUps = 0;
    for (var m = 0; m < o.months; m++) {
      var p = o.prices ? o.prices[m] : o.price, rev = o.volume * p, extra = 0;
      if (rev < pay && o.topUp) { extra = Math.min((pay - rev) / p, o.volume * (o.maxTopUpPct === undefined ? 1 : o.maxTopUpPct)); rev += extra * p; topUps += extra; }
      var cover = rev / pay; minCover = Math.min(minCover, cover); if (rev < pay) shortfall += pay - rev;
      rows.push({ month: m + 1, price: p, revenue: rev, debtService: pay, excess: rev - pay, topUp: extra, cover: cover });
    }
    return { payment: pay, rows: rows, minCover: minCover, shortfall: shortfall, topUpVolume: topUps, contractValue: o.volume * o.months * (o.prices ? o.prices[0] : o.price) };
  }
  function breakevenPrice(payment, volume) { return payment / volume; }

  // ---------- M5 credit enhancement and hedging ----------
  function creditInsurance(o) { var prem = o.amount * o.premiumPa * o.days / 360; return { premium: prem, covered: o.amount * o.cover, retained: o.amount * (1 - o.cover) }; }
  // per-barrel proceeds of a producer under hedge strategies; premiums per bbl
  function hedgedProceeds(P, s) {
    switch (s.type) {
      case 'none': return P;
      case 'swap': return s.K;
      case 'put': return Math.max(P, s.K) - s.premium;
      case 'collar': return Math.min(Math.max(P, s.Kp), s.Kc) - (s.premium || 0);
      case 'calls': return P + (s.premium - Math.max(0, P - s.Kc)) * (s.ratio || 1);
    }
    return P;
  }
  // blended cost of an ECA-covered loan: ECA tranche (rate + upfront premium spread over life) and an uncovered commercial tranche
  function ecaBlend(o) { // {share, ecaRate, premiumFlat, years, comRate}
    var eca = o.ecaRate + o.premiumFlat / o.years;
    return { ecaAllIn: eca, blended: o.share * eca + (1 - o.share) * o.comRate };
  }

  // ---------- M6 receivables ----------
  function factoring(o) { // {invoice, advancePct, feePct, rate, days}
    var adv = o.invoice * o.advancePct, interest = adv * o.rate * o.days / 360, fee = o.invoice * o.feePct;
    return { advance: adv, interest: interest, fee: fee, balance: o.invoice - adv - interest - fee, cost: interest + fee };
  }
  function poolLoss(pool, defaultRate, lgd, dilution) { return pool * (defaultRate * lgd + (dilution || 0)); }
  function tranches(loss, pool, subordination, reserve) { // subordination as fraction of pool; reserve cash in front of junior
    var absorbed = Math.min(loss, reserve || 0), rest = loss - absorbed, jr = Math.min(rest, pool * subordination), sr = Math.max(0, rest - pool * subordination);
    return { reserve: absorbed, junior: jr, senior: sr, seniorPct: sr / (pool * (1 - subordination)) };
  }

  // ---------- M7 capital and recoveries ----------
  function capitalCharge(exposure, ccf, rw, ratio) { return exposure * ccf * rw * (ratio === undefined ? 0.08 : ratio); }
  function returnOnCapital(o) { // {exposure, feePa, days, ccf, rw, ratio}
    var cap = capitalCharge(o.exposure, o.ccf, o.rw, o.ratio), fee = o.exposure * o.feePa * o.days / 360;
    return { capital: cap, fee: fee, annualised: cap > 0 ? fee / cap * 360 / o.days : Infinity };
  }
  function recovery(value, liquidationLoss) { return value * (1 - liquidationLoss); }
  // Basel specialized lending (Commodities Finance) slotting categories and RWA
  // Categories: Strong (70% or 50% if maturity < 2.5 yrs), Good (90% or 70%), Satisfactory (115%), Weak (250%)
  function baselSlottingRwa(exposure, category, shortMaturity) {
    var weights = {
      strong: shortMaturity ? 0.50 : 0.70,
      good: shortMaturity ? 0.70 : 0.90,
      satisfactory: 1.15,
      weak: 2.50
    };
    var rw = weights[category.toLowerCase()] || 1.00;
    var rwa = exposure * rw;
    var capital = rwa * 0.08;
    return { category: category, rw: rw, rwa: rwa, capitalRequired: capital };
  }

  var api = { workingCapital: workingCapital, marginNeed: marginNeed, fundingHeadroom: fundingHeadroom,
    lcSellerCost: lcSellerCost, straightDiscount: straightDiscount, discountToYield: discountToYield, impliedYield: impliedYield,
    borrowingBase: borrowingBase, borrowingBaseShock: borrowingBaseShock, rblBase: rblBase, repo: repo,
    eligibleReceivablesPool: eligibleReceivablesPool, baselSlottingRwa: baselSlottingRwa,
    annuity: annuity, prepaySchedule: prepaySchedule, breakevenPrice: breakevenPrice,
    creditInsurance: creditInsurance, hedgedProceeds: hedgedProceeds, ecaBlend: ecaBlend,
    factoring: factoring, poolLoss: poolLoss, tranches: tranches,
    capitalCharge: capitalCharge, returnOnCapital: returnOnCapital, recovery: recovery };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.C4 = api;
})(typeof window !== 'undefined' ? window : this);
