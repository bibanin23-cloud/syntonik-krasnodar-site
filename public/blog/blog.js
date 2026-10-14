import * as leads from '/lib/leads.js';
import {LEAD_ENDPOINT} from '/lead-config.js';
import {cases,caseVideoEmbedUrl} from '/data/cases.js';

document.querySelector('.blog-toc details')?.toggleAttribute('open',!matchMedia('(max-width:900px)').matches);
const menu=document.querySelector('.blog-menu'),mobileMenu=matchMedia('(max-width:600px)');
function updateMenu(){if(menu)menu.open=!mobileMenu.matches;}
updateMenu();mobileMenu.addEventListener('change',updateMenu);
menu?.querySelector('nav').addEventListener('click',event=>{if(mobileMenu.matches&&event.target.closest('a'))menu.open=false;});

// The same counter and goal names as the existing site. No personal fields in events.
if(!window.ym){
  window.ym=function(){(window.ym.a=window.ym.a||[]).push(arguments);};window.ym.l=Date.now();
}
const counterUrl='https://mc.yandex.ru/metrika/tag.js?id=113548520';
if(!document.querySelector(`script[src="${counterUrl}"]`)){
  const tag=document.createElement('script');tag.async=true;tag.src=counterUrl;document.head.append(tag);
  window.ym(113548520,'init',{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});
}
function goal(name){try{window.ym(113548520,'reachGoal',name,{page:location.pathname});}catch{}}

const dialog=document.querySelector('#blog-lead-dialog'),form=document.querySelector('#blog-lead-form');
const fields=document.querySelector('#blog-lead-fields'),success=document.querySelector('#blog-lead-success');
const status=document.querySelector('#blog-form-status'),phoneError=document.querySelector('#blog-phone-error');
const emailError=document.querySelector('#blog-email-error');
const submit=leads.createLeadSubmitter(LEAD_ENDPOINT);
let pending=false,opener;
// Compatible with the currently published lead module, which predates this named export.
const normalisePhone=leads.normaliseRuMobile||((value)=>{
  const raw=value.replace(/^[ \u00a0\u202f]+|[ \u00a0\u202f]+$/g,'');
  if(!/^\+?[0-9 ()\-\u00a0\u202f]+$/.test(raw))return null;
  const compact=raw.replace(/[ ()\-\u00a0\u202f]/g,'');
  if(/^\+79\d{9}$/.test(compact))return compact;
  if(/^9\d{9}$/.test(compact))return '+7'+compact;
  if(/^[78]9\d{9}$/.test(compact))return '+7'+compact.slice(1);
  return null;
});
function validatePhone(){
  const phone=normalisePhone(form.elements.phone.value),message=phone?'':'Проверьте номер: укажите 10 цифр после +7.';
  form.elements.phone.setCustomValidity(message);phoneError.textContent=message;phoneError.hidden=Boolean(phone);
  if(phone)form.elements.phone.removeAttribute('aria-invalid');else form.elements.phone.setAttribute('aria-invalid','true');
  return phone;
}
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-callback]');if(!trigger||pending)return;
  opener=trigger;form.reset();fields.hidden=false;success.hidden=true;status.textContent='';
  document.querySelector('#blog-dialog-title').textContent='Получить консультацию';form.querySelector('details').open=false;
  for(const name of ['name','phone','email'])form.elements[name].setCustomValidity('');
  emailError.hidden=true;emailError.textContent='';form.elements.email.removeAttribute('aria-invalid');
  form.elements.phone.removeAttribute('aria-invalid');phoneError.hidden=true;phoneError.textContent='';
  dialog.showModal();form.elements.name.focus();goal('form_open_callback');
});
form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''));
form.elements.phone.addEventListener('blur',validatePhone);
form.elements.phone.addEventListener('input',()=>{if(!phoneError.hidden)validatePhone();});
form.elements.email.addEventListener('blur',()=>leads.validateOptionalEmail(form.elements.email,emailError));
form.elements.email.addEventListener('input',()=>{if(!emailError.hidden)leads.validateOptionalEmail(form.elements.email,emailError);});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(pending||!success.hidden)return;
  form.elements.name.value=form.elements.name.value.trim();form.elements.city.value=form.elements.city.value.trim();
  if(!form.elements.name.value){form.elements.name.setCustomValidity('Заполните поле.');form.elements.name.reportValidity();form.elements.name.focus();return;}
  const phone=validatePhone();if(!phone){form.elements.phone.focus();return;}
  if(!leads.validateOptionalEmail(form.elements.email,emailError)){form.elements.email.focus();return;}
  if(!form.reportValidity())return;
  const data=new FormData(form),button=form.querySelector('[type=submit]');pending=true;button.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Отправляем заявку…';
  try{
    const result=await submit({name:data.get('name'),phone,email:data.get('email'),city:data.get('city'),comment:data.get('comment'),form:'callback',page:location.href,...leads.sessionUtms,consent:data.get('consent')==='on',terms:false,fuel:'',volume:''});
    if(result?.success!==true)throw new Error('Lead was not saved');
    form.reset();fields.hidden=true;success.hidden=false;status.textContent='';document.querySelector('#blog-dialog-title').textContent='Заявка отправлена!';document.querySelector('#blog-close-success').focus();goal('lead_callback_success');
  }catch{status.textContent='Не удалось отправить заявку. Попробуйте ещё раз.';}
  finally{pending=false;button.disabled=false;form.removeAttribute('aria-busy');}
});
for(const id of ['blog-close-form','blog-close-success'])document.getElementById(id).addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});});
function closeOnBackdrop(event){if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)event.currentTarget.close();}
dialog.addEventListener('click',closeOnBackdrop);
dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button,a[href],input,textarea,summary')].filter(e=>!e.disabled&&e.getClientRects().length),first=controls[0],last=controls.at(-1);
  if((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first).focus();}
});

// Reuse the site's Rutube URL helper and dialog/player markup, including private access parameters.
const videoDialog=document.querySelector('#case-video-dialog'),player=document.querySelector('#case-video-player');let videoOpener;
if(videoDialog){
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-case-video]');if(!link)return;
    const item=cases.find(c=>c.id===link.dataset.caseVideo),src=caseVideoEmbedUrl(item?.videoUrl);if(!src)return;
    event.preventDefault();videoOpener=link;const frame=document.createElement('iframe');frame.src=src;frame.title='Видеоотзыв: '+item.model;frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;player.replaceChildren(frame);videoDialog.showModal();document.querySelector('#close-case-video').focus();
  });
  document.querySelector('#close-case-video').addEventListener('click',()=>videoDialog.close());videoDialog.addEventListener('click',closeOnBackdrop);
  videoDialog.addEventListener('close',()=>{player.replaceChildren();if(videoOpener?.isConnected)videoOpener.focus({preventScroll:true});});
}
