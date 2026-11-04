import {useCallback,useEffect,useRef,useState} from 'react';
import type {Gateway} from './lib/gateway';
import {useCopy} from './lib/localization';
import {safeUrl} from './lib/config';

/** A delivery ID is the receipt. A signed MP4 URL is only a renewable transport. */
export function ChatVideo({gateway,deliveryId}:{gateway:Gateway;deliveryId:string}){
 const t=useCopy();const [url,setUrl]=useState<string>(),[error,setError]=useState(false);const player=useRef<HTMLVideoElement>(null),expires=useRef(0),refreshing=useRef(false),retry=useRef(false),alive=useRef(true),resume=useRef<{time:number;play:boolean}|null>(null);
 const refresh=useCallback(async()=>{if(refreshing.current)return;refreshing.current=true;try{const result=await gateway.videoDelivery(deliveryId);if(!alive.current)return;const next=safeUrl(result.video_url);if(!next)throw new Error('video_not_ready');expires.current=result.expires_at?Date.parse(result.expires_at):0;setUrl(next);setError(false);}catch{if(alive.current)setError(true);}finally{refreshing.current=false;}},[gateway,deliveryId]);
 useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;};},[refresh]);
 const renew=()=>{if(refreshing.current)return;const video=player.current;resume.current={time:video?.currentTime??0,play:!!video&&!video.paused};void refresh();};
 return <div className="chat-video">{url?<video ref={player} src={url} controls playsInline preload="metadata" aria-label={t('Видео из диалога','Conversation video')} onPlay={()=>{if(expires.current&&expires.current<Date.now()+5000)renew();}} onError={()=>{if(!retry.current){retry.current=true;renew();}else setError(true);}} onLoadedMetadata={()=>{const target=resume.current;if(target&&player.current){player.current.currentTime=target.time;if(target.play)void player.current.play().catch(()=>{});resume.current=null;}retry.current=false;}}/>:<p role="status">{t('Загружаем видео…','Loading video…')}</p>}{error&&<p role="alert">{t('Не удалось загрузить видео.','Could not load the video.')}<button onClick={()=>{retry.current=false;void refresh();}}>{t('Повторить','Retry')}</button></p>}</div>;
}
