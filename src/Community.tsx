import {useInfiniteQuery} from '@tanstack/react-query';
import {useContext} from 'react';
import {useServerQuery,ServerContext,queryClient,serverKey} from './lib/queries';
import {useEffect,useRef,useState} from 'react';
import type {Gateway,Publication,VotingCampaign} from './lib/gateway';
import {Sheet} from './components/Sheet';
import {useCopy,useLocalization} from './lib/localization';
import {safeUrl} from './lib/config';

export function VotingSheet({gateway,onClose,enabled}:{gateway:Gateway;onClose:()=>void;enabled:boolean}){
 const scope=useContext(ServerContext);const t=useCopy();const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const query=useServerQuery('voting',signal=>gateway.voting(signal),{enabled});const campaign=query.data?.campaign??null,loading=query.isLoading;const load=()=>query.refetch();
 const vote=async(id:string)=>{if(!campaign||busy)return;setBusy(true);try{queryClient.setQueryData(serverKey(scope.owner,scope.locale,'voting'),await gateway.vote(campaign.id,id));}catch{setError(t('Не удалось сохранить голос. Обнови голосование.','Could not save your vote. Refresh the vote.'));}finally{setBusy(false);}};
 return <Sheet title={campaign?.title||t('Кого пригласим следующим?','Who should join next?')} onClose={onClose}>
  {loading?<p role="status">{t('Загружаем…','Loading…')}</p>:campaign?<div className="voting-candidates">{campaign.candidates.map(c=><button key={c.id} className="voting-candidate" disabled={busy||campaign.selected_candidate_id!==null} onClick={()=>void vote(c.id)} aria-pressed={campaign.selected_candidate_id===c.id}>{safeUrl(c.image_url)&&<img src={safeUrl(c.image_url)} alt=""/>}<strong>{c.name}</strong><p>{c.description}</p>{campaign.selected_candidate_id===c.id&&<span>{t('Твой голос','Your vote')} ✓</span>}</button>)}</div>:!error&&<p>{t('Голосование пока не открыто. Когда появятся кандидаты, ты сможешь выбрать нового персонажа здесь.','Voting is not open yet. When candidates arrive, you will be able to choose a new character here.')}</p>}
  {(error||query.isError)&&<p role="alert" className="error-text">{error||t('Не удалось загрузить голосование.','Could not load the vote.')}<button className="text-button" onClick={()=>void load()}>{t('Повторить','Retry')}</button></p>}
 </Sheet>;
}

export function SystemFeed({gateway,initialPosts}:{gateway:Gateway;initialPosts:Publication[]}){
 const t=useCopy();const {language}=useLocalization();const scope=useContext(ServerContext);
 const query=useInfiniteQuery({queryKey:serverKey(scope.owner,language,'publications'),queryFn:({signal,pageParam})=>gateway.publications(pageParam,signal),initialPageParam:undefined as string|undefined,getNextPageParam:p=>p.next_before??undefined,maxPages:20,enabled:scope.enabled,staleTime:60_000});
 const posts=query.data?.pages.flatMap(p=>p.posts)??initialPosts,before=query.hasNextPage,loading=query.isFetching,error=query.isError?t('Не удалось загрузить публикации.','Could not load publications.'):'';
 const load=(older?:boolean)=>older?query.fetchNextPage():query.refetch();
 return <div className="chat-history" role="log" aria-label={t('Публикации Midnight Persona','Midnight Persona publications')}><div className="chat-history-inner system-posts">{[...posts].sort((a,b)=>a.published_at.localeCompare(b.published_at)).map(post=><article key={post.id} className="system-post"><h2>{post.title}</h2><p>{post.body}</p><time>{new Date(post.published_at).toLocaleString(language)}</time></article>)}{before&&<button className="chat-history-more" disabled={loading} onClick={()=>void load(before)}>{t('Ранние публикации','Earlier publications')}</button>}{error&&<p role="alert">{error}<button onClick={()=>void load()}>{t('Повторить','Retry')}</button></p>}{!posts.length&&!loading&&!error&&<p>{t('Публикаций пока нет.','No publications yet.')}</p>}</div></div>;
}

