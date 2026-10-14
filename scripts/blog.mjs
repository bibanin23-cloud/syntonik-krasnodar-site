import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cases,caseVideoEmbedUrl} from '../public/data/cases.js';

const project=fileURLToPath(new URL('../',import.meta.url));
export const blogOrigin='https://syntonik-krasnodar.ru';
export const blogTitle='Блог об автомобильном топливе и двигателях';
export const blogDescription='Почему растёт расход топлива, как сохранить исправность двигателя и на чём действительно можно экономить. Разбираемся на основе инженерных знаний, исследований и практического опыта.';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=html=>html.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const dateLabel=date=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'}).format(new Date(date+'T12:00:00Z'));
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const postUrl=post=>`/blog/${post.slug}/`;
export const categoryUrl=category=>`/blog/category/${category.slug}/`;
export const visiblePosts=(registry,includeDrafts=false)=>registry.posts.filter(p=>p.status==='published'||includeDrafts);
export function relatedPosts(registry,current){
  const eligible=registry.posts.filter(p=>p.status==='published'&&p.slug!==current.slug);
  const requested=(current.related||[]).map(slug=>eligible.find(p=>p.slug===slug)).filter(Boolean);
  return [...new Map([...requested,...eligible.filter(p=>p.category===current.category)].map(p=>[p.slug,p])).values()].slice(0,3);
}
export function validateRegistry(registry){
  if(!Array.isArray(registry.categories)||!Array.isArray(registry.posts)||!registry.authors)throw new Error('Invalid blog registry');
  for(const list of [registry.categories.map(c=>c.id),registry.categories.map(c=>c.slug),registry.posts.map(p=>p.slug)]){
    if(new Set(list).size!==list.length||list.some(s=>!slugPattern.test(s)))throw new Error('Duplicate or invalid blog slug');
  }
  for(const p of registry.posts){
    for(const field of ['title','seoTitle','description','excerpt','cover','coverAlt','author','category'])if(typeof p[field]!=='string'||!p[field].trim())throw new Error(`Missing ${field}: ${p.slug}`);
    if(!registry.authors[p.author]||!registry.categories.some(c=>c.id===p.category))throw new Error(`Unknown author/category: ${p.slug}`);
    if(!['draft','published'].includes(p.status))throw new Error(`Invalid status: ${p.slug}`);
    for(const field of ['datePublished','dateModified'])if(p[field]!=null){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p[field])||new Date(p[field]+'T12:00:00Z').toISOString().slice(0,10)!==p[field])throw new Error(`Invalid ${field}: ${p.slug}`);
    }
    if(p.status==='published'&&!p.datePublished)throw new Error(`Published post needs its actual publication date: ${p.slug}`);
    if(p.dateModified&&(!p.datePublished||p.dateModified<p.datePublished))throw new Error(`Invalid modification date: ${p.slug}`);
    if(!['legacy-html','html-fragment'].includes(p.content?.format))throw new Error(`Unknown content format: ${p.slug}`);
    if(p.related?.some(s=>!registry.posts.some(other=>other.slug===s)))throw new Error(`Unknown related article: ${p.slug}`);
    for(const url of [p.cover,...(p.documents||[])])if(!/^\/assets\/[a-zA-Z0-9_./-]+$/.test(url)||url.includes('..'))throw new Error(`Invalid resource: ${p.slug}`);
    if(p.videoCaseId&&!caseVideoEmbedUrl(cases.find(c=>c.id===p.videoCaseId)?.videoUrl))throw new Error(`Unknown case video: ${p.slug}`);
  }
  return registry;
}
export async function loadBlogRegistry(){return validateRegistry(JSON.parse(await readFile(path.join(project,'content/blog/registry.json'),'utf8')));}
export function extractLegacyContent(html){
  const marker='<div class="blog-prose">',start=html.indexOf(marker),end=html.lastIndexOf('</div></div></article>');
  if(start<0||end<start)throw new Error('Legacy article content markers not found');
  return html.slice(start+marker.length,end);
}
async function loadContent(post){
  const filename=path.resolve(project,post.content.file||'');
  const allowed=post.content.format==='legacy-html'?path.join(project,'public/blog'):path.join(project,'content/blog/posts');
  if(!filename.startsWith(allowed+path.sep))throw new Error('Article content must stay inside its content directory');
  const source=(await readFile(filename,'utf8')).replaceAll('\r\n','\n');
  if(post.content.sha256&&createHash('sha256').update(source).digest('hex')!==post.content.sha256)throw new Error(`Approved article changed: ${post.slug}`);
  const html=post.content.format==='legacy-html'?extractLegacyContent(source):source;
  if(/<(?:script|iframe|h1)\b/i.test(html))throw new Error(`Article fragments cannot include scripts, iframes or H1: ${post.slug}`);
  return html;
}
export function withHeadingIds(html){
  const used=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])),headings=[];let n=0;
  html=html.replace(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/g,(_,level,attrs,text)=>{
    let id=attrs.match(/\bid="([^"]+)"/)?.[1];
    if(!id){do{id=`blog-heading-${++n}`;}while(used.has(id));used.add(id);attrs+=` id="${id}"`;}
    headings.push({id,level:Number(level),text:plain(text)});return `<h${level}${attrs}>${text}</h${level}>`;
  });
  return {html,headings};
}
function authorCard(author,expanded=false,meta=''){
  const name=author.profileUrl?`<a href="${escape(author.profileUrl)}">${escape(author.name)}</a>`:escape(author.name);
  const qualification=author.professionalInfo||`${author.jobTitle} · ${author.companyRole}`;
  return `<div class="blog-author-card${expanded?' blog-author-expanded':''}"${expanded?' data-blog-added="author"':''}><span class="blog-author-photo${author.photoFraming==='portrait'?' blog-author-photo-portrait':''}"><img src="${escape(author.photo)}" width="48" height="48" alt="${escape(author.name)}" loading="lazy"></span><div><p class="blog-author-name">${name}</p><p>${escape(qualification)}</p>${meta?`<p class="blog-article-meta">${meta}</p>`:''}</div></div>`;
}
function consultation(config){return `<aside class="blog-inline-consultation" data-blog-added="consultation"><p>${escape(config.title)}</p><button class="primary" type="button" data-callback>Получить консультацию</button></aside>`;}
function enhanceContent(html,post,author){
  const config=post.consultation||{};
  if(config.inlineAfter){
    const marker=`<section id="${escape(config.inlineAfter)}"`,start=html.indexOf(marker),end=html.indexOf('</section>',start);
    if(start<0||end<start)throw new Error(`Consultation insertion section not found: ${post.slug}`);
    html=html.slice(0,end+10)+consultation(config)+html.slice(end+10);
  }
  if(config.conclusionSection){
    const start=html.indexOf(`<section id="${escape(config.conclusionSection)}"`),end=html.indexOf('</section>',start);
    if(start<0||end<start)throw new Error(`Conclusion section not found: ${post.slug}`);
    html=html.slice(0,end+10)+authorCard(author,true)+html.slice(end+10);
  }else html+=authorCard(author,true);
  if(!config.existingFinal)html+=consultation(config);
  return html;
}
function dates(post){return `${post.datePublished?`<time datetime="${post.datePublished}">${dateLabel(post.datePublished)}</time>`:''}${post.dateModified&&post.dateModified!==post.datePublished?`<span>Обновлено: <time datetime="${post.dateModified}">${dateLabel(post.dateModified)}</time></span>`:''}`;}
function card(post,registry,readingTime,{featured=false}={}){
  const author=registry.authors[post.author],category=registry.categories.find(c=>c.id===post.category);
  return `<article class="blog-card${featured?' blog-featured':' blog-standard'}"><a class="blog-card-cover" href="${postUrl(post)}" tabindex="-1" aria-hidden="true"><img src="${escape(post.cover)}" width="960" height="540" alt="${escape(post.coverAlt)}" loading="lazy"></a><div class="blog-card-copy"><p class="blog-kicker">${escape(category.title)}${post.status==='draft'?' · Черновик':''}</p><h2><a href="${postUrl(post)}">${escape(post.title)}</a></h2><p>${escape(post.excerpt)}</p><p class="blog-card-meta">${escape(author.name)} · ${readingTime} мин чтения</p><a class="button" href="${postUrl(post)}">Читать статью <span aria-hidden="true">→</span></a></div></article>`;
}
function breadcrumbs(items){return `<nav class="blog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a>${items.map(([title,url])=>`<span aria-hidden="true">/</span>${url?`<a href="${url}">${escape(title)}</a>`:`<span aria-current="page">${escape(title)}</span>`}`).join('')}</nav>`;}
function schemaBreadcrumbs(items){return {'@type':'BreadcrumbList',itemListElement:[['Главная','/'],...items].map(([name,url],i)=>({'@type':'ListItem',position:i+1,name,item:blogOrigin+url}))};}
export async function renderBlog({registry,includeDrafts=false,indexable=false}={}){
  registry??=await loadBlogRegistry();
  validateRegistry(registry);
  const [template,home,legacy]=await Promise.all([readFile(path.join(project,'content/blog/template.html'),'utf8'),readFile(path.join(project,'public/index.html'),'utf8'),readFile(path.join(project,'public/blog/bezopasen-li-syntonik-dlya-dvigatelya/index.html'),'utf8')]);
  const footer=home.match(/<footer\b[\s\S]*?<\/footer>/)?.[0]?.replace(/href="#/g,'href="/#');
  // Extend the shared blog form without changing the approved legacy article file.
  const dialogs=[...legacy.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)].map(m=>m[0]).join('').replace(/name="(name|phone|city|comment)"/g,'class="ym-disable-keys" name="$1"').replace('<label for="blog-lead-city">','<label for="blog-lead-email">Электронная почта (необязательно)<input id="blog-lead-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="example@mail.ru" maxlength="254" aria-describedby="blog-email-error" class="ym-disable-keys"><span id="blog-email-error" role="status" hidden></span></label><label for="blog-lead-city">');
  if(!footer||!dialogs)throw new Error('Existing footer/dialogs not found');
  for(const author of Object.values(registry.authors))await stat(path.join(project,'public',author.photo));
  const eligible=visiblePosts(registry,includeDrafts),contents=new Map(),reading=new Map();
  for(const post of registry.posts){
    for(const url of [post.cover,...(post.documents||[])])await stat(path.join(project,'public',url));
    const body=await loadContent(post);contents.set(post.slug,body);reading.set(post.slug,Math.max(1,Math.ceil(plain(body).split(/\s+/).length/200)));
  }
  const pages=new Map(),sitemap=[];
  function page(url,{title,description,content,image='/assets/backgrounds/industrial-v1.png',graph,type='website',published=true}){
    const allowed=indexable&&published,canonical=blogOrigin+url;
    const head=`<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${allowed?'index,follow':'noindex,nofollow'}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="${type}"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="Syntonik Краснодар — ЭнерДар"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${blogOrigin+image}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${blogOrigin+image}"><script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script>`;
    pages.set(url,template.replace('<!-- BLOG_HEAD -->',head).replace('<!-- BLOG_CONTENT -->',content).replace('<!-- BLOG_FOOTER -->',footer).replace('<!-- BLOG_DIALOGS -->',dialogs));
  }
  function listing(category=null){
    const title=category?category.title:blogTitle,url=category?categoryUrl(category):'/blog/',items=eligible.filter(p=>!category||p.category===category.id),featured=items.find(p=>p.featured)||items[0];
    const usedCategories=registry.categories.filter(c=>eligible.some(p=>p.category===c.id));
    const filters=`<nav class="blog-categories" aria-label="Категории статей"><a href="/blog/"${!category?' aria-current="page"':''}>Все статьи</a>${usedCategories.map(c=>`<a href="${categoryUrl(c)}"${category?.id===c.id?' aria-current="page"':''}>${escape(c.title)}</a>`).join('')}</nav>`;
    const intro=`<div class="blog-hero blog-index-intro"><h1>${escape(title)}</h1><p>${escape(blogDescription)}</p></div>`;
    const articles=featured?`<section class="blog-article-list" aria-label="Статьи"><p class="blog-feature-label">Главный материал</p>${card(featured,registry,reading.get(featured.slug),{featured:true})}${items.length>1?`<div class="blog-card-grid">${items.filter(p=>p!==featured).map(p=>card(p,registry,reading.get(p.slug))).join('')}</div>`:''}</section>`:'<p class="blog-empty">Материалы готовятся к публикации.</p>';
    const graph=[{'@type':'CollectionPage',name:title,url:blogOrigin+url,description:blogDescription},schemaBreadcrumbs(category?[['Блог','/blog/'],[category.title,url]]:[['Блог',url]])];
    page(url,{title:category?`${title} — Блог Syntonik`:title+' — Syntonik',description:blogDescription,content:breadcrumbs(category?[['Блог','/blog/'],[category.title,null]]:[['Блог',null]])+`<div class="blog-index">${intro}${filters}${articles}</div>`,image:featured?.cover,graph,published:!category||items.some(p=>p.status==='published')});
  }
  listing();sitemap.push({url:'/blog/'});
  for(const category of registry.categories){if(eligible.some(p=>p.category===category.id))listing(category);if(registry.posts.some(p=>p.status==='published'&&p.category===category.id))sitemap.push({url:categoryUrl(category)});}
  for(const post of eligible){
    const author=registry.authors[post.author],category=registry.categories.find(c=>c.id===post.category),url=postUrl(post);
    const enhanced=enhanceContent(contents.get(post.slug),post,author),{html,headings}=withHeadingIds(enhanced);
    const toc=headings.length?`<aside class="blog-toc"><details open><summary>Содержание статьи</summary><nav aria-label="Разделы статьи">${headings.map(h=>`<a class="blog-toc-level-${h.level}" href="#${h.id}">${escape(h.text)}</a>`).join('')}</nav></details></aside>`:'';
    const related=relatedPosts(registry,post);
    const after=related.length?`<section class="blog-related" aria-labelledby="blog-related-title"><h2 id="blog-related-title">Продолжить чтение</h2><div class="blog-card-grid">${related.map(p=>card(p,registry,reading.get(p.slug))).join('')}</div></section>`:'';
    const summary=post.summary?`<aside class="blog-summary" aria-labelledby="blog-summary-title"><h2 id="blog-summary-title">Главное за 30 секунд</h2><p>${escape(post.summary)}</p></aside>`:'';
    const hero=`<header class="blog-hero blog-article-hero"><p class="blog-kicker">${escape(category.title)}</p><h1>${escape(post.title)}</h1><p class="blog-excerpt">${escape(post.excerpt)}</p>${authorCard(author,false,dates(post)+`<span>${reading.get(post.slug)} мин чтения</span>`)}<img class="blog-hero-cover" src="${escape(post.cover)}" width="960" height="540" alt="${escape(post.coverAlt)}"></header>`;
    const articleSchema={'@type':'BlogPosting','@id':blogOrigin+url+'#article',headline:post.title,description:post.description,url:blogOrigin+url,mainEntityOfPage:blogOrigin+url,image:blogOrigin+post.cover,articleSection:category.title,inLanguage:'ru-RU',author:{'@type':'Person',name:author.name,jobTitle:author.jobTitle,worksFor:{'@type':'Organization',name:author.company}},publisher:{'@type':'Organization',name:'ЭнерДар'}};
    if(post.datePublished)articleSchema.datePublished=post.datePublished;if(post.dateModified)articleSchema.dateModified=post.dateModified;
    page(url,{title:post.seoTitle,description:post.description,image:post.cover,type:'article',published:post.status==='published',graph:[articleSchema,schemaBreadcrumbs([['Блог','/blog/'],[category.title,categoryUrl(category)],[post.title,url]])],content:breadcrumbs([['Блог','/blog/'],[category.title,categoryUrl(category)],[post.title,null]])+`<article class="blog-article">${hero}${summary}<div class="blog-article-layout">${toc}<div class="blog-prose">${html}</div></div>${after}<p class="blog-back"><a href="/blog/">← Вернуться в блог</a></p></article>`});
    if(post.status==='published')sitemap.push({url,lastmod:post.dateModified||post.datePublished});
  }
  return {pages,sitemap,registry};
}
