import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {cases,caseVideoEmbedUrl} from '../public/data/cases.js';import {renderBlogPublication} from '../scripts/build.mjs';
const pagePath=new URL('../public/blog/bezopasen-li-syntonik-dlya-dvigatelya/index.html',import.meta.url);
const canonical='https://syntonik-krasnodar.ru/blog/bezopasen-li-syntonik-dlya-dvigatelya/';
test('approved article is static, semantic and linked to its actual case and five existing PDFs',async()=>{
  const html=await readFile(pagePath,'utf8');assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.match(html,/Инженерный разбор состава, испытаний и реального опыта/);assert.match(html,/Это инженерная гипотеза, а не установленная причина/);
  assert.match(html,/14,3/);assert.match(html,/10,0/);assert.match(html,/не является гарантией аналогичной экономии/);
  for(const name of ['certificate','petrol-test','diesel-test','safety-passport','safety-explanation'])assert.ok(html.includes('/assets/documents/'+name+'.pdf'));
  const touareg=cases.find(c=>c.id==='touareg');assert.ok(html.includes(touareg.image));assert.ok(html.includes(touareg.videoUrl));assert.ok(caseVideoEmbedUrl(touareg.videoUrl).includes('?p='));
  assert.match(html,/<table>/);assert.match(html,/<th scope="col">/);assert.match(html,/<th scope="row">/);assert.doesNotMatch(html,/iframe.*src=/);
});
test('blog pages expose consistent canonical, one set of social metadata and structured data',async()=>{
  for(const [path,url] of [[pagePath,canonical],[new URL('../public/blog/index.html',import.meta.url),'https://syntonik-krasnodar.ru/blog/']]){
    const html=await readFile(path,'utf8');assert.match(html,/name="robots" content="index,follow"/);assert.ok(html.includes('rel="canonical" href="'+url+'"'));
    for(const property of ['og:type','og:title','og:description','og:url','og:image'])assert.equal((html.match(new RegExp('property="'+property+'"','g'))||[]).length,1);
    assert.match(html,/name="twitter:card" content="summary_large_image"/);
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(schema['@context'],'https://schema.org');assert.ok(schema['@graph'].some(s=>s['@type']==='BreadcrumbList'));
  }
});
test('publication dates are absent while unpublished and become exact visible and structured dates at release',async()=>{
  const html=await readFile(pagePath,'utf8'),draft=renderBlogPublication(html),released=renderBlogPublication(html,'2026-10-13');
  assert.doesNotMatch(draft,/datePublished|datetime=/);assert.match(released,/datetime="2026-10-13"/);assert.match(released,/13 октября 2026/);assert.match(released,/"datePublished":"2026-10-13"/);
  assert.throws(()=>renderBlogPublication(html,'2026-02-30'),/Invalid blog publication date/);
});
test('blog consultation shares the existing submission, endpoint and first-touch UTM modules',async()=>{
  const js=await readFile(new URL('../public/blog/blog.js',import.meta.url),'utf8');assert.match(js,/leads\.createLeadSubmitter\(LEAD_ENDPOINT\)/);assert.match(js,/\.\.\.leads\.sessionUtms/);assert.match(js,/page:location\.href/);assert.match(js,/form:'callback'/);
  assert.doesNotMatch(js,/fetch\(|api\.telegram|platform-api2|amoCRM/i);assert.equal((js.match(/113548520,'init'/g)||[]).length,1);assert.match(js,/goal\('form_open_callback'\)/);assert.match(js,/goal\('lead_callback_success'\)/);
});
