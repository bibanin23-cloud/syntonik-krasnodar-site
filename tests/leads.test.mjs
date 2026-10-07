import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {captureSessionUtms,createLeadSubmitter} from '../public/lib/leads.js';

const endpoint='https://script.google.com/macros/s/test/exec';
const lead={name:'  Тест  ',phone:' +79950000000 ',city:'Краснодар',form:'callback',page:'https://syntonik-krasnodar.ru/#dealer',consent:true};
const id='11111111-1111-4111-8111-111111111111';
const success=()=>({ok:true,json:async()=>({success:true})});
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};

test('first visit UTM survives a page change; absent fields stay empty',()=>{
  const store=storage();
  const first=captureSessionUtms('https://example.test/?utm_source=test&utm_campaign=one',store);
  assert.equal(first.utm_source,'test');assert.equal(first.utm_term,'');
  assert.deepEqual(captureSessionUtms('https://example.test/blog/?utm_source=other',store),first);
  assert.equal(captureSessionUtms('https://example.test/',storage()).utm_source,'');
});
test('UTM capture works when storage is blocked or contains invalid JSON',()=>{
  const blocked={getItem(){throw Error();},setItem(){throw Error();}};
  assert.equal(captureSessionUtms('https://example.test/?utm_medium=manual',blocked).utm_medium,'manual');
  const bad=storage();bad.setItem('syntonik:first-touch-utm','{');
  assert.equal(captureSessionUtms('https://example.test/?utm_source=new',bad).utm_source,'new');
});
test('one in-flight POST; clean data, no credentials and readable JSON receipt',async()=>{
  const calls=[];let finish;
  const submit=createLeadSubmitter(endpoint,{makeId:()=>id,now:()=> '2026-10-07T12:00:00.000Z',fetcher:(url,options)=>{calls.push({url,options});return new Promise(resolve=>finish=resolve);}});
  const first=submit(lead),second=submit(lead);assert.equal(first,second);
  await Promise.resolve();assert.equal(calls.length,1);
  const {url,options}=calls[0],body=JSON.parse(options.body);
  assert.equal(url,endpoint);assert.equal(options.method,'POST');assert.match(options.headers['Content-Type'],/^text\/plain/);
  assert.equal(options.mode,'cors');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'follow');
  assert.equal(body.name,'Тест');assert.equal(body.phone,'+79950000000');assert.equal(body.request_id,id);assert.equal(body.utm_term,'');
  assert.equal(body.timestamp,'2026-10-07T12:00:00.000Z');
  finish(success());assert.equal((await first).success,true);
});
test('ambiguous network failure reuses request ID; success permits a new ID',async()=>{
  const ids=[];let count=0,attempt=0;
  const submit=createLeadSubmitter(endpoint,{makeId:()=> 'request-id-'+(++count),fetcher:async(url,options)=>{
    ids.push(JSON.parse(options.body).request_id);if(attempt++===0)throw Error('connection lost');return success();
  }});
  await assert.rejects(submit(lead));await submit(lead);await submit(lead);
  assert.deepEqual(ids,['request-id-1','request-id-1','request-id-2']);
});
test('missing endpoint, whitespace-only name/contact and missing consent never send',()=>{
  let calls=0;const submit=createLeadSubmitter(endpoint,{fetcher:()=>calls++});
  assert.throws(()=>createLeadSubmitter('')(lead));
  for(const data of [{...lead,name:'   '},{...lead,phone:'  '},{...lead,consent:false}])assert.throws(()=>submit(data));
  assert.equal(calls,0);
});
test('HTTP errors, server rejection and unreadable JSON are not successes',async()=>{
  for(const response of [{ok:false},{ok:true,json:async()=>({success:false})},{ok:true,json:async()=>{throw Error('JSON');}}]){
    const submit=createLeadSubmitter(endpoint,{makeId:()=>id,fetcher:async()=>response});
    await assert.rejects(submit(lead));
  }
});
test('oversized values are limited before transmission',async()=>{
  let body;const submit=createLeadSubmitter(endpoint,{makeId:()=>id,fetcher:async(url,options)=>{body=JSON.parse(options.body);return success();}});
  await submit({...lead,name:'x'.repeat(200),comment:'x'.repeat(5000),utm_source:'x'.repeat(1000)});
  assert.equal(body.name.length,80);assert.equal(body.comment.length,1000);assert.equal(body.utm_source.length,200);
});

