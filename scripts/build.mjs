import {readdir,readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {cases,caseVideoEmbedUrl} from '../public/data/cases.js';

const project=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const source=path.join(project,'public');
const canonical='https://syntonik-krasnodar.ru/';
const require=createRequire(import.meta.url);
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);files.push(...(entry.isDirectory()?await walk(file):[file]));}return files;}

const caseNumber=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
const caseMileage=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const casePlay='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15"/><path d="m12 9 11 7-11 7Z"/></svg>';

export function renderCaseCards(items=cases){
  return items.map(c=>{
    const difference=c.before-c.after,percent=difference/c.before*100;
    const video=caseVideoEmbedUrl(c.videoUrl)
      ? `<a class="case-video" href="${escapeHtml(c.videoUrl)}" target="_blank" rel="noopener noreferrer" data-case-video="${escapeHtml(c.id)}" aria-haspopup="dialog" aria-controls="case-video-dialog" aria-label="Смотреть видеоотзыв: ${escapeHtml(c.model)}">${casePlay}<span>Смотреть видеоотзыв</span></a>`
      : `<button class="case-video" type="button" disabled aria-label="Видеоотзыв скоро появится: ${escapeHtml(c.model)}">${casePlay}<span>Видеоотзыв скоро появится</span></button>`;
    return `<article class="case-card" data-case-id="${escapeHtml(c.id)}" aria-labelledby="case-title-${escapeHtml(c.id)}"><div class="case-top"><div class="case-info"><p class="case-fuel">${escapeHtml(c.fuel)}</p><h3 id="case-title-${escapeHtml(c.id)}">${escapeHtml(c.model)}</h3><p class="case-meta">${c.year} · <span>${caseMileage.format(c.mileage)} км</span></p><p class="case-route">${escapeHtml(c.route)}</p></div><img class="case-car" src="${escapeHtml(c.image)}" width="${c.imageWidth||1536}" height="${c.imageHeight||1024}" alt="${escapeHtml(c.model)}" loading="lazy"></div><div class="case-consumption"><strong><span class="case-reading-label">До</span>${caseNumber.format(c.before)}</strong><span class="case-arrow" aria-hidden="true">→</span><strong class="case-after"><span class="case-reading-label">После</span>${caseNumber.format(c.after)}</strong><span class="case-unit">л/100 км</span></div><div class="case-saving"><p class="case-difference"><strong>−${caseNumber.format(difference)}</strong><span>л/100 км</span></p><p class="case-percent"><span>Экономия</span><strong>${caseNumber.format(percent)}%</strong></p></div>${video}</article>`;
  }).join('\n');
}

export function renderCases(html){
  if(!html.includes('<!-- CASE_CARDS -->'))throw new Error('Missing screen 3 card template');
  return html.replace('<!-- CASE_CARDS -->',renderCaseCards()).replace('<!-- CASE_POSITION -->',`1 из ${cases.length}`);
}

