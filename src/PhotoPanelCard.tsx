import {useNearViewport} from './lib/nearViewport';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Gateway} from './lib/gateway';
import type {Gallery,PhotoPanel,VideoDelivery} from './lib/types';
import {safeUrl} from './lib/config';
import {useCopy} from './lib/localization';
import type {PhotoLightboxSource} from './PhotoLightbox';
import {ChatVideo} from './ChatVideo';

type SpecialSlide='source-photo'|'video';
type Props={gateway:Gateway;chatCode:string;sceneSessionId:string|null;mediaId:string;anchor?:string;photoUrl?:string;access?:Gallery['media'][number];gallery:Gallery['media'];delivery?:VideoDelivery;storageScope:string|null;videoBusy:boolean;onVideoStatus:(message:string|null)=>void;onOpen:(id:string,url:string,source:PhotoLightboxSource)=>void;onUnlock:(id:string,sku:string)=>Promise<void>;onAnimate:(id:string)=>void;onChanged:()=>void};

export function PhotoPanelCard(p:Props){
 const {ref,near}=useNearViewport();const t=useCopy();const [panel,setPanel]=useState<PhotoPanel|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[videoAvailable,setVideoAvailable]=useState(Boolean(p.access?.animation_available)),[special,setSpecial]=useState<SpecialSlide|null>(null),[videoReady,setVideoReady]=useState(p.delivery?.status==='delivered');
 const generation=useRef(0),alive=useRef(true),authorized=useRef(p.access?.unlocked?p.mediaId:undefined),latest=useRef(panel);latest.current=panel;
 const requestIds=useRef<Record<string,string>>({}),manual=useRef(false),activeDelivery=useRef<string|null>(null),requestedPosition=useRef<number|null>(null),photoPhaseStarted=useRef(false),timers=useRef<number[]>([]),completeVideoRef=useRef<(earliest:number)=>void>(()=>{});
 const loadedScene=useRef(p.sceneSessionId),previousScene=useRef(p.sceneSessionId);const sceneFresh=loadedScene.current===p.sceneSessionId;
 const clearTimers=()=>{for(const timer of timers.current)window.clearTimeout(timer);timers.current=[];};
 useEffect(()=>()=>{alive.current=false;generation.current++;clearTimers();p.onVideoStatus(null);},[]);
 const accept=(value:PhotoPanel)=>{if(!alive.current)return;if(value.unlocked)authorized.current=value.media_id;if(value.media_id===p.delivery?.requested_photo_uuid&&value.position!=null)requestedPosition.current=value.position;loadedScene.current=p.sceneSessionId;setPanel(value);setError('');};
 const reload=async(current?:string)=>{if(!p.anchor)return;const version=++generation.current;try{const result=await p.gateway.photoPanel(p.chatCode,p.anchor,current??authorized.current);if(version===generation.current)accept(result);}catch{if(alive.current&&version===generation.current)setError(t('Не удалось обновить фотопанель.','Could not refresh the photo panel.'));}};
 useEffect(()=>{alive.current=true;if(near&&p.anchor&&p.access?.unlocked){authorized.current=p.mediaId;void reload(p.mediaId);}},[near,p.gateway,p.chatCode,p.anchor,p.mediaId,p.access?.unlocked]);
 useEffect(()=>{if(previousScene.current===p.sceneSessionId)return;previousScene.current=p.sceneSessionId;if(p.anchor&&authorized.current)void reload(authorized.current);},[p.sceneSessionId,p.anchor]);
 useEffect(()=>{const current=latest.current;const target=current?.offer?.media_id??(current&&!current.unlocked?current.media_id:undefined);if(target&&p.gallery.some(m=>m.media_id===target&&m.unlocked))void reload(target);},[p.gallery]);
 const selectedId=panel?.media_id??p.mediaId,requested=p.delivery?.requested_photo_uuid??null,paired=p.delivery?.source_photo_uuid??null;
 const samePhoto=p.delivery?.same_photo===true||(requested!=null&&requested===paired),unlocked=panel?.unlocked??p.access?.unlocked??Boolean(p.photoUrl);
 const ordinaryPhoto=unlocked?safeUrl(panel?.photo_url??p.photoUrl):undefined,sourcePhoto=safeUrl(p.delivery?.source_photo_url);

 const completeVideo=useCallback(async(earliest:number)=>{
  if(!p.delivery||!alive.current)return;const delay=Math.max(0,earliest-Date.now());
  const timer=window.setTimeout(async()=>{try{const result=await p.gateway.videoDelivery(p.delivery!.delivery_id);if(!alive.current)return;if(result.status==='delivered'){setVideoReady(true);p.onVideoStatus(null);if(!manual.current)setSpecial('video');p.onChanged();return;}if(['failed','uncertain'].includes(result.status)){p.onVideoStatus(null);setError(t('Видео не удалось показать. Фотографии остались доступны.','The video could not be shown. Your photos are still available.'));return;}timers.current.push(window.setTimeout(()=>completeVideoRef.current(Date.now()),1000));}catch{if(alive.current){p.onVideoStatus(null);setError(t('Видео не удалось показать. Фотографии остались доступны.','The video could not be shown. Your photos are still available.'));}}},delay);
  timers.current.push(timer);
 },[p.delivery?.delivery_id,p.gateway,p.onChanged,p.onVideoStatus,t]);
 completeVideoRef.current=completeVideo;

 const sourceLoaded=()=>{if(!p.delivery||samePhoto||photoPhaseStarted.current)return;photoPhaseStarted.current=true;p.onVideoStatus(t('Оживляем фото','Animating photo'));completeVideo(Math.max(Date.now()+5000,Date.parse(p.delivery.ready_at??'')));};
 useEffect(()=>{
  clearTimers();photoPhaseStarted.current=false;const changed=activeDelivery.current!==p.delivery?.delivery_id;if(changed){manual.current=false;setSpecial(null);activeDelivery.current=p.delivery?.delivery_id??null;}setVideoReady(p.delivery?.status==='delivered');
  if(!p.delivery||p.delivery.requested_photo_uuid!==p.mediaId)return;
  if(p.delivery.status==='delivered'){if(!manual.current)setSpecial('video');p.onVideoStatus(null);return;}
  if(['failed','uncertain'].includes(p.delivery.status)){p.onVideoStatus(null);return;}
  if(samePhoto){p.onVideoStatus(t('Оживляем фото','Animating photo'));completeVideo(Date.parse(p.delivery.ready_at??''));return;}
  p.onVideoStatus(t('Подготавливаем фото для оживления','Preparing a photo for animation'));
  const revealAt=Date.parse(p.delivery.source_photo_reveal_at??'');
  const timer=window.setTimeout(()=>{if(!alive.current)return;if(!manual.current){setSpecial('source-photo');p.onVideoStatus(t('Оживляем фото','Animating photo'));}else{photoPhaseStarted.current=true;completeVideo(Math.max(Date.now()+5000,Date.parse(p.delivery!.ready_at??'')));}},Math.max(0,(Number.isFinite(revealAt)?revealAt:Date.now()+2000)-Date.now()));timers.current.push(timer);
  return clearTimers;
 },[p.delivery?.delivery_id,p.delivery?.status,p.mediaId,samePhoto]);

 useEffect(()=>{let active=true;const known=p.gallery.find(m=>m.media_id===selectedId);setVideoAvailable(Boolean(known?.animation_available&&known.scene_session_id===p.sceneSessionId));if(near&&unlocked&&!p.delivery)void p.gateway.videoAvailability(p.chatCode,selectedId).then(value=>active&&setVideoAvailable(value.animation_available)).catch(()=>{});return()=>{active=false;};},[near,p.gateway,p.chatCode,p.sceneSessionId,selectedId,unlocked,p.gallery,p.delivery?.delivery_id]);

 const serverAction=async(kind:'photo_prev'|'photo_next'|'photo_regen',fromId=authorized.current)=>{
  if(!p.anchor||busy||!sceneFresh)return;setBusy(true);setError('');const version=++generation.current;
  try{
   if(panel&&!panel.unlocked&&kind==='photo_prev'&&authorized.current){const result=await p.gateway.photoPanel(p.chatCode,p.anchor,authorized.current);if(version===generation.current)accept(result);return;}
   const key=`${p.storageScope??'mp'}.photo-action.${p.chatCode}.${p.anchor}.${fromId??''}.${kind}`;let id:string|null=requestIds.current[key]??null;if(!id)try{id=sessionStorage.getItem(key);}catch{}if(!id){id=crypto.randomUUID();try{sessionStorage.setItem(key,id);}catch{}}requestIds.current[key]=id;
   const result=await p.gateway.photoPanelAction(p.chatCode,p.anchor,{client_message_id:id,action:kind,...(fromId?{current_media_id:fromId}:{})});
   if(version===generation.current){accept(result);setSpecial(null);delete requestIds.current[key];try{sessionStorage.removeItem(key);}catch{}p.onChanged();}
  }catch{if(alive.current&&version===generation.current)setError(t('Действие не подтверждено. Повтор использует тот же запрос.','The action is unconfirmed. Retrying uses the same request.'));}
  finally{if(alive.current)setBusy(false);}
 };
 const action=(kind:'photo_prev'|'photo_next'|'photo_regen')=>{manual.current=true;p.onVideoStatus(null);
  if(kind==='photo_regen'){void serverAction(kind);return;}
  if(special==='video'&&kind==='photo_prev'){setSpecial(samePhoto?null:'source-photo');return;}
  if(special==='source-photo'){if(kind==='photo_prev'){setSpecial(null);return;}if(kind==='photo_next'&&videoReady){setSpecial('video');return;}}
  if(special==='video'&&kind==='photo_next'){void serverAction('photo_next',requested??authorized.current);return;}
  if(!special&&selectedId===requested&&kind==='photo_next'){
   if(!samePhoto&&sourcePhoto){setSpecial('source-photo');return;}
   if(samePhoto&&videoReady){setSpecial('video');return;}
  }
  void serverAction(kind);
 };
 const lockedOffer=panel?.offer??(p.access&&!p.access.unlocked?p.access:undefined),extras=p.delivery?(samePhoto?1:2):0;
 const basePosition=panel?.position??null;if(requested&&selectedId===requested&&basePosition!=null)requestedPosition.current=basePosition;
 const position=special==='source-photo'&&requestedPosition.current!=null?requestedPosition.current+1:special==='video'&&requestedPosition.current!=null?requestedPosition.current+(samePhoto?1:2):basePosition!=null&&requestedPosition.current!=null&&basePosition>requestedPosition.current?basePosition+extras:basePosition;
 const count=(panel?.count??0)+extras,photo=special==='source-photo'?sourcePhoto:ordinaryPhoto;
 const canPrevious=special!=null||Boolean(panel?.actions.previous),canNext=special==='source-photo'?videoReady||Boolean(panel?.actions.next):special==='video'?Boolean(panel?.actions.next):Boolean(panel?.actions.next||(selectedId===requested&&((!samePhoto&&sourcePhoto)||videoReady)));
 return <div ref={ref} className="chat-photo-panel">
  {special==='video'&&p.delivery?<ChatVideo gateway={p.gateway} deliveryId={p.delivery.delivery_id}/>:photo?<button className="chat-photo-button" data-photo-id={special==='source-photo'?paired:selectedId} onClick={event=>p.onOpen(special==='source-photo'&&paired?paired:selectedId,photo,{id:special==='source-photo'&&paired?paired:selectedId,url:photo,element:event.currentTarget,image:event.currentTarget.querySelector('img')})} aria-label={t('Открыть фотографию','Open photo')}><img src={photo} alt={t('Фотография из диалога','Conversation photo')} loading="lazy" onLoad={special==='source-photo'?sourceLoaded:undefined}/></button>:<div className="chat-locked"><span aria-hidden="true">⌑</span><strong>{unlocked?t('Фотография загружается','Loading photo'):t('Фотография для тебя','A photo for you')}</strong><p>{t('Открой, когда захочется узнать больше.','Open it when you want to see more.')}</p>{lockedOffer&&<button disabled={busy} onClick={()=>void p.onUnlock(lockedOffer.media_id,lockedOffer.sku)}>{lockedOffer.conditions.price_required===0?t('Открыть','Open'):t('Посмотреть условия','View offer')} ↗</button>}</div>}
  {(panel||special)&&<nav className="chat-photo-panel-actions" aria-label={t('Действия фотопанели','Photo panel actions')}>
   {position!=null&&<span aria-label={t('Номер фотографии','Photo position')}>{position}/{count}</span>}{canPrevious&&<button disabled={busy||!sceneFresh} onClick={()=>action('photo_prev')} aria-label={t('Предыдущий элемент','Previous item')}>‹</button>}{canNext&&<button disabled={busy||!sceneFresh} onClick={()=>action('photo_next')} aria-label={t('Следующий элемент','Next item')}>›</button>}
   {!special&&panel?.actions.more&&<button disabled={busy||!sceneFresh||Boolean(panel.offer)} onClick={()=>action('photo_regen')}>{t('Ещё фото','More photos')}</button>}
  </nav>}
  {!special&&panel?.offer&&panel.offer.media_id!==selectedId&&<div className="chat-locked chat-next-photo-offer"><strong>{t('Следующая фотография','Next photo')}</strong><button disabled={busy||!sceneFresh} onClick={()=>void p.onUnlock(panel.offer!.media_id,panel.offer!.sku)}>{panel.offer.conditions.price_required===0?t('Открыть','Open'):t('Посмотреть условия','View offer')} ↗</button></div>}
  {!p.delivery&&videoAvailable&&unlocked&&<button className="chat-animate" disabled={p.videoBusy||busy||!sceneFresh} onClick={()=>p.onAnimate(selectedId)}>{p.videoBusy?t('Подождём…','One moment…'):t('🎬 Оживить фото','🎬 Animate photo')}</button>}
  {error&&<p className="chat-panel-error" role="alert">{error}<button onClick={()=>void reload()}>{t('Обновить','Refresh')}</button></p>}
 </div>;
}
