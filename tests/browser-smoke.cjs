const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/data/map-config.json')return res.writeHead(200,{'Content-Type':'application/json'}).end('{"naverMapsClientId":""}');
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
async function run(browser,viewport,label){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#dp-selected option').length>=3);
  await page.screenshot({path:path.join(os.tmpdir(),'happy-house-'+label+'-home.png'),fullPage:true});
  await page.locator('#budget-tab').click();
  assert.match(await page.locator('.dp-result-card').innerText(),/더 필요한 자금|비상자금/);
  async function fill(id,value){const input=page.locator('#'+id);await input.evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await input.fill(value);await input.press('Tab');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
  await fill('dp-settings-cash','40000');
  await fill('dp-settings-monthlyLimit','700');
  await fill('dp-settings-income','1200');
  await fill('dp-settings-living','300');
  await fill('dp-settings-currentRate','4');
  await fill('dp-settings-currentOperating','30');
  await fill('dp-settings-credit','0.5');
  await page.locator('#candidates-tab').click();
  assert.equal(await page.locator('.dp-projection').count(),2);
  assert.match(await page.locator('.dp-projections').innerText(),/우리집 유지 순자산/);
  const flat=await page.locator('.dp-projections').innerText();
  await page.locator('[data-action="scenario-up"]').click();
  assert.notEqual(await page.locator('.dp-projections').innerText(),flat);
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:path.join(os.tmpdir(),'happy-house-'+label+'-compare.png'),fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#dp-selected option').length>=3);
  await page.locator('#budget-tab').click();assert.equal(await page.locator('#dp-settings-cash').inputValue(),'40000');
  await page.locator('#recommendations-tab').click();assert.ok(await page.locator('.dp-discovery-card').count()>0);
  await page.locator('[data-filter="area"]').selectOption('84');
  const seed=await page.evaluate(()=>JSON.parse(localStorage.getItem('happy-house-plan-v2')).compare);
  const keys=await page.locator('.dp-discovery-card [data-action="choose"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.key));
  const card=page.locator('.dp-discovery-card').nth(Math.max(0,keys.findIndex(key=>!seed.includes(key))));const name=await card.locator('h2').textContent();
  await card.locator('[data-action="choose"]').click();assert.ok((await page.locator('#dp-selected').innerText()).includes(name));
  assert.equal(await page.locator('#budget-panel').isVisible(),true);
  await page.locator('#candidates-tab').click();
  assert.equal(await page.locator('.dp-mobile-selected h3').textContent(),name);
  await page.locator('#budget-tab').click();
  const downloadEvent=page.waitForEvent('download');await page.locator('[data-action="export"]').click();
  const download=await downloadEvent;const exportPath=path.join(os.tmpdir(),'happy-house-test-'+label+'.json');await download.saveAs(exportPath);
  await fill('dp-settings-cash','30000');
  await page.locator('#dp-import').setInputFiles(exportPath);
  await page.waitForFunction(()=>document.querySelector('#dp-settings-cash').value==='40000');
  await page.locator('#dp-import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,settings:{cash:-1},saved:[],compare:[],assumptions:null}))});
  await page.waitForFunction(()=>document.querySelector('#dp-toast').textContent.includes('올바른 JSON'));
  assert.equal(await page.locator('#dp-settings-cash').inputValue(),'40000');
  for(const tab of ['home','budget','candidates','recommendations','home-price','reconstruction','map']){
    await page.locator('#'+tab+'-tab').click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=1,tab+' overflow '+overflow);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({label,errors,selected:name,persistence:true,allTabs:true}));await context.close();
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  try {await run(browser,{width:1440,height:1000},'desktop');await run(browser,{width:390,height:844},'mobile');}
  finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
