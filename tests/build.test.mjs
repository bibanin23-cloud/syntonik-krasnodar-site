import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from '../scripts/build.mjs';
const outDir=fileURLToPath(new URL('../.build-test/',import.meta.url));
test('preview build resolves repository paths without changing approved content',async()=>{
  try{
    await build({basePath:'/syntonik-krasnodar-site/',siteUrl:'https://bibanin23-cloud.github.io/syntonik-krasnodar-site/',outDir});
    const html=await readFile(outDir+'index.html','utf8');
    const app=await readFile(outDir+'app.js','utf8');
    assert.match(html,/src="\/syntonik-krasnodar-site\/app\.js"/);
    assert.match(html,/href="\/syntonik-krasnodar-site\/blog\/"/);
    assert.match(html,/content="noindex,nofollow"/);
    assert.match(html,/rel="canonical" href="https:\/\/syntonik-krasnodar\.ru\/"/);
    assert.match(app,/\/syntonik-krasnodar-site\/assets\/products\/\$\{selectedFuel.id\}/);
    assert.match(await readFile(outDir+'data/cases.js','utf8'),/\^\\\//); // Rutube validation regex is not a path.
    assert.deepEqual([...html.matchAll(/data-screen="(\d+)"/g)].map(m=>+m[1]),[1,2,3,4,6,7,8,9,10,11]);
    assert.doesNotMatch(html,/<section id="how"|how-title|how-steps|mechanism-chain/);
    assert.match(html,/<span id="how" class="about-anchor" aria-hidden="true"><\/span>/);
    const about=html.match(/<section id="about"[\s\S]*?<\/section>/)?.[0];
    assert.ok(about);
    assert.equal((about.match(/<h2 /g)||[]).length,1);
    assert.equal((about.match(/<article>/g)||[]).length,4);
    assert.equal((about.match(/<img /g)||[]).length,4);
    assert.doesNotMatch(about,/class="eyebrow"/);
    assert.match(about,/SYNTONIK — БОЛЬШЕ, <em>ЧЕМ ПРИСАДКА К ТОПЛИВУ/);
    assert.match(about,/src="\/syntonik-krasnodar-site\/assets\/backgrounds\/mechanism-v1\.png"/);
    assert.equal((html.match(/class="faq-item"/g)||[]).length,30);
    assert.equal((html.match(/class="case-card"/g)||[]).length,6);
    assert.equal((html.match(/<a class="case-video"/g)||[]).length,6);
    assert.match(html,/src="\/syntonik-krasnodar-site\/assets\/cars\/haval-cutout-v1\.png"/);
    assert.match(html,/data-case-id="haval"[\s\S]*?class="case-meta">2026/);
    assert.match(html,/data-case-id="touareg"[\s\S]*?class="case-fuel">Дизель/);
    assert.doesNotMatch(html,/CASE_CARDS|CASE_POSITION|cases-people/);
    assert.doesNotMatch(app,/#cars['"]\)\.innerHTML/);
    assert.match(await readFile(outDir+'robots.txt','utf8'),/Disallow: \//);
  }finally{await rm(outDir,{recursive:true,force:true});}
});
test('indexing opens only on the primary domain; legal pages and blog stay noindex',async()=>{
  await assert.rejects(build({basePath:'/site',siteUrl:'https://syntonik-krasnodar.ru/',indexable:true,outDir}));
  await assert.rejects(build({siteUrl:'https://example.com/',indexable:true,outDir}));
  try{
    await build({siteUrl:'https://syntonik-krasnodar.ru/',indexable:true,outDir});
    assert.match(await readFile(outDir+'index.html','utf8'),/content="index,follow"/);
    assert.match(await readFile(outDir+'legal/privacy/index.html','utf8'),/noindex/);
    assert.match(await readFile(outDir+'robots.txt','utf8'),/Sitemap: https:\/\/syntonik-krasnodar.ru\/sitemap.xml/);
  }finally{await rm(outDir,{recursive:true,force:true});}
});