const source=await readFile(new URL('../integrations/apps-script/Code.gs',import.meta.url),'utf8');
function scriptHarness({failSheet=false,failTelegram=false,failMax=false,config={}}={}){
  const rows=[],notes=[],calls=[],warnings=[];
  const sheet={getLastRow:()=>rows.length,setFrozenRows(){},getRange(row,col,height,width){return {
    setValues(values){for(let n=0;n<height;n++){rows[row+n-1]??=[];for(let c=0;c<width;c++)rows[row+n-1][col+c-1]=values[n][c];}return this;},
    setNumberFormat(){return this;},setNote(value){notes[row-1]??=[];notes[row-1][col-1]=value;return this;},
    getNotes(){return Array.from({length:height},(_,n)=>[notes[row+n-1]?.[col-1]||'']);}
  };}};
  const properties={GOOGLE_SHEET_ID:'test-sheet',TELEGRAM_BOT_TOKEN:'fake-telegram-token',TELEGRAM_CHAT_ID:'123',MAX_BOT_TOKEN:'fake-max-token',MAX_CHAT_ID:'456',...config};
  const context={
    PropertiesService:{getScriptProperties:()=>({getProperties:()=>properties})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    SpreadsheetApp:{openById(){if(failSheet)throw Error('sheet failure');return {getSheetByName:()=>sheet,insertSheet:()=>sheet};},flush(){}},
    Utilities:{formatDate:()=> '07.10.2026 15:00:00'},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},
    UrlFetchApp:{fetch(url,options){calls.push({url,options});const telegram=url.includes('api.telegram.org');if(telegram?failTelegram:failMax)throw Error('fake-secret must not leak');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(telegram?{ok:true}:{message:{body:{mid:'1'}}})};}},
    console:{warn:text=>warnings.push(text),log(){}},
  };
  vm.createContext(context);vm.runInContext(source,context);
  return {context,rows,notes,calls,warnings,post:(data={})=>context.doPost({postData:{contents:JSON.stringify({...lead,request_id:id,...data})}})};
}
test('one lead saves the required 12 columns and reaches both independent APIs',()=>{
  const h=scriptHarness(),receipt=h.post({city:'Краснодар',form:'order',terms:true,fuel:'Бензин',volume:'250 мл',utm_source:'test'});
  assert.equal(receipt.success,true);assert.equal(receipt.notifications.telegram,'sent');assert.equal(receipt.notifications.max,'sent');
  assert.equal(h.rows.length,2);assert.equal(h.rows[0].length,12);assert.equal(h.rows[1].length,12);
  assert.equal(h.rows[1][0],'07.10.2026 15:00:00');assert.equal(h.rows[1][1],'Тест');assert.equal(h.rows[1][11],'Новая');
  assert.match(h.rows[1][3],/Город: Краснодар\nТопливо: Бензин\nОбъём: 250 мл/);assert.equal(h.rows[1][6],'test');
  assert.equal(h.calls.length,2);assert.match(h.calls[1].url,/^https:\/\/platform-api2\.max\.ru\/messages\?chat_id=456/);
  assert.equal(h.calls[1].options.headers.Authorization,'fake-max-token');
});
test('retry with the same request ID never adds a row or sends duplicate notifications',()=>{
  const h=scriptHarness();h.post();const duplicate=h.post();
  assert.equal(duplicate.success,true);assert.equal(duplicate.duplicate,true);assert.equal(h.rows.length,2);assert.equal(h.calls.length,2);
});
test('either messenger may fail without losing Sheets or stopping the other one',()=>{
  for(const options of [{failTelegram:true},{failMax:true},{failTelegram:true,failMax:true}]){
    const h=scriptHarness(options),result=h.post();
    assert.equal(result.success,true);assert.equal(h.rows.length,2);assert.equal(h.calls.length,2);
    assert.equal(result.notifications.telegram,options.failTelegram?'failed':'sent');assert.equal(result.notifications.max,options.failMax?'failed':'sent');
    assert.equal(JSON.stringify(result).includes('fake-secret'),false);assert.equal(h.warnings.join('').includes('fake-secret'),false);
  }
});
test('Sheets failure or invalid lead produces an error and no messages',()=>{
  const broken=scriptHarness({failSheet:true});assert.equal(broken.post().success,false);assert.equal(broken.calls.length,0);
  const h=scriptHarness();
  for(const data of [{name:'  '},{phone:''},{consent:false},{form:'order',terms:false},{request_id:'bad'},{form:'unknown'}])assert.equal(h.post(data).success,false);
  assert.equal(h.rows.length,0);assert.equal(h.calls.length,0);
});
test('spreadsheet formulas are escaped; message text remains literal',()=>{
  const h=scriptHarness();h.post({name:'=IMPORTXML("example")',comment:'<b>plain text</b>'});
  assert.equal(h.rows[1][1][0],"'");
  for(const call of h.calls){const payload=JSON.parse(call.options.payload);assert.ok(payload.text.includes('<b>plain text</b>'));assert.equal(payload.parse_mode,undefined);assert.equal(payload.format,undefined);}
});
test('MAX user address and independently disabled MAX channel',()=>{
  const user=scriptHarness({config:{MAX_CHAT_ID:'',MAX_USER_ID:'789'}});user.post();assert.match(user.calls[1].url,/user_id=789/);
  const disabled=scriptHarness({config:{MAX_ENABLED:'false'}});assert.equal(disabled.post().notifications.max,'disabled');assert.equal(disabled.calls.length,1);
});
test('maximum allowed lead fits both messenger limits with date intact',()=>{
  const h=scriptHarness();const data=h.context.normalizeLead({...lead,name:'x'.repeat(80),phone:'x'.repeat(80),comment:'x'.repeat(1000),city:'x'.repeat(100),fuel:'x'.repeat(40),volume:'x'.repeat(40),page:'https://example.test/'+ 'x'.repeat(980),request_id:id,...Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(k=>[k,'x'.repeat(200)]))});
  data.timestamp='07.10.2026 15:00:00';const message=h.context.leadMessage(data);assert.ok(message.length<=4000);assert.ok(message.endsWith(data.timestamp));
});

