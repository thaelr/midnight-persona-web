import {useRef,useState,type ReactNode,type SyntheticEvent} from 'react';
import {Drawer} from '@base-ui/react/drawer';
import {useCopy} from '../lib/localization';
import {useOverlayBack} from '../lib/overlayBack';
import {Icon} from './Icons';
import './sheet.css';

// Apply the library's exclusion before it considers a touch/pen gesture. This also
// covers controls rendered later by purchase/profile content without changing it.
function ignoreControlSwipe(event:SyntheticEvent<HTMLDivElement>){
 const target=event.target instanceof Element?event.target:null;
 const control=target?.closest('button,a,input,textarea,select,label,[role="button"],[contenteditable="true"]');
 if(control&&event.currentTarget.contains(control)&&!control.hasAttribute('data-base-ui-swipe-ignore'))control.setAttribute('data-base-ui-swipe-ignore','');
}

export function Sheet({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const t=useCopy();
 const [open,setOpen]=useState(true);
 const closing=useRef(false),closed=useRef(false),close=useRef(onClose);
 close.current=onClose;
 const requestClose=()=>{if(!closing.current){closing.current=true;setOpen(false);}};
 // History remains owned by this hook through the exit. Base UI owns focus,
 // scroll locking and gesture arbitration, and never writes our history entry.
 useOverlayBack(true,requestClose);
 return <Drawer.Root open={open} swipeDirection="down" onOpenChange={next=>{if(!next)requestClose();}} onOpenChangeComplete={next=>{
   if(!next&&!closed.current){closed.current=true;close.current();}
  }}>
  <Drawer.VirtualKeyboardProvider><Drawer.Portal>
   <Drawer.Backdrop className="drawer-sheet-backdrop"/>
   <Drawer.Viewport className="drawer-sheet-viewport">
    <Drawer.Popup className="sheet drawer-sheet" onPointerDownCapture={ignoreControlSwipe} onTouchStartCapture={ignoreControlSwipe}>
     <div className="sheet-grip" aria-hidden="true"/>
     <header><Drawer.Title render={<h2/>}>{title}</Drawer.Title><Drawer.Close className="icon-button" aria-label={t('Закрыть','Close')} data-base-ui-swipe-ignore><Icon name="close"/></Drawer.Close></header>
     <Drawer.Content className="sheet-content" data-base-ui-swipe-ignore="x">{children}</Drawer.Content>
    </Drawer.Popup>
   </Drawer.Viewport>
  </Drawer.Portal></Drawer.VirtualKeyboardProvider>
 </Drawer.Root>;
}
