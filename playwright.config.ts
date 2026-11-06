import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'e2e',timeout:30_000,workers:1,use:{baseURL:'http://127.0.0.1:5177',headless:true,serviceWorkers:'block'},reporter:[['list']],webServer:{command:'pnpm exec vite preview --host 127.0.0.1 --port 5177',url:'http://127.0.0.1:5177',reuseExistingServer:true}});
