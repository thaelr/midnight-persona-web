import {useEffect,useRef,useState} from 'react';
import {useCopy} from '../lib/localization';
import {Icon} from './Icons';

type BrandHeaderProps={language:string;onLanguage:()=>void;onHome:()=>void};

/** Moon-only header. Hover reveals the wordmark on fine pointers; touch toggles it. */
export function BrandHeader({language,onLanguage,onHome}:BrandHeaderProps){
 const t=useCopy(),ref=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false);
 const [coarse,setCoarse]=useState(()=>typeof matchMedia==='function'&&matchMedia('(hover: none)').matches);
 useEffect(()=>{const query=matchMedia('(hover: none)');const update=()=>setCoarse(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const activate=()=>{if(coarse){setOpen(value=>!value);return;}onHome();};
 return <header className="app-header">
  <button ref={ref} type="button" className={`brand-mark${open?' is-open':''}`} onClick={activate} aria-label="Midnight Persona" aria-expanded={coarse?open:undefined}>
   <span className="brand-wordmark" aria-hidden="true"><img src="/assets/midnight-persona.svg" alt=""/></span>
   <span className="brand-moon" aria-hidden="true"><img src="/assets/moon.svg" alt=""/></span>
  </button>
  <div className="header-right"><button type="button" className="language-switch" onClick={onLanguage} aria-label={t('Изменить язык','Change language')}>{language.toUpperCase()}<Icon name="globe" size={16}/></button></div>
 </header>;
}
