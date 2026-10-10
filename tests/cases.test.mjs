import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cases,caseVideoEmbedUrl} from '../public/data/cases.js';
import {renderCaseCards,renderCases} from '../scripts/build.mjs';
import {server} from '../scripts/serve.mjs';

test('screen 3 renders all case facts, calculations, images and fallback video links without JS',()=>{
  const html=renderCaseCards();
  assert.equal((html.match(/class="case-card"/g)||[]).length,6);
  assert.equal((html.match(/<h3 /g)||[]).length,6);
  assert.equal((html.match(/<a class="case-video"/g)||[]).length,6);
  assert.equal((html.match(/<span>Смотреть видеоотзыв<\/span>/g)||[]).length,6);
  assert.doesNotMatch(html,/<iframe/);
  const format=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
  for(const c of cases){
    const card=html.match(new RegExp(`<article class="case-card" data-case-id="${c.id}"[\\s\\S]*?<\\/article>`))?.[0];
    assert.ok(card,c.id);
    for(const fact of [c.model,c.fuel,String(c.year),c.route,c.image,format.format(c.before),format.format(c.after),`−${format.format(c.before-c.after)}`,`${format.format((c.before-c.after)/c.before*100)}%`])assert.ok(card.includes(fact),`${c.id}: ${fact}`);
    assert.ok(card.includes(`alt="${c.model}"`));
    assert.ok(card.includes('target="_blank" rel="noopener noreferrer"'));
    assert.ok(card.includes(`aria-label="Смотреть видеоотзыв: ${c.model}"`));
    assert.ok(card.includes('л/100 км'));
  }
  assert.equal(cases.find(c=>c.id==='haval').year,2026);
  assert.equal(cases.find(c=>c.id==='touareg').fuel,'Дизель');
  assert.equal(cases.find(c=>c.id==='touareg').year,2008);
});

test('missing video is inactive, unsafe URLs are rejected, private tokens and shorts survive embedding',()=>{
  for(const value of [null,'javascript:alert(1)','https://example.com/video/42492378f8e001ff1c43a7b461f1d017/'])assert.equal(caseVideoEmbedUrl(value),null);
  const privateCase=cases[0],embed=new URL(caseVideoEmbedUrl(privateCase.videoUrl));
  assert.equal(embed.searchParams.get('p'),new URL(privateCase.videoUrl).searchParams.get('p'));
  assert.ok(caseVideoEmbedUrl(cases.find(c=>c.id==='exeed').videoUrl).includes('/play/embed/'));
  const pending=renderCaseCards([{...privateCase,videoUrl:null}]);
  assert.match(pending,/<button class="case-video"[^>]*disabled/);
  assert.match(pending,/Видеоотзыв скоро появится/);
  assert.doesNotMatch(pending,/data-case-video=|href=/);
});

test('template generation keeps every other screen intact and refuses an empty final container',async()=>{
  const source=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const rendered=renderCases(source);
  const stripCases=html=>html.replace(/<section id="cases"[\s\S]*?<\/section>/,'');
  assert.equal(stripCases(source),stripCases(rendered));
  assert.doesNotMatch(rendered,/CASE_CARDS|CASE_POSITION|cases-people/);
  assert.match(rendered,/>1 из 6<\/output>/);
  assert.throws(()=>renderCases(source.replace('<!-- CASE_CARDS -->','')),/Missing screen 3/);
});

test('the existing source preview serves six static cards before JavaScript runs',async()=>{
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(response.status,200);
    const html=await response.text();
    assert.equal((html.match(/class="case-card"/g)||[]).length,6);
    assert.doesNotMatch(html,/CASE_CARDS/);
  }finally{if(server.listening)await new Promise(resolve=>server.close(resolve));}
});
