import {test,expect} from '@playwright/test';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

test.skip(!process.env.MP_LOCAL_N8N,'Requires the isolated native n8n/Gateway/Postgres stack');
test('local-integrated native n8n: recovered operation completes once; new browser message reaches Writer and survives reload',async({context,page,request})=>{
 test.setTimeout(60_000);
 const evidenceRoot=resolve(existsSync('../DELIVERY_MANIFEST.json')?'../verification':'../../verification');
 const fixture=JSON.parse(readFileSync(resolve(evidenceRoot,'browser-fixture.json'),'utf8'));
 const previous=JSON.parse(readFileSync(resolve(evidenceRoot,'browser-local-http.json'),'utf8'));
 expect(fixture.worker).toBe(true);
 await context.addInitScript(f=>{
  localStorage.setItem('mp.language','en');localStorage.setItem('sb-mp-test-auth-token',JSON.stringify({access_token:f.accessToken,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:36000,expires_at:f.expires,user:{id:f.authId,aud:'authenticated',role:'authenticated',app_metadata:{provider:'anonymous'},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'}}));
 },fixture);
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/config.json')return route.fulfill({json:{apiBaseUrl:fixture.gateway,supabaseUrl:'https://mp-test.supabase.co',supabasePublishableKey:'fixture-public-key',termsUrl:'https://midnightpersona.app/terms',privacyUrl:'https://midnightpersona.app/privacy',telegramAuthProvider:'custom:telegram'}});
  if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  return route.abort();
 });
 const headers={Authorization:'Bearer '+fixture.accessToken};
 const chatUrl=fixture.gateway+'/web/chats/'+previous.chat_code;
 const recovered=await (await request.get(chatUrl+'/events?after=0&operation_ids='+previous.operation_id,{headers})).json();
 expect(recovered.operations[0].status).toBe('completed');
 const cursors=recovered.events.map((e:any)=>BigInt(e.cursor));
 expect(cursors.every((c:bigint,i:number)=>i===0||c>cursors[i-1])).toBe(true);
 const before=await (await request.get(chatUrl+'/messages',{headers})).json();
 expect(before.messages.filter((m:any)=>m.role==='user'&&m.text==='Neutral local delivery test')).toHaveLength(1);
 await page.goto('/#chats/'+previous.chat_code);await expect(page.getByRole('log')).toBeVisible();
 const text='A neutral question about the weather '+crypto.randomUUID().slice(0,8);
 await page.getByRole('textbox').fill(text);
 const post=page.waitForResponse(r=>r.url()===chatUrl+'/messages'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Send message'}).click();const response=await post;expect(response.status()).toBe(202);
 const operation=await response.json();
 await expect.poll(async()=>{const r=await request.get(chatUrl+'/events?after=0&operation_ids='+operation.operation_id,{headers});return (await r.json()).operations[0]?.status;},{timeout:40_000,intervals:[300,500,1000]}).toBe('completed');
 const after=await (await request.get(chatUrl+'/messages',{headers})).json();
 const user=after.messages.filter((m:any)=>m.role==='user'&&m.text===text);expect(user).toHaveLength(1);
 const replies=after.messages.filter((m:any)=>m.role==='assistant');
 expect(replies.length).toBe(before.messages.filter((m:any)=>m.role==='assistant').length+1);
 const expected=replies.at(-1).text as string;
 expect(expected).toMatch(/^(A cool breeze|Sunlight catches|A small bird|Clouds drift|The fountain|Fresh air)/);
 await page.reload();await expect(page.getByText(text,{exact:true})).toBeVisible();
 await expect(page.getByRole('log').getByText(expected,{exact:true})).toBeVisible();
 await page.waitForTimeout(400); // Allow the existing message entrance animation to finish for visual QA.
 await page.screenshot({path:resolve(evidenceRoot,'local-native-chat.png'),fullPage:true});
 writeFileSync(resolve(evidenceRoot,'browser-native-results.json'),JSON.stringify({classification:'local-integrated browser/HTTP Gateway/Postgres/native n8n/Core/SQL; synthetic Auth/payment/LLM only',recovered_operation_id:previous.operation_id,new_operation_id:operation.operation_id,new_operation_status:'completed',user_rows:user.length,new_assistant_rows:1,numeric_cursors_monotone:true},null,2));
});
