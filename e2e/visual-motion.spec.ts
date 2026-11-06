import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {mockApp,profile} from './fixtures';

const origin='http://127.0.0.1:5177';
const neutral='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#352348"/><circle cx="300" cy="300" r="110" fill="#765994"/><path d="M0 800L300 440L600 800" fill="#4d3466"/></svg>';
async function visualFixture(context:BrowserContext){
 const requests=await mockApp(context);
 await context.route('**/neutral.svg*',r=>r.fulfill({contentType:'image/svg+xml',body:neutral}));
 return requests;
}
async function settled(page:Page){await expect(page.locator('.catalog-motion-root')).toHaveAttribute('data-catalog-moving','false');}
async function swipe(page:Page,selector:string,dx:number,dy=0){
 const box=await page.locator(selector).boundingBox();expect(box).toBeTruthy();
 const x=box!.x+box!.width*.55,y=box!.y+box!.height*.45;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
}

test('motion: continuous carousel, loop, interruption and axis isolation',async({context,page})=>{
 await visualFixture(context);await page.setViewportSize({width:390,height:844});await page.goto('/');
 const root=page.locator('.catalog-motion-root');await expect(root).toHaveAttribute('data-catalog-active','1');
 await page.getByRole('button',{name:'Previous character',exact:true}).click();await settled(page);await expect(root).toHaveAttribute('data-catalog-active','vote');
 await page.getByRole('button',{name:'Next character',exact:true}).click();await settled(page);await expect(root).toHaveAttribute('data-catalog-active','1');
 await swipe(page,'.catalog-stage',-180);await settled(page);await expect(root).toHaveAttribute('data-catalog-active','2');
 await expect(page).toHaveURL(/\/$/);const active=await root.getAttribute('data-catalog-active');
 await swipe(page,'.catalog-stage',5,100);await expect(root).toHaveAttribute('data-catalog-active',active!);
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'Next character',exact:true}).click({force:true});
 await settled(page);await expect(root).toHaveAttribute('data-catalog-detail','');
 const ids=await page.locator('[data-catalog-id]').evaluateAll(items=>items.map(item=>item.getAttribute('data-catalog-id')));expect(new Set(ids).size).toBe(ids.length);
 expect(ids.length).toBeLessThanOrEqual(5);
 await page.setViewportSize({width:1440,height:900});await settled(page);
 expect(await page.locator('.catalog-card-motion').evaluateAll(nodes=>nodes.filter(n=>Number(getComputedStyle(n).opacity)>.1).length)).toBeGreaterThanOrEqual(3);
});

test('motion: selected image survives Grid/Swipe, detail and return',async({context,page})=>{
 await visualFixture(context);await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Next character',exact:true}).click();await settled(page);
 const id=await page.locator('.catalog-motion-root').getAttribute('data-catalog-active');
 const card=page.locator(`[data-catalog-source="${id}"]`);await card.evaluate(el=>el.setAttribute('data-identity-probe','retained'));
 await page.getByRole('button',{name:'Open catalog'}).click();await expect(card).toHaveAttribute('data-identity-probe','retained');
 await card.click();await expect(page.locator('.catalog-detail[data-catalog-present=true]')).toBeVisible();
 await expect(page.locator('.catalog-detail .character-gallery .portrait')).toBeVisible();
 await page.getByRole('button',{name:'Back to characters'}).click();await expect(page.locator('.catalog-motion-root')).toHaveAttribute('data-catalog-mode','grid');
 await expect(card).toBeFocused();await page.getByRole('button',{name:'Open carousel'}).click();await settled(page);
 await expect(page.locator('.catalog-motion-root')).toHaveAttribute('data-catalog-active',id!);
 await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Characters',exact:true}).click();
 await expect(page.locator('.catalog-motion-root')).toHaveAttribute('data-catalog-active',id!);
});

