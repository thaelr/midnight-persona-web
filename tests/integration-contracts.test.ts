import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiError,createGateway,type Gateway} from '../src/lib/gateway';
import {localeLanguage} from '../src/lib/auth';
import {translatePair} from '../src/lib/localization';
import {consumeOAuthError} from '../src/lib/oauthCallback';
import {recoverPurchases} from '../src/lib/purchaseRecovery';

test('public localization does not require or send a session and retains locale/namespace',async()=>{
 let tokens=0;const calls:Array<{url:string;init:RequestInit}>=[];
 const gateway=createGateway(async()=>{tokens++;throw new Error('no session');},{baseUrl:'https://gateway.example.test',fetchImpl:async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({locale:'fr',namespace:'web',copy:{Hello:'Bonjour'}});}});
 assert.equal((await gateway.localization('fr','web')).copy.Hello,'Bonjour');assert.equal(tokens,0);assert.equal(new Headers(calls[0].init.headers).has('Authorization'),false);assert.match(calls[0].url,/\/web\/localizations\/fr\/web$/);
});
test('new locale matching and missing-copy fallback do not restrict types to RU/EN',()=>{
 assert.equal(localeLanguage('fr-CA',['ru','en','fr']),'fr');assert.equal(localeLanguage('kk-KZ',['ru','en']),'ru');assert.equal(localeLanguage('de-DE',['ru','en']),'en');assert.equal(localeLanguage(undefined,['ru','en']),null);
 assert.equal(translatePair('fr',{Save:'Enregistrer'},'Сохранить','Save'),'Enregistrer');assert.equal(translatePair('fr',{},'Сохранить','Save'),'Save');
});
test('reset mode, profile text, providerless feature and paid-video receipt use exact contracts',async()=>{
 const calls:Array<{url:string;body:unknown}>=[];const g=createGateway(async()=>'token',{baseUrl:'https://gateway.example.test',fetchImpl:async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});return Response.json({});}});
 await g.reset('c1234567',{client_message_id:'same',scene_mode:'roleplay'});await g.updateProfile({display_name:'Name',profile_text:'A note'});await g.createPurchase({client_message_id:'benefit',chat_code:'c1234567',sku:'server-feature'});await g.videoDelivery('receipt');
 assert.deepEqual(calls[0].body,{client_message_id:'same',scene_mode:'roleplay'});assert.deepEqual(calls[1].body,{display_name:'Name',profile_text:'A note'});assert.equal(Object.hasOwn(calls[2].body as object,'provider'),false);assert.match(calls[3].url,/video-deliveries\/receipt$/);
});
test('OAuth callback errors are consumed without exposing provider descriptions or removing PKCE code',()=>{
 const r=consumeOAuthError(new URL('https://app.example.test/?code=pkce&error_code=identity_already_exists&error_description=private#profile'));
 assert.equal(r.code,'identity_already_exists');assert.equal(r.cleanUrl,'/?code=pkce#profile');
 const h=consumeOAuthError(new URL('https://app.example.test/#error=access_denied&error_description=private'));assert.equal(h.cleanUrl,'/');assert.equal(h.code,'access_denied');
});
class MemoryStorage implements Storage{
 data=new Map<string,string>();get length(){return this.data.size;}clear(){this.data.clear();}getItem(k:string){return this.data.get(k)??null;}key(i:number){return [...this.data.keys()][i]??null;}removeItem(k:string){this.data.delete(k);}setItem(k:string,v:string){this.data.set(k,v);}
}
const purchase={purchase_id:'paid-receipt',status:'fulfilled',kind:'feature',provider:'nowpayments',sku:'video',price:{amount:'19',currency:'RUB'},checkout_url:null,media_id:'photo',created_at:'2026-11-03',updated_at:'2026-11-03'} as const;
test('paid Video Unlock recovery uses its delivery only, survives eligible_at and never purchases again',async()=>{
 const storage=new MemoryStorage();storage.setItem('own:receipt',JSON.stringify({purchaseId:'paid-receipt'}));storage.setItem('other:receipt',JSON.stringify({purchaseId:'foreign'}));let polls=0,settled=0;
 const gateway={purchase:async(id:string)=>{assert.equal(id,'paid-receipt');return {...purchase,video_delivery_id:'video-receipt'};},videoDelivery:async(id:string)=>{assert.equal(id,'video-receipt');polls++;if(polls===1)throw new Error('not eligible');return {status:'delivered'};},createPurchase:()=>assert.fail('must not purchase'),requestVideo:()=>assert.fail('must use paid receipt')} as unknown as Gateway;
 await recoverPurchases(gateway,storage,'own:',()=>settled++);await recoverPurchases(gateway,storage,'own:',()=>settled++);await recoverPurchases(gateway,storage,'own:',()=>settled++);
 assert.equal(polls,2);assert.equal(settled,1);assert.equal(JSON.parse(storage.getItem('own:receipt')!).deliveryCompleted,true);
});
test('Full photo-offer recovery keeps panel context and one idempotent delivery request',async()=>{
 const storage=new MemoryStorage();storage.setItem('own:receipt',JSON.stringify({purchaseId:'paid-receipt',animateMediaId:'panel-photo',chatCode:'c1234567'}));let requested=0,polls=0;
 const gateway={purchase:async()=>({...purchase,kind:'subscription'}),requestVideo:async(code:string,media:string,key:string)=>{requested++;assert.equal(code,'c1234567');assert.equal(media,'panel-photo');assert.equal(key,'full:paid-receipt');return {delivery_id:'full-delivery'};},videoDelivery:async()=>{polls++;return {status:polls===1?'pending':'delivered'};},createPurchase:()=>assert.fail('must not purchase')} as unknown as Gateway;
 await recoverPurchases(gateway,storage,'own:',()=>{});await recoverPurchases(gateway,storage,'own:',()=>{});assert.equal(requested,1);assert.equal(polls,2);
});

