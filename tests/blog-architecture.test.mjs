import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadBlogRegistry,renderBlog,validateRegistry,relatedPosts,withHeadingIds,extractLegacyContent,postUrl,categoryUrl} from '../scripts/blog.mjs';
const slug='bezopasen-li-syntonik-dlya-dvigatelya';
const originalHash='3469422b747923d5d671bafd1b5cb67eb5df7b0797155aa5fceebaad42533791';
test('legacy article file and full approved body remain intact behind the adapter',async()=>{
  const original=(await readFile(new URL(`../public/blog/${slug}/index.html`,import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.equal(createHash('sha256').update(original).digest('hex'),originalHash);
  const {pages}=await renderBlog({includeDrafts:true}),article=pages.get(`/blog/${slug}/`);
  for(const fragment of extractLegacyContent(original).matchAll(/<(p|h2|h3|table|figure|ul)\b[^>]*>[\s\S]*?<\/\1>/g)){
    const normalized=fragment[0].replace(/(<h[23])([^>]*)(>)/,'$1$3');
    assert.ok(article.replace(/(<h[23])[^>]*(>)/g,'$1$2').includes(normalized),'Missing approved content');
  }
  assert.equal((article.match(/<table>/g)||[]).length,1);
  assert.match(article,/data-case-video="touareg"/);assert.match(article,/blog-author-expanded/);assert.match(article,/Главное за 30 секунд/);
});
test('preview includes a featured draft and only its category; production excludes its route and sitemap',async()=>{
  const registry=await loadBlogRegistry(),preview=await renderBlog({registry,includeDrafts:true}),production=await renderBlog({registry,indexable:true});
  const category=categoryUrl(registry.categories.find(c=>c.id==='research'));
  assert.equal(preview.pages.size,3);assert.ok(preview.pages.has(category));assert.match(preview.pages.get('/blog/'),/blog-featured/);
  assert.doesNotMatch(preview.pages.get('/blog/'),/rashod-topliva/);
  for(const page of preview.pages.values())assert.match(page,/name="robots" content="noindex,nofollow"/);
  assert.deepEqual([...production.pages.keys()],['/blog/']);assert.deepEqual(production.sitemap,[{url:'/blog/'}]);
  assert.doesNotMatch(production.pages.get('/blog/'),/href="\/blog\/bezopasen/);
});
test('published fixtures have exact dates, canonical and one complete set of social/schema metadata',async()=>{
  const registry=structuredClone(await loadBlogRegistry());registry.posts[0].status='published';registry.posts[0].datePublished='2026-10-13';registry.posts[0].dateModified='2026-10-14';
  const result=await renderBlog({registry,indexable:true}),post=registry.posts[0],article=result.pages.get(postUrl(post));
  assert.equal((article.match(/<h1>/g)||[]).length,1);
  assert.match(article,/name="robots" content="index,follow"/);assert.ok(article.includes(post.seoTitle));assert.ok(article.includes(post.description));
  assert.ok(article.includes(`rel="canonical" href="https://syntonik-krasnodar.ru${postUrl(post)}"`));
  for(const field of ['og:type','og:title','og:description','og:url','og:image'])assert.equal((article.match(new RegExp(`property="${field}"`,'g'))||[]).length,1);
  assert.match(article,/name="twitter:card" content="summary_large_image"/);
  const schema=JSON.parse(article.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]),posting=schema['@graph'].find(s=>s['@type']==='BlogPosting');
  assert.equal(posting.datePublished,'2026-10-13');assert.equal(posting.dateModified,'2026-10-14');assert.equal(posting.author.name,'Игорь Бибанин');
  assert.ok(result.sitemap.some(s=>s.url===postUrl(post)&&s.lastmod==='2026-10-14'));
});
test('registry rejects duplicate routes, false dates and unknown resources; related posts exclude drafts/current',async()=>{
  const registry=await loadBlogRegistry();
  for(const mutate of [r=>r.posts.push({...r.posts[0]}),r=>r.posts[0].datePublished='2026-02-30',r=>r.posts[0].status='published',r=>r.posts[0].related=['missing'],r=>r.posts[0].cover='/assets/../secret']){
    const invalid=structuredClone(registry);mutate(invalid);assert.throws(()=>validateRegistry(invalid));
  }
  const current=registry.posts[0],others=[{...current,slug:'second',status:'published',datePublished:'2026-10-13'},{...current,slug:'draft',status:'draft'},{...current,slug:'third',status:'published',datePublished:'2026-10-13'}];
  registry.posts.push(...others);current.related=['draft','second'];assert.deepEqual(relatedPosts(registry,current).map(p=>p.slug),['second','third']);
});
test('TOC covers H2/H3 with unique anchors and shared footer remains identical apart from homepage hashes',async()=>{
  const headings=withHeadingIds('<h2 id="blog-heading-1">Первый</h2><h3>Второй</h3><h2>Третий</h2>');
  assert.deepEqual(headings.headings.map(h=>h.id),['blog-heading-1','blog-heading-2','blog-heading-3']);
  const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),footer=home.match(/<footer\b[\s\S]*?<\/footer>/)[0].replace(/href="#/g,'href="/#');
  const {pages}=await renderBlog({includeDrafts:true});for(const html of pages.values())assert.ok(html.includes(footer));
});
test('future HTML fragments use the shared template and routes without editing legacy source',async()=>{
  const directory=new URL('../content/blog/posts/',import.meta.url),file=new URL(`fixture-${process.pid}.html`,directory);
  await mkdir(directory,{recursive:true});await writeFile(file,'<section id="conclusion"><h2>Вывод</h2><p>Текст для проверки генератора.</p><h3>Подробности</h3><p>Второй абзац.</p></section>');
  try{
    const registry=structuredClone(await loadBlogRegistry()),post={...registry.posts[0],slug:'fixture-engine',title:'Проверка HTML-фрагмента',seoTitle:'Проверка шаблона — тест',category:'engine',status:'published',datePublished:'2026-10-13',dateModified:null,summary:null,featured:false,content:{format:'html-fragment',file:`content/blog/posts/fixture-${process.pid}.html`},related:[],documents:[],videoCaseId:null,consultation:{title:'Получить консультацию',conclusionSection:'conclusion'}};
    registry.posts.push(post);const {pages,sitemap}=await renderBlog({registry,indexable:true}),article=pages.get(postUrl(post));
    assert.match(article,/Текст для проверки генератора/);assert.equal((article.match(/<h1>/g)||[]).length,1);assert.match(article,/blog-toc-level-3/);assert.match(article,/blog-author-expanded/);assert.match(article,/data-callback/);
    assert.ok(pages.has('/blog/category/dvigatel-i-toplivnaya-sistema/'));assert.ok(sitemap.some(p=>p.url===postUrl(post)));assert.doesNotMatch(article,/blog-summary-title|blog-related-title/);
    post.content.file='public/lead-config.js';await assert.rejects(renderBlog({registry}),/content directory/);
  }finally{await rm(file,{force:true});}
});
