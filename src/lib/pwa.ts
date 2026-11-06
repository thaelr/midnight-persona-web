import {isUpdateSafe} from './activity';
import {reportError} from './diagnostics';
export const HIDDEN_UPDATE_MS=60*60*1000;
export const backgroundEligible=(hiddenAt:number|null,now:number)=>hiddenAt!==null&&now-hiddenAt>=HIDDEN_UPDATE_MS;
export function installPwaUpdates(registration:ServiceWorkerRegistration){
 const key='mp.pwa.hiddenAt';let hiddenAt:number|null=null,eligible=false,requested=false,recheck=false,updating=false,disposed=false;
 try{const saved=sessionStorage.getItem(key);if(saved)hiddenAt=Number(saved)||null;}catch{}
 const safe=()=>eligible&&document.visibilityState==='visible'&&isUpdateSafe();
 const refresh=()=>{
  if(updating)return;updating=true;
  void Promise.resolve().then(()=>registration.update()).catch(error=>reportError('pwa','update',error)).finally(()=>{updating=false;if(!disposed)check();});
 };
 const check=()=>{if(disposed||document.visibilityState!=='visible')return;if(hiddenAt!==null){const returnedAfterHour=backgroundEligible(hiddenAt,Date.now());eligible ||= returnedAfterHour;hiddenAt=null;try{sessionStorage.removeItem(key);}catch{}if(returnedAfterHour)refresh();}if(!updating&&eligible&&safe()&&registration.waiting){if(requested){recheck=true;return;}requested=true;registration.waiting.postMessage({type:'REQUEST_SAFE_ACTIVATION'});setTimeout(()=>{requested=false;if(recheck){recheck=false;check();}},3000);}};
 const visibility=()=>{if(document.visibilityState==='hidden'){hiddenAt=Date.now();try{sessionStorage.setItem(key,String(hiddenAt));}catch{}}else check();};
 const message=(event:MessageEvent)=>{if(event.data?.type==='CAN_UPDATE'){eligible ||= backgroundEligible(hiddenAt,Date.now());event.ports[0]?.postMessage({safe:eligible&&isUpdateSafe()});}};
 const changed=()=>{if(!eligible||!isUpdateSafe())return;const marker='mp.pwa.reloaded';const version=registration.active?.scriptURL??'sw';try{const prior=JSON.parse(sessionStorage.getItem(marker)||'null');if(prior?.version===version&&Date.now()-prior.at<10_000)return;sessionStorage.setItem(marker,JSON.stringify({version,at:Date.now()}));sessionStorage.removeItem(key);}catch{}location.reload();};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',check);window.addEventListener('mp-activity',check);document.addEventListener('pause',check,true);document.addEventListener('ended',check,true);navigator.serviceWorker.addEventListener('message',message);navigator.serviceWorker.addEventListener('controllerchange',changed);
 registration.addEventListener('updatefound',()=>{registration.installing?.addEventListener('statechange',check);});check();
 return()=>{disposed=true;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',check);window.removeEventListener('mp-activity',check);document.removeEventListener('pause',check,true);document.removeEventListener('ended',check,true);navigator.serviceWorker.removeEventListener('message',message);navigator.serviceWorker.removeEventListener('controllerchange',changed);};
}
export async function registerPwa(){try{const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});installPwaUpdates(registration);}catch(e){reportError('pwa','register',e);}}