export async function build({basePath='',siteUrl='',indexable=false,optimizeImages=false,outDir=path.join(project,'dist')}={}){
  if(!/^(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(basePath))throw new Error('Invalid base path');
  const base=basePath==='/'?'':basePath.replace(/\/$/,'');
  if(indexable&&(base||![canonical,canonical.replace('https://','http://')].includes(siteUrl)))throw new Error('Indexing is allowed only on the final canonical domain');
  const output=path.resolve(outDir);
  if(output===source||source.startsWith(output+path.sep)||!output.startsWith(project+path.sep))throw new Error('Build output must be a separate directory inside the project');
  const files=await walk(source);
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  const sharp=optimizeImages?require(process.env.SHARP_MODULE||'sharp'):null;
  let originalImageBytes=0,optimizedImageBytes=0;
  // Files are rewritten only in the generated site. Approved originals stay intact.
  for(const file of files){
    let relative=path.relative(source,file).replaceAll('\\','/');
    let contents=await readFile(file);
    if(optimizeImages&&/\.png$/i.test(file)){
      originalImageBytes+=contents.length;
      contents=await sharp(contents).webp({lossless:true,effort:6}).toBuffer();
      optimizedImageBytes+=contents.length;
      relative=relative.replace(/\.png$/i,'.webp');
    }else if(/\.(html|css|js)$/.test(file)){
      let text=contents.toString('utf8');
      if(relative==='index.html')text=renderCases(text);
      if(optimizeImages)text=text.replace(/(\/assets\/[^'"`\s)<>]+)\.png/g,'$1.webp');
      // Match URL attributes, CSS url(), and root-local JS strings/templates.
      // External URLs, regular expressions, canonical URLs and imports are unchanged.
      text=text.replace(/((?:src|href|poster|action)=["']|url\(["']?|["'`])(\/(?!\/)[a-zA-Z][^"'`\s<>)]*|\/)(?=["'`\s<>)]|$)/g,(_,prefix,url)=>prefix+base+url);
      if(file.endsWith('.html')){
        const title=text.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'Syntonik Краснодар';
        const description=text.match(/<meta name="description" content="([^"]*)"/)?.[1]||'Syntonik в Краснодаре — ЭнерДар.';
        if(indexable&&relative==='index.html')text=text.replace('content="noindex,nofollow"','content="index,follow"');
        const origin=siteUrl?new URL(siteUrl).origin:canonical.slice(0,-1);
        const image=origin+base+'/assets/backgrounds/hero-scene-v4.'+(optimizeImages?'webp':'png');
        text=text.replace('</head>',`<link rel="icon" type="image/svg+xml" href="${base}/assets/brand/syntonik-black.svg"><meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="Syntonik Краснодар — ЭнерДар"><meta property="og:title" content="${title.replaceAll('"','&quot;')}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}${relative==='index.html'?'':relative.replace(/index\.html$/,'')}"><meta property="og:image" content="${image}"></head>`);
      }
      contents=Buffer.from(text);
    }
    const target=path.join(output,relative);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,contents);
  }
  await writeFile(path.join(output,'.nojekyll'),'');
  await writeFile(path.join(output,'robots.txt'),indexable?`User-agent: *\nAllow: /\nDisallow: /legal/\nDisallow: /blog/\nSitemap: ${canonical}sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
  await writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${canonical}</loc></url></urlset>\n`);
  await writeFile(path.join(output,'404.html'),`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Страница не найдена — Syntonik</title><link rel="stylesheet" href="${base}/styles.css"></head><body><main style="padding:5%"><h1>Страница не найдена</h1><a href="${base}/">Перейти на главную</a></main></body></html>`);
  // Check static references again after rewriting and optimization.
  for(const file of (await walk(output)).filter(file=>/\.(html|css|js)$/.test(file))){
    const text=await readFile(file,'utf8');
    for(const match of text.matchAll(/(?:src|href)=["'](\/[^"'?#]+)|url\(['"]?(\/[^'"\)]+)|from\s+['"]([^'"]+)['"]/g)){
      const ref=match[1]||match[2]||match[3];
      if(ref.includes('${')||ref.startsWith('//'))continue;
      const target=ref.startsWith('/')?path.join(output,ref.slice(base.length)):path.resolve(path.dirname(file),ref);
      try{await stat(target);}catch{throw new Error(`Missing production resource: ${path.relative(output,file)} -> ${ref}`);}
    }
  }
  const report={basePath:base||'/',indexable,optimizedImages:optimizeImages,originalImageBytes,optimizedImageBytes,files:(await walk(output)).length};
  console.log(JSON.stringify(report));
  return report;
}

if(process.argv[1]===fileURLToPath(import.meta.url))await build({basePath:process.env.BASE_PATH||'',siteUrl:process.env.SITE_URL||'',indexable:process.env.INDEXABLE==='true',optimizeImages:process.env.OPTIMIZE_IMAGES==='true'});
