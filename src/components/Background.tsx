import {useEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {config} from '../lib/config';
export function Background({complete}:{complete:boolean}){
 const ambient=useRef<HTMLVideoElement>(null),reduce=useReducedMotion();
 const [phase,setPhase]=useState<'intro'|'ambient'>(complete||!config.introVideo?'ambient':'intro');
 const [introFailed,setIntroFailed]=useState(false);
 const [ambientReady,setAmbientReady]=useState(false),[ambientFailed,setAmbientFailed]=useState(false);
 useEffect(()=>{if(complete&&(!config.introVideo||introFailed))setPhase('ambient');},[complete,introFailed]);
 // Decorative media is unmounted in reduced motion; content players are independent.
 useEffect(()=>{if(reduce&&complete)setPhase('ambient');},[reduce,complete]);
 useEffect(()=>{if(!reduce&&phase==='ambient')ambient.current?.play().catch(()=>{});},[phase,reduce]);
 return <div className="ambient" aria-hidden="true" data-background-phase={reduce?'static':phase}>
  {!reduce&&!ambientFailed&&config.ambientVideo&&(complete||phase==='ambient')&&<video data-background="ambient" ref={ambient} src={config.ambientVideo} className={phase==='ambient'&&ambientReady?'visible':''} autoPlay={phase==='ambient'} muted playsInline loop preload="metadata" onLoadedData={()=>setAmbientReady(true)} onPlaying={()=>setAmbientReady(true)} onError={()=>setAmbientFailed(true)}/>}
  {!reduce&&phase==='intro'&&config.introVideo&&!introFailed&&<video data-background="intro" src={config.introVideo} className="visible" autoPlay muted playsInline loop={!complete} preload="metadata" onEnded={()=>{if(complete)setPhase('ambient');}} onError={()=>setIntroFailed(true)}/>}
 </div>;
}
