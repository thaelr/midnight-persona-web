import {test,expect,type BrowserContext} from '@playwright/test';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Separate opt-in suite. No /web route is mocked: browser -> HTTP Gateway -> Postgres.
test.skip(!process.env.MP_LOCAL_INTEGRATED,'Requires isolated Gateway/Postgres fixture');
test.describe.configure({mode:'serial'});
const evidenceRoot=resolve(existsSync('../DELIVERY_MANIFEST.json')?'../verification':'../../verification');
const fixturePath=resolve(evidenceRoot,'browser-fixture.json');
function fixture(){return JSON.parse(readFileSync(fixturePath,'utf8')) as {authId:string;userId:string;accessToken:string;expires:number;gateway:string;worker:boolean};}
async function realApp(context:BrowserContext){
 const f=fixture();const counts:Record<string,number>={};
 await context.addInitScript(f=>{
  localStorage.setItem('mp.language','en');
  localStorage.setItem('sb-mp-test-auth-token',JSON.stringify({access_token:f.accessToken,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:36000,expires_at:f.expires,user:{id:f.authId,aud:'authenticated',role:'authenticated',app_metadata:{provider:'anonymous'},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'}}));
 },f);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/config.json')return route.fulfill({json:{apiBaseUrl:f.gateway,supabaseUrl:'https://mp-test.supabase.co',supabasePublishableKey:'fixture-public-key',termsUrl:'https://midnightpersona.app/terms',privacyUrl:'https://midnightpersona.app/privacy',telegramAuthProvider:'custom:telegram'}});
  if(u.origin===f.gateway){counts[u.pathname]=(counts[u.pathname]??0)+1;return route.continue();}
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();
  // Prevent actual auth, billing, remote images or telemetry in the local suite.
  return route.abort();
 });
 return {f,counts,headers:{Authorization:'Bearer '+f.accessToken}};
}
test('local-integrated: zero-chat account catalog, durable two-client checkout, no duplicate provider call',async({context,page,request})=>{
 const {f,headers}=await realApp(context);
 await page.goto('/#profile');await expect(page.getByRole('heading',{name:'Your side'})).toBeVisible();
 const chats=await request.get(f.gateway+'/web/chats',{headers});expect(chats.ok()).toBe(true);expect((await chats.json()).chats).toHaveLength(0);
 await page.getByRole('button',{name:/Subscription/}).click();await expect(page.getByRole('button',{name:/Base/}).first()).toBeEnabled();
 const catalog=await (await request.get(f.gateway+'/web/commerce/catalog',{headers})).json();
 const plan=catalog.products.find((p:any)=>p.kind==='subscription'&&p.providers.includes('sbp'));expect(plan).toBeTruthy();
 const before=await (await request.get(f.gateway+'/fixture/metrics')).json();
 const ids=[crypto.randomUUID(),crypto.randomUUID()];
 const purchases=await Promise.all(ids.map(client_message_id=>request.post(f.gateway+'/web/commerce/purchases',{headers,data:{client_message_id,sku:plan.sku,provider:'sbp'}})));
 const bodies=await Promise.all(purchases.map(async r=>{expect(r.ok()).toBe(true);return r.json();}));
 expect(bodies[0].purchase_id).toBe(bodies[1].purchase_id);expect(bodies[0].price).toEqual(plan.price);expect(bodies[0].status).not.toBe('fulfilled');
 const after=await (await request.get(f.gateway+'/fixture/metrics')).json();expect(after.providerCreates-before.providerCreates).toBe(1);
 for(const client_message_id of ids){const retry=await request.post(f.gateway+'/web/commerce/purchases',{headers,data:{client_message_id,sku:plan.sku,provider:'sbp'}});expect((await retry.json()).purchase_id).toBe(bodies[0].purchase_id);}
 expect((await (await request.get(f.gateway+'/web/chats',{headers})).json()).chats).toHaveLength(0);
});
test('local-integrated: catalog, actual chat queue, active-only polling and reload preserve operation',async({context,page,request})=>{
 const {f,headers,counts}=await realApp(context);
 await page.goto('/#characters');await expect(page.getByRole('button',{name:/Neutral character 1/}).first()).toBeVisible();
 await page.waitForTimeout(1500);expect(Object.keys(counts).some(p=>/\/(events|messages|media)$/.test(p))).toBe(false);
 const response=await request.post(f.gateway+'/web/chats',{headers,data:{character_i:1,scene_mode:'roleplay',client_message_id:crypto.randomUUID()}});expect(response.status()).toBe(202);
 const created=await response.json();expect(created.operation.status).toBe('accepted');
 const code=created.chat.chat_code;
 await page.goto('/#chats/'+code);await expect(page.getByRole('log')).toBeVisible();
 await page.getByRole('textbox').fill('Neutral local delivery test');
 const accepted=page.waitForResponse(r=>r.url().endsWith('/'+code+'/messages')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Send message'}).click();const result=await accepted;expect(result.status()).toBe(202);const operation=await result.json();expect(operation.status).toBe('accepted');
 await page.reload();await expect(page.getByRole('log')).toBeVisible();
 await page.waitForTimeout(2500);
 const operations=await request.get(f.gateway+'/web/chats/'+code+'/events?after=0&operation_ids='+operation.operation_id,{headers});
 const journal=await operations.json();expect(journal.operations[0].operation_id).toBe(operation.operation_id);expect(journal.operations[0].status).toBe('accepted');
 expect(Object.keys(counts).filter(p=>/\/(events|messages|media)$/.test(p)).every(p=>p.includes('/'+code+'/'))).toBe(true);
 writeFileSync(resolve(evidenceRoot,'browser-local-http.json'),JSON.stringify({classification:'local-integrated HTTP/Postgres; synthetic Auth/payment; delivery worker disabled',counts,chat_code:code,operation_id:operation.operation_id},null,2));
});
test('local-integrated: profile persists through HTTP/SQL; mobile layout remains usable',async({context,page,request})=>{
 const {f,headers}=await realApp(context);
 const saved=await request.patch(f.gateway+'/web/me',{headers,data:{display_name:'Persisted local reader'}});expect(saved.ok()).toBe(true);
 await page.setViewportSize({width:320,height:568});await page.goto('/#profile');await expect(page.getByText('Persisted local reader',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Persisted local reader',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:resolve(evidenceRoot,'local-profile-mobile.png'),fullPage:true});
});
