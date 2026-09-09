(function (root) {
  'use strict';
  const positive = (v) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
  const known = (v) => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));
  function brokerage(price) {
    if (price < 50000000) return Math.min(price * .006, 250000);
    if (price < 200000000) return Math.min(price * .005, 800000);
    if (price < 900000000) return price * .004;
    if (price < 1200000000) return price * .005;
    if (price < 1500000000) return price * .006;
    return price * .007;
  }
  function purchaseTax(price, area) {
    const rate = price <= 600000000 ? .01 : price <= 900000000 ? (price / 100000000 * 2 / 3 - 3) / 100 : .03;
    return price * rate * 1.1 + (area > 85 ? price * .002 : 0);
  }
  function incomeTax(gross) {
    const deduction = gross <= 5000000 ? gross * .7 : gross <= 15000000 ? 3500000 + (gross - 5000000) * .4
      : gross <= 45000000 ? 7500000 + (gross - 15000000) * .15 : gross <= 100000000 ? 12000000 + (gross - 45000000) * .05
        : Math.min(20000000, 14750000 + (gross - 100000000) * .02);
    let remaining = Math.max(0, gross - deduction), last = 0, tax = 0;
    for (const [ceiling, rate] of [[14000000,.06],[50000000,.15],[88000000,.24],[150000000,.35],[300000000,.38],[500000000,.4],[1000000000,.42],[Infinity,.45]]) {
      const slice = Math.min(remaining, ceiling - last);
      tax += slice * rate; remaining -= slice; last = ceiling;
      if (remaining <= 0) break;
    }
    return tax * 1.1;
  }
  function subsidyTax(monthly, s) {
    return known(s.subsidyTaxRate) ? monthly * positive(s.subsidyTaxRate) / 100
      : (incomeTax(positive(s.salary) + monthly * 12) - incomeTax(positive(s.salary))) / 12;
  }
  function payment(principal, rate, months) {
    const r = rate / 1200;
    return months <= 0 || principal <= 0 ? 0 : r === 0 ? principal / months : principal * r / (1 - (1 + r) ** -months);
  }
  function schedule(principal, rate, months, method = 'annuity', grace = 0, length = 156) {
    principal = positive(principal); months = Math.max(1, Math.round(positive(months)));
    let balance = principal;
    const fixed = payment(principal, rate, months);
    return Array.from({ length }, (_, i) => {
      const month = i + 1, n = month - grace;
      const opening = balance;
      const interest = month <= grace + months ? opening * rate / 1200 : 0;
      const repayment = n < 1 || n > months ? 0 : method === 'bullet' ? (n === months ? balance : 0)
        : method === 'principal' ? Math.min(balance, principal / months) : Math.min(balance, Math.max(0, fixed - interest));
      balance = Math.max(0, balance - repayment);
      if (month === grace + months) balance = 0;
      return { month, opening, principal: repayment, interest, balance, payment: repayment + interest };
    });
  }
  function dateAt(start, month) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(start || '');
    if (!match) return month + '개월차';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + month - 1, 1));
    return date.getUTCFullYear() + '.' + String(date.getUTCMonth() + 1).padStart(2, '0');
  }
  function plan(s, target) {
    const price = positive(target.price), area = positive(target.area);
    const sale = positive(s.salePrice), mortgage = positive(s.mortgage);
    const vat = 1 + positive(s.brokerVat) / 100;
    const saleFee = brokerage(sale) * vat;
    const saleCosts = saleFee + positive(s.saleOther);
    const saleNet = sale - mortgage - saleCosts;
    const kbKnown = known(target.kbLow) && positive(target.kbLow) > 0 && known(target.kbHigh) && positive(target.kbHigh) >= positive(target.kbLow);
    const loan = Math.min(500000000, price * .7, kbKnown ? (target.kbLow + target.kbHigh) / 2 * .7 : Infinity);
    const tax = known(target.taxOverride) ? positive(target.taxOverride) : purchaseTax(price, area);
    const buyerFee = brokerage(price) * vat;
    const other = positive(s.movingCost) + positive(s.adminCost) + positive(target.renovation) + positive(target.projectCost);
    const upfront = price + tax + buyerFee + other;
    const credit = positive(s.credit);
    const initialCash = saleNet + positive(s.cash) + loan + credit - upfront;
    const reserve = positive(s.reserve);
    const company = schedule(loan, 4.6, 120, s.companyMethod, 36);
    const creditRows = schedule(credit, positive(s.creditRate), s.creditMonths, s.interestOnly ? 'bullet' : 'annuity');
    const monthlyExtra = positive(target.operating) + positive(target.transport) + positive(target.holdingTax) / 12;
    const rows = company.map((row, i) => {
      const creditRow = creditRows[i];
      const ownInterest = row.opening * .015 / 12;
      const supportTax = subsidyTax(row.opening * .031 / 12, s);
      const balloon = s.interestOnly && creditRow.month === Number(s.creditMonths) ? creditRow.principal : 0;
      const principal = row.principal + creditRow.principal;
      const expense = ownInterest + creditRow.interest + supportTax + monthlyExtra;
      return { month: row.month, date: dateAt(s.startDate, row.month), companyPrincipal: row.principal, companyInterest: ownInterest,
        creditPrincipal: creditRow.principal, creditInterest: creditRow.interest, subsidyTax: supportTax, other: monthlyExtra,
        total: principal + expense, expense, principal, balloon, recurring: principal + expense - balloon,
        debt: row.balance + creditRow.balance };
    });
    const peak = Math.max(...rows.map(r => r.recurring));
    const incomeKnown = known(s.income) && Number(s.income) > 0 && known(s.living);
    const missing = [];
    if (!sale) missing.push('우리집 예상 매도가');
    if (!price) missing.push('후보 매수가');
    if (!kbKnown) missing.push('후보 KB 시세');
    else if (!target.kbDate || !Number.isFinite(Date.parse(target.kbDate)) || Date.now() - Date.parse(target.kbDate) > 30 * 86400000) missing.push('KB 시세 최신 확인');
    if (target.kind === 'reconstruction' && !target.projectConfirmed) missing.push('분담금·임시거주 비용');
    if (!known(s.monthlyLimit)) missing.push('월 주거비 상한');
    const shortage = Math.max(0, reserve - initialCash);
    const monthlyOver = known(s.monthlyLimit) ? Math.max(0, peak - Number(s.monthlyLimit)) : null;
    return { price, sale, loan, kbKnown, saleFee, saleCosts, saleNet, buyerFee, tax, other, upfront, initialCash, shortage, reserve,
      transactionCost: saleCosts + tax + buyerFee + other, rows, peak, missing, monthlyOver,
      monthlySavings: incomeKnown ? Number(s.income) - Number(s.living) - rows[36].recurring : null,
      status: shortage > 1 || monthlyOver > 1 ? 'over' : missing.length ? 'unknown' : 'fit' };
  }
  function ceiling(s, target) {
    if (!positive(s.salePrice)) return null;
    let low = 0, high = 3000000000;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2, p = plan(s, { ...target, price: mid });
      if (p.shortage > 1 || p.monthlyOver > 1) high = mid; else low = mid;
    }
    return Math.floor(low / 1000000) * 1000000;
  }
  function projection(s, target, years, assumptions = {}) {
    const p = plan(s, target), months = years * 12;
    if (![s.income, s.living, s.currentRate, s.currentOperating].every(known) || !positive(s.income)) return { ready: false, reason: '가계 실수령·생활비·기존 주담대 금리·현재 주거비 입력 필요' };
    if (!p.sale || !p.price || !known(s.currentMonths) || Number(s.currentMonths) < 1) return { ready: false, reason: '현재 집 가격과 주담대 잔여기간 확인 필요' };
    const oldRows = schedule(s.mortgage, s.currentRate, s.currentMonths, s.currentMethod || 'annuity', 0, months);
    const cashRate = positive(assumptions.cashRate) / 1200;
    let stayCash = positive(s.cash), moveCash = p.initialCash;
    let moveMin = moveCash, stayMin = stayCash;
    for (let i = 0; i < months; i++) {
      stayCash += Math.max(0, stayCash) * cashRate + Number(s.income) - Number(s.living) - Number(s.currentOperating) - oldRows[i].payment;
      moveCash += Math.max(0, moveCash) * cashRate + Number(s.income) - Number(s.living) - p.rows[i].total;
      moveMin = Math.min(moveMin, moveCash); stayMin = Math.min(stayMin, stayCash);
    }
    const stayHouse = p.sale * (1 + Number(assumptions.homeGrowth || 0) / 100) ** years;
    const moveHouse = p.price * (1 + Number(assumptions.targetGrowth || 0) / 100) ** years;
    const stayWealth = stayHouse + stayCash - oldRows.at(-1).balance;
    const moveWealth = moveHouse + moveCash - p.rows[months - 1].debt;
    return { ready: true, stayWealth, moveWealth, difference: moveWealth - stayWealth, stayCash, moveCash, moveMin, stayMin,
      breakEvenPrice: stayWealth - moveCash + p.rows[months - 1].debt,
      feasible: moveMin >= 0 && stayMin >= 0 };
  }
  function closing(s, target, contractDate, saleDate, closingDate, depositPercent) {
    if (![contractDate, saleDate, closingDate].every(v => /^\d{4}-\d{2}-\d{2}$/.test(v || '')) || contractDate > closingDate) return null;
    const p = plan(s, target), deposit = p.price * Math.min(100, positive(depositPercent)) / 100;
    const events = [{date:contractDate, amount:-deposit, label:'매수 계약금'},
      {date:saleDate, amount:p.saleNet, label:'우리집 매도 잔금 (기존 주담대·매도비 차감)'},
      {date:closingDate, amount:p.loan + positive(s.credit) - (p.upfront - deposit), label:'대출 실행·매수 잔금·부대비용'}];
    const dates = [...new Set(events.map(e=>e.date))].sort();
    let balance = positive(s.cash), minimum = balance;
    const rows = dates.map(date => {const today = events.filter(e=>e.date===date); balance += today.reduce((v,e)=>v+e.amount,0); minimum=Math.min(minimum,balance); return {date, label:today.map(e=>e.label).join(' / '),balance};});
    return {rows,shortage:Math.max(0,-minimum)};
  }
  const api = { known, brokerage, purchaseTax, incomeTax, payment, schedule, dateAt, plan, ceiling, projection, closing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HouseFinance = api;
})(typeof window !== 'undefined' ? window : globalThis);
