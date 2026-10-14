export const UTM_FIELDS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const clean = (value,limit) => String(value ?? '').trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,limit);

// HTML type=email syntax, also usable without a DOM in the shared transport.
export function normaliseOptionalEmail(value){
  if(value==null)return '';
  if(typeof value!=='string')throw new Error('Invalid email');
  const email=value.trim();
  if(email.length>254||(email&&!/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email)))throw new Error('Invalid email');
  return email;
}

export function validateOptionalEmail(input,error){
  input.value=input.value.trim();input.setCustomValidity('');
  const valid=!input.value||(!input.validity.typeMismatch&&!input.validity.tooLong&&input.value.length<=254);
  const message=valid?'':'Проверьте адрес электронной почты';
  input.setCustomValidity(message);error.textContent=message;error.hidden=valid;
  if(valid)input.removeAttribute('aria-invalid');else input.setAttribute('aria-invalid','true');
  return valid;
}

export function normaliseRuMobile(value){
  if(typeof value!=='string')return null;
  const text=value.replace(/^[ \u00a0\u202f]+|[ \u00a0\u202f]+$/g,'');
  if(!/^\+?[0-9 ()\-\u00a0\u202f]+$/.test(text))return null;
  const compact=text.replace(/[ ()\-\u00a0\u202f]/g,'');
  if(/^\+79\d{9}$/.test(compact))return compact;
  if(/^9\d{9}$/.test(compact))return '+7'+compact;
  if(/^[78]9\d{9}$/.test(compact))return '+7'+compact.slice(1);
  return null;
}

export function captureSessionUtms(url,storage){
  const key='syntonik:first-touch-utm';
  try{
    const saved=JSON.parse(storage.getItem(key));
    if(saved && typeof saved==='object' && !Array.isArray(saved)){
      return Object.fromEntries(UTM_FIELDS.map(field=>[field,clean(saved[field],200)]));
    }
  }catch{}
  const params=new URL(url).searchParams;
  const utms=Object.fromEntries(UTM_FIELDS.map(field=>[field,clean(params.get(field),200)]));
  try{storage.setItem(key,JSON.stringify(utms));}catch{}
  return utms;
}

let sessionUtms={};
if(typeof window!=='undefined'){
  let storage;
  try{storage=window.sessionStorage;}catch{}
  sessionUtms=captureSessionUtms(window.location.href,storage);
}
export {sessionUtms};

export function createLeadSubmitter(endpoint,{fetcher=globalThis.fetch,makeId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
  let pending, retry;
  return function submitLead(data){
    if(pending)return pending;
    if(!endpoint)throw new Error('LEAD_ENDPOINT is not configured');
    const lead={};
    for(const [field,limit] of Object.entries({name:80,comment:1000,form:80,page:1000,city:100,fuel:40,volume:40}))lead[field]=clean(data[field],limit);
    lead.phone=normaliseRuMobile(data.phone);
    lead.email=normaliseOptionalEmail(data.email);
    for(const field of UTM_FIELDS)lead[field]=clean(data[field],200);
    lead.consent=data.consent===true;
    lead.terms=data.terms===true;
    if(!lead.name||!lead.phone||!lead.form||!/^https?:\/\//.test(lead.page)||!lead.consent)throw new Error('Invalid lead');
    if(lead.form==='order'&&!lead.terms)throw new Error('Invalid order terms');
    const fingerprint=JSON.stringify(lead);
    if(retry?.fingerprint!==fingerprint)retry={fingerprint,id:makeId(),timestamp:now()};
    const payload={...lead,request_id:retry.id,timestamp:retry.timestamp};
    pending=Promise.resolve().then(()=>fetcher(endpoint,{
      method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(payload),mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',
      signal:AbortSignal.timeout(55000)
    })).then(async response=>{
      if(!response.ok)throw new Error('Lead request failed');
      const result=await response.json();
      if(result.success!==true)throw new Error('Lead was not saved');
      retry=undefined;
      return result;
    }).finally(()=>{pending=undefined;});
    return pending;
  };
}
