import type {BrowserContext} from '@playwright/test';
export const userId='00000000-0000-4000-8000-000000000001';
export const profile={user_id:userId,display_name:'Test reader',language:'en',language_confirmed_at:'2026-01-01T00:00:00Z',profile_text:null,age_confirmed_at:'2026-01-01T00:00:00Z',terms_accepted_at:'2026-01-01T00:00:00Z',subscription_sku:null,subscription_until:null,entitlements:{},needs_language_selection:false};
export const chat=(i:number)=>({chat_code:'chat'+i,character_i:i,scene_mode:'fast',scene_session_id:'scene'+i,turn_no:1,scene_turn_no:1,updated_at:'2026-01-01T00:00:00Z',origin:i===1?'telegram':'web',last_message:null,unread_count:0,last_read_message_id:null});
export const product={sku:'fixture-base',kind:'subscription',title:'Base',description:'Fixture plan',price:{amount:'10',currency:'USD'},original_price:null,promo_key:null,providers:['test'],requires_chat:false,subscription_tier:'base'};
export async function mockApp(context:BrowserContext,options:{session?:boolean;chats?:number;localizationStatus?:number;bootstrapStatus?:number;optionalFailure?:boolean;locks?:boolean;crash?:boolean}={}){
 const counts:Record<string,number>={},writes:Array<{path:string;body:any}>=[];let cursor=1;let events:any[]=[];const messages:any[]=[];let purchases=0;
 const list=Array.from({length:options.chats??10},(_,i)=>chat(i+1));
 await context.addInitScript(({session,userId,locks})=>{localStorage.setItem('mp.language','en');if(locks===false)Object.defineProperty(navigator,'locks',{value:undefined});if(session){const expires=Math.floor(Date.now()/1000)+36000;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:userId,exp:expires}))+'.test';localStorage.setItem('sb-mp-test-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:36000,expires_at:expires,user:{id:userId,aud:'authenticated',role:'authenticated',app_metadata:{provider:'anonymous'},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'}}));}}, {session:options.session!==false,userId,locks:options.locks});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname==='/config.json')return route.fulfill({json:{apiBaseUrl:'https://gateway.test',supabaseUrl:'https://mp-test.supabase.co',supabasePublishableKey:'fixture-public-key',termsUrl:'https://midnightpersona.app/terms',privacyUrl:'https://midnightpersona.app/privacy',telegramAuthProvider:'custom:telegram'}});
  if(u.pathname==='/neutral.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#8050b0"/></svg>'});
  if(u.hostname==='gateway.test'){
   const path=u.pathname;counts[path]=(counts[path]??0)+1;const body=req.postDataJSON();if(req.method()!=='GET')writes.push({path,body});
   const reply=(json:any,status=200)=>route.fulfill({json,status});
   if(path==='/web/localizations')return reply(options.localizationStatus?{error:'unavailable'}:{languages:[{locale:'ru',display_name:'Русский'},{locale:'en',display_name:'English'}]},options.localizationStatus??200);
   if(path.startsWith('/web/localizations/'))return reply({locale:'en',namespace:path.split('/').at(-1),copy:{}});
   if(path==='/web/auth/bootstrap')return reply(options.bootstrapStatus?{error:'unavailable'}:profile,options.bootstrapStatus??200);
   if(path==='/web/me')return reply({...profile,...(body??{})});
   if(path==='/web/characters')return reply({characters:options.crash?[null]:list.map((c,i)=>({character_i:c.character_i,name:'Character '+(i+1),description:'Neutral test fixture',image_url:'http://127.0.0.1:5177/neutral.svg',gallery_photos:[],modes:['fast','roleplay'],chat_code:c.chat_code}))});
   if(path==='/web/chats')return reply({chats:list});
   if(path==='/web/chat-summaries')return reply(options.optionalFailure?{error:'unavailable'}:{chats:[]},options.optionalFailure?503:200);
   if(path==='/web/publications')return reply(options.optionalFailure?{error:'unavailable'}:{posts:[],next_before:null},options.optionalFailure?503:200);
   if(path==='/web/voting')return reply({campaign:null});
   if(path.endsWith('/messages')&&req.method()==='GET')return reply({messages,next_before:null,event_cursor:String(cursor),quick_replies:null});
   if(path.endsWith('/messages')&&req.method()==='POST'){const id='00000000-0000-4000-8000-000000000010';if(!messages.some(m=>m.client_message_id===body.client_message_id)){const m={id:'m:'+body.client_message_id,client_message_id:body.client_message_id,role:'user',text:body.text,source:'web',scene_session_id:'scene1',turn_no:2,created_at:new Date().toISOString()};messages.push(m);events.push({cursor:String(++cursor),type:'message',data:m,created_at:m.created_at});}return reply({operation_id:id,event_id:id,status:'completed',action:'message',chat_code:'chat1'});}
   if(path.endsWith('/events'))return reply({events:events.filter(e=>BigInt(e.cursor)>BigInt(u.searchParams.get('after')??'0')),cursor:String(cursor),operations:[]});
   if(path.endsWith('/continuation'))return reply({offered:false,separator:'---',messages:[],chat:list[0]});
   if(path.endsWith('/media'))return reply({media:[],video_deliveries:[]});
   if(path.endsWith('/read'))return reply({read:true});
   if(path==='/web/commerce/catalog')return reply({products:[product],providers:['test'],pricing_requires_chat:false});
   if(path==='/web/commerce/entitlements')return reply({subscription_sku:null,subscription_until:null,subscription_active:false,balances:{}});
   if(path.startsWith('/web/commerce/purchases')){if(req.method()==='POST')purchases++;return reply({purchase_id:'fixture-purchase',status:'fulfilled',sku:product.sku,kind:'subscription',provider:'test',price:product.price,checkout_url:null,media_id:null,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'});}
   if(path==='/web/me/telegram-link')return reply({linked:false,available:false,telegram_user_id:null});
   return reply({error:'fixture_unhandled'},404);
  }
  if(u.hostname==='mp-test.supabase.co')return route.fulfill({json:u.pathname.endsWith('/logout')?{}:{...profile,id:userId}});
  if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  return route.abort();
 });
 return {counts,writes,get purchases(){return purchases;}};
}
