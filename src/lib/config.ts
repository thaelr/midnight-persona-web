export type AppConfig = {apiBaseUrl:string;supabaseUrl:string;supabasePublishableKey:string;introVideo:string;ambientVideo:string;termsUrl:string;privacyUrl:string;supportTelegram:string;supportEmail:string;faqUrl:string;telegramAuthProvider:string};
export let config:AppConfig={apiBaseUrl:'',supabaseUrl:'',supabasePublishableKey:'',introVideo:'',ambientVideo:'',termsUrl:'',privacyUrl:'',supportTelegram:'',supportEmail:'',faqUrl:'',telegramAuthProvider:''};
export async function loadConfig(){
  const response=await fetch('/config.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Не удалось загрузить настройки приложения.');
  const data:unknown=await response.json();
  if(!data||typeof data!=='object')throw new Error('Некорректный конфиг приложения.');
  for(const key of Object.keys(config) as (keyof AppConfig)[]){const value=(data as Record<string,unknown>)[key];if(typeof value==='string')config[key]=value.trim();}
  // Publishable/legacy anon keys only; a service key must never be embedded here.
  if(config.supabasePublishableKey.startsWith('sb_secret_'))throw new Error('В клиентском конфиге указан серверный ключ.');
  if(config.supabasePublishableKey.split('.').length===3){try{const role=JSON.parse(atob(config.supabasePublishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;if(role==='service_role')throw new Error('Серверный ключ недопустим в браузере.');}catch(e){if(e instanceof Error&&e.message.includes('Серверный'))throw e;}}
  if(config.telegramAuthProvider&&!/^custom:[a-z0-9][a-z0-9:-]{0,42}$/.test(config.telegramAuthProvider))config.telegramAuthProvider='';
  config.apiBaseUrl=config.apiBaseUrl.replace(/\/$/,'');
}
export function isConfigured(){return Boolean(config.apiBaseUrl&&config.supabaseUrl&&config.supabasePublishableKey);}
export function safeUrl(value:string|null|undefined){if(!value)return undefined;try{const u=new URL(value,location.origin);return u.protocol==='https:'||u.origin===location.origin?u.href:undefined;}catch{return undefined;}}
