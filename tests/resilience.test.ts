import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,ApiError} from '../src/lib/gateway';
import {pollDelay} from '../src/lib/polling';
import {retryRead} from '../src/lib/queries';
import {validCriticalResponse} from '../src/lib/runtimeContract';
import {backgroundEligible,HIDDEN_UPDATE_MS,installPwaUpdates} from '../src/lib/pwa';
import {setActivity} from '../src/lib/activity';
test('read retries are bounded and never repeat authorization/business errors',()=>{
 for(const status of [400,401,403,404,409,422])assert.equal(retryRead(0,new ApiError(status,'error')),false);
 assert.equal(retryRead(0,new ApiError(503,'unavailable')),true);assert.equal(retryRead(2,new ApiError(503,'unavailable')),false);
 assert.equal(retryRead(0,new ApiError(0,'request_aborted')),false);
 assert.equal(pollDelay(0,true,()=>0),1500);assert.equal(pollDelay(0,false,()=>0),12000);
 assert.ok(pollDelay(100,true,()=>1)<=36000);assert.ok(pollDelay(1,false,()=>0)<pollDelay(3,false,()=>0));
});
test('account switch abort ignores a late response even if the transport ignores AbortSignal',async()=>{
 let resolve!:(r:Response)=>void;const gateway=createGateway(async()=>'fixture',{baseUrl:'https://gateway.test',fetchImpl:()=>new Promise(r=>{resolve=r;})});
 const pending=gateway.chats();await new Promise(r=>setImmediate(r));gateway.abortPending();resolve(Response.json({chats:[{private:'old owner'}]}));
 await assert.rejects(pending,(e:unknown)=>e instanceof ApiError&&e.code==='request_aborted');
});
test('critical runtime boundaries reject malformed bootstrap, money, entitlements and event envelopes',()=>{
 assert.equal(validCriticalResponse('/web/auth/bootstrap',{user_id:'id'}),false);
 assert.equal(validCriticalResponse('/web/commerce/purchases/id',{purchase_id:'id',status:'fulfilled',price:{amount:10,currency:'USD'},checkout_url:null}),false);
 assert.equal(validCriticalResponse('/web/commerce/entitlements',{subscription_sku:null,subscription_until:null,balances:{photo:-1}}),false);
 assert.equal(validCriticalResponse('/web/chats/chat/events',{cursor:'1',events:[{cursor:'2',created_at:'now',type:'message',data:{role:'assistant'}}]}),false);
 assert.equal(validCriticalResponse('/web/chats/chat/events',{cursor:'9007199254740993',events:[]}),true);
});
test('PWA checks once after a background hour, defers drafts, and reloads once after safe activation',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:1_000_000});
 const documentMock=Object.assign(new EventTarget(),{visibilityState:'visible',querySelectorAll:()=>[]});
 const windowMock=new EventTarget(),sw=new EventTarget();let activations=0,reloads=0,updates=0,finishUpdate!:()=>void;
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};
 const previous={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,sessionStorage:globalThis.sessionStorage,location:globalThis.location};
 Object.defineProperties(globalThis,{window:{value:windowMock,configurable:true},document:{value:documentMock,configurable:true},navigator:{value:{serviceWorker:sw},configurable:true},sessionStorage:{value:storage,configurable:true},location:{value:{reload:()=>reloads++},configurable:true}});
 const registration=Object.assign(new EventTarget(),{waiting:{postMessage:()=>activations++},active:{scriptURL:'/sw.js'},update:()=>{updates++;return new Promise<void>(resolve=>{finishUpdate=resolve;});}});
 const dispose=installPwaUpdates(registration as unknown as ServiceWorkerRegistration);
 t.mock.timers.tick(HIDDEN_UPDATE_MS);windowMock.dispatchEvent(new Event('focus'));assert.equal(activations,0,'one hour visible is not eligible');
 documentMock.visibilityState='hidden';documentMock.dispatchEvent(new Event('visibilitychange'));t.mock.timers.tick(HIDDEN_UPDATE_MS-1);documentMock.visibilityState='visible';documentMock.dispatchEvent(new Event('visibilitychange'));assert.equal(activations,0);
 t.mock.timers.tick(HIDDEN_UPDATE_MS);windowMock.dispatchEvent(new Event('focus'));assert.equal(activations,0,'foreground after a short background does not count');
 assert.equal(updates,0,'neither visible time nor a short background requests an update');
 documentMock.visibilityState='hidden';documentMock.dispatchEvent(new Event('visibilitychange'));t.mock.timers.tick(HIDDEN_UPDATE_MS);setActivity('test-draft',true);documentMock.visibilityState='visible';documentMock.dispatchEvent(new Event('visibilitychange'));assert.equal(activations,0,'draft defers activation');
 windowMock.dispatchEvent(new Event('focus'));windowMock.dispatchEvent(new Event('mp-activity'));await new Promise(r=>setImmediate(r));assert.equal(updates,1,'focus and activity share the same in-flight check');
 finishUpdate();await new Promise(r=>setImmediate(r));assert.equal(activations,0,'finishing update does not bypass the draft');
 windowMock.dispatchEvent(new Event('focus'));assert.equal(updates,1,'the consumed background interval is not checked twice');
 setActivity('test-draft',false);assert.equal(activations,1);sw.dispatchEvent(new Event('controllerchange'));sw.dispatchEvent(new Event('controllerchange'));assert.equal(reloads,1);
 assert.equal(backgroundEligible(null,Date.now()),false);dispose();
 // Restored page: a saved background timestamp cannot beat identity/draft hydration.
 activations=0;storage.setItem('mp.pwa.hiddenAt',String(Date.now()-HIDDEN_UPDATE_MS));setActivity('initialization',true);
 const restored=installPwaUpdates(registration as unknown as ServiceWorkerRegistration);assert.equal(activations,0);
 await new Promise(r=>setImmediate(r));assert.equal(updates,2);finishUpdate();await new Promise(r=>setImmediate(r));assert.equal(activations,0);
 setActivity('test-draft',true);setActivity('initialization',false);assert.equal(activations,0);
 setActivity('test-draft',false);assert.equal(activations,1);restored();
 for(const [key,value]of Object.entries(previous))Object.defineProperty(globalThis,key,{value,configurable:true});
});
