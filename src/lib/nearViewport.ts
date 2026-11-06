import {useEffect,useRef,useState} from 'react';
/** Do not resolve private media or issue panel GETs for a long offscreen history. */
export function useNearViewport(){
 const ref=useRef<HTMLDivElement>(null),[near,setNear]=useState(typeof IntersectionObserver==='undefined');
 useEffect(()=>{if(near||!ref.current||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'250px'});observer.observe(ref.current);return()=>observer.disconnect();},[near]);
 return {ref,near};
}
