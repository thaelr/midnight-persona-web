// Local-only lifecycle fixture. It never proxies API, Auth or media.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
let version='A';const root=path.resolve('dist');
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:5178');
 if(url.pathname==='/__test/version'&&req.method==='PUT'){version=url.searchParams.get('v')??'B';res.end('ok');return;}
 if(url.pathname==='/config.json'){res.setHeader('Content-Type','application/json');res.end('{}');return;}
 if(url.pathname.startsWith('/web/')||url.pathname.startsWith('/auth/')){res.writeHead(404);res.end();return;}
 const name=['/','/terms','/privacy'].includes(url.pathname)?'index.html':url.pathname.slice(1);const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
 let data=await readFile(file);if(name==='sw.js')data=Buffer.from(data.toString().replace(/const VERSION=[^;]+;/,`const VERSION='fixture-${version}';`));
 res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch{res.writeHead(404);res.end();}
}).listen(5178,'127.0.0.1');