test('Full succeeds but a stale photo panel ends animation recovery with one explicit notice',async()=>{
 const storage=new MemoryStorage();storage.setItem('own:receipt',JSON.stringify({purchaseId:'paid-receipt',animateMediaId:'old-panel',chatCode:'c1234567'}));let requests=0;const notices:Array<{status:string;animation_error?:string}>=[];
 const gateway={purchase:async()=>({...purchase,kind:'subscription'}),requestVideo:async()=>{requests++;throw new ApiError(409,'video_unavailable');},createPurchase:()=>assert.fail('must not create another purchase')} as unknown as Gateway;
 await recoverPurchases(gateway,storage,'own:',p=>notices.push(p));await recoverPurchases(gateway,storage,'own:',p=>notices.push(p));
 assert.equal(requests,1);assert.deepEqual(notices.map(p=>[p.status,p.animation_error]),[['fulfilled','video_unavailable']]);assert.equal(JSON.parse(storage.getItem('own:receipt')!).animationError,'video_unavailable');
});

test('photopanel actions preserve server anchor, current selection and retry ID without sending a photo URL',async()=>{
 const calls:Array<{url:string;body:unknown}>=[];const g=createGateway(async()=>'token',{baseUrl:'https://gateway.example.test',fetchImpl:async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});return Response.json({media_id:'selected',photo_url:null,unlocked:false,scene_session_id:'scene',actions:{previous:false,next:false,more:false}});}});
 await g.photoPanel('c1234567','anchor','selected');const input={client_message_id:'persistent-panel-request',action:'photo_regen' as const,current_media_id:'selected'};await g.photoPanelAction('c1234567','anchor',input);await g.photoPanelAction('c1234567','anchor',input);
 assert.match(calls[0].url,/\/media\/anchor\/panel\?current_media_id=selected$/);assert.deepEqual(calls[1].body,input);assert.deepEqual(calls[2].body,input);assert.equal(Object.hasOwn(calls[1].body as object,'photo_url'),false);
});
