import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.env.SITE_ROOT?path.resolve(process.env.SITE_ROOT):fileURLToPath(new URL('../public/',import.meta.url));
const base=(process.env.BASE_PATH||'').replace(/\/$/,'');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.jfif':'image/jpeg','.pdf':'application/pdf','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(base){
      if(pathname===base){res.writeHead(302,{Location:base+'/'});res.end();return;}
      if(!pathname.startsWith(base+'/')){res.writeHead(404);res.end();return;}
      pathname=pathname.slice(base.length);
    }
    let file=path.resolve(root,'.'+pathname);
    if(file!==path.resolve(root)&&!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'self' https://script.google.com https://script.googleusercontent.com; frame-src https://rutube.ru; img-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Страница не найдена');}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Syntonik preview: http://127.0.0.1:4173'));
