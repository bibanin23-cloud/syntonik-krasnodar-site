import {calculate} from './lib/calculator.js';
import {fuels,volumes} from './data/catalog.js';
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
const cars=[['Tenet T4','tenet.png'],['Haval F7','haval.jpg'],['Volkswagen Touareg','touareg.jfif'],['Hyundai Tucson','tucson.jpg'],['EXEED VX','exeed.png'],['Land Cruiser 200','land-cruiser.jfif']];
document.querySelector('#cars').innerHTML=cars.map(([name,file])=>`<article class="car"><img src="/assets/cars/${file}" alt="${name}" loading="lazy"><h3>${name}</h3></article>`).join('');
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

