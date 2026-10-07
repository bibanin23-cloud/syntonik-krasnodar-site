import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fuels,volumes} from '../public/data/catalog.js';
import {faq} from '../public/data/faq.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p);}}
await walk(root);
const missing=[];
for(const fuel of fuels)for(const volume of volumes){const ref=`assets/products/${fuel.id}-${volume.ml}.png`;try{await stat(path.join(root,ref));}catch{missing.push({file:'data/catalog.js',ref});}}
for(const p of files.filter(p=>/\.(html|css|js)$/.test(p))){const text=await readFile(p,'utf8');for(const m of text.matchAll(/(?:src|href)=["'](\/[^"'?#]+)|url\(['"]?(\/[^'"\)]+)|from\s+['"]([^'"]+)['"]/g)){const ref=m[1]||m[2]||m[3];if(ref.includes('${'))continue;const target=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(p),ref);try{await stat(target);}catch{missing.push({file:path.relative(root,p),ref});}}}
if(missing.length){console.error(JSON.stringify(missing));process.exitCode=1;}else console.log('All referenced local resources exist.');
const homepage=await readFile(path.join(root,'index.html'),'utf8');
const ids=[...homepage.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
const brokenAnchors=[...homepage.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]).filter(id=>!ids.includes(id));
const screens=[...homepage.matchAll(/data-screen="(\d+)"/g)].map(m=>Number(m[1]));
const faqValid=faq.length===30&&faq.every((item,index)=>item.id===index+1&&item.question&&item.answer.length&&item.answer.every(p=>typeof p==='string'&&p.trim()));
if(duplicates.length||brokenAnchors.length||screens.join(',')!=='1,2,3,4,5,6,7,8,9,10,11'||!faqValid){console.error(JSON.stringify({duplicates,brokenAnchors,screens,faqValid}));process.exitCode=1;}else console.log('11 ordered screens, unique anchors, 20 product photos and 30 FAQ entries verified.');
if(process.argv.includes('--hashes')){
 const hashes={};
 for(const p of files.filter(p=>/\.(png|pdf)$/.test(p))){const bytes=await readFile(p);hashes[path.relative(root,p).replaceAll('\\','/')]=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}
 console.log(JSON.stringify(hashes));
}
