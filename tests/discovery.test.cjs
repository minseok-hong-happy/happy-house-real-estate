const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=import('../scripts/sync-home-price.mjs');
const date=new Date().toISOString().slice(0,10);
const month=date.slice(0,7).replace('-','');
const configured=[{id:'fixed',name:'Known',matchNames:['Known'],lawdCd:'41115',location:'Suwon Paldal',dongNames:['A']}];
const record=(name,jibun,price=100000,area=84.9)=>({apartmentName:name,dongName:'A',jibun,contractDate:date,priceManwon:price,areaSqm:area,floor:5,buildYear:2020});

test('discovery separates equal names by address, excludes configured homes and uses qualifying latest prices',async()=>{
  const {discoverCandidates}=await api;
  const records=[record('Known','1'),record('New','2'),record('New','3',95000,59.9),record('Cheap','4',70000),record('Small','5',100000,40)];
  const result=await discoverCandidates('test',configured,{},async(_key,_district,ym)=>ym===month?records:[]);
  assert.equal(result.districtCount,1);assert.equal(result.items.length,2);
  assert.equal(new Set(result.items.map(i=>i.id)).size,2);
  assert.equal(result.items[0].completionYear,2020);
  assert.ok(result.items.every(i=>i.exactName && i.areaPrices.length===1));
});

test('discovery has a per-district cap and preserves last successful data on failures',async()=>{
  const {discoverCandidates}=await api;
  const records=Array.from({length:20},(_,i)=>record('House'+i,String(i)));
  const result=await discoverCandidates('test',configured,{},async(_key,_district,ym)=>ym===month?records:[]);
  assert.equal(result.items.length,12);
  const fallback=await discoverCandidates('test',configured,{recommendationPool:result.items},async()=>{throw Error('fixture unavailable');});
  assert.equal(fallback.items.length,12);
  assert.ok(fallback.items.every(i=>i.priceStatus==='error' && i.areaPrices[0].latestPriceManwon===100000));
});

test('exact discovery matching does not mix similarly named or differently addressed homes',async()=>{
  const {targetTransactions}=await api;
  const target={...configured[0],name:'New',matchNames:['New'],exactName:true,jibun:'2'};
  const found=targetTransactions([record('New','2'),record('New2','2'),record('New','3')],target,new Date('2000-01-01'));
  assert.equal(found.length,1);assert.equal(found[0].jibun,'2');
});

test('request queue serializes starts and continues after a failed task',async()=>{
  const {createRequestQueue}=await api;
  let clock=0;const starts=[];const queue=createRequestQueue(550,async delay=>{clock+=delay;},()=>clock);
  const results=await Promise.allSettled([1,2,3].map(n=>queue(async()=>{starts.push(clock);if(n===2)throw Error('fixture');return n;})));
  assert.deepEqual(starts,[0,550,1100]);assert.equal(results[1].status,'rejected');assert.equal(results[2].value,3);
});

test('transaction requests retry throttling with Retry-After but not bad credentials',async()=>{
  const {requestDistrictPage}=await api;
  let calls=0;const delays=[];
  const options={enqueue:task=>task(),wait:async delay=>delays.push(delay),request:async()=>{
    calls++;return calls===1?new Response('rate limited',{status:429,headers:{'Retry-After':'2'}}):new Response('<resultCode>00</resultCode><totalCount>0</totalCount>');
  }};
  const result=await requestDistrictPage('test','41115','202609',1,options);
  assert.equal(calls,2);assert.deepEqual(delays,[2000]);assert.equal(result.totalCount,0);
  calls=0;await assert.rejects(requestDistrictPage('test','41115','202609',1,{...options,request:async()=>{calls++;return new Response('invalid key',{status:403});}}),/403/);
  assert.equal(calls,1);
});
