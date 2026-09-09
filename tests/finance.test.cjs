const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../finance-core.js');
const settings={salePrice:840000000,mortgage:500000000,cash:200000000,reserve:30000000,credit:100000000,creditRate:5,creditMonths:60,interestOnly:true,salary:100000000,companyMethod:'annuity',brokerVat:10,movingCost:3000000,adminCost:2000000,saleOther:0,monthlyLimit:6000000,income:12000000,living:3000000,currentRate:4,currentMonths:300,currentOperating:300000,startDate:'2026-09-09'};
const target={price:1000000000,area:84,kbLow:910000000,kbHigh:1070000000,renovation:10000000,operating:300000,transport:100000,holdingTax:1200000};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} != ${b}`);
test('brokerage matches current residential brackets and boundary limits',()=>{
  near(F.brokerage(1000000000),5000000);near(F.brokerage(900000000),4500000);near(F.brokerage(1200000000),7200000);near(F.brokerage(1500000000),10500000);near(F.brokerage(40000000),240000);near(F.brokerage(190000000),800000);
});
test('full acquisition costs and reserve reduce budget, without duplicate seller fee',()=>{
  const p=F.plan(settings,target);
  near(p.loan,500000000);near(p.tax,33000000);near(p.buyerFee,5500000);near(p.saleFee,3696000);
  near(p.initialCash,settings.salePrice-settings.mortgage-p.saleCosts+settings.cash+settings.credit+p.loan-p.upfront);
  near(p.shortage,Math.max(0,settings.reserve-p.initialCash));
  const expensive=F.plan(settings,{...target,price:1100000000});assert.ok(expensive.shortage>p.shortage);
});
test('KB cap belongs to target, missing KB cannot confirm affordability',()=>{
  near(F.plan(settings,{...target,kbLow:500000000,kbHigh:600000000}).loan,385000000);
  const p=F.plan({...settings,cash:800000000},{...target,kbLow:null,kbHigh:null});assert.equal(p.kbKnown,false);assert.equal(p.status,'unknown');
  assert.equal(F.plan({...settings,cash:800000000},{...target,kbDate:'2020-01-01'}).status,'unknown');
  assert.equal(F.plan({...settings,cash:800000000},{...target,kbDate:new Date().toISOString().slice(0,10)}).status,'fit');
});
test('interest-only principal is present exactly once at maturity',()=>{
  const rows=F.plan(settings,target).rows;
  near(rows[0].creditPrincipal,0);near(rows[59].creditPrincipal,100000000);near(rows[59].balloon,100000000);near(rows[60].creditInterest,0);
  near(rows.reduce((sum,r)=>sum+r.creditPrincipal,0),100000000);
  near(rows[59].total-rows[59].recurring,100000000);
});
test('36-month grace and 120 repayments conserve company principal',()=>{
  for(const method of ['annuity','principal']){
    const p=F.plan({...settings,companyMethod:method},target);
    near(p.rows[35].companyPrincipal,0);assert.ok(p.rows[36].companyPrincipal>0);near(p.rows[0].companyInterest,625000);
    near(p.rows.reduce((sum,r)=>sum+r.companyPrincipal,0),p.loan);near(p.rows[155].debt,0);
    p.rows.forEach(r=>near(r.total,r.principal+r.expense));
  }
});
test('zero interest loans and shorter credit terms',()=>{
  const rows=F.schedule(120000,0,12);near(rows[0].payment,10000);near(rows[11].balance,0);near(rows[12].payment,0);
  near(F.plan({...settings,creditMonths:36},target).rows[36].creditInterest,0);
});
test('same house prices and sufficient cash: changing target growth changes only target house value',()=>{
  const flat=F.projection(settings,target,5,{homeGrowth:0,targetGrowth:0});
  const up=F.projection(settings,target,5,{homeGrowth:0,targetGrowth:1});
  assert.equal(flat.ready,true);assert.equal(flat.feasible,true);near(up.stayWealth,flat.stayWealth);
  near(up.difference-flat.difference,target.price*((1.01)**5-1));near(flat.breakEvenPrice,target.price-flat.difference);
});
test('unknown inputs and negative cash are not an investment recommendation',()=>{
  assert.equal(F.projection({...settings,income:null},target,5).ready,false);
  const p=F.projection({...settings,cash:0,credit:0},target,5);assert.equal(p.ready,true);assert.equal(p.feasible,false);
});
test('principal transfer is net-asset neutral, transaction costs are not',()=>{
  const s={...settings,cash:400000000,credit:0,income:10000000,living:2000000,currentRate:0};
  const a=F.projection(s,target,3),b=F.projection({...s,currentMonths:120},target,3);
  near(a.stayWealth,b.stayWealth);
  const c=F.projection(s,{...target,renovation:target.renovation+10000000},3);near(a.moveWealth-c.moveWealth,10000000);
});
test('contract deposit needs cash before sale proceeds arrive',()=>{
  const c=F.closing({...settings,cash:20000000},target,'2026-09-10','2026-10-10','2026-10-10',10);
  near(c.rows[0].balance,-80000000);assert.ok(c.shortage>=80000000);
  assert.equal(F.closing(settings,target,'2026-10-12','2026-10-10','2026-10-10',10),null);
});
test('ceiling is cost-inclusive and no more than cash-only affordability',()=>{
  const limit=F.ceiling(settings,target);const p=F.plan(settings,{...target,price:limit});assert.ok(p.shortage<1);assert.ok(p.monthlyOver<1);
  assert.ok(limit<settings.salePrice-settings.mortgage+settings.cash+settings.credit+500000000);
});
