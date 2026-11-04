import React from 'react';
import {createRoot} from 'react-dom/client';
import {loadConfig} from './lib/config';
import {App} from './App';
import {translatePair} from './lib/localization';
import './styles.css';
loadConfig().then(()=>{createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);if('serviceWorker' in navigator&&import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>{});}).catch(()=>{let language='en';try{language=localStorage.getItem('mp.language')||navigator.language;}catch{}const t=(ru:string,en:string)=>translatePair(language,{},ru,en);const el=document.getElementById('root')!;el.className='fatal';const h=document.createElement('h1');h.textContent='Midnight Persona';const p=document.createElement('p');p.textContent=t('Не удалось загрузить настройки приложения. Попробуй обновить страницу.','Could not load the app settings. Please reload the page.');const retry=document.createElement('button');retry.textContent=t('Повторить','Retry');retry.onclick=()=>location.reload();el.replaceChildren(h,p,retry);});
import './integration.css';
