import {useEffect,useRef,useState} from 'react';
import {config} from '../lib/config';
export function Background({complete}:{complete:boolean}){
 const intro=useRef<HTMLVideoElement>(null),ambient=useRef<HTMLVideoElement>(null);
 const [phase,setPhase]=useState<'intro'|'ambient'>(complete||!config.introVideo?'ambient':'intro');
 const [introFailed,setIntroFailed]=useState(false);
 useEffect(()=>{if(complete&&(!config.introVideo||introFailed))setPhase('ambient');},[complete,introFailed]);
 useEffect(()=>{if(phase==='ambient')ambient.current?.play().catch(()=>{});},[phase]);
 return <div className="ambient" aria-hidden="true">{config.ambientVideo&&<video ref={ambient} src={config.ambientVideo} className={phase==='ambient'?'visible':''} autoPlay={phase==='ambient'} muted playsInline loop preload="auto"/>}{config.introVideo&&!introFailed&&<video ref={intro} src={config.introVideo} className={phase==='intro'?'visible':''} autoPlay muted playsInline loop={!complete} preload="auto" onEnded={()=>{if(complete)setPhase('ambient');}} onError={()=>setIntroFailed(true)}/>}</div>;
}
