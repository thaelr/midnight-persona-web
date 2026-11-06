import {ApiError} from './lib/gateway';
import {startPolling} from './lib/polling';
import {reportError} from './lib/diagnostics';
import {setActivity} from './lib/activity';
import {queryClient,serverKey,ServerContext} from './lib/queries';
import {useContext} from 'react';
import {useCopy} from './lib/localization';
import {useOverlayBack} from './lib/overlayBack';
import {authorizedPhotos} from './lib/photoViewer';
import {PhotoPanelCard} from './PhotoPanelCard';
import {PhotoLightbox, type PhotoLightboxSource} from './PhotoLightbox';
import {ChatVideo} from './ChatVideo';
import {SystemFeed} from './Community';
import {Sheet} from './components/Sheet';
import type {Publication} from './lib/gateway';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Gateway } from './lib/gateway';
import type { Character, Chat, Message, WebEvent, Product, Gallery, QuickRepliesData } from './lib/types';
import './chat.css';

export interface ChatViewProps {
  gateway: Gateway;
  characters: Character[];
  chats: Chat[];
  chatCode: string | null;
  onOpenChat: (code: string) => void;
  onClose: () => void;
  notify: (message: string) => void;
  onPurchase: (sku: string, chatCode: string, mediaId?: string,subscriptionChange?:'upgrade'|'renew',animateMediaId?:string) => void;
  onRefreshChats: () => void;
  language?: string;
  publications?:Publication[];
  /** API base + authenticated user ID. The parent also keys this component by it. */
  storageScope?: string;
}
type Outgoing = { id: string; text: string; createdAt: string; status: 'sending' | 'accepted' | 'failed'; operationId?: string; matchedMessageId?: string };
type TimelineMedia = { id: string; at: string; sceneId: string | null; sku?: string };
type ThreadState = {
  messages: Message[]; nextBefore: string | null; loaded: boolean; loading: boolean; error: string | null;
  cursor: string; replayed: boolean; quick: QuickRepliesData | null; media: TimelineMedia[];
  gallery: Gallery['media']; operations: Record<string, { status: string; action: string }>;
  outgoing: Outgoing[]; unread: number;windowed:boolean;
};
const fresh = (): ThreadState => ({ messages: [], nextBefore: null, loaded: false, loading: false, error: null,
  cursor: '0', replayed: false, quick: null, media: [], gallery: [], operations: {}, outgoing: [], unread: 0,windowed:false });
