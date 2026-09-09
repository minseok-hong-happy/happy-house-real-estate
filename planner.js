(function () {
  'use strict';
  const F = window.HouseFinance;
  const KEY = 'happy-house-plan-v2';
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const defaults = {
    salePrice: null, mortgage: 500000000, cash: 0, reserve: 30000000, credit: 0, creditRate: 5, creditMonths: 60,
    interestOnly: true, salary: 100000000, subsidyTaxRate: null, companyMethod: 'annuity', brokerVat: 10,
    movingCost: 3000000, adminCost: 2000000, saleOther: 0, income: null, living: null, monthlyLimit: null,
    currentRate: null, currentMonths: 300, currentMethod: 'annuity', currentOperating: null, startDate: today,
    wifeLimit: null, selfLimit: null, wifeHome: null, selfHome: null, workDays: 5,
    wifeDestination: '서울시청역', selfDestination: '삼성전자 디지털시티 중앙문', commuteMode: '대중교통',
    contractDate: '', saleDate: '', closingDate: '', depositPercent: 10
  };
  let storageError = false, state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { storageError = true; }
  function validState(data) {
    if (!data || data.version !== 2 || !data.settings || typeof data.settings !== 'object') return false;
    for(const key of ['overrides','prices','snapshots','mapPoints','assumptions'])if(Object.hasOwn(data,key)&&(!data[key]||typeof data[key]!=='object'||Array.isArray(data[key])))return false;
    const forbidden = key => ['__proto__','constructor','prototype'].includes(key);
    for (const [key,value] of Object.entries(data.settings)) {
      if (!Object.hasOwn(defaults,key) || forbidden(key)) return false;
      const stringField=['companyMethod','currentMethod','startDate','wifeDestination','selfDestination','commuteMode','contractDate','saleDate','closingDate'].includes(key);
      if (key==='interestOnly') {if(typeof value!=='boolean')return false;}
      else if (stringField) {if(typeof value!=='string'||value.length>200)return false;}
      else if(value!==null && (typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12))return false;
      if(value!==null && /Rate|brokerVat|depositPercent/.test(key) && value>100)return false;
      if(value!==null && /Months/.test(key) && (value<1||value>1200))return false;
    }
    if(!Array.isArray(data.saved)||!Array.isArray(data.compare)||data.saved.length>200||data.compare.length>3||[...data.saved,...data.compare].some(v=>typeof v!=='string'||forbidden(v)))return false;
    if(Object.hasOwn(data,'assumptions') && (!data.assumptions || typeof data.assumptions!=='object' || Object.entries(data.assumptions).some(([k,v])=>!['homeGrowth','targetGrowth','cashRate'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||v < (k==='cashRate'?0:-20)||v>20)))return false;
    const targetFields=['price','area','kbLow','kbHigh','kbDate','renovation','operating','transport','holdingTax','taxOverride','projectCost','projectConfirmed','wifeMinutes','selfMinutes','commuteDate','notes'];
    for(const [id,values] of Object.entries(data.overrides||{})) {
      if(forbidden(id)||!values||typeof values!=='object')return false;
      for(const [key,value] of Object.entries(values)) {
        if(!targetFields.includes(key))return false;
        if(['kbDate','commuteDate','notes'].includes(key)){if(typeof value!=='string'||value.length>10000)return false;}
        else if(key==='projectConfirmed'){if(typeof value!=='boolean')return false;}
        else if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12))return false;
      }
    }
    if(data.manual && !Array.isArray(data.manual))return false;
    return [...(data.manual||[]),...Object.values(data.snapshots||{})].every(i=>i&&typeof i.key==='string'&&!forbidden(i.key)&&typeof i.name==='string'&&typeof i.price==='number'&&Number.isFinite(i.price)&&i.price>0&&typeof i.area==='number'&&i.area>0&&i.area<10000);
  }
  if (!validState(state)) state = {};
  state = { version: 2, saved: [], compare: [], overrides: {}, manual: [], prices: {}, assumptions: { homeGrowth:0,targetGrowth:0,cashRate:0 }, ...state, settings: { ...defaults, ...state.settings } };
  let catalog = [], sources = null, homeData = null, rawCandidates = null, changes = [];
  let discovery = { search:'', region:'all', min:9, max:11, area:59, sort:'budget', fresh:false, fit:false };
  let selected = state.selected || null;
  const candidateMarkers = new Map(), geocodeAttempts = new Set();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => {
    if(!F.known(v))return '입력 필요';
    const n=Math.round(Math.abs(v)/10000), sign=v<0?'−':'';
    return sign+(n>=10000?Math.floor(n/10000)+'억 '+(n%10000?(n%10000).toLocaleString('ko-KR')+'만원':'원'):n.toLocaleString('ko-KR')+'만원');
  };
  const eok = (v) => F.known(v) ? (v / 100000000).toLocaleString('ko-KR', { maximumFractionDigits:2 }) + '억' : '확인 필요';
  const delta = (v) => F.known(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v)) : '확인 필요';
  const age = (date) => date ? Math.max(0, Math.floor((new Date(today) - new Date(date)) / 86400000)) : Infinity;
  const savedItems = () => state.saved.map(id => find(id)).filter(Boolean);
  function save() {
    state.selected = selected;
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageError = false; } catch { storageError = true; }
  }
  function find(id) { return catalog.find(i=>i.key===id) || state.manual.find(i=>i.key===id) || state.snapshots?.[id]; }
  function target(item = find(selected)) {
    if (!item) return { key:'manual-preview', name:'직접 계산', price:1000000000, area:84, renovation:10000000, operating:300000, transport:0,holdingTax:0 };
    const initialKb = item.id === 'maegyo-prugio-sk' && item.area === 84 ? { kbLow:910000000,kbHigh:1070000000,kbDate:'2026-07-17' } : {};
    return { ...item, renovation:10000000,operating:300000,transport:0,holdingTax:0,projectCost:null, ...initialKb, ...state.overrides[item.key],
      price: state.overrides[item.key]?.price ?? item.price };
  }
  const current = () => target();
  const calc = (item) => F.plan(state.settings, target(item));
  const go = (tab) => showTab(tab);
  const button = (text, action, key='', primary=false) => `<button type="button" class="dp-button ${primary?'dp-primary':''}" data-action="${action}" data-key="${esc(key)}">${text}</button>`;
  const field = (scope, name, label, value, unit='', scale=1, extra='') => `<label class="dp-field"><span>${label}</span><div><input id="dp-${scope}-${name}" data-scope="${scope}" data-field="${name}" data-scale="${scale}" type="number" min="0" step="${scale===100000000?.01:'any'}" value="${F.known(value)?esc(Number(value)/scale):''}" placeholder="미입력" ${extra}><small>${unit}</small></div></label>`;
  const select = (scope,name,label,value,options) => `<label class="dp-field"><span>${label}</span><select data-scope="${scope}" data-field="${name}" id="dp-${scope}-${name}">${options.map(([v,t])=>`<option value="${v}" ${String(value)===String(v)?'selected':''}>${t}</option>`).join('')}</select></label>`;
  const textField = (name,label,type='text') => `<label class="dp-field"><span>${label}</span><input type="${type}" data-scope="settings" data-field="${name}" value="${esc(state.settings[name])}" id="dp-settings-${name}"></label>`;
  const stat = (label,value,note='',tone='') => `<div class="dp-stat ${tone}"><span>${label}</span><strong>${value}</strong>${note?`<small>${note}</small>`:''}</div>`;
  const header = (title,copy='',actions='') => `<header class="dp-heading"><div><h1>${title}</h1>${copy?`<p>${copy}</p>`:''}</div>${actions}</header>`;
  const details = (title,content,open=false) => `<details class="dp-details" ${open?'open':''}><summary>${title}</summary><div class="dp-details-body">${content}</div></details>`;
  const settingField = (name,label,unit='만원',scale=10000) => field('settings',name,label,state.settings[name],unit,scale);
  const targetField = (name,label,unit='만원',scale=10000) => field('target',name,label,current()[name],unit,scale);
  function toast(message) { const node=document.querySelector('#dp-toast'); node.textContent=message; node.hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>node.hidden=true,4500); }
  function status(p) { return p.status==='over' ? ['조건 조정 필요','dp-warn'] : p.status==='fit' ? ['설정 조건 충족','dp-good'] : ['추가 확인 필요','dp-neutral']; }
  function chooser() {
    const list = [...new Map([...savedItems(),...catalog.filter(i=>i.requested),...state.manual].map(i=>[i.key,i])).values()];
    if (!list.length) return `<p class="dp-muted">${rawCandidates?'거래 정보를 가져오지 못했어요. 이사 후보지에서 직접 후보를 추가할 수 있습니다.':'실거래 정보를 불러오는 중입니다. 추천에서 후보를 선택할 수 있어요.'}</p>`;
    return `<label class="dp-field dp-chooser"><span>계산할 집</span><select id="dp-selected" data-action="select-target">${list.map(i=>`<option value="${esc(i.key)}" ${i.key===selected?'selected':''}>${esc(i.name)} · ${i.area}㎡</option>`).join('')}</select></label>`;
  }
  function checks(t,p) {
    const notes = [];
    if(t.priceStatus==='error') notes.push('이 단지는 이번 수집에 실패해 이전 거래 자료를 보여줍니다.');
    if(!p.kbKnown) notes.push('이 집의 KB 시세 확인 전 한도 추정입니다.');
    else if(age(t.kbDate)>30) notes.push('저장된 KB 시세가 오래됐어요. 최신값을 확인해 주세요.');
    if(!F.known(state.settings.monthlyLimit)) notes.push('감당할 월 주거비 상한을 입력하면 적합 여부를 확인할 수 있어요.');
    else if(p.monthlyOver>1) notes.push('상한을 넘는 달이 있어요. 가장 큰 정기 부담은 '+money(p.peak)+'/월입니다.');
    if(age(t.date)>90) notes.push('마지막 거래가 90일 이상 지났어요. 현재 매물 가격을 확인해 주세요.');
    if(t.kind==='reconstruction'&&!t.projectConfirmed) notes.push('재건축 분담금·임시거주비 확인 전입니다.');
    return notes;
  }
  function home() {
    const t=current(),p=F.plan(state.settings,t),[label,tone]=status(p);
    const noSale = !F.known(state.settings.salePrice);
    const list = state.compare.map(find).filter(Boolean).slice(0,3);
    document.querySelector('#home-panel').innerHTML = header('내 이사 계획', '월 부담과 남는 자산을 함께 확인하세요.',button('내 조건 수정','go-budget')) +
      `<section class="dp-hero"><div><span class="dp-kicker">선택한 집</span><h2>${esc(t.name)} <small>${t.area}㎡</small></h2><p>매수가 ${eok(t.price)} · ${t.date?esc(t.date)+' 실거래 참고':'직접 계산'}</p><span class="dp-badge ${tone}">${noSale?'매도가 입력 필요':label}</span></div><div class="dp-hero-amount"><span>${p.shortage>1?'더 필요한 자금':'이사 후 남는 현금'}</span><strong>${noSale?'확인 중':money(p.shortage>1?p.shortage:p.initialCash)}</strong><small>비상자금 목표 ${money(p.reserve)} ${p.shortage>1?'포함':'확보 여부 반영'}</small>${button('이 집 자세히 계산','go-budget','',true)}</div></section>` +
      `<div class="dp-stats">${stat('거치 중 월 주거비',money(p.rows[0].recurring),'개인 이자·세금·주거비 포함')}${stat('37개월차 월 주거비',money(p.rows[36].recurring),'정기 납부 최대 '+money(p.peak)+'/월',p.monthlyOver>1?'dp-warn':'')}${stat('37개월차 예상 저축',money(p.monthlySavings),F.known(p.monthlySavings)?'가계 실수령 − 생활비 − 주거비':'가계 실수령·생활비 입력 후 표시')}</div>` +
      `<div class="dp-next">${checks(t,p).slice(0,1).map(esc).join('')||'다음은 현재 집을 유지했을 때와 비교해 보세요.'}${button('현재 집과 비교','go-candidates')}</div>` +
      `<div class="dp-section-title"><h2>비교 중인 집</h2>${button('후보 찾기','go-recommendations')}</div><div class="dp-picks">${list.map(i=>compactCard(i)).join('')||'<p class="dp-muted">추천에서 마음에 드는 집을 담아보세요.</p>'}</div>`+
      (changes.length?`<section class="dp-note"><b>지난 방문 이후 실거래 변화</b>${changes.slice(0,3).map(c=>`<p>${esc(c.name)} ${c.area}㎡ · ${eok(c.before)} → ${eok(c.after)}</p>`).join('')}</section>`:'')+
      details('데이터 확인 · '+(rawCandidates?.sync?.lastSuccessfulAt||'불러오는 중'),sourceList())+
      `<p class="dp-footnote">입력값은 이 기기에 저장됩니다.${storageError?' 저장 공간에 접근할 수 없어 현재 탭에서만 유지됩니다.':''}</p>`;
  }
  function compactCard(item) {
    const t=target(item),p=calc(item);
    return `<article class="dp-card"><span class="dp-kicker">${esc(item.location||'직접 추가')} · ${t.area}㎡</span><h3>${esc(t.name)}</h3><strong class="dp-price">${eok(t.price)}</strong><p>추가 자금 <b>${money(p.shortage)}</b><br>37개월차 <b>${money(p.rows[36].recurring)}/월</b></p>${button('이 집 계산','choose',item.key)}</article>`;
  }
  function sourceList() {
    if(!sources)return '<p class="dp-muted">데이터 상태를 확인하는 중입니다.</p>';
    const names={ok:'갱신',empty:'신고 거래 없음',not_configured:'미연결',not_available:'직접 확인',fallback:'이전 자료',stale:'이전 정상값',error:'갱신 실패',partial:'일부 갱신'};
    return `<div class="dp-source-list">${sources.sources.map(s=>`<div><span>${esc(s.label)}</span><b>${names[s.status]||'확인 필요'}${s.totalCount?' · '+s.itemCount+'/'+s.totalCount:''}</b><small>${esc(s.syncedAt||'기준일 없음')}</small></div>`).join('')}</div><p class="dp-muted">수집일과 거래일은 다릅니다. 매물 미연결은 매물이 없다는 뜻이 아닙니다.</p>`;
  }
  function finance() {
    const s=state.settings,t=current(),p=F.plan(s,t);
    const family = `<div class="dp-fields">${settingField('income','가계 월 실수령')}${settingField('living','월 생활비 (주거비 제외)')}${settingField('currentRate','현재 주담대 금리','%',1)}${settingField('currentMonths','현재 주담대 남은 기간','개월',1)}${settingField('currentOperating','현재 월 관리·보유·교통비')}${settingField('salary','본인 세전 연봉')}${select('settings','currentMethod','현재 주담대 상환',s.currentMethod,[['annuity','원리금균등'],['principal','원금균등'],['bullet','만기일시']])}${settingField('subsidyTaxRate','지원이자 세금 직접 보정 (선택)','%',1)}</div><p class="dp-muted">현재 주거비는 주담대 상환을 제외합니다. 미입력 세금 보정은 세전 연봉으로 간이 계산합니다.</p>`;
    const credit = `<div class="dp-fields">${settingField('credit','추가 신용대출','억원',1e8)}${settingField('creditRate','신용대출 금리','%',1)}${select('settings','creditMonths','신용대출 기간',s.creditMonths,[[36,'3년'],[60,'5년'],[84,'7년'],[120,'10년']])}</div><label class="dp-check"><input type="checkbox" data-scope="settings" data-field="interestOnly" ${s.interestOnly?'checked':''}>이자만 납부 · 만기에 원금 상환</label>${s.credit>0&&s.interestOnly?`<p class="dp-callout">${F.dateAt(s.startDate,Number(s.creditMonths))}에 원금 ${money(s.credit)} 상환이 포함됩니다.</p>`:''}`;
    const costs=`<div class="dp-fields">${targetField('renovation','수리·인테리어 예산')}${settingField('movingCost','이사 예산')}${settingField('adminCost','등기·대출 부대비 예산')}${settingField('saleOther','양도세·중도상환 등 매도비용')}${targetField('operating','월 관리비 예산')}${targetField('transport','월 교통비 예산')}${targetField('holdingTax','연 보유세 예산')}${targetField('taxOverride','취득세 등 확정액 (선택)')}${select('settings','brokerVat','중개보수 부가세 가정',s.brokerVat,[[10,'10% 포함'],[0,'별도 없음']])}</div><p class="dp-muted">초기 수리비 1,000만원·이사비 300만원·등기 등 200만원·관리비 월 30만원은 수정 가능한 예산 가정입니다. 양도세·보유세·교통비는 입력한 만큼 반영합니다.</p>`;
    const kb=`<div class="dp-rule">최대 5억 · 매수가/KB 평균의 70% · 3년 거치 후 10년 상환<br>개인 1.5% + 회사 지원 3.1%</div><div class="dp-fields">${targetField('kbLow','이 집 KB 시세 하한','억원',1e8)}${targetField('kbHigh','이 집 KB 시세 상한','억원',1e8)}<label class="dp-field"><span>KB 확인일</span><input type="date" data-scope="target" data-field="kbDate" value="${esc(t.kbDate||'')}"></label>${select('settings','companyMethod','사내 원금 상환 방식',s.companyMethod,[['annuity','원리금균등 (계약 확인)'],['principal','원금균등']])}${textField('startDate','대출 실행 기준일','date')}</div><p class="dp-muted">KB는 선택한 집에만 적용됩니다. 미입력은 5억·매수가 한도만 적용한 추정입니다. 실제 승인액과 상환 방식은 사내 계약 기준으로 확인하세요.</p>`;
    document.querySelector('#budget-panel').innerHTML=header('대출 관리','후보별로 필요한 돈과 월 부담을 계산합니다.')+
      `<div class="dp-plan-layout"><div class="dp-inputs"><section class="dp-card">${chooser()}<div class="dp-fields">${targetField('price','이 집 예상 매수가','억원',1e8)}${targetField('area','전용면적','㎡',1)}</div><small class="dp-muted">${t.date?'최근 거래 '+esc(t.date)+' · '+eok(find(selected)?.price):'직접 입력 기준'} ${button('최근 거래가로','latest-price')}</small></section>`+
      `<section class="dp-card"><h2>내가 쓸 수 있는 돈</h2><div class="dp-fields">${settingField('salePrice','우리집 예상 매도가','억원',1e8)}${settingField('mortgage','남은 주담대','억원',1e8)}${settingField('cash','보유 현금 (비상금 포함)')}${settingField('reserve','남길 비상자금 목표')}${settingField('monthlyLimit','월 주거비 상한')}</div><p class="dp-muted">우리집 59㎡ 최근 거래를 매도가 참고값으로 자동 입력합니다. 비상금 목표 3,000만원은 변경할 수 있어요.</p></section>`+
      details('추가 신용대출',credit,s.credit>0)+details('사내 대출 · 이 집 KB 시세',kb)+details('세금·복비·이사·유지비 가정',costs)+details('현재 집과 순자산 비교에 필요한 값',family)+
      (t.kind==='reconstruction'?details('재건축 추가 자금',`<div class="dp-fields">${targetField('projectCost','분담금·임시거주 등 총예산')}</div><label class="dp-check"><input type="checkbox" data-scope="target" data-field="projectConfirmed" ${t.projectConfirmed?'checked':''}>분담금·임시거주비를 확인해 예산에 반영했어요</label><p class="dp-muted">기간·분담금이 확정되지 않은 사업은 참고 시나리오입니다.</p>`,true):'')+
      `<div class="dp-actions">${button('설정 내보내기','export')}${button('설정 가져오기','import')}<input type="file" id="dp-import" accept="application/json,.json" hidden></div></div>`+
      `<div class="dp-results"><section class="dp-result-card"><span class="dp-kicker">${p.shortage>1?'더 필요한 자금':'비상자금 확보 후 여유'}</span><strong>${money(p.shortage>1?p.shortage:p.initialCash-p.reserve)}</strong><p>매수대금 + 세금·복비 + 이사·수리 + 비상자금</p><div class="dp-line"><span>총 매수 지출</span><b>${money(p.upfront)}</b></div><div class="dp-line"><span>매도 순자금</span><b>${money(p.saleNet)}</b></div><div class="dp-line"><span>사내 대출 추정</span><b>${eok(p.loan)}</b></div><div class="dp-line"><span>매수 후 현금</span><b>${money(p.initialCash)}</b></div>${button('우리집 유지와 비교','go-candidates','',true)}</section>`+
      `<section class="dp-card"><h2>월 주거비</h2><div class="dp-line"><span>1개월차 · 거치 중</span><b>${money(p.rows[0].recurring)}</b></div><div class="dp-line"><span>37개월차 · 상환 시작</span><b>${money(p.rows[36].recurring)}</b></div><div class="dp-line"><span>가장 큰 정기 월 부담</span><b>${money(p.peak)}</b></div><p class="dp-muted">원금·개인 이자·지원분 세금·유지비 포함. 만기 원금은 월별표에 별도 합산합니다.</p>${checks(t,p).map(n=>`<p class="dp-callout">${esc(n)}</p>`).join('')}</section>`+
      details('37개월차 · 원금·이자·세금 나눠보기',monthlyBreakdown(p.rows[36],t))+
      details('세금·복비 계산 내역',`<div class="dp-line"><span>매도 복비 (조달금에서 차감)</span><b>${money(p.saleFee)}</b></div><div class="dp-line"><span>매수 복비</span><b>${money(p.buyerFee)}</b></div><div class="dp-line"><span>취득세·교육세 등</span><b>${money(p.tax)}</b></div><div class="dp-line"><span>이사·수리·기타</span><b>${money(p.other)}</b></div><p class="dp-muted">일반 주택 매수 세율 가정. 주택 수·명의·특례에 따라 달라집니다. 확인한 세액은 직접 입력할 수 있어요. <a href="https://map.gg.go.kr/reb/selectRebRateView.do" target="_blank" rel="noreferrer">중개보수 기준</a></p>`)+
      details('매도가가 3,000만원 낮아진다면',`<p>추가 필요자금 <b>${money(F.plan({...s,salePrice:Math.max(0,s.salePrice-30000000)},t).shortage)}</b></p><p>신용금리가 2%p 높아지면 37개월차 <b>${money(F.plan({...s,creditRate:Number(s.creditRate)+2},t).rows[36].recurring)}/월</b></p>`)+`</div></div>`+
      details('13년 월별 납부표 · 만기 원금 포함',timeline(p))+
      details('계약금과 잔금 사이에 돈이 부족할까?',closingView(s,t));
  }
  function monthlyBreakdown(row,t) {
    const entries=[['사내대출 원금',row.companyPrincipal],['신용대출 원금',row.creditPrincipal],['사내대출 개인 이자',row.companyInterest],['신용대출 이자',row.creditInterest],['회사 지원이자 추가세금 추정',row.subsidyTax],['월 환산 보유세 예산',Number(t.holdingTax||0)/12],['관리·교통비 예산',Number(t.operating||0)+Number(t.transport||0)],['월 납부 합계',row.total]];
    return entries.map(([label,value])=>`<div class="dp-line"><span>${label}</span><b>${money(value)}</b></div>`).join('')+'<p class="dp-muted">원금 상환과 소모되는 이자·세금·유지비를 구분했습니다. 신용대출 만기 원금이 있는 달은 합계에 포함됩니다.</p>';
  }
  function timeline(p) {
    const max=Math.max(1,p.peak);
    return `<div class="dp-bars" aria-label="연도별 정기 월 부담">${Array.from({length:13},(_,i)=>{const row=p.rows[i*12];return `<div><i style="height:${Math.max(4,row.recurring/max*100)}%" title="${i+1}년차 ${money(row.recurring)}"></i><span>${i+1}년</span></div>`;}).join('')}</div><p class="dp-muted">막대는 각 연도 첫 달의 정기 부담입니다. 만기 일시상환은 아래 표에 포함됩니다.</p>${button('월별표 CSV 받기','csv')}<div class="dp-table-scroll"><table class="dp-table"><thead><tr>${['월','사내 원금','개인 이자','신용 원금','신용 이자','지원분 세금','유지비','합계'].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${p.rows.map(r=>`<tr class="${r.balloon?'dp-maturity':''}"><th>${r.date} <small>${r.month}개월차${r.balloon?' · 만기':''}</small></th>${[r.companyPrincipal,r.companyInterest,r.creditPrincipal,r.creditInterest,r.subsidyTax,r.other,r.total].map(v=>`<td>${money(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function closingView(s,t) {
    const c=F.closing(s,t,s.contractDate,s.saleDate,s.closingDate,s.depositPercent);
    const result = c ? `<p class="dp-callout">잔금 전 최대 부족자금 <b>${money(c.shortage)}</b></p>` + c.rows.map(r=>`<div class="dp-line"><span>${r.date}<small>${esc(r.label)}</small></span><b>${money(r.balance)}</b></div>`).join('') : '<p class="dp-muted">날짜를 입력하면 계약금부터 잔금까지 확인합니다. 계약일은 매수 잔금일보다 빨라야 합니다.</p>';
    return `<div class="dp-fields">${textField('contractDate','매수 계약일','date')}${textField('saleDate','우리집 매도 잔금일','date')}${textField('closingDate','매수 잔금·대출 실행일','date')}${settingField('depositPercent','계약금 비율','%',1)}</div>${result}<p class="dp-muted">신용·사내대출은 매수 잔금일 실행 가정입니다. 같은 날 입출금은 합산하므로 실제 지급 순서를 확인하세요.</p>`;
  }
  function commute(item) {
    const t=target(item),s=state.settings;
    return { wife:t.wifeMinutes,self:t.selfMinutes,checked:t.commuteDate,
      delta:F.known(t.wifeMinutes)&&F.known(t.selfMinutes)&&F.known(s.wifeHome)&&F.known(s.selfHome)
        ? ((Number(t.wifeMinutes)+Number(t.selfMinutes))-(Number(s.wifeHome)+Number(s.selfHome)))*2*Number(s.workDays):null };
  }
  function comparison() {
    const s=state.settings,list=state.compare.map(find).filter(Boolean),t=current(),p=F.plan(s,t);
    const chosen=list.find(i=>i.key===selected)||list[0];
    const baseline=[['매수가 / 주택 참고가',eok(s.salePrice)],['전용면적','59㎡'],['추가 필요자금','0원'],['37개월차 주거비',F.known(s.currentRate)&&F.known(s.currentOperating)?money(F.schedule(s.mortgage,s.currentRate,s.currentMonths,s.currentMethod)[36].payment+Number(s.currentOperating)):'기존 주담대·주거비 입력'],['배우자 편도',F.known(s.wifeHome)?s.wifeHome+'분':'확인 필요'],['본인 편도',F.known(s.selfHome)?s.selfHome+'분':'확인 필요']];
    const columns=list.map(item=>{const v=target(item),x=calc(item),c=commute(item);return `<article class="dp-compare-column ${item.key===chosen?.key?'dp-mobile-selected':''}"><header><small>${esc(item.location)}</small><h3>${esc(item.name)}</h3>${button('계산','choose',item.key)}</header>${[eok(v.price),v.area+'㎡',money(x.shortage),money(x.rows[36].recurring),F.known(c.wife)?c.wife+'분':'확인 필요',F.known(c.self)?c.self+'분':'확인 필요'].map((value,i)=>`<div><small>${baseline[i][0]}</small><b>${value}</b></div>`).join('')}</article>`;}).join('');
    document.querySelector('#candidates-panel').innerHTML=header('이사 후보지','우리집 유지와 같은 기준으로 비교합니다.',button('후보 찾기','go-recommendations'))+
      `<div class="dp-saved-strip">${savedItems().map(i=>`<div><button class="dp-chip ${selected===i.key?'is-active':''}" data-action="focus" data-key="${esc(i.key)}">${esc(i.name)} ${i.area}㎡</button><button class="dp-icon-button" data-action="remove" data-key="${esc(i.key)}" aria-label="${esc(i.name)} 후보 삭제">×</button></div>`).join('')||'<p>아직 담은 후보가 없어요. 추천에서 집을 담아보세요.</p>'}</div>`+
      `<div class="dp-compare" style="--compare-count:${Math.max(1,list.length)}"><article class="dp-compare-column dp-baseline"><header><small>비교 기준</small><h3>우리집 유지</h3><p>힐스테이트 푸르지오 수원</p></header>${baseline.map(([label,value])=>`<div><small>${label}</small><b>${value}</b></div>`).join('')}</article>${columns}</div>`+
      `<div class="dp-actions">${savedItems().map(i=>`<label class="dp-check"><input type="checkbox" data-compare="${esc(i.key)}" ${state.compare.includes(i.key)?'checked':''}>${esc(i.name)} ${i.area}㎡</label>`).join('')}</div><p class="dp-muted">최대 3곳 비교 · 모바일은 위 후보 이름을 눌러 한 곳씩 비교합니다.</p>`+
      `<section class="dp-card dp-asset"><div class="dp-section-title"><div><span class="dp-kicker">${esc(t.name)} · ${t.area}㎡</span><h2>이사하면 자산이 더 늘어날까?</h2></div>${button('계산 조건','go-budget')}</div><p class="dp-muted">같은 소득에서 비용·대출·월 저축을 반영한 보유 순자산입니다. 미래 가격은 직접 바꾸는 가정이에요.</p><div class="dp-scenario-buttons">${button('모두 보합','scenario-flat')}${button('후보 연 1%p 우위','scenario-up')}${button('모두 연 2% 하락','scenario-down')}</div><div class="dp-fields dp-three">${assumptionField('homeGrowth','우리집 연 가격변화')}${assumptionField('targetGrowth','후보 연 가격변화')}${assumptionField('cashRate','현금 연 수익률')}</div><div class="dp-projections">${[3,5].map(year=>projectionCard(year,t)).join('')}</div><p class="dp-footnote">비용·세금은 입력 가정. 미래 매도세금은 제외한 보유 기준이며, KB·소득 미확인 상태에서 매수 승인을 뜻하지 않습니다.</p></section>`+
      `<section class="dp-card"><h2>우리집과 가격 차이</h2><div class="dp-stats">${stat('현재 거래 참고가 차이',money(t.price-s.salePrice),'후보 − 우리집')}${stat('설정 조건의 매수 상한',money(F.ceiling(s,t)),'세금·복비·비상자금 반영 / KB 추정 주의')}${stat('37개월차 남는 월 저축',money(p.monthlySavings),'생활비와 주거비 차감')}</div><p class="dp-muted">우리집 거래 ${esc(homeData?.recentTransactions?.records?.[0]?.contractDate||'미확인')} / 후보 거래 ${esc(t.date||'직접 입력')}. 날짜·층·매물 상태가 달라 직접 가격 비교에는 차이가 있습니다.</p></section>`+
      details('출퇴근 확인 · '+esc(t.name),commuteEditor(t))+
      details('방문 메모 · '+esc(t.name),`<label class="dp-field"><span>주차·소음·채광·수리 등 확인한 내용</span><textarea rows="4" data-scope="target" data-field="notes" placeholder="현장에서 확인한 장점과 아쉬운 점을 적어두세요.">${esc(t.notes||'')}</textarea></label>`)+
      details('직접 후보 추가',`<form id="dp-manual-form"><div class="dp-fields"><label class="dp-field"><span>단지·매물 이름</span><input name="name" required maxlength="100"></label><label class="dp-field"><span>동네·주소</span><input name="location" maxlength="150"></label><label class="dp-field"><span>매수가 (억원)</span><input name="price" type="number" min="0.01" step="0.01" required></label><label class="dp-field"><span>전용면적 (㎡)</span><input name="area" type="number" min="1" required></label></div><button class="dp-button dp-primary" type="submit">후보에 담기</button></form>`);
  }
  function assumptionField(name,label) {return `<label class="dp-field"><span>${label}</span><div><input id="dp-assumptions-${name}" type="number" min="${name==='cashRate'?0:-20}" max="20" step="0.5" data-scope="assumptions" data-field="${name}" value="${Number(state.assumptions[name])||0}"><small>%</small></div></label>`;}
  function projectionCard(year,t) {
    const r=F.projection(state.settings,t,year,state.assumptions);
    if(!r.ready)return `<article class="dp-projection"><h3>${year}년 후</h3><p>${esc(r.reason)}</p>${button('필요한 값 입력','family-input')}</article>`;
    return `<article class="dp-projection"><h3>${year}년 후</h3>${stat('우리집 유지 대비',r.feasible?delta(r.difference):'현금 부족으로 비교 보류','보유 주택 + 금융자산 − 대출')}
      ${r.feasible?`<div class="dp-line"><span>우리집 유지 순자산</span><b>${eok(r.stayWealth)}</b></div><div class="dp-line"><span>이사 후 순자산</span><b>${eok(r.moveWealth)}</b></div><div class="dp-line"><span>이사 손익분기 주택가치</span><b>${eok(r.breakEvenPrice)}</b></div>`:`<p class="dp-callout">기간 중 현금 부족 ${money(Math.max(0,-r.moveMin))} (이사) / ${money(Math.max(0,-r.stayMin))} (유지). 추가 대출을 자동 가정하지 않습니다.</p>`}</article>`;
  }
  function commuteEditor(t) {
    const s=state.settings,c=commute(find(selected));
    const search=(q)=>'https://map.naver.com/p/search/'+encodeURIComponent(q);
    return `<p class="dp-muted">지역 점수 대신 확인한 편도 시간을 비교합니다. 단지 출입구부터 실제 근무지까지, 같은 출근 시간대로 확인하세요.</p><div class="dp-fields">${textField('wifeDestination','배우자 실제 근무지')}${select('settings','selfDestination','디지털시티 도착점',s.selfDestination,[['삼성전자 디지털시티 중앙문','중앙문'],['삼성전자 디지털시티 정문','정문']])}${select('settings','commuteMode','확인한 이동수단',s.commuteMode,[['대중교통','대중교통'],['차량','차량'],['셔틀','사내셔틀'],['혼합','각자 다른 수단']])}${settingField('workDays','주당 출근일','일',1)}${settingField('wifeHome','우리집 → 배우자 직장','분',1)}${settingField('selfHome','우리집 → 본인 직장','분',1)}${targetField('wifeMinutes','후보 → 배우자 직장','분',1)}${targetField('selfMinutes','후보 → 본인 직장','분',1)}${settingField('wifeLimit','배우자 통근 상한','분',1)}${settingField('selfLimit','본인 통근 상한','분',1)}</div><div class="dp-actions"><a class="dp-button" href="${search(t.location+' '+t.name)}" target="_blank" rel="noreferrer">후보 위치</a><a class="dp-button" href="${search(s.wifeDestination)}" target="_blank" rel="noreferrer">배우자 목적지</a><a class="dp-button" href="${search(s.selfDestination)}" target="_blank" rel="noreferrer">본인 목적지</a></div><p class="dp-callout">${F.known(c.delta)?'두 사람 주간 통근 '+(c.delta>0?c.delta+'분 증가':Math.abs(c.delta)+'분 감소'):'현재 집과 후보의 시간을 입력하면 주간 통근 증감을 보여줍니다.'}</p><p class="dp-muted">${t.commuteDate?'직접 확인값 저장 '+esc(t.commuteDate):'자동 길찾기 시간이 아닙니다.'} · 건물·사내 이동도 포함해 입력하세요.</p>`;
  }
  function recommendations() {
    const regions=[...new Set(catalog.filter(i=>i.kind!=='reconstruction').map(i=>i.region))].sort();
    let options=catalog.filter(i=>i.kind!=='reconstruction'&&i.price>=discovery.min*1e8&&i.price<=discovery.max*1e8&&i.area>=discovery.area&&
      (discovery.region==='all'||i.region===discovery.region)&&(!discovery.search||(i.name+' '+i.location).includes(discovery.search))&&(!discovery.fresh||age(i.date)<=90));
    options=options.map(i=>({item:i,p:calc(i)})).filter(({item,p})=>!discovery.fit||(p.shortage<1&&p.monthlyOver!==null&&p.monthlyOver<1&&
      (!F.known(state.settings.wifeLimit)||(F.known(target(item).wifeMinutes)&&target(item).wifeMinutes<=state.settings.wifeLimit))&&
      (!F.known(state.settings.selfLimit)||(F.known(target(item).selfMinutes)&&target(item).selfMinutes<=state.settings.selfLimit))));
    const sorters={budget:(a,b)=>a.p.shortage-b.p.shortage||a.p.peak-b.p.peak, recent:(a,b)=>String(b.item.date).localeCompare(String(a.item.date)),price:(a,b)=>a.item.price-b.item.price,liquidity:(a,b)=>b.item.count-a.item.count};
    options.sort(sorters[discovery.sort]||sorters.budget);
    document.querySelector('#recommendations-panel').innerHTML=header('추천','자금 부담부터 비교하고, 근거를 확인해 보세요.',button('담은 후보 '+state.saved.length,'go-candidates'))+
      `<section class="dp-filters"><label class="dp-field dp-search"><span>단지·동네 찾기</span><input type="search" id="dp-search" data-filter="search" value="${esc(discovery.search)}" placeholder="수지, 분당, 단지명"></label><label class="dp-field"><span>지역</span><select id="dp-region" data-filter="region"><option value="all">전체 지역</option>${regions.map(r=>`<option ${discovery.region===r?'selected':''}>${esc(r)}</option>`).join('')}</select></label><label class="dp-field"><span>최소 가격 (억)</span><input data-filter="min" type="number" min="0" step="0.5" value="${discovery.min}"></label><label class="dp-field"><span>최대 가격 (억)</span><input data-filter="max" type="number" min="0" step="0.5" value="${discovery.max}"></label><label class="dp-field"><span>최소 전용 (㎡)</span><select data-filter="area">${[0,59,74,84].map(v=>`<option value="${v}" ${discovery.area===v?'selected':''}>${v||'전체'}</option>`).join('')}</select></label><label class="dp-field"><span>정렬</span><select data-filter="sort">${[['budget','자금 부담 적은 순'],['recent','최근 거래순'],['price','가격 낮은 순'],['liquidity','거래 많은 순']].map(([v,l])=>`<option value="${v}" ${discovery.sort===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="dp-check"><input type="checkbox" data-filter="fresh" ${discovery.fresh?'checked':''}>90일 내 거래</label><label class="dp-check"><input type="checkbox" data-filter="fit" ${discovery.fit?'checked':''}>내 자금·월 부담·통근 조건만</label></section>`+
      `<p class="dp-muted">${options.length}개 단지·면적 선택지 · ${new Set(catalog.filter(i=>i.kind!=='reconstruction').map(i=>i.id)).size}개 추적 단지에서 탐색 · ${esc(rawCandidates?.sync?.lastSuccessfulAt||'동기화 대기')}${discovery.fit?' · KB·세금 확인은 별도입니다.':''}</p>`+
      `<div class="dp-list">${options.slice(0,60).map(({item,p})=>recommendationCard(item,p)).join('')||'<div class="dp-card"><h2>조건에 맞는 후보가 없어요.</h2><p>가격·면적 조건을 넓히거나 월 부담·통근 확인값을 입력해 주세요.</p></div>'}</div>`+
      (options.length>60?'<p class="dp-muted">상위 60개 표시 중입니다. 지역과 면적으로 더 좁혀보세요.</p>':'')+
      `<p class="dp-footnote">실거래는 현재 매물이 아닙니다. 최근 거래 날짜·층·표본을 함께 확인하세요. 고정된 상승 예상 점수는 사용하지 않습니다.</p>`;
  }
  function recommendationCard(item,p) {
    const t=target(item),old=age(item.date)>90;
    return `<article class="dp-card dp-discovery-card"><div class="dp-card-top"><span class="dp-kicker">${esc(item.location)}</span><span class="dp-badge ${old?'dp-warn':'dp-neutral'}">${old?'거래 오래됨':item.count<3?'표본 적음':'실거래 참고'}</span></div><h2>${esc(item.name)}</h2><div class="dp-card-price"><strong>${eok(item.price)}</strong><span>전용 ${item.area}㎡</span></div><p class="dp-muted">${esc(item.date||'날짜 미확인')} · ${item.floor??'?'}층 · 12개월 ${item.count||0}건</p><div class="dp-two-stats">${stat('비상금 포함 추가 자금',money(p.shortage))}${stat('37개월차 월 주거비',money(p.rows[36].recurring))}</div><p class="dp-muted">${p.kbKnown?'저장된 KB 기준 · 확인일 '+esc(t.kbDate):'KB 확인 전 대출 한도 추정'}${item.completionYear?' · '+item.completionYear+'년 준공':''}</p>
      ${details('최근 거래와 과거 가격 흐름',`<div class="dp-mini-trades">${(item.trades||[]).map(r=>`<p>${esc(r.contractDate)} · ${r.floor}층 <b>${eok(r.priceManwon*10000)}</b></p>`).join('')}</div><p class="dp-muted">${F.known(item.trend)?'과거 관측기간 가격 변화 '+item.trend+'% · '+item.observedMonths+'개월':'장기 비교 표본 부족'}. 미래 상승률 예측이 아닙니다.</p>`)}
      <div class="dp-actions">${button(state.saved.includes(item.key)?'담은 후보':'후보 담기','add',item.key)}${button('이 집 계산','choose',item.key,true)}</div></article>`;
  }
  function render() { home(); finance(); comparison(); recommendations(); mapShortlist(); }
  function mapShortlist() {
    const host=document.querySelector('#dp-map-candidates'); if(!host)return;
    host.innerHTML=`<div class="dp-section-title"><h2>관심 후보 위치</h2>${button('비교함','go-candidates')}</div><div class="dp-map-links">${savedItems().map(i=>`<a class="dp-button" href="https://map.naver.com/p/search/${encodeURIComponent(i.location+' '+i.name)}" target="_blank" rel="noreferrer">${esc(i.name)} · ${eok(target(i).price)} ↗</a>`).join('')}</div><p class="dp-muted">검증된 좌표만 핀으로 표시합니다. 주소 확인 전인 후보는 네이버 지도에서 확인할 수 있어요.</p>`;
    drawSavedMarkers();
  }
  function drawSavedMarkers() {
    if(typeof propertyMap==='undefined'||!propertyMap)return;
    candidateMarkers.forEach(marker=>{if(typeof marker.setMap==='function')marker.setMap(null);else marker.remove();});candidateMarkers.clear();
    savedItems().forEach(item=>{
      const cached=state.mapPoints?.[item.key];
      const point=item.mapPoint||(cached?.location===item.location?cached:null);
      if(point&&['naver-geocode','naver-browser-geocode'].includes(point.source)&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&point.latitude>33&&point.latitude<39&&point.longitude>124&&point.longitude<132){
        const html=`<div class="dp-saved-pin"><b>${esc(item.name)}</b><small>${eok(target(item).price)} · ${item.area}㎡</small></div>`;
        const popup=`<div class="dp-card"><h3>${esc(item.name)}</h3><p>${item.area}㎡ · ${eok(target(item).price)}</p>${button('이 집 계산','choose',item.key)}</div>`;
        let marker;
        if(mapProvider==='naver'){
          marker=new window.naver.maps.Marker({position:new window.naver.maps.LatLng(point.latitude,point.longitude),map:propertyMap,icon:{content:html,anchor:new window.naver.maps.Point(65,40)}});
          window.naver.maps.Event.addListener(marker,'click',()=>{new window.naver.maps.InfoWindow({content:popup}).open(propertyMap,marker);});
        }else if(window.L){marker=window.L.marker([point.latitude,point.longitude],{icon:window.L.divIcon({className:'dp-map-marker',html,iconSize:[130,42],iconAnchor:[65,42]})}).addTo(propertyMap).bindPopup(popup);}
        if(marker)candidateMarkers.set(item.key,marker);
      }else if(mapProvider==='naver'&&state.compare.includes(item.key)&&item.latestTransaction?.jibun&&!geocodeAttempts.has(item.key)){
        geocodeAttempts.add(item.key);
        Promise.race([requestBrowserGeocode(item),new Promise(resolve=>setTimeout(()=>resolve(null),8000))]).then(result=>{
          if(!result)return;state.mapPoints={...state.mapPoints,[item.key]:{...result,location:item.location}};save();drawSavedMarkers();
        }).catch(()=>{});
      }
    });
  }
  function add(item) {
    if(!item)return;
    if(!state.saved.includes(item.key))state.saved.push(item.key);
    state.snapshots={...state.snapshots,[item.key]:item};
    if(!state.compare.includes(item.key)&&state.compare.length<3)state.compare.push(item.key);
    save();
  }
  function setCandidates(data) {
    rawCandidates=data;
    const items=[...(data.candidates||[]),...(data.recommendationPool||[])];
    const additions=items.flatMap(item=>(item.areaPrices||[]).filter(a=>Number(a.latestPriceManwon)>0).map(a=>({
      key:item.id+':'+a.areaTypeSqm,id:item.id,name:item.displayName||item.name,location:item.location,region:regionFor(item.location),
      area:Number(a.areaTypeSqm),price:Number(a.latestPriceManwon)*10000,date:a.latestContractDate,count:a.count,
      floor:a.recentTransactions?.[0]?.floor,trades:a.recentTransactions||[],trend:a.growthAnalysis?.longTermChangePercent,
      observedMonths:a.growthAnalysis?.observedMonths,completionYear:item.completionYear,requested:(data.candidates||[]).some(c=>c.id===item.id),
      mapPoint:item.mapPoint,latestTransaction:item.latestTransaction,priceStatus:item.priceStatus
    })));
    catalog=[...additions,...catalog.filter(i=>i.kind==='reconstruction')];
    changes=additions.filter(i=>state.prices[i.key]&&state.prices[i.key]!==i.price&&state.saved.includes(i.key)).map(i=>({...i,before:state.prices[i.key],after:i.price}));
    state.prices=Object.fromEntries(additions.map(i=>[i.key,i.price]));
    if(!state.seeded&&additions.length) {
      for(const id of ['maegyo-prugio-sk','yeongtong-sk-view','yeongtong-hyundai']) {const options=additions.filter(i=>i.id===id).sort((a,b)=>Math.abs(a.area-84)-Math.abs(b.area-84));if(options[0])add(options[0]);}
      if(!state.saved.length)add(additions[0]);
      state.seeded=true;
    }
    if(!find(selected)) selected=state.saved[0]||additions[0]?.key;
    save();render();
  }
  function regionFor(location='') {if(location.includes('수지구'))return '수지';if(location.includes('분당구'))return '분당';if(/성남시 (중원구|수정구)/.test(location))return '구성남';if(location.includes('기흥구'))return '기흥';if(location.includes('수원시'))return '수원';return location.split(' ')[0]||'기타';}
  function setHome(data) {
    homeData=data;
    const price=Number(data.recentTransactions?.summary?.latestPriceManwon)*10000;
    if(state.settings.salePrice===null&&Number.isFinite(price)&&price>0)state.settings.salePrice=price;
    save();render();
  }
  function setReconstruction(data) {
    const rec=(data.items||[]).flatMap(i=>(i.areaPrices||[]).filter(a=>a.latestPriceManwon>0).map(a=>({key:'rebuild:'+i.id+':'+a.areaTypeSqm,id:i.id,name:i.name,location:i.location,kind:'reconstruction',area:a.areaTypeSqm,price:a.latestPriceManwon*10000,date:a.latestContractDate,region:regionFor(i.location)})));
    catalog=[...catalog.filter(i=>i.kind!=='reconstruction'),...rec];
    document.querySelectorAll('.reconstruction-card').forEach(card=>{const map=card.querySelector('[data-map-project]');const item=rec.find(i=>i.id===map?.dataset.mapProject);if(item&&!card.querySelector('[data-action="choose"]'))card.append(document.createRange().createContextualFragment(button('총투입액 비교','choose',item.key)));});
  }
  function download(name,body,type) {const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b||b.tagName==='SELECT')return;
    const a=b.dataset.action,key=b.dataset.key;
    if(a.startsWith('go-')){go(a.slice(3));return;}
    if(a==='choose'||a==='focus'){const item=find(key);if(!item)return;add(item);selected=key;if(!state.compare.includes(key))state.compare=[...state.compare.slice(0,2),key];save();render();go(a==='choose'?'budget':'candidates');return;}
    if(a==='add'){add(find(key));render();toast('후보에 담았습니다. 비교함에서 확인하세요.');return;}
    if(a==='remove'){state.saved=state.saved.filter(i=>i!==key);state.compare=state.compare.filter(i=>i!==key);if(selected===key)selected=state.saved[0]||catalog[0]?.key;save();render();return;}
    if(a==='latest-price'){if(selected){state.overrides[selected]={...state.overrides[selected],price:null};save();render();}return;}
    if(a==='family-input'){go('budget');const node=document.querySelector('#dp-settings-income');node.closest('details').open=true;node.focus();return;}
    if(a.startsWith('scenario-')){state.assumptions=a==='scenario-up'?{homeGrowth:2,targetGrowth:3,cashRate:0}:a==='scenario-down'?{homeGrowth:-2,targetGrowth:-2,cashRate:0}:{homeGrowth:0,targetGrowth:0,cashRate:0};save();comparison();return;}
    if(a==='export'){download('happy-house-plan-'+today+'.json',JSON.stringify(state,null,2),'application/json');return;}
    if(a==='import'){document.querySelector('#dp-import').click();return;}
    if(a==='csv'){const rows=F.plan(state.settings,current()).rows;download('happy-house-monthly.csv','\uFEFF월,개월차,사내원금,개인이자,신용원금,신용이자,지원분세금,유지비,총납부,남은대출\n'+rows.map(r=>[r.date,r.month,...[r.companyPrincipal,r.companyInterest,r.creditPrincipal,r.creditInterest,r.subsidyTax,r.other,r.total,r.debt].map(Math.round)].join(',')).join('\n'),'text/csv;charset=utf-8');}
  });
  document.addEventListener('change',async e=>{
    const node=e.target;
    if(node.id==='dp-import') {
      try {const file=node.files[0];if(!file)return;if(file.size>2000000)throw Error('size');const data=JSON.parse(await file.text());if(!validState(data))throw Error('format');state={...state,...data,settings:{...defaults,...data.settings}};selected=state.selected;save();render();toast('설정을 가져왔습니다.');}catch{toast('이 앱에서 내보낸 올바른 JSON 파일을 선택해 주세요.');}return;
    }
    if(node.dataset.action==='select-target'){selected=node.value;if(!state.compare.includes(selected))state.compare=[...state.compare.slice(0,2),selected];save();render();return;}
    if(node.dataset.compare){const key=node.dataset.compare;if(node.checked&&state.compare.length>=3){node.checked=false;toast('비교는 3곳까지 가능해요. 하나를 해제한 뒤 선택해 주세요.');return;}state.compare=node.checked?[...state.compare,key]:state.compare.filter(i=>i!==key);if(state.compare.length&&!state.compare.includes(selected))selected=state.compare[0];save();render();return;}
    if(node.dataset.filter){const k=node.dataset.filter;discovery[k]=node.type==='checkbox'?node.checked:['min','max','area'].includes(k)?Number(node.value):node.value;recommendations();return;}
    const scope=node.dataset.scope,name=node.dataset.field;if(!scope||!name)return;
    if(node.type==='number'&&!node.checkValidity()){node.reportValidity();return;}
    const value=node.type==='checkbox'?node.checked:node.type==='number'?(node.value===''?null:Number(node.value)*Number(node.dataset.scale||1)):node.tagName==='SELECT'&&['creditMonths','brokerVat'].includes(name)?Number(node.value):node.value;
    if(scope==='target'){if(!selected)return;state.overrides[selected]={...state.overrides[selected],[name]:value};if(['wifeMinutes','selfMinutes'].includes(name))state.overrides[selected].commuteDate=today;}
    else state[scope][name]=value;
    save();requestAnimationFrame(()=>{
      const open=[...document.querySelectorAll('details[open]')].map(d=>d.querySelector('summary')?.textContent);
      const focusId=document.activeElement?.id;
      const scrollY=window.scrollY;
      render();document.querySelectorAll('details').forEach(d=>{if(open.includes(d.querySelector('summary')?.textContent))d.open=true;});
      if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
      window.scrollTo({top:scrollY,behavior:'instant'});
    });
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='dp-manual-form')return;e.preventDefault();const f=new FormData(e.target),key='manual:'+Date.now();
    const item={key,id:key,name:String(f.get('name')).trim(),location:String(f.get('location')).trim(),price:Number(f.get('price'))*1e8,area:Number(f.get('area')),count:0};
    state.manual.push(item);add(item);selected=key;if(!state.compare.includes(key))state.compare=[...state.compare.slice(0,2),key];save();render();go('budget');
  });
  const statusNode=document.createElement('div');statusNode.id='dp-toast';statusNode.className='dp-toast';statusNode.setAttribute('role','status');statusNode.hidden=true;document.body.append(statusNode);
  const mapBlock=document.createElement('section');mapBlock.id='dp-map-candidates';mapBlock.className='dp-card';document.querySelector('#map-panel').append(mapBlock);
  for(const id of ['home-panel','budget-panel','candidates-panel','recommendations-panel'])document.querySelector('#'+id).classList.add('decision-panel');
  document.querySelector('#budget-tab b').textContent='대출 관리';
  window.HappyPlanner={setHome,setCandidates,setReconstruction,refresh:render,refreshMap:mapShortlist};
  render();
  if(window.happyHouseHomeData)setHome(window.happyHouseHomeData);
  if(window.happyHouseCandidateData)setCandidates(window.happyHouseCandidateData);
  if(window.happyHouseReconstructionData)setReconstruction(window.happyHouseReconstructionData);
  fetch('data/sync-status.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{sources=data;home();}).catch(()=>{sources={sources:[{label:'수집 상태',status:'error'}]};home();});
})();
