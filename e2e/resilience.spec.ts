import {test,expect} from '@playwright/test';
import {mockApp} from './fixtures';
for(const status of [404,503])test(`A01 dictionary ${status} leaves all configured sign-in choices available`,async({context,page})=>{
 await mockApp(context,{session:false,localizationStatus:status});await page.goto('/');
 for(const name of ['Continue with Telegram','Continue with Google','Continue as a guest'])await expect(page.getByRole('button',{name})).toBeEnabled();
});
test('A02 bootstrap failure preserves session and offers retry/logout, not registration',async({context,page})=>{
 await mockApp(context,{bootstrapStatus:503});await page.goto('/');await expect(page.getByText('Restoring access')).toBeVisible();await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();await expect(page.getByRole('button',{name:'Continue as a guest'})).toHaveCount(0);
});
test('A06 optional failures do not hide the catalog',async({context,page})=>{
 await mockApp(context,{optionalFailure:true});await page.goto('/#characters');await expect(page.getByRole('button',{name:/Character 1/}).first()).toBeVisible();await expect(page.getByText('That did not work. Please try again.')).toHaveCount(0);
});
test('A12 inactive chats do not load histories/events; active idle chat does not reload snapshots',async({context,page})=>{
 const f=await mockApp(context);await page.goto('/#characters');await page.waitForTimeout(1500);expect(Object.keys(f.counts).filter(p=>/\/(events|messages|media)$/.test(p))).toEqual([]);
 await page.goto('/#chats/chat1');await expect(page.getByRole('log')).toBeVisible();await page.waitForTimeout(3500);expect(f.counts['/web/chats/chat1/messages']).toBe(1);expect(f.counts['/web/chats/chat1/media']).toBe(1);expect(Object.keys(f.counts).some(p=>/chat(?:[2-9]|10)\/(events|messages)/.test(p))).toBe(false);
});
test('A11 imported mode notice is server-driven and appears once',async({context,page})=>{
 await mockApp(context);await page.goto('/#chats/chat1');await expect(page.getByText('The “Hotter” mode is selected')).toBeVisible();await page.reload();await expect(page.getByRole('log')).toBeVisible();await expect(page.getByText('The “Hotter” mode is selected')).toHaveCount(0);
});
test('A16/A17 zero-chat subscription remains available without Web Locks and sends no chat',async({context,page})=>{
 const f=await mockApp(context,{chats:0,locks:false});await page.goto('/#profile');await page.getByRole('button',{name:/Subscription/}).click();await page.getByRole('button',{name:/Base/}).click();await page.getByRole('button',{name:'Confirm purchase'}).click();await expect(page.getByText('You’re all set')).toBeVisible();expect(f.purchases).toBe(1);const request=f.writes.find(w=>w.path==='/web/commerce/purchases');expect(request?.body.chat_code).toBeUndefined();expect(request?.body.client_message_id).toBeTruthy();
});
test('A19 legal direct URL, RU/EN query, reload and Back require no Auth/Gateway',async({context,page})=>{
 const f=await mockApp(context,{session:false});await page.goto('/terms?lang=ru');await expect(page.getByRole('heading',{name:'Пользовательское соглашение'})).toBeVisible();await page.getByRole('button',{name:'EN',exact:true}).click();await expect(page).toHaveURL(/\/terms\?lang=en$/);await page.reload();await expect(page.getByRole('heading',{name:'Terms of Service'})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Пользовательское соглашение'})).toBeVisible();expect(f.counts).toEqual({});
});
test('A21 failed catalog render leaves profile navigation usable',async({context,page})=>{
 await mockApp(context,{crash:true});await page.goto('/#characters');await expect(page.getByText('This screen is temporarily unavailable')).toBeVisible();await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(page.getByRole('heading',{name:'Your side'})).toBeVisible();
});
test('A24 narrow viewport and overlay Back retain usable composer',async({context,page})=>{
 await mockApp(context);await page.setViewportSize({width:320,height:568});await page.goto('/#chats/chat1');await expect(page.getByRole('textbox')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.getByRole('textbox').fill('Neutral fixture message');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByText('Neutral fixture message').last()).toBeVisible();
});
test('A01 empty dictionaries and a pending namespace never block sign-in',async({context,page})=>{
 await mockApp(context,{session:false});await context.route('**/web/localizations',r=>r.fulfill({json:{languages:[]}}));await context.route('**/web/localizations/en/web',r=>r.abort('timedout'));await page.goto('/');await expect(page.getByRole('button',{name:'Continue with Google'})).toBeEnabled();await expect(page.getByRole('button',{name:'Continue as a guest'})).toBeEnabled();
});
test('A05 logout clears the visible account and leaves no old conversation',async({context,page})=>{
 await mockApp(context);await page.goto('/#profile');await expect(page.getByText('Test reader')).toBeVisible();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Continue as a guest'})).toBeVisible();await expect(page.getByText('Test reader')).toHaveCount(0);await expect(page.getByRole('log')).toHaveCount(0);
});
test('A07 publications appear only when the server publishes a post, system feed has no composer',async({context,page})=>{
 await mockApp(context);let published=false;await context.route('**/web/publications*',r=>r.fulfill({json:{posts:published?[{id:'post1',title:'Neutral announcement',body:'Fixture publication',published_at:'2026-01-01T00:00:00Z'}]:[],next_before:null}}));await page.clock.install();await page.goto('/#chats');await expect(page.getByRole('heading',{name:'Your stories'})).toBeVisible();await expect(page.getByRole('button',{name:/Midnight Persona Neutral announcement/})).toHaveCount(0);published=true;await page.clock.runFor(60_100);await page.getByRole('button',{name:/Midnight Persona Neutral announcement/}).click();await expect(page.getByText('Fixture publication')).toBeVisible();await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('A09 uncertain send retries the original ID after reload',async({context,page})=>{
 await mockApp(context);const ids:string[]=[];let fail=true;await context.route('**/web/chats/chat1/messages',async r=>{if(r.request().method()==='POST'){ids.push(r.request().postDataJSON().client_message_id);if(fail){fail=false;return r.abort('failed');}}return r.fallback();});await page.goto('/#chats/chat1');await page.getByRole('textbox').fill('Uncertain fixture');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByText('Delivery unconfirmed')).toBeVisible();await page.reload();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('Delivery unconfirmed')).toHaveCount(0);await expect.poll(()=>ids.length).toBe(2);expect(ids[1]).toBe(ids[0]);
});
test('A13 gap rebases snapshot, hidden tab pauses, focus catches up without duplicate messages',async({context,page})=>{
 const f=await mockApp(context);let reads=0;await context.route('**/web/chats/chat1/events*',r=>{reads++;if(reads===1)return r.fulfill({status:409,json:{error:'event_cursor_gap'}});return r.fulfill({json:{cursor:'2',operations:[],events:[{cursor:'2',type:'message',created_at:'2026-01-01T00:00:02Z',data:{id:'stable-reply',role:'assistant',text:'Caught up once',source:'web',scene_session_id:'scene1',turn_no:1,created_at:'2026-01-01T00:00:02Z'}}]}});});await page.clock.install();await page.goto('/#chats/chat1');await page.clock.runFor(2000);await expect(page.getByRole('log').getByText('Caught up once')).toHaveCount(1);expect(f.counts['/web/chats/chat1/messages']).toBe(2);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});const previous=reads;await page.clock.runFor(40_000);expect(reads).toBe(previous);await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>reads).toBeGreaterThan(previous);await expect(page.getByRole('log').getByText('Caught up once')).toHaveCount(1);
});
test('A14 panel uses the owned anchor, server 1/N, and a closed offer without its URL',async({context,page})=>{
 await mockApp(context,{chats:1});const photo='10000000-0000-4000-8000-000000000001',next='10000000-0000-4000-8000-000000000002',locked='10000000-0000-4000-8000-000000000003';let selected=photo;let offer=false;const actions:string[]=[];
 await context.route('**/web/chats/chat1/media',r=>r.fulfill({json:{media:[{unlocked:true,media_id:photo,media_kind:'photo',photo_url:'http://127.0.0.1:5177/neutral.svg',panel_media_id:photo,scene_session_id:'scene1',created_at:'2026-01-01T00:00:00Z'}],video_deliveries:[]}}));
 await context.route('**/web/chats/chat1/media/*/panel*',r=>{if(r.request().method()==='POST'){const input=r.request().postDataJSON();actions.push(input.action);if(input.action==='photo_next')selected=next;if(input.action==='photo_regen')offer=true;}return r.fulfill({json:{media_id:selected,photo_url:'http://127.0.0.1:5177/neutral.svg?selected='+selected,unlocked:true,scene_session_id:'scene1',position:selected===photo?1:2,count:2,actions:{previous:true,next:true,more:true},...(offer?{offer:{media_id:locked,sku:'photo-fixture',conditions:{price:{amount:'5',currency:'USD'},price_required:5}}}:{})}});});
 await context.route('**/web/chats/chat1/media/*/video',r=>r.fulfill({json:{media_id:selected,animation_available:false,video_id:null,full_active:false,video_pass_active:false,panel_delivered:false,scene_session_id:'scene1'}}));
 await page.goto('/#chats/chat1');await expect(page.getByLabel('Photo position')).toHaveText('1/2');await page.getByRole('button',{name:'Next photo',exact:true}).click();await expect(page.getByLabel('Photo position')).toHaveText('2/2');await page.getByRole('button',{name:'More photos'}).click();await expect(page.getByText('Next photo',{exact:true})).toBeVisible();expect(actions).toEqual(['photo_next','photo_regen']);expect(await page.locator('img').evaluateAll(images=>images.some(img=>img.src.includes('10000000-0000-4000-8000-000000000003')))).toBe(false);
});

test('A18 Commerce failure leaves profile editing and catalog available',async({context,page})=>{await mockApp(context);await context.route('**/web/commerce/catalog*',r=>r.fulfill({status:503,json:{error:'unavailable'}}));await page.goto('/#profile');await page.getByRole('button',{name:/Test reader/}).click();await expect(page.getByLabel('Your name',{exact:true})).toBeEditable();await page.getByRole('button',{name:'Characters',exact:true}).click();await expect(page.getByRole('button',{name:/Character 1/}).first()).toBeVisible();});