const terminal = new Set(['completed', 'failed', 'stale']);
const order = (a: Message, b: Message) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
const mergeMessages = (left: Message[], right: Message[]) => [...new Map([...left, ...right].map(m => [m.id, m])).values()].sort(order);
const readStorage = <T,>(key: string, fallback: T): T => { try { return JSON.parse(sessionStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const readPersistent=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const writeStorage = (key: string, value: unknown) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode may disallow storage. */ } };
const safeImage = (url: string | null | undefined) => { if (!url) return undefined; try { const u = new URL(url, location.origin); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } };

function reconcileOutgoing(outgoing: Outgoing[], messages: Message[]): Outgoing[] {
  // Current rows reconcile by the original client ID. Legacy rows without it
  // use a one-to-one text/time fallback; writes always retain their original ID.
  const used = new Set(outgoing.flatMap(x => x.matchedMessageId ? [x.matchedMessageId] : []));
  return outgoing.map(item => {
    if (item.matchedMessageId) return item;
    const exact=messages.find(m=>m.client_message_id===item.id);
    const match = exact??messages.find(m => !m.client_message_id&&m.role === 'user' && m.source === 'web' && m.text === item.text &&
      !used.has(m.id) && Date.parse(m.created_at) >= Date.parse(item.createdAt) - 2000);
    if (!match) return item;
    used.add(match.id);
    return { ...item, matchedMessageId: match.id };
  });
}

export function ChatView(props: ChatViewProps) {
  const { gateway, characters, chats, chatCode, onOpenChat, onClose, notify, onPurchase, onRefreshChats, language = 'ru', storageScope } = props;
  const scope=useContext(ServerContext);
  const alive=useRef(true),readAbort=useRef(new AbortController());
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;readAbort.current.abort();};},[]);
  const storagePrefix = storageScope ? `mp.chat.${encodeURIComponent(storageScope)}` : null;
  const tr = useCopy();const isSystem=chatCode==='system';
  const [videoOffers,setVideoOffers]=useState<{mediaId:string;products:Product[]}|null>(null);
  const [videoBusy,setVideoBusy]=useState<string|null>(null);
  const [continuing,setContinuing]=useState(false);
  const [modeNotice,setModeNotice]=useState<string|null>(null);const [reconnect,setReconnect]=useState(0);
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const threadsRef = useRef(threads);
  const propsRef = useRef(props); propsRef.current = props;
  const chatsRef = useRef(chats); chatsRef.current = chats;
  const activeRef = useRef(chatCode); activeRef.current = chatCode;
  const [drafts, setDrafts] = useState<Record<string, string>>(() => storagePrefix ? readStorage(`${storagePrefix}.drafts`, {}) : {});
  const [collapsed, setCollapsed] = useState(false);
  const [commands, setCommands] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const resetIds = useRef<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{id:string;chatCode:string;source:PhotoLightboxSource} | null>(null);
  const [viewerExtras,setViewerExtras]=useState<Record<string,{id:string;url:string;createdAt:string}>>({});
  const [newMessages, setNewMessages] = useState(false);
  useOverlayBack(resetOpen,()=>setResetOpen(false));
  const historyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLDialogElement>(null);
  const nearBottom = useRef(true);
  const positions = useRef<Record<string, number>>({});
  const prepend = useRef<{ code: string; height: number; top: number } | null>(null);
  const lastRenderedCode = useRef<string | null>(null);
  const sendingIds = useRef(new Set<string>());
  const loadBusy = useRef(new Set<string>());
  const mediaBusy = useRef(new Set<string>());
  const mediaRequestIds = useRef<Record<string, string>>({});

  const update = useCallback((code: string, fn: (state: ThreadState) => ThreadState) => {
    if(!alive.current)return;
    let previous = threadsRef.current[code];
    if (!previous) {
      const saved = storagePrefix ? readStorage<Outgoing[]>(`${storagePrefix}.outbox.${code}`, []) : [];
      previous = { ...fresh(), operations:storagePrefix?readStorage(`${storagePrefix}.operations.${code}`,{}):{}, cursor:storagePrefix?readStorage(`${storagePrefix}.cursor.${code}`,'0'):'0', outgoing: saved.map(item => item.status === 'sending' ? { ...item, status: 'failed' as const } : item) };
    }
    const state = fn(previous);
    const completed=Object.entries(state.operations).filter(([,v])=>terminal.has(v.status)).slice(-50);state.operations={...Object.fromEntries(completed),...Object.fromEntries(Object.entries(state.operations).filter(([,v])=>!terminal.has(v.status)))};
    threadsRef.current = { ...threadsRef.current, [code]: state };
    setThreads(threadsRef.current);
    if (storagePrefix) {writeStorage(`${storagePrefix}.outbox.${code}`, state.outgoing);writeStorage(`${storagePrefix}.cursor.${code}`,state.cursor);writeStorage(`${storagePrefix}.operations.${code}`,state.operations);}
  }, [storagePrefix]);

  const pendingDeliveries=useRef(new Map<string,{readyAt:string;code:string}>());
  const refreshGallery = useCallback(async (code:string)=>{
   try{const result=await queryClient.fetchQuery({queryKey:serverKey(scope.owner,language,'gallery',code),queryFn:({signal})=>gateway.gallery(code,signal),staleTime:0});if(!alive.current||activeRef.current!==code)return;update(code,s=>({...s,gallery:result.media}));for(const delivery of result.video_deliveries??[])pendingDeliveries.current.set(delivery.delivery_id,{readyAt:delivery.ready_at??new Date().toISOString(),code});}
   catch(error){if(error instanceof ApiError&&[401,403].includes(error.status))update(code,s=>({...s,gallery:[]}));reportError('chat','gallery',error);}
  },[gateway,update,scope.owner,language]);

  const loadHistory = useCallback(async (code: string, before?: string,rebase=false) => {
    if (loadBusy.current.has(code)) return;
    loadBusy.current.add(code);
    update(code, s => ({ ...s, loading: true, error: null }));
    try {
      const result = await gateway.messages(code, { before, limit: 50 },readAbort.current.signal);
      if(!alive.current||activeRef.current!==code)return;
      if (before && historyRef.current && activeRef.current === code) prepend.current = { code, height: historyRef.current.scrollHeight, top: historyRef.current.scrollTop };
      update(code, s => {
        const messages = mergeMessages(rebase?[]:s.messages, result.messages);
        const snapshot=!before&&(!s.loaded||rebase);
        return { ...s, messages:before?messages.slice(0,1000):messages.slice(-1000),windowed:rebase?false:before&&messages.length>1000||s.windowed, cursor:snapshot?(result.event_cursor??s.cursor):s.cursor,quick:snapshot?(result.quick_replies??null):s.quick, nextBefore: before || !s.loaded || rebase ? result.next_before : s.nextBefore,
          loaded: true, loading: false, outgoing: reconcileOutgoing(s.outgoing, messages) };
      });
    } catch {
      if(readAbort.current.signal.aborted||activeRef.current!==code)return;
      update(code, s => ({ ...s, loading: false, error: tr('Не удалось загрузить переписку. Повтори попытку.', 'Could not load this conversation. Try again.') }));
    } finally { loadBusy.current.delete(code); }
  }, [gateway, tr, update]);

  useEffect(() => {
    if(!chatCode||chatCode==='system')return;
    const code=chatCode;let stopped=false;readAbort.current.abort();readAbort.current=new AbortController();
    // Only the visible conversation owns a history/event chain. Outbox/cursor stay owner-scoped.
    threadsRef.current={};setThreads({});update(code,s=>s);
    const stop=startPolling(async()=>{
      if(!threadsRef.current[code]?.loaded){await loadHistory(code);if(!threadsRef.current[code]?.loaded)throw new ApiError(0,'history_unavailable');await refreshGallery(code);}
      let refreshMedia=false,refreshHistory=false;
      try{for(let page=0;page<6&&!stopped;page++){
        if(document.visibilityState==='hidden'||!navigator.onLine)break;
        const state=threadsRef.current[code];const cursor=state?.cursor??'0';
        const ids=Object.entries(state?.operations??{}).filter(([,v])=>!terminal.has(v.status)).map(([id])=>id).slice(0,50);
        const result=await gateway.events(code,{after:cursor,limit:100,...(ids.length?{operation_ids:ids.join(',')}:{})},readAbort.current.signal);
        if(stopped)return false;
        for(const event of result.events){if(['media_offer','media_unlocked','video_delivered'].includes(event.type))refreshMedia=true;if(event.type==='video_delivered')refreshHistory=true;applyEvent(code,event,true);}
        for(const op of result.operations??[])applyEvent(code,{cursor:result.cursor,created_at:new Date().toISOString(),type:'operation_status',data:{...op,error_code:null}},true);
        update(code,s=>({...s,cursor:result.cursor,replayed:true,error:null}));
        if(result.events.length<100||result.cursor===cursor)break;
      }}catch(error){if(error instanceof ApiError&&['event_cursor_gap','invalid_cursor'].includes(error.code)){await loadHistory(code,undefined,true);await refreshGallery(code);return true;}throw error;}
      if(refreshMedia)await refreshGallery(code);if(refreshHistory)await loadHistory(code);
      for(const [id,delivery] of [...pendingDeliveries.current].filter(([,v])=>v.code===code&&Date.parse(v.readyAt)<=Date.now()).slice(0,10)){try{const value=await gateway.videoDelivery(id);if(value.status==='delivered'){pendingDeliveries.current.delete(id);await loadHistory(code);await refreshGallery(code);}}catch(error){delivery.readyAt=new Date(Date.now()+30_000).toISOString();reportError('chat','video_delivery',error);}}
      return Object.values(threadsRef.current[code]?.operations??{}).some(op=>!terminal.has(op.status))||pendingDeliveries.current.size>0;
    },error=>{if(!stopped){update(code,s=>({...s,error:tr('Связь прервана. Переподключаемся…','Connection lost. Reconnecting…')}));reportError('chat','events',error);}});
    function applyEvent(code: string, event: WebEvent, live: boolean) {
      update(code, s => {
        if (event.type === 'message') {
          if (!live) return event.data.role === 'user' ? { ...s, quick: null } : s;
          const isNew = !s.messages.some(m => m.id === event.data.id);
          const messages = mergeMessages(s.messages, [event.data]);
          if (isNew && code === activeRef.current && !nearBottom.current) setNewMessages(true);
          return { ...s, messages:s.windowed?messages.slice(0,1000):messages.slice(-1000), outgoing: reconcileOutgoing(s.outgoing, messages),
            quick: event.data.role === 'user' ? null : s.quick,
            unread: code !== activeRef.current && isNew && event.data.role === 'assistant' ? s.unread + 1 : s.unread };
        }
        if (event.type === 'quick_replies') return { ...s, quick: event.data };
        if (event.type === 'scene') { if (live) propsRef.current.onRefreshChats(); return { ...s, quick: null }; }
        if (event.type === 'media_offer' || event.type === 'media_unlocked') {
          const item = { id: event.data.media_id, at: event.created_at, sceneId: event.data.scene_session_id,
            ...(event.type === 'media_offer' ? { sku: event.data.sku } : {}) };
          return { ...s, quick:event.type==='media_offer'?null:s.quick, media: s.media.some(m => m.id === item.id) ? s.media.map(m => m.id === item.id ? { ...m, ...item, at: m.at } : m) : [...s.media, item] };
        }
        if (event.type === 'operation_status') {
          const { operation_id: id, status, action } = event.data;
          if(['failed','stale'].includes(status)&&s.operations[id]?.status!==status)queueMicrotask(()=>{if(alive.current)propsRef.current.notify(tr('Операция не завершилась. Данные диалога обновлены.','The operation did not complete. Conversation state has been refreshed.'));});
          const outgoing = s.outgoing.flatMap(item => item.operationId === id && status === 'completed' ? [] :
            [{ ...item, ...(item.operationId === id && ['failed', 'stale'].includes(status) ? { status: 'failed' as const } : {}) }]);
          return { ...s, operations: { ...s.operations, [id]: { status, action } }, outgoing };
        }
        return s;
      });
    }
    return()=>{stopped=true;stop();readAbort.current.abort();pendingDeliveries.current.clear();};
  },[chatCode,gateway,loadHistory,refreshGallery,update,reconnect]);

  useEffect(() => {
    setCommands(false); setResetOpen(false); setLightbox(null);setViewerExtras({}); setNewMessages(false);
    if (chatCode&&chatCode!=='system') {
      update(chatCode, s => ({ ...s, unread: 0 }));

      const code=chatCode;setContinuing(false);setModeNotice(null);

      void gateway.continuation(code).then(result=>{if(activeRef.current!==code)return;setContinuing(result.offered);if(result.messages.length)update(code,s=>({...s,messages:mergeMessages(s.messages,result.messages)}));}).catch(()=>{});
    } else {setCollapsed(false);readAbort.current.abort();}
  }, [chatCode, loadHistory, refreshGallery, update]);
  useEffect(()=>{if(!chatCode)return;const imported=chats.find(c=>c.chat_code===chatCode);const marker=storagePrefix?storagePrefix+'.mode.'+chatCode:null;if(imported?.origin==='telegram'&&imported.scene_mode&&marker&&!readPersistent(marker)){setModeNotice(imported.scene_mode);try{localStorage.setItem(marker,'1');}catch{}}},[chatCode,chats,storagePrefix]);
  useEffect(() => { if (storagePrefix) {writeStorage(`${storagePrefix}.drafts`, drafts);window.dispatchEvent(new Event('mp-drafts-changed'));} }, [drafts, storagePrefix]);
  useEffect(() => {
    const dialog = resetRef.current;
    if (resetOpen && dialog && !dialog.open) dialog.showModal();
    if (!resetOpen && dialog?.open) dialog.close();
  }, [resetOpen]);
  useEffect(() => {
    if (!commands) return;
    const dismiss = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setCommands(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCommands(false); composerRef.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [commands]);

  const current = chatCode ? threads[chatCode] || fresh() : fresh();
  const chat = chats.find(c => c.chat_code === chatCode);
  const character = characters.find(c => c.character_i === chat?.character_i);
  const draft = chatCode ? drafts[chatCode] || '' : '';
  const writer = Object.values(current.operations).some(op => ['message', 'scene_start', 'reset'].includes(op.action) && !terminal.has(op.status));
  const visibleOutgoing = current.outgoing.filter(o => !o.matchedMessageId || o.status === 'failed');
  const timelineMedia=[...new Map([...current.media,...current.gallery.filter(m=>m.created_at).map(m=>({id:m.media_id,at:m.created_at!,sceneId:m.scene_session_id??null,...(!m.unlocked?{sku:m.sku}:{})}))].map(m=>[m.id,m])).values()].filter(m=>!current.messages.some(message=>message.media_kind==='photo'&&message.media_id===m.id));
  const visibleMedia = current.nextBefore && current.messages.length ? timelineMedia.filter(m => m.at >= current.messages[0].created_at) : timelineMedia;
  const totalItems = current.messages.length + visibleMedia.length + visibleOutgoing.length;
  const lightboxPhotos=[...new Map([...Object.values(viewerExtras),...authorizedPhotos(current.messages,current.gallery)].map(photo=>[photo.id,photo])).values()].filter(photo=>safeImage(photo.url)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  useLayoutEffect(() => {
    const element = historyRef.current;
    if (!element || !chatCode) return;
    if (lastRenderedCode.current !== chatCode) {
      element.scrollTop = positions.current[chatCode] ?? element.scrollHeight;
      lastRenderedCode.current = chatCode;
      nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    } else if (prepend.current?.code === chatCode) {
      element.scrollTop = prepend.current.top + element.scrollHeight - prepend.current.height; prepend.current = null;
    } else if (nearBottom.current) element.scrollTop = element.scrollHeight;
  }, [chatCode, totalItems, current.loaded, writer]);

  async function transmit(code: string, outgoing: Outgoing) {
    if (sendingIds.current.has(outgoing.id)) return;
    sendingIds.current.add(outgoing.id);
    update(code, s => ({ ...s, outgoing: s.outgoing.map(x => x.id === outgoing.id ? { ...x, status: 'sending' } : x) }));
    try {
      const operation = await gateway.sendMessage(code, { client_message_id: outgoing.id, text: outgoing.text });
      update(code, s => {
        const known = s.operations[operation.operation_id];
        const status = known && terminal.has(known.status) ? known.status : operation.status;
        return { ...s, operations: { ...s.operations, [operation.operation_id]: { status, action: operation.action } },
          outgoing: s.outgoing.flatMap(x => x.id !== outgoing.id ? [x] : status === 'completed' ? [] :
            [{ ...x, operationId: operation.operation_id, status: ['failed', 'stale'].includes(status) ? 'failed' as const : 'accepted' as const }]) };
      });
      void loadHistory(code);
    } catch {
      update(code, s => ({ ...s, outgoing: s.outgoing.map(x => x.id === outgoing.id ? { ...x, status: 'failed' } : x) }));
    } finally { sendingIds.current.delete(outgoing.id); }
  }
  function send(text: string) {
    if (!chatCode || !text.trim()) return;
    if((threadsRef.current[chatCode]?.outgoing.length??0)>=50){notify(tr('Дождись завершения отправленных сообщений.','Wait for the sent messages to finish.'));return;}
    const item: Outgoing = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString(), status: 'sending' };
    update(chatCode, s => ({ ...s, quick: null, outgoing: [...s.outgoing, item] }));
    setDrafts(s => ({ ...s, [chatCode]: '' }));
    nearBottom.current = true; setNewMessages(false);
    void transmit(chatCode, item);
  }
  function submit(e: FormEvent) { e.preventDefault(); send(draft); }
  async function openCommands() {
    if (!chatCode) return;
    if (commands) { setCommands(false); return; }
    setCommands(true); setCatalogLoading(true); setProducts([]);
    try { const result = await queryClient.fetchQuery({queryKey:serverKey(scope.owner,language,'catalog',chatCode),queryFn:({signal})=>gateway.catalog(chatCode,signal),staleTime:15_000}); setProducts(result.products.filter(p => p.kind !== 'photo'&&p.feature_key!=='video_unlock')); }
    catch { setCommands(false); notify(tr('Не удалось загрузить доступные действия.', 'Could not load available actions.')); }
    finally { setCatalogLoading(false); }
  }
  async function resetScene(mode:'fast'|'roleplay') {
    if (!chatCode || isSystem || resetBusy) return;
    const pendingMode=storagePrefix?readStorage<string|null>(`${storagePrefix}.resetmode.${chatCode}`,null):null;
    if(pendingMode&&pendingMode!==mode){notify(tr('Предыдущий сброс ещё не подтверждён. Повтори выбранный для него режим.','The previous reset is unconfirmed. Retry its selected mode.'));return;}
    setResetBusy(true);
    resetIds.current[chatCode] ||= storagePrefix ? readStorage<string | null>(`${storagePrefix}.reset.${chatCode}`, null) || crypto.randomUUID() : crypto.randomUUID();
    if (storagePrefix) writeStorage(`${storagePrefix}.reset.${chatCode}`, resetIds.current[chatCode]);
    if (storagePrefix) writeStorage(`${storagePrefix}.resetmode.${chatCode}`,mode);
    try {
      const operation = await gateway.reset(chatCode, { client_message_id: resetIds.current[chatCode],scene_mode:mode });
      update(chatCode, s => ({ ...s, quick: null, operations: { ...s.operations,
        [operation.operation_id]: s.operations[operation.operation_id] && terminal.has(s.operations[operation.operation_id].status) ? s.operations[operation.operation_id] : { status: operation.status, action: operation.action } } }));
      delete resetIds.current[chatCode];
      if (storagePrefix) writeStorage(`${storagePrefix}.reset.${chatCode}`, null);
      if (storagePrefix) writeStorage(`${storagePrefix}.resetmode.${chatCode}`, null);
      setResetOpen(false); onRefreshChats();
      if (['failed', 'stale'].includes(operation.status)) notify(tr('Сервис не смог начать новую сцену.', 'The service could not start the new scene.'));
    } catch { setResetOpen(false); notify(tr('Не удалось начать сцену. Повторная попытка сохранит идентификатор операции.', 'Could not start the scene. Retrying will use the same operation ID.')); }
    finally { setResetBusy(false); }
  }
  async function unlock(mediaId: string, sku: string) {
    if (!chatCode || mediaBusy.current.has(mediaId)) return;
    mediaBusy.current.add(mediaId);
    const key=`${storagePrefix}.unlock.${chatCode}.${mediaId}`;mediaRequestIds.current[mediaId] ||= readStorage<string|null>(key,null)??crypto.randomUUID();writeStorage(key,mediaRequestIds.current[mediaId]);
    try {
      const result = await gateway.unlockMedia(chatCode, mediaId, { client_message_id: mediaRequestIds.current[mediaId] });
      if ('unlocked' in result && result.unlocked) { await refreshGallery(chatCode); notify(tr('Фотография открыта.', 'Photo unlocked.')); }
      else if ('purchase_id' in result) notify(tr('Для фотографии уже создана покупка. Проверь её статус в окне оплаты.', 'A purchase has already been created for this photo. Check its payment status.'));
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (['payment_provider_required', 'provider_required', 'payment_required'].includes(code)) onPurchase(sku, chatCode, mediaId);
      else notify(tr('Не удалось открыть фотографию. Попробуй ещё раз.', 'Could not unlock the photo. Try again.'));
    } finally { mediaBusy.current.delete(mediaId); }
  }
  function openPurchase(sku: string, mediaId?: string,subscriptionChange?:'upgrade'|'renew',animateMediaId?:string) { if (chatCode) { setCommands(false); setResetOpen(false); onPurchase(sku, chatCode, mediaId,subscriptionChange,animateMediaId); } }
  async function animatePhoto(mediaId:string){
    if(!chatCode||videoBusy)return;setVideoBusy(mediaId);try{
      const state=await gateway.videoAvailability(chatCode,mediaId);
      if(!state.animation_available){await refreshGallery(chatCode);return;}
      if(state.full_active||state.video_pass_active){
        const key=`${storagePrefix}.video.${chatCode}.${mediaId}`;let id=readStorage<string|null>(key,null);if(!id){id=crypto.randomUUID();writeStorage(key,id);}
        const delivery=await gateway.requestVideo(chatCode,mediaId,id);try{await gateway.videoDelivery(delivery.delivery_id);}catch{/* eligible_at is enforced on the server. */}
        await refreshGallery(chatCode);await loadHistory(chatCode);
      }else{const catalog=await queryClient.fetchQuery({queryKey:serverKey(scope.owner,language,'catalog',chatCode),queryFn:({signal})=>gateway.catalog(chatCode,signal),staleTime:15_000});setVideoOffers({mediaId,products:catalog.products.filter(p=>p.feature_key==='video_unlock'||p.feature_key==='video_pass'||p.subscription_tier==='full')});}
    }catch{notify(tr('Не удалось запросить видео. Повтор использует ту же выдачу.','Could not request the video. Retrying uses the same delivery.'));}finally{setVideoBusy(null);}
  }
  const readId=useRef<Record<string,string>>({});
  const markVisibleRead=useCallback(()=>{if(!chatCode||isSystem||document.visibilityState!=='visible'||!nearBottom.current)return;const last=threadsRef.current[chatCode]?.messages.at(-1);if(!last||readId.current[chatCode]===last.id)return;const code=chatCode;gateway.markRead(code,last.id).then(()=>{readId.current[code]=last.id;onRefreshChats();}).catch(()=>{});},[chatCode,isSystem,gateway,onRefreshChats]);
  useEffect(()=>{markVisibleRead();const visible=()=>markVisibleRead();document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[markVisibleRead,current.messages]);
  useEffect(()=>{setActivity('chat-draft',Object.values(drafts).some(Boolean));return()=>setActivity('chat-draft',false);},[drafts]);
  useEffect(()=>{setActivity('chat-pending',writer||resetBusy||!!videoBusy);return()=>setActivity('chat-pending',false);},[writer,resetBusy,videoBusy]);
  const clock = (date: string) => { try { return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(date)); } catch { return ''; } };

  return <section className={`chat-shell ${chatCode ? 'chat-has-active' : ''} ${collapsed ? 'chat-collapsed' : ''}`} aria-label={tr('Чаты', 'Chats')}>
    <aside className="chat-sidebar">
      <div className="chat-sidebar-heading"><div><span className="chat-eyebrow">{tr('MIDNIGHT / ПЕРЕПИСКА','MIDNIGHT / INBOX')}</span><h1>{tr('Твои истории', 'Your stories')}</h1></div><button className="chat-icon chat-collapse" onClick={() => setCollapsed(true)} aria-label={tr('Свернуть список чатов', 'Collapse conversations')}>‹</button></div>
      <div className="chat-conversations">{Boolean(props.publications?.length)&&<button className={`chat-list-item ${isSystem?'chat-list-active':''}`} onClick={()=>onOpenChat('system')}><span className="chat-avatar">M</span><span className="chat-list-text"><strong>Midnight Persona</strong><span>{props.publications?.[0]?.title}</span></span></button>}
        {chats.length === 0 ? <div className="chat-empty-list"><span className="chat-empty-mark" aria-hidden="true">↗</span><h2>{tr('Всё начинается с привет', 'It starts with hello')}</h2><p>{tr('Выбери персонажа. Здесь появится ваша первая история.', 'Choose a character. Your first story will appear here.')}</p></div> : chats.map(item => {
          const person = characters.find(p => p.character_i === item.character_i);
          const state = threads[item.chat_code];
          const last = item.last_message??state?.messages.at(-1);
          return <button key={item.chat_code} className={`chat-list-item ${item.chat_code === chatCode ? 'chat-list-active' : ''}`} onClick={() => onOpenChat(item.chat_code)} aria-current={item.chat_code === chatCode ? 'page' : undefined}>
            <span className="chat-avatar">{safeImage(person?.image_url) ? <img src={safeImage(person?.image_url)} alt="" loading="lazy" /> : <span>{person?.name.slice(0, 1) || 'M'}</span>}</span>
            <span className="chat-list-text"><strong>{person?.name || tr('Персонаж', 'Character')}</strong><span>{last?.media_kind==='video'?tr('Видео','Video'):last?.media_kind==='photo'?tr('Фотография','Photo'):last?.text || tr('Открыть переписку', 'Open conversation')}</span></span>
            <span className="chat-list-meta"><time>{clock(last?.created_at || item.updated_at)}</time>{!!item.unread_count && <span className="chat-unread" aria-label={tr('Непрочитанные сообщения', 'Unread messages')}>{item.unread_count}</span>}</span>
          </button>;
        })}
      </div>
      <div className="chat-sidebar-foot"><span aria-hidden="true">✳</span>{tr('Каждая встреча — отдельная история.', 'Every encounter is a story of its own.')}</div>
    </aside>
    <main className="chat-main">
      {!chatCode ? <div className="chat-no-selection"><span className="chat-empty-mark" aria-hidden="true">↗</span><span className="chat-eyebrow">{tr('НЕМНОГО БЛИЖЕ','A LITTLE CLOSER')}</span><h2>{tr('Продолжим?', 'Shall we continue?')}</h2><p>{tr('Открой переписку слева.', 'Open a conversation on the left.')}</p></div> : isSystem?<><header className="chat-header"><div className="chat-title"><strong>Midnight Persona</strong><span>{tr('Новости и публикации','News and publications')}</span></div><button className="chat-icon" onClick={onClose} aria-label={tr('Закрыть диалог','Close conversation')}>↗</button></header><SystemFeed gateway={gateway} initialPosts={props.publications??[]}/></>:<>
        <header className="chat-header">
          {collapsed && <button className="chat-icon chat-expand" onClick={() => setCollapsed(false)} aria-label={tr('Развернуть список чатов', 'Expand conversations')}>☰</button>}
          <span className="chat-avatar chat-avatar-small">{safeImage(character?.image_url) ? <img src={safeImage(character?.image_url)} alt="" /> : character?.name.slice(0, 1)}</span>
          <div className="chat-title"><strong>{character?.name || tr('Переписка', 'Conversation')}</strong><span>{writer ? tr('Печатает…', 'Typing…') : chat?.scene_mode === 'fast' ? 'Fast' : chat?.scene_mode === 'roleplay' ? 'Roleplay' : tr('Ваша история', 'Your story')}</span></div>
          <button className="chat-icon chat-close" onClick={() => { if (historyRef.current) positions.current[chatCode] = historyRef.current.scrollTop; onClose(); }} aria-label={tr('Закрыть диалог', 'Close conversation')}>↗</button>
        </header>
        {modeNotice&&<div className="chat-connection" role="status">{modeNotice==='fast'?tr('Выбран режим «Погорячее»','The “Hotter” mode is selected'):tr('Выбран режим «История»','The “Story” mode is selected')}<button onClick={()=>setModeNotice(null)}>{tr('Закрыть','Close')}</button></div>}{current.error && <div className="chat-connection" role="status">{current.error}<button onClick={() => setReconnect(n=>n+1)}>{tr('Повторить', 'Retry')}</button></div>}
        {continuing&&<div className="chat-connection" role="status">{tr('Продолжаем вашу историю из Telegram.','Continuing your story from Telegram.')}<button onClick={()=>setContinuing(false)}>{tr('Закрыть','Close')}</button></div>}
        <div className="chat-history" ref={historyRef} role="log" aria-label={tr('История сообщений', 'Message history')} aria-live="polite" aria-relevant="additions text" onScroll={e => {
          const el = e.currentTarget; positions.current[chatCode] = el.scrollTop;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
          if (nearBottom.current) {setNewMessages(false);markVisibleRead();}
        }}>
          <div className="chat-history-inner">
            {current.windowed&&<button className="chat-history-more" onClick={()=>void loadHistory(chatCode,undefined,true)}>{tr("К последним сообщениям","Back to latest messages")}</button>}{current.nextBefore && <button className="chat-history-more" disabled={current.loading} onClick={() => void loadHistory(chatCode, current.nextBefore || undefined)}>{current.loading ? tr('Загружаем…', 'Loading…') : tr('Ранние сообщения ↑', 'Earlier messages ↑')}</button>}
            {!current.loaded && current.loading && <div className="chat-loading" role="status">{tr('Возвращаем вашу историю…', 'Loading your story…')}</div>}
            {current.loaded && !totalItems && <div className="chat-conversation-start"><span>✳</span><p>{tr('Ваша история начинается здесь.', 'Your story begins here.')}</p></div>}
            {[...current.messages.map(message => ({ kind: 'message' as const, at: message.created_at, message })), ...visibleMedia.map(media => ({ kind: 'media' as const, at: media.at, media }))].sort((a, b) => a.at.localeCompare(b.at)).map(item => {
              if(item.kind==='message'&&item.message.media_kind==='video'&&item.message.video_delivery_id)return <article key={item.message.id} className="chat-media"><ChatVideo gateway={gateway} deliveryId={item.message.video_delivery_id}/><time>{clock(item.at)}</time></article>;
              if (item.kind === 'message'&&!item.message.media_kind) return <article key={`m-${item.message.id}`} className={`chat-message chat-message-${item.message.role}`}><p>{item.message.text}</p><time dateTime={item.at}>{clock(item.at)}</time></article>;
              const mediaId=item.kind==='message'?item.message.media_id!:item.media.id;
              const access = current.gallery.find(m => m.media_id === mediaId);
              const photo = access?.unlocked ? safeImage(access.photo_url) : item.kind==='message'?safeImage(item.message.photo_url):undefined;
              return <article key={`media-${mediaId}`} className="chat-media">
                <PhotoPanelCard gateway={gateway} chatCode={chatCode} sceneSessionId={chat?.scene_session_id??null} mediaId={mediaId} anchor={access?.panel_media_id} photoUrl={photo} access={access} gallery={current.gallery} storageScope={storagePrefix} videoBusy={videoBusy!==null} onOpen={(id,url,source)=>{setViewerExtras(old=>({...old,[id]:{id,url,createdAt:item.at}}));setLightbox({id,chatCode,source});}} onUnlock={unlock} onAnimate={id=>void animatePhoto(id)} onChanged={()=>void refreshGallery(chatCode)}/>
                <time>{clock(item.at)}</time>
              </article>;
            })}
            {visibleOutgoing.map(item => <article key={item.id} className={`chat-message chat-message-user chat-outgoing ${item.status === 'failed' ? 'chat-send-failed' : ''}`}>
              {!item.matchedMessageId && <p>{item.text}</p>}<div className="chat-send-state"><time>{clock(item.createdAt)}</time><span>{item.status === 'failed' ? tr('Отправка не подтверждена', 'Delivery unconfirmed') : item.status === 'sending' ? tr('Отправляем…', 'Sending…') : tr('Доставляется', 'Delivering')}</span>{item.status === 'failed' && <button onClick={() => void transmit(chatCode, item)}>{tr('Повторить', 'Retry')}</button>}</div>
            </article>)}
            {writer && <div className="chat-typing" role="status" aria-label={tr('Персонаж печатает', 'Character is typing')}><i /><i /><i /></div>}
          </div>
        </div>
        <div className="chat-composer-area">
          {newMessages && <button className="chat-new-messages" onClick={() => { historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' }); nearBottom.current = true; setNewMessages(false); }}>{tr('Новые сообщения ↓', 'New messages ↓')}</button>}
          {!!current.quick?.options.length && current.quick.scene_session_id === chat?.scene_session_id && <div className="chat-quick-replies" aria-label={tr('Быстрые ответы', 'Quick replies')}>{current.quick.options.map((reply, index) => {
            const text = typeof reply === 'string' ? reply : reply.reply_text;
            return <button key={`${current.quick!.turn_no}-${index}`} onClick={() => send(text)}>{text}</button>;
          })}</div>}
          <form className="chat-composer" onSubmit={submit}>
            <div className="chat-command-anchor" ref={menuRef}>
              {commands && <div className="chat-command-menu" aria-label={tr('Действия', 'Actions')}><span className="chat-eyebrow">{tr('ВОЗМОЖНОСТИ', 'POSSIBILITIES')}</span><button onClick={() => { setCommands(false); setResetOpen(true); }} type="button">{tr('Начать новую сцену', 'Start a new scene')} <span>↗</span></button>{catalogLoading ? <p>{tr('Загружаем…', 'Loading…')}</p> : products.map(product => <button key={product.sku} type="button" onClick={() => openPurchase(product.sku,undefined,product.upgrade?'upgrade':undefined)}>{product.title}<span>↗</span></button>)}</div>}
              <button type="button" className="chat-command-button" aria-expanded={commands} aria-label={tr('Открыть меню команд', 'Open actions menu')} onClick={() => void openCommands()}>＋</button>
            </div>
            <label className="chat-composer-label"><span className="chat-sr-only">{tr('Твоё сообщение', 'Your message')}</span><textarea ref={composerRef} value={draft} rows={1} maxLength={4000} placeholder={tr('Напиши что-нибудь…', 'Say something…')} onChange={e => { setDrafts(s => ({ ...s, [chatCode]: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`; }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(draft); } }} /></label>
            <button className="chat-send" type="submit" disabled={!draft.trim()} aria-label={tr('Отправить сообщение', 'Send message')}>↑</button>
          </form>
          <span className="chat-composer-foot">{tr('Персонажи созданы с помощью ИИ.', 'Characters are created with AI.')}</span>
        </div>
      </>}
    </main>
    {videoOffers&&<Sheet title={tr('Оживить фото','Animate photo')} onClose={()=>setVideoOffers(null)}>{videoOffers.products.length?videoOffers.products.map(p=><button className="account-offer" key={p.sku} onClick={()=>{const mediaId=videoOffers.mediaId;setVideoOffers(null);openPurchase(p.sku,p.kind==='subscription'?undefined:mediaId,p.upgrade?'upgrade':undefined,p.kind==='subscription'?mediaId:undefined);}}><span><strong>{p.title}</strong><small>{p.description}</small></span><span>{p.upgrade?.price.amount??p.price?.amount} {p.upgrade?.price.currency??p.price?.currency} ↗</span></button>):<p>{tr('Сейчас нет доступных предложений.','There are no available offers right now.')}</p>}</Sheet>}
    <dialog className="chat-dialog" ref={resetRef} onCancel={() => setResetOpen(false)} onClick={e => { if (e.target === e.currentTarget) setResetOpen(false); }}>
      <div className="chat-dialog-content"><div className="chat-dialog-title"><h2>{tr('Новая сцена', 'A new scene')}</h2><button className="chat-icon" onClick={() => setResetOpen(false)} aria-label={tr('Закрыть', 'Close')}>×</button></div><p>{tr('Начни заново с тем же персонажем. Переписка останется в истории.', 'Start again with the same character. Your messages stay in history.')}</p><div className="chat-reset-modes">{(['fast', 'roleplay'] as const).map(mode => <button key={mode} disabled={resetBusy} onClick={() => void resetScene(mode)}>{mode === 'fast' ? 'Fast' : 'Roleplay'}<span>{tr('Начать новую сцену', 'Start a new scene')}</span></button>)}</div><button className="chat-continue" onClick={() => setResetOpen(false)}>{tr('Хочу продолжить текущий диалог', 'Continue this conversation')}</button></div>
    </dialog>
    {lightbox&&lightbox.chatCode===chatCode&&<PhotoLightbox photos={lightboxPhotos} selectedId={lightbox.id} source={lightbox.source} onSelect={id=>setLightbox(current=>current?{...current,id}:null)} onClose={()=>setLightbox(null)}/>}
  </section>;
}



