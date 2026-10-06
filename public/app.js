import {calculate} from './lib/calculator.js';
import {fuels,volumes} from './data/catalog.js';
import {cases} from './data/cases.js';
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
    target.innerHTML=`<div class="result-card"><p>Экономия на топливе в месяц · ${number(s*100)}%</p><div class="money">${money(result.monthlySavings)}</div><div class="result-row"><span>Экономия в год</span><strong>${money(result.yearlySavings)}</strong></div><div class="result-row"><span>Расход до → после</span><strong>${number(c)} → ${number(result.consumptionAfter)} л/100 км</strong></div><div class="result-row"><span>Топливо в месяц до → после</span><strong>${number(result.fuelBefore)} → ${number(result.fuelAfter)} л</strong></div><div class="result-row"><span>Syntonik в год</span><strong>${number(result.syntonikMlYear)} мл</strong></div></div>`;
    comparison.innerHTML=[0.1,0.2,0.3].map(r=>{const v=calculate(c,m,p,r);return `<tr class="${r===s?'selected':''}"><th scope="row">${r*100}%</th><td>${money(v.monthlySavings)}</td><td>${money(v.yearlySavings)}</td><td>${number(v.syntonikMlYear)} мл</td></tr>`}).join('');
  }catch{target.textContent='Проверьте исходные данные.';comparison.replaceChildren();}
}
calcForm.addEventListener('input',updateCalculator);updateCalculator();
let selectedFuel=fuels[0];
function renderCatalog(){
  document.querySelector('#fuel-tabs').innerHTML=fuels.map(f=>`<button data-fuel="${f.id}" aria-pressed="${selectedFuel.id===f.id}">${f.name}</button>`).join('');
  document.querySelector('#products').innerHTML=volumes.map(v=>`<article class="product">${v.ml===250&&selectedFuel.image?`<img src="${selectedFuel.image}" width="1122" height="1402" loading="lazy" alt="Syntonik ${selectedFuel.name}, ${v.label}">`:`<div class="product-placeholder">${selectedFuel.id==='mazut'?'Мазут — изображение готовится':'Фото фасовки '+v.label+' готовится'}</div>`}<p class="muted">${selectedFuel.name}</p><h3>${v.label}</h3><strong>${money(v.price)}</strong><button data-order data-volume="${v.ml}" data-fuel="${selectedFuel.id}">Заказать →</button></article>`).join('');
}
renderCatalog();
const caseNumber=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
const caseMileage=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const casePlay='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15"/><path d="m12 9 11 7-11 7Z"/></svg>';
document.querySelector('#cars').innerHTML=cases.map(c=>{
  const difference=c.before-c.after, percent=difference/c.before*100;
  const video=c.videoUrl?.startsWith('https://rutube.ru/')
    ? `<a class="case-video" href="${c.videoUrl}" target="_blank" rel="noopener" aria-label="Смотреть видео: ${c.model}">${casePlay}<span>Смотреть видео</span></a>`
    : `<button class="case-video" type="button" disabled aria-label="Видео: ${c.model} — скоро появится">${casePlay}<span>Видео скоро появится</span></button>`;
  return `<article class="case-card" data-case-id="${c.id}" aria-labelledby="case-title-${c.id}"><div class="case-top"><div class="case-info"><p class="case-fuel">${c.fuel}</p><h3 id="case-title-${c.id}">${c.model}</h3><p class="case-meta">${c.year} · <span>${caseMileage.format(c.mileage)} км</span></p><p class="case-route">${c.route}</p></div><img class="case-car" src="${c.image}" width="${c.imageWidth||1536}" height="${c.imageHeight||1024}" alt="${c.model}" loading="lazy"></div><div class="case-consumption"><span class="case-sr-only">Расход до:</span><strong>${caseNumber.format(c.before)}</strong><span class="case-arrow" aria-hidden="true">→</span><span class="case-sr-only">После:</span><strong class="case-after">${caseNumber.format(c.after)}</strong><span class="case-unit">л / 100 км</span></div><div class="case-saving"><p class="case-difference"><strong>−${caseNumber.format(difference)}</strong><span>л / 100 км</span></p><p class="case-percent"><span>Экономия</span><strong>${caseNumber.format(percent)}%</strong></p></div>${video}</article>`;
}).join('');
const dialog=document.querySelector('#lead-dialog'),leadForm=document.querySelector('#lead-form');
leadForm.elements.fuel.innerHTML=fuels.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
leadForm.elements.volume.innerHTML=volumes.map(v=>`<option value="${v.ml}">${v.label} — ${money(v.price)}</option>`).join('');
function openForm(kind,fuel,volume){
  leadForm.reset();leadForm.dataset.kind=kind;
  const order=kind==='order';
  document.querySelector('#dialog-title').textContent=order?'Заказать Syntonik':'Обратный звонок';
  document.querySelector('#order-fields').hidden=!order;
  document.querySelector('#terms-label').hidden=!order;
  leadForm.elements.terms.required=order;
  leadForm.elements.fuel.disabled=!order;leadForm.elements.volume.disabled=!order;
  leadForm.elements.fuel.value=fuel||selectedFuel.id;leadForm.elements.volume.value=volume||'250';
  leadForm.elements.phone.setCustomValidity('');document.querySelector('#form-status').textContent='';dialog.showModal();
}
document.addEventListener('click',event=>{
  const fuelButton=event.target.closest('[data-fuel]:not([data-order])');
  if(fuelButton){selectedFuel=fuels.find(f=>f.id===fuelButton.dataset.fuel);renderCatalog();document.querySelector(`[data-fuel="${selectedFuel.id}"]`).focus();}
  const order=event.target.closest('[data-order]');if(order)openForm('order',order.dataset.fuel,order.dataset.volume);
  if(event.target.closest('[data-callback]'))openForm('callback');
});
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
leadForm.elements.phone.addEventListener('input',()=>leadForm.elements.phone.setCustomValidity(''));
leadForm.addEventListener('submit',event=>{
  event.preventDefault();const digits=leadForm.elements.phone.value.replace(/\D/g,'');
  if(digits.length<10||digits.length>15){leadForm.elements.phone.setCustomValidity('Введите телефон: от 10 до 15 цифр.');leadForm.elements.phone.reportValidity();return;}
  document.querySelector('#form-status').textContent='Данные заполнены. Онлайн-заявка не отправлена: приём заявок ещё не подключён. Позвоните Игорю или напишите в Telegram.';
});

