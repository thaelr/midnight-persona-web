import {useEffect,useRef} from 'react';

function overlayPath(state:Record<string,unknown>|null):string[]{
 return Array.isArray(state?.mpOverlayPath)?state.mpOverlayPath.filter((value):value is string=>typeof value==='string'):typeof state?.mpOverlay==='string'?[state.mpOverlay]:[];
}
function closingPath(state:Record<string,unknown>|null):string[]{
 return Array.isArray(state?.mpOverlayClosing)?state.mpOverlayClosing.filter((value):value is string=>typeof value==='string'):[];
}

/** Give each transient overlay one history entry, including nested/replaced overlays. */
export function useOverlayBack(open:boolean,onClose:()=>void){
 const close=useRef(onClose);close.current=onClose;
 const state=useRef({marker:'',generation:0});
 useEffect(()=>{
  if(!open)return;
  const local=state.current,generation=++local.generation;
  if(!local.marker)local.marker=crypto.randomUUID();
  const marker=local.marker,current=history.state;
  const path=overlayPath(current),closing=closingPath(current);
  if(path.at(-1)===marker){
   // React StrictMode replays effects without creating a second history entry.
   history.replaceState({...current,mpOverlayClosing:closing.filter(value=>value!==marker)},'',location.href);
  }else if(closing.includes(path.at(-1)??'')){
   // A same-commit replacement (for example offer -> purchase) inherits the
   // outgoing entry instead of leaving a dead overlay in browser history.
   while(path.length&&closing.includes(path.at(-1)!))path.pop();
   history.replaceState({...current,mpOverlay:marker,mpOverlayPath:[...path,marker],mpOverlayClosing:closing.filter(value=>path.includes(value))},'',location.href);
  }else history.pushState({...current,mpOverlay:marker,mpOverlayPath:[...path,marker],mpOverlayClosing:closing},'',location.href);
  let consumed=false;
  const pop=()=>{
   // Back from a child returns to its still-open parent; it must not close it.
   if(consumed||overlayPath(history.state).includes(marker))return;
   consumed=true;local.marker='';close.current();
  };
  window.addEventListener('popstate',pop);
  return()=>{
   window.removeEventListener('popstate',pop);
   if(consumed)return;
   const current=history.state;
   if(overlayPath(current).includes(marker))history.replaceState({...current,mpOverlayClosing:[...closingPath(current),marker]},'',location.href);
   queueMicrotask(()=>{
    if(local.generation!==generation)return;
    const current=history.state;
    if(current?.mpOverlay===marker){
     const path=overlayPath(current),closing=closingPath(current);
     let count=0;
     // Unmounting an entire nested tree removes its entries in one traversal.
     for(let i=path.length-1;i>=0&&closing.includes(path[i]);i--)count++;
     if(count)history.go(-count);
    }
    local.marker='';
   });
  };
 },[open]);
}
