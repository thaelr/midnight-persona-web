import {chromium} from '@playwright/test';
import {mockApp} from '../e2e/fixtures';
import {writeFile} from 'node:fs/promises';
const label=process.argv[2]??'current';if(!/^[a-z]+$/.test(label))throw new Error('Invalid report label');
const browser=await chromium.launch();const results=[];
for(const route of ['#characters','#chats/chat1']){const context=await browser.newContext();const fixture=await mockApp(context);const page=await context.newPage();await page.goto('http://127.0.0.1:5177/'+route);await page.waitForTimeout(10_000);results.push({route,windowMs:10_000,counts:fixture.counts,navigation:await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;return {domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd};})});await context.close();}
await browser.close();await writeFile('../../verification/frontend-'+label+'-http.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
