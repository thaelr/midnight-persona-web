import {useEffect,useState} from 'react';
import {legalContent} from './legal/content';
import {localeLanguage} from './lib/auth';
import {setActivity} from './lib/activity';
export function LegalPage({document}:{document:'terms'|'privacy'}){
 useEffect(()=>{setActivity('initialization',false);},[]);
 const read=()=>{const query=new URLSearchParams(location.search).get('lang');if(query==='ru'||query==='en')return query;try{return localeLanguage(localStorage.getItem('mp.language')||navigator.language)||'en';}catch{return 'en';}};
 const [language,setLanguage]=useState(read);useEffect(()=>{const back=()=>setLanguage(read());window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
 const ru=language==='ru';const content=legalContent[document][ru?'ru':'en'];
 return <main className="legal-page"><a href="/">Midnight Persona</a><nav aria-label="Language">{['ru','en'].map(l=><button key={l} aria-pressed={language===l} onClick={()=>{const u=new URL(location.href);u.searchParams.set('lang',l);history.pushState(null,'',u);setLanguage(l);try{localStorage.setItem('mp.language',l);}catch{}}}>{l.toUpperCase()}</button>)}</nav><h1>{document==='terms'?(ru?'Пользовательское соглашение':'Terms of Service'):(ru?'Политика конфиденциальности':'Privacy Policy')}</h1>{content?<article>{content}</article>:<p role="status">{ru?'Утверждённый текст ещё не добавлен владельцем. Документ пока не опубликован.':'The owner has not added the approved text yet. This document is not published yet.'}</p>}<a href={`/${document==='terms'?'privacy':'terms'}?lang=${language}`}>{document==='terms'?(ru?'Политика конфиденциальности':'Privacy Policy'):(ru?'Пользовательское соглашение':'Terms of Service')}</a></main>;
}
