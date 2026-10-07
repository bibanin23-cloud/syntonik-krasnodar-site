// Copy into Google Apps Script. Configure IDs and tokens in Script Properties.
const LEAD_HEADERS = ['Дата и время','Имя','Телефон / контакт','Комментарий','Форма','Страница','utm_source','utm_medium','utm_campaign','utm_content','utm_term','Статус'];
const LEAD_UTMS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];

function doPost(e){
  let lock;
  try{
    if(!e || !e.postData || e.postData.contents.length>20000)throw new Error('request');
    const data=normalizeLead(JSON.parse(e.postData.contents));
    const config=PropertiesService.getScriptProperties().getProperties();
    if(!config.GOOGLE_SHEET_ID)throw new Error('configuration');
    lock=LockService.getScriptLock();
    lock.waitLock(30000);
    const book=SpreadsheetApp.openById(config.GOOGLE_SHEET_ID);
    const sheet=book.getSheetByName(config.SHEET_NAME||'Заявки')||book.insertSheet(config.SHEET_NAME||'Заявки');
    const lastRow=sheet.getLastRow();
    // Keep the required 12 columns. The request ID lives in a status-cell note.
    if(lastRow>1 && sheet.getRange(2,12,lastRow-1,1).getNotes().some(row=>row[0]===data.request_id)){
      return leadJson({success:true,duplicate:true});
    }
    if(!lastRow){sheet.getRange(1,1,1,12).setValues([LEAD_HEADERS]);sheet.setFrozenRows(1);}
    data.timestamp=Utilities.formatDate(new Date(),'Europe/Moscow','dd.MM.yyyy HH:mm:ss');
    const row=sheet.getLastRow()+1;
    const values=[data.timestamp,data.name,data.phone,data.comment,data.form,data.page,...LEAD_UTMS.map(field=>data[field]),'Новая'];
    sheet.getRange(row,1,1,12).setNumberFormat('@').setValues([values.map(sheetText)]);
    sheet.getRange(row,12).setNote(data.request_id);
    SpreadsheetApp.flush();
    lock.releaseLock();lock=null;
    // A messenger failure never changes the successful Sheets receipt.
    const notifications={};
    for(const [channel,send] of [['telegram',sendToTelegram],['max',sendToMax]]){
      try{notifications[channel]=send(data,config);}catch{notifications[channel]='failed';console.warn(channel+' notification failed');}
    }
    return leadJson({success:true,notifications});
  }catch{
    return leadJson({success:false,error:'Не удалось сохранить заявку. Проверьте данные и настройки обработчика.'});
  }finally{if(lock)lock.releaseLock();}
}

function doGet(){return leadJson({success:true,service:'Syntonik leads'});}
function leadJson(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function leadText(value,limit){
  if(value!=null && typeof value!=='string')throw new Error('field');
  return (value||'').trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,limit);
}
function normalizeLead(input){
  if(!input || Array.isArray(input) || typeof input!=='object')throw new Error('data');
  const data={};
  for(const [field,limit] of Object.entries({name:80,phone:80,comment:1000,form:80,page:1000,city:100,fuel:40,volume:40,request_id:80}))data[field]=leadText(input[field],limit);
  for(const field of LEAD_UTMS)data[field]=leadText(input[field],200);
  if(!data.name||!data.phone||!['order','callback'].includes(data.form)||!/^https?:\/\/[^\s]+$/.test(data.page)||! /^[a-zA-Z0-9-]{16,80}$/.test(data.request_id)||input.consent!==true)throw new Error('validation');
  if(data.form==='order' && input.terms!==true)throw new Error('terms');
  data.comment=[data.comment,data.city?'Город: '+data.city:'',data.fuel?'Топливо: '+data.fuel:'',data.volume?'Объём: '+data.volume:''].filter(Boolean).join('\n');
  return data;
}
function sheetText(value){return /^[=+\-@]/.test(value)?"'"+value:value;}
function leadMessage(data){
  const labels=[['Имя',data.name],['Телефон',data.phone],['Комментарий',data.comment],['Форма',data.form==='order'?'Заказ Syntonik':'Обратный звонок'],['Страница',data.page],['Источник',data.utm_source],['Канал',data.utm_medium],['Кампания',data.utm_campaign],['Контент',data.utm_content],['Ключевое слово',data.utm_term],['Дата',data.timestamp]];
  // Plain text: user input cannot introduce Telegram/MAX markup.
  return '🔔 Новая заявка с сайта Syntonik\n\n'+labels.filter(item=>item[1]).map(item=>item[0]+': '+item[1]).join('\n');
}
function sendToTelegram(data,config){
  if(config.TELEGRAM_ENABLED==='false')return 'disabled';
  if(!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID)throw new Error('telegram configuration');
  const response=UrlFetchApp.fetch('https://api.telegram.org/bot'+config.TELEGRAM_BOT_TOKEN+'/sendMessage',{
    method:'post',contentType:'application/json',muteHttpExceptions:true,
    payload:JSON.stringify({chat_id:config.TELEGRAM_CHAT_ID,text:leadMessage(data).slice(0,4000),link_preview_options:{is_disabled:true}})
  });
  if(response.getResponseCode()!==200 || JSON.parse(response.getContentText()).ok!==true)throw new Error('telegram delivery');
  return 'sent';
}
function sendToMax(data,config){
  if(config.MAX_ENABLED==='false')return 'disabled';
  const recipient=config.MAX_CHAT_ID?['chat_id',config.MAX_CHAT_ID]:['user_id',config.MAX_USER_ID];
  if(!config.MAX_BOT_TOKEN || !recipient[1] || !/^-?\d+$/.test(recipient[1]))throw new Error('max configuration');
  const response=UrlFetchApp.fetch('https://platform-api2.max.ru/messages?'+recipient[0]+'='+encodeURIComponent(recipient[1])+'&disable_link_preview=true',{
    method:'post',contentType:'application/json',headers:{Authorization:config.MAX_BOT_TOKEN},muteHttpExceptions:true,
    payload:JSON.stringify({text:leadMessage(data).slice(0,4000)})
  });
  if(response.getResponseCode()!==200 || !JSON.parse(response.getContentText()).message)throw new Error('max delivery');
  return 'sent';
}

// Run manually after starting the two bots. Logs IDs only, never bot tokens.
function showRecipientIds(){
  const config=PropertiesService.getScriptProperties().getProperties();
  for(const channel of ['telegram','max']){
    try{
      if(channel==='telegram' && config.TELEGRAM_BOT_TOKEN){
        const result=JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot'+config.TELEGRAM_BOT_TOKEN+'/getUpdates?timeout=0').getContentText());
        for(const update of result.result||[]){const chat=update.message && update.message.chat;if(chat)console.log('TELEGRAM_CHAT_ID: '+chat.id);}
      }
      if(channel==='max' && config.MAX_BOT_TOKEN){
        const result=JSON.parse(UrlFetchApp.fetch('https://platform-api2.max.ru/updates?timeout=0',{headers:{Authorization:config.MAX_BOT_TOKEN}}).getContentText());
        for(const update of result.updates||[]){
          const message=update.message,chat=message && message.recipient,user=update.user || (message && message.sender);
          if(chat && chat.chat_id)console.log('MAX_CHAT_ID: '+chat.chat_id);
          if(user && user.user_id)console.log('MAX_USER_ID: '+user.user_id);
        }
      }
    }catch{console.warn(channel+' IDs unavailable; check the token and start the bot.');}
  }
}