type TelegramAuthResult={id_token?:string;error?:string};
declare global{interface Window{Telegram?:{Login?:{auth:(options:{client_id:number;scope:string[];nonce:string;lang:string},callback:(result:TelegramAuthResult)=>void)=>void}}}}
let sdkPromise:Promise<void>|null=null;
function loadTelegramSdk(){return sdkPromise??=new Promise<void>((resolve,reject)=>{if(window.Telegram?.Login){resolve();return;}const script=document.createElement('script');script.src='https://oauth.telegram.org/js/telegram-login.js?6';script.async=true;script.onload=()=>resolve();script.onerror=()=>{sdkPromise=null;script.remove();reject(new Error('sdk_unavailable'));};document.head.append(script);});}
export function TelegramLink({gateway,onLinked}:{gateway:Gateway;onLinked:()=>void}){
 const t=useCopy(),{language}=useLocalization();const [state,setState]=useState<{linked:boolean;available:boolean}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[challenge,setChallenge]=useState<{challenge:string;client_id:string;expires_at:string}|null>(null),[attempt,setAttempt]=useState(0);const alive=useRef(true);
 useEffect(()=>{alive.current=true;gateway.telegramLinkStatus().then(s=>alive.current&&setState(s)).catch(()=>alive.current&&setError(t('Не удалось загрузить привязку.','Could not load account linking.')));return()=>{alive.current=false;};},[gateway,attempt]);
 useEffect(()=>{if(!state?.available||state.linked)return;let active=true;setChallenge(null);Promise.all([loadTelegramSdk(),gateway.telegramLinkStart()]).then(([,value])=>{if(active)setChallenge(value);}).catch(()=>active&&setError(t('Не удалось подготовить Telegram.','Could not prepare Telegram sign-in.')));return()=>{active=false;};},[state?.available,state?.linked,gateway,attempt]);
 const link=()=>{if(busy||!challenge)return;if(Date.parse(challenge.expires_at)<=Date.now()){setAttempt(n=>n+1);return;}setBusy(true);setError('');try{if(!window.Telegram?.Login)throw new Error('sdk_unavailable');window.Telegram.Login.auth({client_id:Number(challenge.client_id),scope:['profile'],nonce:challenge.challenge,lang:language},result=>{if(!alive.current)return;if(!result?.id_token){setBusy(false);return;}void gateway.telegramLinkComplete(challenge.challenge,result.id_token).then(()=>{if(alive.current){setState({linked:true,available:true});onLinked();}}).catch(e=>{if(alive.current){setError(e?.code==='telegram_account_conflict'?t('Не удалось подтвердить привязку аккаунта. Обратись в поддержку.','Could not confirm account linking. Please contact support.'):t('Не удалось подтвердить Telegram. Попробуй заново.','Could not verify Telegram. Please try again.'));setAttempt(n=>n+1);}}).finally(()=>alive.current&&setBusy(false));});}catch{if(alive.current){setError(t('Не удалось открыть Telegram. Попробуй ещё раз.','Could not open Telegram. Please try again.'));setBusy(false);}}};
 return <div>{state?.linked?<p>{t('Telegram привязан.','Telegram is linked.')}</p>:state?.available?<><p>{t('Подтверди свой аккаунт в Telegram, чтобы связать его с профилем.','Confirm your Telegram account to link it to this profile.')}</p><button className="account-primary" disabled={busy||!challenge} onClick={link}>{busy?t('Ожидаем подтверждения…','Waiting for confirmation…'):t('Подтвердить Telegram','Confirm Telegram')}</button></>:state?<p>{t('Привязка Telegram пока не настроена.','Telegram linking is not configured yet.')}</p>:<p>{t('Загружаем…','Loading…')}</p>}{error&&<p role="alert" className="account-error">{error}<button onClick={()=>setAttempt(n=>n+1)}>{t('Повторить','Retry')}</button></p>}</div>;
}
