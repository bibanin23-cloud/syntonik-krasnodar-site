import {calculate} from './lib/calculator.js';
import {fuels,volumes} from './data/catalog.js';
import {cases,caseVideoEmbedUrl} from './data/cases.js';
import {LEAD_ENDPOINT} from './lead-config.js';
import {createLeadSubmitter,sessionUtms} from './lib/leads.js';
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
  const data=new FormData(calcForm), target=document.querySelector('#calc-result'), comparison=document.querySelector('#comparison');
  if(!calcForm.checkValidity()){target.textContent='Введите корректные расход, пробег и цену топлива.';comparison.replaceChildren();return;}
  try{
    const c=Number(data.get('consumption')),m=Number(data.get('mileage')),p=Number(data.get('price')),s=Number(data.get('scenario'));
    const result=calculate(c,m,p,s);
    target.innerHTML=`<div class="net-savings"><div><strong class="money">${money(result.netMonthlySavings)}</strong><span class="period">в месяц</span></div><p class="year-savings">Чистая экономия в год — <strong>${money(result.netYearlySavings)}</strong></p><div class="net-breakdown"><p>Экономия на топливе — <strong>${money(result.monthlySavings)}</strong></p><p>Стоимость Syntonik — <strong>${money(result.syntonikCostMonth)}</strong></p></div><div class="calc-metrics"><div><strong>${number(result.fuelBefore)}</strong><span>л сейчас / месяц</span></div><div><strong>${number(result.fuelAfter)}</strong><span>л после / месяц</span></div><div><strong>${number(result.monthlySavings)}</strong><span>₽ на топливе</span></div><div><strong>${number(result.syntonikCostMonth)}</strong><span>₽ Syntonik</span></div></div><div class="calc-extra"><span>Расход до → после</span><strong>${number(c)} → ${number(result.consumptionAfter)} л/100 км</strong></div><div class="calc-extra"><span>Расход Syntonik в год</span><strong>${number(result.syntonikMlYear)} мл</strong></div></div>`;
    comparison.innerHTML=[0.1,0.2,0.3].map(r=>{const v=calculate(c,m,p,r);return `<tr class="${r===s?'selected':''}"><th scope="row">${r*100}%</th><td>${money(v.netMonthlySavings)}</td><td>${money(v.netYearlySavings)}</td><td>${number(v.syntonikMlYear)} мл</td></tr>`}).join('');
  }catch{target.textContent='Проверьте исходные данные.';comparison.replaceChildren();}
}
calcForm.addEventListener('input',updateCalculator);updateCalculator();
let selectedFuel=fuels[0];
let calculatorFuel=fuels[0];
function renderCalculatorTabs(){document.querySelector('#calculator-tabs').innerHTML=fuels.map(f=>`<button type="button" data-calc-fuel="${f.id}" aria-pressed="${calculatorFuel.id===f.id}">${f.name}</button>`).join('');}
renderCalculatorTabs();
function renderCatalog(){
  document.querySelector('#fuel-tabs').innerHTML=fuels.map(f=>`<button data-fuel="${f.id}" aria-pressed="${selectedFuel.id===f.id}">${f.name}</button>`).join('');
  document.querySelector('#products').innerHTML=volumes.map(v=>`<article class="product" aria-label="Syntonik ${selectedFuel.name}, ${v.label}"><div class="product-photo photo-${v.ml}"><img src="/assets/products/${selectedFuel.id}-${v.ml}.png" width="1122" height="1402" loading="lazy" alt="Syntonik ${selectedFuel.name}, ${v.label}"></div><h3>${v.label}</h3><p class="fuel-capacity">до ${number(v.ml*10)} л топлива</p><strong class="product-price">${money(v.price)}</strong><button data-order data-volume="${v.ml}" data-fuel="${selectedFuel.id}" aria-label="Заказать Syntonik ${selectedFuel.name}, ${v.label}">Заказать</button></article>`).join('');
}
renderCatalog();
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
const dialog=document.querySelector('#lead-dialog'),leadForm=document.querySelector('#lead-form');
const submitLead=createLeadSubmitter(LEAD_ENDPOINT);
document.querySelector('#lead-setup-note').hidden=Boolean(LEAD_ENDPOINT);
let sendingLead=false;
let formOpener;
leadForm.elements.fuel.innerHTML=fuels.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
leadForm.elements.volume.innerHTML=volumes.map(v=>`<option value="${v.ml}">${v.label} — ${money(v.price)}</option>`).join('');
function openForm(kind,fuel,volume){
  if(sendingLead)return;
  formOpener=document.activeElement;
  leadForm.reset();leadForm.dataset.kind=kind;
  const order=kind==='order';
  document.querySelector('#dialog-title').textContent=order?'Заказать Syntonik':'Обратный звонок';
  try{if(typeof window.ym==='function')window.ym(113548520,'reachGoal',order?'form_open_order':'form_open_callback');}catch{}
  document.querySelector('#order-fields').hidden=!order;
  document.querySelector('#terms-label').hidden=!order;
  leadForm.elements.terms.required=order;
  leadForm.elements.fuel.disabled=!order;leadForm.elements.volume.disabled=!order;
  leadForm.elements.fuel.value=fuel||selectedFuel.id;leadForm.elements.volume.value=volume||'250';
  for(const field of ['name','phone','city'])leadForm.elements[field].setCustomValidity('');
  document.querySelector('#form-status').textContent='';dialog.showModal();
}
document.addEventListener('click',event=>{
  const fuelButton=event.target.closest('[data-fuel]:not([data-order])');
  if(fuelButton){selectedFuel=fuels.find(f=>f.id===fuelButton.dataset.fuel);renderCatalog();document.querySelector(`#fuel-tabs [data-fuel="${selectedFuel.id}"]`).focus();}
  const calcFuelButton=event.target.closest('[data-calc-fuel]');
  if(calcFuelButton){calculatorFuel=fuels.find(f=>f.id===calcFuelButton.dataset.calcFuel);renderCalculatorTabs();document.querySelector(`[data-calc-fuel="${calculatorFuel.id}"]`).focus();}
  const order=event.target.closest('[data-order]');if(order)openForm('order',order.dataset.fuel,order.dataset.volume);
  if(event.target.closest('[data-callback]'))openForm('callback');
});
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(formOpener?.isConnected)formOpener.focus();});
for(const field of ['name','phone','city'])leadForm.elements[field].addEventListener('input',()=>leadForm.elements[field].setCustomValidity(''));
leadForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sendingLead)return;
  for(const field of ['name','phone','city']){
    const input=leadForm.elements[field];input.value=input.value.trim();
    if(!input.value){input.setCustomValidity('Заполните поле.');input.reportValidity();return;}
  }
  const digits=leadForm.elements.phone.value.replace(/\D/g,'');
  if(digits.length<10||digits.length>15){leadForm.elements.phone.setCustomValidity('Введите телефон: от 10 до 15 цифр.');leadForm.elements.phone.reportValidity();return;}
  if(!leadForm.reportValidity())return;
  const status=document.querySelector('#form-status'),button=leadForm.querySelector('[type="submit"]');
  const fields=new FormData(leadForm),order=leadForm.dataset.kind==='order';
  sendingLead=true;button.disabled=true;leadForm.setAttribute('aria-busy','true');status.textContent='Отправляем заявку…';
  try{
    await submitLead({name:fields.get('name'),phone:fields.get('phone'),city:fields.get('city'),comment:fields.get('comment')||'',
      form:leadForm.dataset.kind,page:window.location.href,...sessionUtms,
      consent:fields.get('consent')==='on',terms:fields.get('terms')==='on',
      fuel:order?fuels.find(f=>f.id===fields.get('fuel'))?.name||'':'',
      volume:order?volumes.find(v=>String(v.ml)===fields.get('volume'))?.label||'':''});
    leadForm.reset();status.textContent='Спасибо! Заявка отправлена.';
    try{if(typeof window.ym==='function')window.ym(113548520,'reachGoal',order?'lead_order_success':'lead_callback_success',{city:fields.get('city')||'',fuel:order?(fuels.find(f=>f.id===fields.get('fuel'))?.name||''):'',volume:order?(volumes.find(v=>String(v.ml)===fields.get('volume'))?.label||''):''});}catch{}
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
