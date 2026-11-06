import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const html=await readFile('dist/index.html','utf8');
const assets=(await readdir('dist/assets')).filter(p=>/\.(js|css|woff2?)$/.test(p)).map(p=>'/assets/'+p);
const entries=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(m=>m[1]);
const version=createHash('sha256').update(html).digest('hex').slice(0,16);
let worker=await readFile('public/sw.js','utf8');
worker=worker.replace("'development'",JSON.stringify(version)).replace('/* BUILD_ASSETS */',assets.map(p=>JSON.stringify(p)).join(',')).replace('/* BUILD_ENTRY_ASSETS */',entries.map(p=>JSON.stringify(p)).join(','));
await writeFile('dist/sw.js',worker);
