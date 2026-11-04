import {useEffect,useRef,useState} from 'react';
import type {Gateway} from './lib/gateway';
import type {Gallery,PhotoPanel} from './lib/types';
import {safeUrl} from './lib/config';
import {useCopy} from './lib/localization';

type Props={gateway:Gateway;chatCode:string;sceneSessionId:string|null;mediaId:string;anchor?:string;photoUrl?:string;access?:Gallery['media'][number];gallery:Gallery['media'];storageScope:string|null;videoBusy:boolean;onOpen:(id:string,url:string)=>void;onUnlock:(id:string,sku:string)=>Promise<void>;onAnimate:(id:string)=>void;onChanged:()=>void};
export function PhotoPanelCard(p:Props){
 const t=useCopy();const [panel,setPanel]=useState<PhotoPanel|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[videoAvailable,setVideoAvailable]=useState(Boolean(p.access?.animation_available));
 const generation=useRef(0),alive=useRef(true),authorized=useRef(p.access?.unlocked?p.mediaId:undefined),latest=useRef(panel);latest.current=panel;
 const requestIds=useRef<Record<string,string>>({});
 const loadedScene=useRef(p.sceneSessionId),previousScene=useRef(p.sceneSessionId);
 const sceneFresh=loadedScene.current===p.sceneSessionId;
 useEffect(()=>()=>{alive.current=false;generation.current++;},[]);
 const accept=(value:PhotoPanel)=>{if(!alive.current)return;if(value.unlocked)authorized.current=value.media_id;loadedScene.current=p.sceneSessionId;setPanel(value);setError('');};
 const reload=async(current?:string)=>{if(!p.anchor)return;const version=++generation.current;try{const result=await p.gateway.photoPanel(p.chatCode,p.anchor,current??authorized.current);if(version===generation.current)accept(result);}catch{if(alive.current&&version===generation.current)setError(t('Не удалось обновить фотопанель.','Could not refresh the photo panel.'));}};
 useEffect(()=>{alive.current=true;if(p.anchor&&p.access?.unlocked){authorized.current=p.mediaId;void reload(p.mediaId);}},[p.gateway,p.chatCode,p.anchor,p.mediaId,p.access?.unlocked]);
 useEffect(()=>{if(previousScene.current===p.sceneSessionId)return;previousScene.current=p.sceneSessionId;if(p.anchor&&authorized.current)void reload(authorized.current);},[p.sceneSessionId,p.anchor]);
 useEffect(()=>{const current=latest.current;const target=current?.offer?.media_id??(current&&!current.unlocked?current.media_id:undefined);if(target&&p.gallery.some(m=>m.media_id===target&&m.unlocked))void reload(target);},[p.gallery]);
 const selectedId=panel?.media_id??p.mediaId;
 const unlocked=panel?.unlocked??p.access?.unlocked??Boolean(p.photoUrl);
 const photo=unlocked?safeUrl(panel?.photo_url??p.photoUrl):undefined;
 useEffect(()=>{let active=true;const known=p.gallery.find(m=>m.media_id===selectedId);setVideoAvailable(Boolean(known?.animation_available&&known.scene_session_id===p.sceneSessionId));if(unlocked)void p.gateway.videoAvailability(p.chatCode,selectedId).then(value=>active&&setVideoAvailable(value.animation_available)).catch(()=>{});return()=>{active=false;};},[p.gateway,p.chatCode,p.sceneSessionId,selectedId,unlocked,p.gallery]);
 const action=async(kind:'photo_prev'|'photo_next'|'photo_regen')=>{
  if(!p.anchor||busy||!sceneFresh)return;setBusy(true);setError('');const version=++generation.current;
  try{
   if(panel&&!panel.unlocked&&kind==='photo_prev'&&authorized.current){const result=await p.gateway.photoPanel(p.chatCode,p.anchor,authorized.current);if(version===generation.current)accept(result);return;}
   const key=`${p.storageScope??'mp'}.photo-action.${p.chatCode}.${p.anchor}.${authorized.current??''}.${kind}`;let id:string|null=requestIds.current[key]??null;if(!id)try{id=sessionStorage.getItem(key);}catch{}if(!id){id=crypto.randomUUID();try{sessionStorage.setItem(key,id);}catch{}}requestIds.current[key]=id;
   const result=await p.gateway.photoPanelAction(p.chatCode,p.anchor,{client_message_id:id,action:kind,...(authorized.current?{current_media_id:authorized.current}:{})});
   if(version===generation.current){accept(result);delete requestIds.current[key];try{sessionStorage.removeItem(key);}catch{}p.onChanged();}
  }catch{if(alive.current&&version===generation.current)setError(t('Действие не подтверждено. Повтор использует тот же запрос.','The action is unconfirmed. Retrying uses the same request.'));}
  finally{if(alive.current)setBusy(false);}
 };
 const lockedOffer=panel?.offer??(p.access&&!p.access.unlocked?p.access:undefined);
 return <>
  {photo?<button className="chat-photo-button" onClick={()=>p.onOpen(selectedId,photo)} aria-label={t('Открыть фотографию','Open photo')}><img src={photo} alt={t('Фотография из диалога','Conversation photo')} loading="lazy"/></button>:<div className="chat-locked"><span aria-hidden="true">⌑</span><strong>{unlocked?t('Фотография загружается','Loading photo'):t('Фотография для тебя','A photo for you')}</strong><p>{t('Открой, когда захочется узнать больше.','Open it when you want to see more.')}</p>{lockedOffer&&<button disabled={busy} onClick={()=>void p.onUnlock(lockedOffer.media_id,lockedOffer.sku)}>{lockedOffer.conditions.price_required===0?t('Открыть','Open'):t('Посмотреть условия','View offer')} ↗</button>}</div>}
  {panel&&<nav className="chat-photo-panel-actions" aria-label={t('Действия фотопанели','Photo panel actions')}>
   {panel.actions.previous&&<button disabled={busy||!sceneFresh} onClick={()=>void action('photo_prev')} aria-label={t('Предыдущая фотография','Previous photo')}>‹</button>}
   {panel.actions.next&&<button disabled={busy||!sceneFresh} onClick={()=>void action('photo_next')} aria-label={t('Следующая фотография','Next photo')}>›</button>}
   {panel.actions.more&&<button disabled={busy||!sceneFresh||Boolean(panel.offer)} onClick={()=>void action('photo_regen')}>{t('Ещё фото','More photos')}</button>}
  </nav>}
  {panel?.offer&&panel.offer.media_id!==selectedId&&<div className="chat-locked chat-next-photo-offer"><strong>{t('Следующая фотография','Next photo')}</strong><button disabled={busy||!sceneFresh} onClick={()=>void p.onUnlock(panel.offer!.media_id,panel.offer!.sku)}>{panel.offer.conditions.price_required===0?t('Открыть','Open'):t('Посмотреть условия','View offer')} ↗</button></div>}
  {videoAvailable&&unlocked&&<button className="chat-animate" disabled={p.videoBusy||busy||!sceneFresh} onClick={()=>p.onAnimate(selectedId)}>{p.videoBusy?t('Подождём…','One moment…'):t('🎬 Оживить фото','🎬 Animate photo')}</button>}
  {error&&<p className="chat-panel-error" role="alert">{error}<button onClick={()=>void reload()}>{t('Обновить','Refresh')}</button></p>}
 </>;
}
