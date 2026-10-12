import {calculate} from './lib/calculator.js';
import {fuels,volumes} from './data/catalog.js';
import {cases,caseVideoEmbedUrl} from './data/cases.js';
import {LEAD_ENDPOINT} from './lead-config.js';
import {createLeadSubmitter,sessionUtms,normaliseRuMobile} from './lib/leads.js';
import './remaining.js';
const siteHeader=document.querySelector('.site-header');
function updateHeaderSurface(){siteHeader.classList.toggle('is-scrolled',window.scrollY>12);}
function measureHeader(){document.documentElement.style.setProperty('--site-header-height',`${siteHeader.getBoundingClientRect().height}px`);}
new ResizeObserver(measureHeader).observe(siteHeader);
window.addEventListener('scroll',updateHeaderSurface,{passive:true});
updateHeaderSurface();measureHeader();
const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
const number = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const calcForm = document.querySelector('#calculator-form');
function updateCalculator(){
  const data=new FormData(calcForm), target=document.querySelector('#calc-result'), details=document.querySelector('#calc-details');
  if(!calcForm.checkValidity()){target.textContent='Введите корректные расход, пробег и цену топлива.';details.replaceChildren();return;}
  try{
    const c=Number(data.get('consumption')),m=Number(data.get('mileage')),p=Number(data.get('price')),s=Number(data.get('scenario'));
    const result=calculate(c,m,p,s);
    target.innerHTML=`<div class="net-savings"><p class="savings-label">Ваша возможная экономия</p><div><strong class="money">${money(result.netMonthlySavings)}</strong><span class="period">в месяц</span></div><p class="year-savings"><strong>${money(result.netYearlySavings)}</strong> за год</p><p class="net-explanation">Чистая экономия после вычета стоимости израсходованного Syntonik.</p></div>`;
    details.innerHTML=`<div><dt>Топливо до снижения / месяц</dt><dd>${number(result.fuelBefore)} л</dd></div><div><dt>Топливо после снижения / месяц</dt><dd>${number(result.fuelAfter)} л</dd></div><div><dt>Экономия на топливе / месяц</dt><dd>${money(result.monthlySavings)}</dd></div><div><dt>Расход Syntonik / месяц<br><small>1 мл на 10 л топлива после снижения</small></dt><dd>${number(result.syntonikMlMonth)} мл</dd></div><div><dt>Стоимость Syntonik / месяц</dt><dd>${money(result.syntonikCostMonth)}</dd></div><div><dt>Чистая экономия / месяц</dt><dd>${money(result.netMonthlySavings)}</dd></div>`;
  }catch{target.textContent='Проверьте исходные данные.';details.replaceChildren();}
}
calcForm.addEventListener('input',updateCalculator);updateCalculator();
let selectedFuel=fuels[0];
let calculatorFuel=fuels[0];
function renderCalculatorTabs(){document.querySelector('#calculator-tabs').innerHTML=fuels.map(f=>`<button type="button" data-calc-fuel="${f.id}" aria-pressed="${calculatorFuel.id===f.id}">${f.name}</button>`).join('');}
renderCalculatorTabs();
const productGrid=document.querySelector('#products');
const catalogControls=document.querySelector('.catalog-controls');
const catalogPrevious=document.querySelector('#catalog-prev');
const catalogNext=document.querySelector('#catalog-next');
const catalogPosition=document.querySelector('#catalog-position');
const mobileCatalog=matchMedia('(max-width:700px)');
let activeProduct=0,productScrollFrame=0,productGridWidth=0;
function updateCatalogControls(){
  catalogControls.hidden=!mobileCatalog.matches;
  const label=`${activeProduct+1} из ${volumes.length}`;
  if(catalogPosition.textContent!==label)catalogPosition.textContent=label;
  catalogPrevious.disabled=activeProduct===0;
  catalogNext.disabled=activeProduct===volumes.length-1;
}
function scrollToProduct(index,smooth=false){
  const card=productGrid.children[index];if(!card)return;
  const left=card.getBoundingClientRect().left-productGrid.getBoundingClientRect().left+productGrid.scrollLeft;
  productGrid.scrollTo({left,behavior:smooth&&!matchMedia('(prefers-reduced-motion:reduce)').matches?'smooth':'instant'});
}
function syncScrolledProduct(){
  productScrollFrame=0;if(!mobileCatalog.matches)return;
  const cards=[...productGrid.children],left=productGrid.getBoundingClientRect().left;
  activeProduct=cards.reduce((closest,card,index)=>Math.abs(card.getBoundingClientRect().left-left)<Math.abs(cards[closest].getBoundingClientRect().left-left)?index:closest,0);
  updateCatalogControls();
}
productGrid.addEventListener('scroll',()=>{if(!productScrollFrame)productScrollFrame=requestAnimationFrame(syncScrolledProduct);},{passive:true});
catalogPrevious.addEventListener('click',()=>scrollToProduct(Math.max(0,activeProduct-1),true));
catalogNext.addEventListener('click',()=>scrollToProduct(Math.min(volumes.length-1,activeProduct+1),true));
productGrid.addEventListener('keydown',event=>{
  if(!mobileCatalog.matches||event.target!==productGrid||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const index=event.key==='Home'?0:event.key==='End'?volumes.length-1:Math.max(0,Math.min(volumes.length-1,activeProduct+(event.key==='ArrowRight'?1:-1)));
  scrollToProduct(index,true);
});
new ResizeObserver(()=>{
  const width=productGrid.clientWidth;if(width===productGridWidth)return;
  productGridWidth=width;updateCatalogControls();
  if(mobileCatalog.matches)scrollToProduct(activeProduct);else productGrid.scrollLeft=0;
}).observe(productGrid);
mobileCatalog.addEventListener('change',()=>{updateCatalogControls();if(mobileCatalog.matches)scrollToProduct(activeProduct);else productGrid.scrollLeft=0;});
function renderCatalog(){
  document.querySelector('#fuel-tabs').innerHTML=fuels.map(f=>`<button data-fuel="${f.id}" aria-pressed="${selectedFuel.id===f.id}">${f.name}</button>`).join('');
  document.querySelector('#products').innerHTML=volumes.map(v=>`<article class="product" aria-label="Syntonik ${selectedFuel.name}, ${v.label}"><div class="product-photo photo-${v.ml}"><img src="/assets/products/catalog-clean/${selectedFuel.id}-${v.ml}.png" width="1122" height="1402" loading="lazy" alt="Syntonik ${selectedFuel.name}, ${v.label}"></div><h3>${v.label}</h3><p class="fuel-capacity">Хватит на ${number(v.ml*10)} л топлива</p><strong class="product-price">${money(v.price)}</strong><button data-order data-volume="${v.ml}" data-fuel="${selectedFuel.id}" aria-label="Заказать Syntonik ${selectedFuel.name}, ${v.label}">Заказать</button></article>`).join('');
  activeProduct=0;productGrid.scrollTo({left:0,behavior:'instant'});updateCatalogControls();
}
renderCatalog();
document.querySelector('#calculator-catalog').addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  selectedFuel=calculatorFuel;renderCatalog();
  const catalog=document.querySelector('#catalog');
  catalog.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  document.querySelector(`#fuel-tabs [data-fuel="${selectedFuel.id}"]`).focus({preventScroll:true});
  history.replaceState(null,'','#catalog');
});
const caseGrid=document.querySelector('#cars');
const caseCards=[...caseGrid.querySelectorAll('.case-card')];
const caseControls=document.querySelector('.cases-controls');
const casePrevious=document.querySelector('#cases-prev');
const caseNext=document.querySelector('#cases-next');
const casePosition=document.querySelector('#cases-position');
const mobileCases=matchMedia('(max-width:700px)');
let activeCase=0,caseScrollFrame=0,caseGridWidth=0;
function updateCaseControls(){
  caseControls.hidden=!mobileCases.matches;
  const label=`${activeCase+1} из ${caseCards.length}`;
  if(casePosition.textContent!==label)casePosition.textContent=label;
  casePrevious.disabled=activeCase===0;
  caseNext.disabled=activeCase===caseCards.length-1;
}
function scrollToCase(index,smooth=false){
  const left=caseCards[index].getBoundingClientRect().left-caseGrid.getBoundingClientRect().left+caseGrid.scrollLeft;
  caseGrid.scrollTo({left,behavior:smooth&&!matchMedia('(prefers-reduced-motion:reduce)').matches?'smooth':'instant'});
}
function syncScrolledCase(){
  caseScrollFrame=0;
  if(!mobileCases.matches)return;
  const left=caseGrid.getBoundingClientRect().left;
  activeCase=caseCards.reduce((closest,card,index)=>Math.abs(card.getBoundingClientRect().left-left)<Math.abs(caseCards[closest].getBoundingClientRect().left-left)?index:closest,0);
  updateCaseControls();
}
caseGrid.addEventListener('scroll',()=>{if(!caseScrollFrame)caseScrollFrame=requestAnimationFrame(syncScrolledCase);},{passive:true});
casePrevious.addEventListener('click',()=>scrollToCase(Math.max(0,activeCase-1),true));
caseNext.addEventListener('click',()=>scrollToCase(Math.min(caseCards.length-1,activeCase+1),true));
caseGrid.addEventListener('keydown',event=>{
  if(!mobileCases.matches||event.target!==caseGrid||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();scrollToCase(Math.max(0,Math.min(caseCards.length-1,activeCase+(event.key==='ArrowRight'?1:-1))),true);
});
new ResizeObserver(()=>{
  const width=caseGrid.clientWidth;
  if(width===caseGridWidth)return;
  caseGridWidth=width;updateCaseControls();
  if(mobileCases.matches)scrollToCase(activeCase);else caseGrid.scrollLeft=0;
}).observe(caseGrid);
mobileCases.addEventListener('change',()=>{updateCaseControls();if(mobileCases.matches)scrollToCase(activeCase);else caseGrid.scrollLeft=0;});
updateCaseControls();
const caseVideoDialog=document.querySelector('#case-video-dialog');
const caseVideoPlayer=document.querySelector('#case-video-player');
let caseVideoOpener;
caseGrid.addEventListener('click',event=>{
  const button=event.target.closest('[data-case-video]');
  if(!button||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||typeof caseVideoDialog.showModal!=='function')return;
  const videoCase=cases.find(c=>c.id===button.dataset.caseVideo);
  const embedUrl=caseVideoEmbedUrl(videoCase?.videoUrl);
  if(!embedUrl)return;
  event.preventDefault();
  caseVideoOpener=button;
  document.querySelector('#case-video-title').textContent=`Видеоотзыв: ${videoCase.model}`;
  const player=document.createElement('iframe');
  player.src=embedUrl;player.title=`Видеоотзыв: ${videoCase.model}`;
  player.allow='autoplay; fullscreen; picture-in-picture; encrypted-media';
  player.allowFullscreen=true;
  player.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
  player.referrerPolicy='strict-origin-when-cross-origin';
  caseVideoPlayer.replaceChildren(player);
  caseVideoDialog.showModal();
});
document.querySelector('#close-case-video').addEventListener('click',()=>caseVideoDialog.close());
caseVideoDialog.addEventListener('click',event=>{
  if(event.target!==caseVideoDialog)return;
  const bounds=caseVideoDialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)caseVideoDialog.close();
});
caseVideoDialog.addEventListener('close',()=>{
  caseVideoPlayer.replaceChildren();
  if(caseVideoOpener?.isConnected)caseVideoOpener.focus({preventScroll:true});
});
const testDriveTerms=document.querySelector('#test-drive-terms');
const testDriveTermsTrigger=document.querySelector('#open-test-drive-terms');
testDriveTermsTrigger.addEventListener('click',()=>testDriveTerms.showModal());
document.querySelector('#close-test-drive-terms').addEventListener('click',()=>testDriveTerms.close());
testDriveTerms.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...testDriveTerms.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(element=>!element.disabled&&!element.hidden);
  const first=controls[0],last=controls.at(-1);
  if((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){
    event.preventDefault();(event.shiftKey?last:first).focus();
  }
});
testDriveTerms.addEventListener('click',event=>{
  if(event.target!==testDriveTerms)return;
  const bounds=testDriveTerms.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)testDriveTerms.close();
});
testDriveTerms.addEventListener('close',()=>testDriveTermsTrigger.focus({preventScroll:true}));
const dialog=document.querySelector('#lead-dialog'),leadForm=document.querySelector('#lead-form');
const leadFields=document.querySelector('#lead-fields'),leadSuccess=document.querySelector('#lead-success');
const phoneError=document.querySelector('#lead-phone-error');
const testDriveProduct={ml:15,label:'15 мл',price:690,name:'Syntonik TEST DRIVE'};
const submitLead=createLeadSubmitter(LEAD_ENDPOINT);
document.querySelector('#lead-setup-note').hidden=Boolean(LEAD_ENDPOINT);
let sendingLead=false;
let formOpener;
leadForm.elements.fuel.innerHTML=fuels.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
leadForm.elements.volume.innerHTML=volumes.map(v=>`<option value="${v.ml}">${v.label} — ${money(v.price)}</option>`).join('');
function orderChoice(){
  const trial=leadForm.dataset.testDrive==='true';
  return {trial,fuel:fuels.find(f=>f.id===leadForm.elements.fuel.value),product:(trial?[testDriveProduct]:volumes).find(v=>String(v.ml)===leadForm.elements.volume.value)};
}
function openForm(kind,fuel,volume,testDrive=false){
  if(sendingLead)return;
  formOpener=document.activeElement;
  leadForm.reset();leadForm.dataset.kind=kind;
  const order=kind==='order',trial=order&&testDrive;
  leadForm.dataset.testDrive=String(trial);
  leadFields.hidden=false;leadSuccess.hidden=true;
  document.querySelector('#dialog-title').textContent=order?'Оформить заявку':'Заказать обратный звонок';
  document.querySelector('#lead-order-summary').hidden=!order;
  document.querySelector('#lead-payment-note').hidden=!order;
  document.querySelector('#lead-comment').open=false;
  leadForm.elements.volume.innerHTML=(trial?[testDriveProduct]:volumes).map(v=>`<option value="${v.ml}">${v.label} — ${money(v.price)}</option>`).join('');
  try{if(typeof window.ym==='function')window.ym(113548520,'reachGoal',order?'form_open_order':'form_open_callback');}catch{}
  document.querySelector('#terms-label').hidden=!order;
  leadForm.elements.terms.required=order;
  leadForm.elements.fuel.disabled=!order;leadForm.elements.volume.disabled=!order;
  leadForm.elements.fuel.value=fuel||selectedFuel.id;leadForm.elements.volume.value=trial?'15':volume||'250';
  const choice=orderChoice();
  document.querySelector('#lead-product-summary').textContent=order&&choice.product&&choice.fuel?(trial?`Syntonik TEST DRIVE · ${choice.product.label}`:`Syntonik · ${choice.fuel.name} · ${choice.product.label}`):'';
  document.querySelector('#lead-price-summary').textContent=order&&choice.product?money(choice.product.price):'';
  for(const field of ['name','phone','city'])leadForm.elements[field].setCustomValidity('');
  phoneError.hidden=true;phoneError.textContent='';leadForm.elements.phone.removeAttribute('aria-invalid');
  document.querySelector('#form-status').textContent='';dialog.showModal();leadForm.elements.name.focus();
}
document.addEventListener('click',event=>{
  const fuelButton=event.target.closest('[data-fuel]:not([data-order])');
  if(fuelButton){selectedFuel=fuels.find(f=>f.id===fuelButton.dataset.fuel);renderCatalog();document.querySelector(`#fuel-tabs [data-fuel="${selectedFuel.id}"]`).focus();}
  const calcFuelButton=event.target.closest('[data-calc-fuel]');
  if(calcFuelButton){calculatorFuel=fuels.find(f=>f.id===calcFuelButton.dataset.calcFuel);renderCalculatorTabs();document.querySelector(`[data-calc-fuel="${calculatorFuel.id}"]`).focus();}
  if(event.target.closest('[data-catalog]')){
    if(location.hash!=='#catalog')location.hash='catalog';
    else document.querySelector('#catalog').scrollIntoView({behavior:'smooth',block:'start'});
  }
  const order=event.target.closest('[data-order]');if(order)openForm('order',order.dataset.fuel,order.dataset.volume,order.hasAttribute('data-test-drive'));
  if(event.target.closest('[data-callback]'))openForm('callback');
});
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
document.querySelector('#close-lead-success').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(formOpener?.isConnected)formOpener.focus({preventScroll:true});});
dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const bounds=dialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
});
dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button,a[href],input,select,textarea,summary')].filter(e=>!e.disabled&&e.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){
    event.preventDefault();(event.shiftKey?last:first).focus();
  }
});
for(const field of ['name','city'])leadForm.elements[field].addEventListener('input',()=>leadForm.elements[field].setCustomValidity(''));
function validatePhone(){
  const phone=normaliseRuMobile(leadForm.elements.phone.value);
  const message=phone?'':'Проверьте номер: укажите 10 цифр после +7.';
  leadForm.elements.phone.setCustomValidity(message);
  phoneError.textContent=message;phoneError.hidden=Boolean(phone);
  if(phone)leadForm.elements.phone.removeAttribute('aria-invalid');else leadForm.elements.phone.setAttribute('aria-invalid','true');
  return phone;
}
leadForm.elements.phone.addEventListener('blur',validatePhone);
leadForm.elements.phone.addEventListener('input',()=>{if(!phoneError.hidden)validatePhone();});
leadForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sendingLead||!leadSuccess.hidden)return;
  for(const field of ['name','city'])leadForm.elements[field].value=leadForm.elements[field].value.trim();
  if(!leadForm.elements.name.value){leadForm.elements.name.setCustomValidity('Заполните поле.');leadForm.elements.name.reportValidity();leadForm.elements.name.focus();return;}
  const phone=validatePhone();
  if(!phone){leadForm.elements.phone.focus();return;}
  if(!leadForm.reportValidity())return;
  const status=document.querySelector('#form-status'),button=leadForm.querySelector('[type="submit"]');
  const fields=new FormData(leadForm),order=leadForm.dataset.kind==='order';
  const {trial,fuel,product:orderProduct}=orderChoice();
  if(order&&(!fuel||!orderProduct)){status.textContent='Выберите товар в каталоге и откройте заявку ещё раз.';return;}
  sendingLead=true;button.disabled=true;leadForm.setAttribute('aria-busy','true');status.textContent='Отправляем заявку…';
  try{
    const receipt=await submitLead({name:fields.get('name'),phone,city:fields.get('city'),comment:[fields.get('comment')||'',order&&trial?`Товар: ${testDriveProduct.name}`:'',order?`Цена упаковки: ${money(orderProduct.price)}`:''].filter(Boolean).join('\n'),
      form:leadForm.dataset.kind,page:window.location.href,...sessionUtms,
      consent:fields.get('consent')==='on',terms:fields.get('terms')==='on',
      fuel:order?fuel.name:'',volume:order?orderProduct.label:''});
    if(receipt?.success!==true)throw new Error('Lead was not saved');
    leadForm.reset();status.textContent='';leadFields.hidden=true;leadSuccess.hidden=false;
    document.querySelector('#dialog-title').textContent='Заявка отправлена!';document.querySelector('#close-lead-success').focus();
    try{if(typeof window.ym==='function')window.ym(113548520,'reachGoal',order?'lead_order_success':'lead_callback_success',{city:fields.get('city')||'',fuel:order?fuel.name:'',volume:order?orderProduct.label:''});}catch{}
  }catch{status.textContent='Не удалось отправить заявку. Попробуйте ещё раз.';}
  finally{sendingLead=false;button.disabled=false;leadForm.removeAttribute('aria-busy');}
});

document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link)return;
  const href=link.getAttribute('href')||'';
  try{
    if(typeof window.ym!=='function')return;
    if(href.startsWith('tel:'))window.ym(113548520,'reachGoal','click_phone');
    else if(href.startsWith('https://t.me/'))window.ym(113548520,'reachGoal','click_telegram');
    else if(href.startsWith('https://max.ru/'))window.ym(113548520,'reachGoal','click_max');
  }catch{}
});
