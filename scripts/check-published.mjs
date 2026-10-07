import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'test-results',process.env.SITE_URL?'published':'build');
await mkdir(output,{recursive:true});
let server;
let url=process.env.SITE_URL;
if(!url){
  process.env.SITE_ROOT=path.join(root,'dist');
  ({server}=await import('./serve.mjs'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  url=`http://127.0.0.1:${server.address().port}${(process.env.BASE_PATH||'').replace(/\/$/,'')}/`;
}
const browser=await chromium.launch();
const report={url,widths:[],errors:[],checks:[],realLead:null};
try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.url().startsWith(url)&&response.status()>=400)report.errors.push(`HTTP ${response.status()} ${response.url()}`);});
  page.on('requestfailed',request=>{if(request.url().startsWith(url))report.errors.push(`${request.url()} ${request.failure()?.errorText}`);});
  for(const width of [1920,1440,1366,1024,768,390,375,360]){
    await page.setViewportSize({width,height:900});
    await page.goto(url,{waitUntil:'load'});
    await page.locator('#products .product').first().waitFor();
    assert.equal(await page.locator('[data-screen]').count(),11);
    assert.equal(await page.locator('.faq-category').count(),4);
    assert.equal(await page.locator('.faq-item').count(),30);
    for(const section of await page.locator('[data-screen]').all()){
      await section.scrollIntoViewIfNeeded();
      await section.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode().catch(()=>{}))));
    }
    const geometry=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,broken:[...document.images].filter(img=>!img.complete||!img.naturalWidth).map(img=>img.currentSrc),overflows:[...document.querySelectorAll('h1,h2,h3,.section-lead,.dealer-role,.faq-category')].filter(el=>el.getBoundingClientRect().width&&el.scrollWidth>el.clientWidth+2).map(el=>({tag:el.tagName,id:el.id,text:el.textContent.slice(0,80),width:el.clientWidth,scroll:el.scrollWidth}))}));
    report.widths.push({width,...geometry});
    await page.screenshot({path:path.join(output,`${width}.png`),fullPage:true});
    assert(geometry.document<=width+1&&geometry.body<=width+1,`Horizontal overflow at ${width}: ${JSON.stringify(geometry)}`);
    assert.deepEqual(geometry.broken,[],`Broken images at ${width}`);
    assert.deepEqual(geometry.overflows,[],`Clipped text at ${width}`);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto(url,{waitUntil:'load'});
  for(const href of ['#about','#benefits','#how','#cases','#dealer']){
    await page.locator(`.site-header nav a[href="${href}"]`).click();
    await page.waitForFunction(hash=>location.hash===hash,href);
    // The reduced-motion preference disables animated scrolling in modern browsers.
    await page.waitForFunction(selector=>Math.abs(document.querySelector(selector).getBoundingClientRect().top-(document.querySelector('.site-header').getBoundingClientRect().bottom+22))<6,href,{timeout:5000}).catch(async()=>{
      const placement=await page.evaluate(selector=>({top:document.querySelector(selector).getBoundingClientRect().top,header:document.querySelector('.site-header').getBoundingClientRect().bottom}),href);
      assert(placement.top>=placement.header-1,`Header covers ${href}: ${JSON.stringify(placement)}`);
    });
  }
  report.checks.push('header and menu anchors');
  const categories=page.locator('.faq-category');
  await categories.nth(0).locator(':scope > summary').click();
  await categories.nth(0).locator('.faq-item summary').nth(0).click();
  await categories.nth(0).locator('.faq-item summary').nth(1).click();
  assert.equal(await page.locator('.faq-item[open]').count(),1);
  await categories.nth(1).locator(':scope > summary').click();
  assert.equal(await page.locator('.faq-category[open]').count(),1);
  await categories.nth(1).locator(':scope > summary').click();
  assert.equal(await page.locator('.faq-category[open]').count(),0);
  report.checks.push('FAQ category and question accordion');
  for(const [value,net] of [['0.1','502'],['0.2','1224'],['0.3','1946']]){
    await page.locator(`#calculator-form input[value="${value}"]`).check();
    assert.equal((await page.locator('#calc-result .money').innerText()).replace(/\D/g,''),net);
  }
  await page.locator('#calculator-form input[value="0.2"]').check();
  assert.match(await page.locator('#calc-result').innerText(),/14\s*688/);
  assert.match(await page.locator('#calc-result').innerText(),/96 мл/);
  await page.locator('#calculator-form [name="mileage"]').fill('');
  assert.match(await page.locator('#calc-result').innerText(),/Введите корректные/);
  await page.locator('#calculator-form [name="mileage"]').fill('1000');
  report.checks.push('calculator 10/20/30%, empty input, annual dosage');
  for(const fuel of ['petrol','diesel','lpg','mazut']){
    await page.locator(`#fuel-tabs [data-fuel="${fuel}"]`).click();
    assert.equal(await page.locator('#products .product').count(),5);
    await page.locator('#products img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
    assert((await page.locator('#products img').first().getAttribute('src')).includes(`/${fuel}-`));
  }
  report.checks.push('20 catalog photos and product switches');
  // Check all local pages and documents over HTTP, not just files on disk.
  const links=await page.locator('a[href]').evaluateAll(anchors=>[...new Set(anchors.map(a=>a.href))].filter(href=>href.startsWith(location.origin)&&!href.includes('#')));
  for(const link of links){const response=await context.request.get(link);assert.equal(response.status(),200,link);}
  const icon=await page.locator('link[rel="icon"]').getAttribute('href');
  assert.equal((await context.request.get(new URL(icon,url).href)).status(),200);
  assert.equal((await context.request.get(new URL('sitemap.xml',url).href)).status(),200);
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('a[href="tel:+79952628899"]').count()>0,true);
  assert.equal(await page.locator('a[href="mailto:enerdar23@yandex.com"]').count(),1);
  assert.equal(await page.locator('a[href="https://t.me/Enerdar"]').count()>0,true);
  assert.equal(await page.locator('a[href^="https://max.ru/u/"]').count(),3);
  assert.equal(await page.locator('[src^="http://"]').count(),0);
  report.checks.push('PDFs, legal pages, blog, favicon, sitemap, contacts and HTTPS resource paths');
  for(const button of await page.locator('[data-case-video]').all()){
    await button.click();
    assert.match(await page.locator('#case-video-player iframe').getAttribute('src'),/^https:\/\/rutube\.ru\/play\/embed\/[a-f0-9]{32}\//);
    await page.locator('#close-case-video').click();
    assert.equal(await page.locator('#case-video-player iframe').count(),0);
  }
  report.checks.push('six inline Rutube players and close');
  // Mock delivery verifies UI behavior without sending eight sets of real leads.
  let sent=[];
  await page.route('https://script.google.com/macros/s/**/exec',async route=>{sent.push(JSON.parse(route.request().postData()));await new Promise(resolve=>setTimeout(resolve,250));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,notifications:{telegram:'sent',max:'disabled'}})});});
  for(const kind of ['order','callback']){
    await page.goto(url+'?utm_source=release-check&utm_medium=test&utm_campaign=prelaunch&utm_content=form&utm_term=syntonik',{waitUntil:'load'});
    if(kind==='order')await page.locator('.site-header [data-order]').click();else await page.locator('[data-callback]').last().click();
    const form=page.locator('#lead-form');
    await form.locator('[type="submit"]').click();
    assert.equal(sent.length,kind==='order'?0:1,'Empty form must not send');
    await form.locator('[name="name"]').fill('Техническая проверка');
    await form.locator('[name="phone"]').fill('+7 995 262-88-99');
    await form.locator('[name="city"]').fill('Краснодар');
    await form.locator('[name="consent"]').check();
    if(kind==='order')await form.locator('[name="terms"]').check();
    await form.locator('[type="submit"]').dblclick();
    await page.locator('#form-status').filter({hasText:'Спасибо!'}).waitFor();
    assert.equal(sent.length,kind==='order'?1:2,'Double click must create one request');
    assert.equal(sent.at(-1).form,kind);
    assert.equal(sent.at(-1).utm_source,'release-check');
    assert.equal(sent.at(-1).city,'Краснодар');
    if(kind==='order'){assert(sent.at(-1).fuel);assert(sent.at(-1).volume);}
    await page.locator('#close-dialog').click();
  }
  await page.unroute('https://script.google.com/macros/s/**/exec');
  report.checks.push('both forms: validation, single request, success, all fields and UTM');
  await page.route('https://script.google.com/macros/s/**/exec',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.locator('.site-header [data-order]').click();
  await page.locator('#lead-form [name="name"]').fill('Техническая проверка');
  await page.locator('#lead-form [name="phone"]').fill('+7 995 262-88-99');
  await page.locator('#lead-form [name="city"]').fill('Краснодар');
  await page.locator('#lead-form [name="consent"]').check();
  await page.locator('#lead-form [name="terms"]').check();
  await page.locator('#lead-form [type="submit"]').click();
  await page.locator('#form-status').filter({hasText:'Не удалось'}).waitFor();
  await page.locator('#close-dialog').click();
  await page.unroute('https://script.google.com/macros/s/**/exec');
  report.checks.push('form network error');
  if(process.env.TEST_REAL_LEAD==='true'){
    assert(url.startsWith('https://'),'Real delivery must be tested from the published HTTPS site');
    // Reuse the test receipt on a rerun instead of adding another row.
    if(process.env.REAL_LEAD_ID)await page.evaluate(id=>{crypto.randomUUID=()=>id;},process.env.REAL_LEAD_ID);
    await page.locator('[data-callback]').last().click();
    await page.locator('#lead-form [name="name"]').fill('ТЕСТ сайта — не перезванивать');
    await page.locator('#lead-form [name="phone"]').fill('+7 995 262-88-99');
    await page.locator('#lead-form [name="city"]').fill('Краснодар — техническая проверка');
    await page.locator('#lead-form [name="consent"]').check();
    const receipt=page.waitForResponse(response=>response.url().startsWith('https://script.googleusercontent.com/')&&response.request().method()==='GET',{timeout:60000});
    await page.locator('#lead-form [type="submit"]').click();
    const response=await receipt;
    report.realLead=await response.json();
    assert.equal(report.realLead.success,true);
    if(!report.realLead.duplicate){
      assert.equal(report.realLead.notifications.telegram,'sent');
      assert.equal(report.realLead.notifications.max,'disabled');
    }
    await page.locator('#form-status').filter({hasText:'Спасибо!'}).waitFor();
  }
  assert.deepEqual(report.errors,[]);
  report.passed=true;
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
