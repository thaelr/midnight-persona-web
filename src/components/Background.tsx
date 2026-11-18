import {useEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {config} from '../lib/config';
function Sources({desktop,mobile}:{desktop:string;mobile:string}){
 return <><source media="(max-width: 600px)" src={mobile||desktop}/><source src={desktop||mobile}/></>;
}
export function Background({complete}:{complete:boolean}){
 const ambient=useRef<HTMLVideoElement>(null),reduce=useReducedMotion();
 const introAvailable=Boolean(config.introVideo||config.introVideoMobile),ambientAvailable=Boolean(config.ambientVideo||config.ambientVideoMobile);
 const [phase,setPhase]=useState<'intro'|'ambient'>(introAvailable?'intro':'ambient');
 const [introFailed,setIntroFailed]=useState(false);
 const [ambientReady,setAmbientReady]=useState(false),[ambientFailed,setAmbientFailed]=useState(false);
 useEffect(()=>{if(introFailed)setPhase('ambient');},[introFailed]);
 // Decorative media is unmounted in reduced motion; content players are independent.
 useEffect(()=>{if(reduce&&complete)setPhase('ambient');},[reduce,complete]);
 useEffect(()=>{if(!reduce&&phase==='ambient')ambient.current?.play().catch(error=>console.error('[background:ambient] play failed',error));},[phase,reduce]);
 return <div className="ambient" aria-hidden="true" data-background-phase={reduce?'static':phase}>
  {!reduce&&!ambientFailed&&ambientAvailable&&(complete||phase==='ambient')&&<video data-background="ambient" ref={ambient} className={phase==='ambient'&&ambientReady?'visible':''} autoPlay={phase==='ambient'} muted playsInline loop preload="metadata" onLoadedData={()=>setAmbientReady(true)} onPlaying={()=>setAmbientReady(true)} onError={event=>{if(event.target!==event.currentTarget)return;console.error('[background:ambient] video error',event.currentTarget.error);setAmbientFailed(true);}}><Sources desktop={config.ambientVideo} mobile={config.ambientVideoMobile}/></video>}
  {!reduce&&phase==='intro'&&introAvailable&&!introFailed&&<video data-background="intro" className="visible" autoPlay muted playsInline preload="metadata" onEnded={()=>setPhase('ambient')} onError={event=>{if(event.target!==event.currentTarget)return;console.error('[background:intro] video error',event.currentTarget.error);setIntroFailed(true);}}><Sources desktop={config.introVideo} mobile={config.introVideoMobile}/></video>}
 </div>;
}