test('motion: Lightbox opens immediately, navigates only allowed photos and returns focus',async({context,page})=>{
 await visualFixture(context);await page.setViewportSize({width:390,height:844});
 const media=[1,2].map(i=>({unlocked:true,media_id:`10000000-0000-4000-8000-00000000000${i}`,media_kind:'photo',photo_url:origin+'/neutral.svg?photo='+i,scene_session_id:'scene1',created_at:`2026-01-01T00:00:0${i}Z`}));
 await context.route('**/web/chats/chat1/media',r=>r.fulfill({json:{media:[...media,{unlocked:false,media_id:'locked',media_kind:'photo',sku:'locked',conditions:{price_required:5,price:{amount:'5',currency:'USD'}}}],video_deliveries:[]}}));
 await context.route('**/web/chats/chat1/media/*/video',r=>r.fulfill({json:{animation_available:false}}));
 await page.goto('/#chats/chat1');const source=page.locator('.chat-photo-button').last();await source.scrollIntoViewIfNeeded();
 await expect(source.locator('img')).toBeVisible();await source.click();
 const dialog=page.getByRole('dialog',{name:'Photo viewer'});await expect(dialog).toBeVisible();await expect(dialog).toHaveJSProperty('open',true);
 await expect(dialog.locator('.photo-lightbox-full')).toHaveAttribute('data-ready','true');await expect(dialog.locator('nav')).toContainText('2 / 2');
 await page.keyboard.press('ArrowLeft');await expect(dialog.locator('nav')).toContainText('1 / 2');await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(source).toBeFocused();
 await source.click();await page.goBack();await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(/#chats\/chat1$/);
 expect(await page.locator('img').evaluateAll(images=>images.some(i=>i.src.includes('locked')))).toBe(false);
});

test('motion: Drawer swipe, Back, focus and sequential purchase keep one history owner',async({context,page})=>{
 const fixture=await visualFixture(context);await page.setViewportSize({width:390,height:844});await page.goto('/#profile');
 const trigger=page.getByRole('button',{name:'Support',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.keyboard.press('Tab');
 expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await page.goBack();await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(/#profile$/);
 await trigger.click();await swipe(page,'.sheet-grip',0,300);await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:/Subscription/}).click();await page.getByRole('button',{name:/Base/}).click();await expect(page.getByRole('button',{name:'Confirm purchase'})).toBeVisible();
 await page.getByRole('button',{name:'Confirm purchase'}).click();await expect(page.getByText('You’re all set')).toBeVisible();expect(fixture.purchases).toBe(1);
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('motion: Intro finishes current cycle, Ambient persists, missing media is safe',async({context,page})=>{
 await visualFixture(context);let release:()=>void=()=>{};const ready=new Promise<void>(resolve=>release=resolve);
 await context.route('**/config.json',r=>r.fulfill({json:{apiBaseUrl:'https://gateway.test',supabaseUrl:'https://mp-test.supabase.co',supabasePublishableKey:'fixture-public-key',introVideo:origin+'/intro.webm',ambientVideo:origin+'/ambient.webm'}}));
 await context.route('**/web/auth/bootstrap',async r=>{await ready;await r.fulfill({json:profile});});
 await context.route('**/*.webm',()=>{});
 await page.goto('/',{waitUntil:'domcontentloaded'});const intro=page.locator('[data-background=intro]');await expect(intro).toHaveCount(1);await expect(intro).toHaveJSProperty('loop',true);await expect(page.locator('[data-background=ambient]')).toHaveCount(0);
 release();await expect(page.getByRole('heading',{name:'Who tonight?'})).toBeVisible();await expect(intro).toHaveJSProperty('loop',false);
 const ambient=page.locator('[data-background=ambient]');await expect(ambient).toHaveAttribute('preload','metadata');await expect(ambient).toHaveJSProperty('paused',true);
 await intro.dispatchEvent('ended');await expect(intro).toHaveCount(0);await ambient.evaluate(el=>el.setAttribute('data-continuity','same'));
 await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(ambient).toHaveAttribute('data-continuity','same');
 await ambient.dispatchEvent('error');await expect(ambient).toHaveCount(0);await expect(page.getByText('Test reader')).toBeVisible();
});

test('motion: reduced motion and three stable visual states',async({context,page})=>{
 await visualFixture(context);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 await page.goto('/');await expect(page.getByRole('heading',{name:'Character 1',exact:true})).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('[data-background]')).toHaveCount(0);await expect(page).toHaveScreenshot('catalog-mobile.png',{animations:'disabled'});
 await page.setViewportSize({width:1440,height:900});await expect(page).toHaveScreenshot('catalog-desktop.png',{animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Support',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page).toHaveScreenshot('drawer-mobile.png',{animations:'disabled'});
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.setViewportSize({width:320,height:568});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('motion: throttled spatial movement and rapid reversal',async({browser},testInfo)=>{
  const context=await browser.newContext({baseURL:origin,serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:testInfo.outputPath('recording'),size:{width:390,height:844}}});
  const page=await context.newPage();
  try{
  await visualFixture(context);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:200,downloadThroughput:96000,uploadThroughput:48000});
  await page.goto('/');await expect(page.getByRole('heading',{name:'Character 1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next character',exact:true}).click();
  await page.getByRole('button',{name:'Previous character',exact:true}).click({force:true});await settled(page);
  await expect(page.locator('.catalog-motion-root')).toHaveAttribute('data-catalog-active','1');
  const [widths]=await Promise.all([
   page.locator('[data-catalog-source="1"] .portrait').evaluate(async element=>{const widths:number[]=[];const end=performance.now()+700;while(performance.now()<end){widths.push(element.getBoundingClientRect().width);await new Promise(requestAnimationFrame);}return widths;}),
   page.getByRole('button',{name:'Open catalog'}).click()
  ]);
  expect(new Set(widths.map(n=>Math.round(n))).size).toBeGreaterThan(3);
  await page.locator('[data-catalog-source="1"]').click();await expect(page.getByRole('button',{name:'Back to characters'})).toBeVisible();
  await page.getByRole('button',{name:'Back to characters'}).click();await expect(page.locator('[data-catalog-source="1"]')).toBeFocused();
  await page.getByRole('button',{name:'Open carousel'}).click();await settled(page);
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Support',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();
  }finally{await context.close();}
});
