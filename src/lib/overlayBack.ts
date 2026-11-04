import {useEffect,useRef} from 'react';

/** Give a transient overlay one browser history entry; closing restores the page. */
export function useOverlayBack(open:boolean,onClose:()=>void){
 const close=useRef(onClose);close.current=onClose;
 const state=useRef({marker:'',generation:0});
 useEffect(()=>{if(!open)return;const local=state.current;const generation=++local.generation;if(!local.marker)local.marker=crypto.randomUUID();const marker=local.marker;
  if(history.state?.mpOverlay!==marker)history.pushState({...history.state,mpOverlay:marker},'',location.href);
  const pop=()=>{if(history.state?.mpOverlay!==marker){local.marker='';close.current();}};
  window.addEventListener('popstate',pop);
  return()=>{window.removeEventListener('popstate',pop);queueMicrotask(()=>{if(local.generation!==generation)return;if(history.state?.mpOverlay===marker)history.back();local.marker='';});};
 },[open]);
}
