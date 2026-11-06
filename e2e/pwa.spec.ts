import {test,expect,type Page} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
test.use({serviceWorkers:'allow'});
let server:ChildProcess;
test.beforeAll(async()=>{server=spawn(process.execPath,['e2e/pwa-server.mjs'],{stdio:'ignore',windowsHide:true});for(let i=0;i<30;i++){try{await fetch('http://127.0.0.1:5178/terms');return;}catch{await new Promise(r=>setTimeout(r,100));}}throw new Error('PWA fixture unavailable');});
test.afterAll(()=>server?.kill());
async function hourInBackground(page:Page){await page.evaluate(()=>{const real=Date.now;Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));Date.now=()=>real()+3_600_001;Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});}
test('A20 real waiting worker waits for both tabs and active video, then replaces the shell once',async({context,page,request})=>{
 await page.goto('http://127.0.0.1:5178/terms');await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const second=await context.newPage();await second.goto('http://127.0.0.1:5178/privacy');await second.evaluate(()=>navigator.serviceWorker.ready);
 expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);
 await request.put('http://127.0.0.1:5178/__test/version?v=B');await hourInBackground(page);
 await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
 await page.waitForTimeout(300);expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true,'the other visible tab vetoes');
 await second.evaluate(()=>{const video=document.createElement('video');video.id='playing-fixture';Object.defineProperty(video,'paused',{value:false});Object.defineProperty(video,'ended',{value:false});document.body.append(video);});
 await hourInBackground(second);await second.waitForTimeout(300);expect(await second.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true,'active video vetoes');
 let reloads=0;second.on('framenavigated',frame=>{if(frame===second.mainFrame())reloads++;});await second.evaluate(()=>{document.getElementById('playing-fixture')!.remove();document.dispatchEvent(new Event('pause'));});
 await expect.poll(()=>reloads).toBe(1);await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);await second.waitForTimeout(200);expect(reloads).toBe(1);
 const caches=await page.evaluate(()=>window.caches.keys());expect(caches.filter(k=>k.startsWith('midnight-shell-'))).toEqual(['midnight-shell-fixture-B']);
 expect(await page.evaluate(async()=>{const c=await window.caches.open('midnight-shell-fixture-B');return (await c.keys()).some(r=>/config|auth|commerce|media/.test(new URL(r.url).pathname));})).toBe(false);
});