const appSource=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function formHarness(send){
  const handlers={},button={disabled:false},status={textContent:''},note={hidden:false};
  const control=(value='')=>({value,disabled:false,setCustomValidity(){},reportValidity:()=>true,addEventListener(){}});
  const elements={name:control(' Тест '),phone:control(' +79950000000 '),city:control(' Краснодар '),fuel:control('petrol'),volume:control('250'),consent:control('on'),terms:control('on')};
  const form={elements,dataset:{kind:'callback'},attributes:{},reportValidity:()=>true,
    querySelector:()=>button,addEventListener:(name,handler)=>handlers[name]=handler,
    setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
    reset(){for(const field of ['name','phone','city'])elements[field].value='';}
  };
  const dialog={addEventListener(){},close(){},showModal(){}};
  const targets={'#lead-dialog':dialog,'#lead-form':form,'#lead-setup-note':note,'#form-status':status,'#close-dialog':{addEventListener(){}}};
  const context={document:{querySelector:s=>targets[s],addEventListener(){}},window:{location:{href:'https://example.test/'}},LEAD_ENDPOINT:endpoint,
    createLeadSubmitter:()=>send,sessionUtms:{utm_source:'test'},fuels:[{id:'petrol',name:'Бензин'}],volumes:[{ml:250,label:'250 мл',price:7100}],money:n=>String(n),
    FormData:class{constructor(form){this.form=form;}get(field){return this.form.elements[field]?.value??null;}}
  };
  vm.createContext(context);vm.runInContext(appSource.slice(appSource.indexOf("const dialog=document.querySelector('#lead-dialog')")),context);
  return {form,button,status,note,submit:()=>handlers.submit({preventDefault(){}})};
}
test('existing form blocks double clicks, shows sending, resets on success and unlocks',async()=>{
  let done,calls=0,payload;
  const h=formHarness(data=>{calls++;payload=data;return new Promise(resolve=>done=resolve);});
  const first=h.submit();await h.submit();assert.equal(calls,1);assert.equal(h.button.disabled,true);assert.equal(h.form.attributes['aria-busy'],'true');assert.equal(h.status.textContent,'Отправляем заявку…');
  assert.equal(payload.city,'Краснодар');assert.equal(payload.form,'callback');assert.equal(payload.fuel,'');assert.equal(payload.utm_source,'test');
  done({success:true});await first;assert.equal(h.form.elements.name.value,'');assert.equal(h.button.disabled,false);assert.equal(h.status.textContent,'Спасибо! Заявка отправлена.');assert.equal(h.note.hidden,true);
});
test('existing form preserves entered data on failure and passes selected order fields',async()=>{
  let payload;const h=formHarness(data=>{payload=data;throw Error('network');});h.form.dataset.kind='order';
  await h.submit();assert.equal(h.form.elements.name.value,'Тест');assert.equal(h.button.disabled,false);assert.equal(h.status.textContent,'Не удалось отправить заявку. Попробуйте ещё раз.');
  assert.equal(payload.fuel,'Бензин');assert.equal(payload.volume,'250 мл');assert.equal(payload.consent,true);assert.equal(payload.terms,true);
});
