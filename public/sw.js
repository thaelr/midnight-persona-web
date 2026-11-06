// Build injects a version and only immutable JS/CSS/fonts. No private data or config.
const VERSION='development';
const CACHE='midnight-shell-'+VERSION;
const SHELL=['/','/icon.svg','/manifest.webmanifest',/* BUILD_ASSETS */];
const PRECACHE=['/','/icon.svg','/manifest.webmanifest',/* BUILD_ENTRY_ASSETS */];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE))));
self.addEventListener('message',event=>{if(event.data?.type!=='REQUEST_SAFE_ACTIVATION')return;event.waitUntil((async()=>{
 const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const votes=await Promise.all(tabs.map(tab=>new Promise(resolve=>{const channel=new MessageChannel();const timeout=setTimeout(()=>resolve(false),1500);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data?.safe===true);channel.port1.close();};tab.postMessage({type:'CAN_UPDATE'},[channel.port2]);})));
 if(votes.length&&votes.every(Boolean))await self.skipWaiting();
})());});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('midnight-shell-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||event.request.headers.has('Authorization')||u.origin!==location.origin)return;
 if(event.request.mode==='navigate'&&['/','/terms','/privacy'].includes(u.pathname)){event.respondWith(caches.open(CACHE).then(cache=>cache.match('/')).then(cached=>cached||fetch(event.request)));return;}
 if(SHELL.includes(u.pathname)&&u.pathname.startsWith('/assets/'))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;})));
});
