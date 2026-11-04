import {useCopy} from '../lib/localization';
import {useOverlayBack} from '../lib/overlayBack';
import {useEffect,useRef,useId,type ReactNode} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {Icon} from './Icons';
export function Sheet({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const t=useCopy();
 useOverlayBack(true,onClose);
 const ref=useRef<HTMLDivElement>(null),id=useId(),reduce=useReducedMotion();
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const node=ref.current;node?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close.current();}if(e.key==='Tab'){const list=node?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]');if(!list?.length){e.preventDefault();return;}const first=list[0],last=list[list.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===node)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;previous?.focus();};},[]);
 return <div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="sheet" initial={{y:reduce?0:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:reduce?0:80,opacity:0}} transition={{duration:reduce?0:.32,ease:[.22,1,.36,1]}}><div className="sheet-grip"/><header><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label={t('Закрыть','Close')}><Icon name="close"/></button></header><div className="sheet-content">{children}</div></motion.div></div>;
}
