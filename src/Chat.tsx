import {useCopy} from './lib/localization';
import {useOverlayBack} from './lib/overlayBack';
import {authorizedPhotos} from './lib/photoViewer';
import {PhotoPanelCard} from './PhotoPanelCard';
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
  outgoing: Outgoing[]; unread: number;
};
const fresh = (): ThreadState => ({ messages: [], nextBefore: null, loaded: false, loading: false, error: null,
  cursor: '0', replayed: false, quick: null, media: [], gallery: [], operations: {}, outgoing: [], unread: 0 });
const terminal = new Set(['completed', 'failed', 'stale']);
const order = (a: Message, b: Message) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
const mergeMessages = (left: Message[], right: Message[]) => [...new Map([...left, ...right].map(m => [m.id, m])).values()].sort(order);
const readStorage = <T,>(key: string, fallback: T): T => { try { return JSON.parse(sessionStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
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
  const storagePrefix = storageScope ? `mp.chat.${encodeURIComponent(storageScope)}` : null;
  const tr = useCopy();const isSystem=chatCode==='system';
  const [videoOffers,setVideoOffers]=useState<{mediaId:string;products:Product[]}|null>(null);
  const [videoBusy,setVideoBusy]=useState<string|null>(null);
  const [continuing,setContinuing]=useState(false);
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
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [viewerExtras,setViewerExtras]=useState<Record<string,{id:string;url:string;createdAt:string}>>({});
  const [newMessages, setNewMessages] = useState(false);
  useOverlayBack(resetOpen,()=>setResetOpen(false));
  useOverlayBack(Boolean(lightbox),()=>setLightbox(null));
  const historyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLDialogElement>(null);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const lightboxPointer=useRef<number|null>(null);
  const nearBottom = useRef(true);
  const positions = useRef<Record<string, number>>({});
  const prepend = useRef<{ code: string; height: number; top: number } | null>(null);
  const lastRenderedCode = useRef<string | null>(null);
  const sendingIds = useRef(new Set<string>());
  const loadBusy = useRef(new Set<string>());
  const mediaBusy = useRef(new Set<string>());
  const mediaRequestIds = useRef<Record<string, string>>({});

  const update = useCallback((code: string, fn: (state: ThreadState) => ThreadState) => {
    let previous = threadsRef.current[code];
    if (!previous) {
      const saved = storagePrefix ? readStorage<Outgoing[]>(`${storagePrefix}.outbox.${code}`, []) : [];
      previous = { ...fresh(), outgoing: saved.map(item => item.status === 'sending' ? { ...item, status: 'failed' as const } : item) };
    }
    const state = fn(previous);
    threadsRef.current = { ...threadsRef.current, [code]: state };
    setThreads(threadsRef.current);
    if (storagePrefix) writeStorage(`${storagePrefix}.outbox.${code}`, state.outgoing);
  }, [storagePrefix]);

  const refreshGallery = useCallback(async (code: string) => {
    try { const result = await gateway.gallery(code); update(code, s => ({ ...s, gallery: result.media }));for(const delivery of result.video_deliveries??[]){try{await gateway.videoDelivery(delivery.delivery_id);}catch{/* Keep the existing delivery pending until eligible. */}}for(const media of result.media){if(media.video_delivery_id&&media.video_delivery_status!=='delivered'){try{await gateway.videoDelivery(media.video_delivery_id);}catch{/* Existing polling retries the same delivery. */}}} } catch { /* Offers remain locked when access cannot be verified. */ }
  }, [gateway, update]);

  const loadHistory = useCallback(async (code: string, before?: string) => {
    if (loadBusy.current.has(code)) return;
    loadBusy.current.add(code);
    update(code, s => ({ ...s, loading: true, error: null }));
    try {
      const result = await gateway.messages(code, { before, limit: 50 });
      if (before && historyRef.current && activeRef.current === code) prepend.current = { code, height: historyRef.current.scrollHeight, top: historyRef.current.scrollTop };
      update(code, s => {
        const messages = mergeMessages(s.messages, result.messages);
        return { ...s, messages, nextBefore: before || !s.loaded ? result.next_before : s.nextBefore,
          loaded: true, loading: false, outgoing: reconcileOutgoing(s.outgoing, messages) };
      });
    } catch {
      update(code, s => ({ ...s, loading: false, error: tr('Не удалось загрузить переписку. Повтори попытку.', 'Could not load this conversation. Try again.') }));
    } finally { loadBusy.current.delete(code); }
  }, [gateway, tr, update]);

  useEffect(() => {
    for (const chat of chats) {
      if (!threadsRef.current[chat.chat_code]) {
        update(chat.chat_code, s => s);
        void loadHistory(chat.chat_code);
      }
    }
  }, [chats, loadHistory, storagePrefix, update]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      await Promise.allSettled(chatsRef.current.map(async chat => {
        const code = chat.chat_code;
        let replayed = threadsRef.current[code]?.replayed || false;
        let refreshMedia = false;
        try {
          for (let page = 0; page < 6 && !stopped; page++) {
            const cursor = threadsRef.current[code]?.cursor || '0';
            const result = await gateway.events(code, { after: cursor, limit: 100 });
            if (stopped) return;
            for (const event of result.events) {
              if (event.type === 'media_offer' || event.type === 'media_unlocked'||event.type==='video_delivered') refreshMedia = true;
              if (event.type === 'operation_status' && replayed && ['failed', 'stale'].includes(event.data.status)) {
                setResetOpen(false); setLightbox(null); setCommands(false);
                propsRef.current.notify(tr('Операция не завершилась. Данные диалога обновлены.', 'The operation did not complete. Conversation state has been refreshed.'));
              }
              applyEvent(code, event, replayed);
            }
            update(code, s => ({ ...s, cursor: result.cursor, error: s.loaded ? null : s.error }));
            if (result.events.length < 100 || result.cursor === cursor) {
              if (!replayed) { replayed = true; update(code, s => ({ ...s, replayed: true })); void loadHistory(code); }
              break;
            }
          }
          if (refreshMedia||code===activeRef.current){await refreshGallery(code);void loadHistory(code);}
        } catch {
          if (activeRef.current === code) update(code, s => ({ ...s, error: tr('Связь прервана. Переподключаемся…', 'Connection lost. Reconnecting…') }));
        }
      }));
      if (!stopped) timer = setTimeout(() => { void tick(); }, document.visibilityState === 'hidden' ? 8000 : 2500);
    }
    function applyEvent(code: string, event: WebEvent, live: boolean) {
      update(code, s => {
        if (event.type === 'message') {
          if (!live) return event.data.role === 'user' ? { ...s, quick: null } : s;
          const isNew = !s.messages.some(m => m.id === event.data.id);
          const messages = mergeMessages(s.messages, [event.data]);
          if (isNew && code === activeRef.current && !nearBottom.current) setNewMessages(true);
          return { ...s, messages, outgoing: reconcileOutgoing(s.outgoing, messages),
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
          const outgoing = s.outgoing.flatMap(item => item.operationId === id && status === 'completed' ? [] :
            [{ ...item, ...(item.operationId === id && ['failed', 'stale'].includes(status) ? { status: 'failed' as const } : {}) }]);
          return { ...s, operations: { ...s.operations, [id]: { status, action } }, outgoing };
        }
        return s;
      });
    }
    void tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [gateway, loadHistory, refreshGallery, tr, update]);

  useEffect(() => {
    setCommands(false); setResetOpen(false); setLightbox(null);setViewerExtras({}); setNewMessages(false);
    if (chatCode&&chatCode!=='system') {
      update(chatCode, s => ({ ...s, unread: 0 }));
      void loadHistory(chatCode); void refreshGallery(chatCode);
      const code=chatCode;setContinuing(false);
      void gateway.continuation(code).then(result=>{if(activeRef.current!==code)return;setContinuing(result.offered);if(result.messages.length)update(code,s=>({...s,messages:mergeMessages(s.messages,result.messages)}));}).catch(()=>{});
    } else setCollapsed(false);
  }, [chatCode, loadHistory, refreshGallery, update]);
  useEffect(() => { if (storagePrefix) writeStorage(`${storagePrefix}.drafts`, drafts); }, [drafts, storagePrefix]);
  useEffect(() => {
    const dialog = resetRef.current;
    if (resetOpen && dialog && !dialog.open) dialog.showModal();
    if (!resetOpen && dialog?.open) dialog.close();
  }, [resetOpen]);
  useEffect(() => {
    const dialog = lightboxRef.current;
    if (lightbox && dialog && !dialog.open) dialog.showModal();
    if (!lightbox && dialog?.open) dialog.close();
  }, [lightbox]);
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
  const lightboxIndex=lightboxPhotos.findIndex(photo=>photo.id===lightbox);
  const lightboxPhoto=lightboxPhotos[lightboxIndex];
  const moveLightbox=(direction:number)=>{const next=lightboxPhotos[lightboxIndex+direction];if(next)setLightbox(next.id);};
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
    try { const result = await gateway.catalog(chatCode); setProducts(result.products.filter(p => p.kind !== 'photo'&&p.feature_key!=='video_unlock')); }
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
    mediaRequestIds.current[mediaId] ||= crypto.randomUUID();
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
      }else{const catalog=await gateway.catalog(chatCode);setVideoOffers({mediaId,products:catalog.products.filter(p=>p.feature_key==='video_unlock'||p.feature_key==='video_pass'||p.subscription_tier==='full')});}
    }catch{notify(tr('Не удалось запросить видео. Повтор использует ту же выдачу.','Could not request the video. Retrying uses the same delivery.'));}finally{setVideoBusy(null);}
  }
  const readId=useRef<Record<string,string>>({});
  const markVisibleRead=useCallback(()=>{if(!chatCode||isSystem||document.visibilityState!=='visible'||!nearBottom.current)return;const last=threadsRef.current[chatCode]?.messages.at(-1);if(!last||readId.current[chatCode]===last.id)return;const code=chatCode;gateway.markRead(code,last.id).then(()=>{readId.current[code]=last.id;onRefreshChats();}).catch(()=>{});},[chatCode,isSystem,gateway,onRefreshChats]);
  useEffect(()=>{markVisibleRead();const visible=()=>markVisibleRead();document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[markVisibleRead,current.messages]);
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
        {current.error && <div className="chat-connection" role="status">{current.error}<button onClick={() => void loadHistory(chatCode)}>{tr('Повторить', 'Retry')}</button></div>}
        {continuing&&<div className="chat-connection" role="status">{tr('Продолжаем вашу историю из Telegram.','Continuing your story from Telegram.')}<button onClick={()=>setContinuing(false)}>{tr('Закрыть','Close')}</button></div>}
        <div className="chat-history" ref={historyRef} role="log" aria-label={tr('История сообщений', 'Message history')} aria-live="polite" aria-relevant="additions text" onScroll={e => {
          const el = e.currentTarget; positions.current[chatCode] = el.scrollTop;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
          if (nearBottom.current) {setNewMessages(false);markVisibleRead();}
        }}>
          <div className="chat-history-inner">
            {current.nextBefore && <button className="chat-history-more" disabled={current.loading} onClick={() => void loadHistory(chatCode, current.nextBefore || undefined)}>{current.loading ? tr('Загружаем…', 'Loading…') : tr('Ранние сообщения ↑', 'Earlier messages ↑')}</button>}
            {!current.loaded && current.loading && <div className="chat-loading" role="status">{tr('Возвращаем вашу историю…', 'Loading your story…')}</div>}
            {current.loaded && !totalItems && <div className="chat-conversation-start"><span>✳</span><p>{tr('Ваша история начинается здесь.', 'Your story begins here.')}</p></div>}
            {[...current.messages.map(message => ({ kind: 'message' as const, at: message.created_at, message })), ...visibleMedia.map(media => ({ kind: 'media' as const, at: media.at, media }))].sort((a, b) => a.at.localeCompare(b.at)).map(item => {
              if(item.kind==='message'&&item.message.media_kind==='video'&&item.message.video_delivery_id)return <article key={item.message.id} className="chat-media"><ChatVideo gateway={gateway} deliveryId={item.message.video_delivery_id}/><time>{clock(item.at)}</time></article>;
              if (item.kind === 'message'&&!item.message.media_kind) return <article key={`m-${item.message.id}`} className={`chat-message chat-message-${item.message.role}`}><p>{item.message.text}</p><time dateTime={item.at}>{clock(item.at)}</time></article>;
              const mediaId=item.kind==='message'?item.message.media_id!:item.media.id;
              const access = current.gallery.find(m => m.media_id === mediaId);
              const photo = access?.unlocked ? safeImage(access.photo_url) : item.kind==='message'?safeImage(item.message.photo_url):undefined;
              return <article key={`media-${mediaId}`} className="chat-media">
                <PhotoPanelCard gateway={gateway} chatCode={chatCode} sceneSessionId={chat?.scene_session_id??null} mediaId={mediaId} anchor={access?.panel_media_id} photoUrl={photo} access={access} gallery={current.gallery} storageScope={storagePrefix} videoBusy={videoBusy!==null} onOpen={(id,url)=>{setViewerExtras(old=>({...old,[id]:{id,url,createdAt:item.at}}));setLightbox(id);}} onUnlock={unlock} onAnimate={id=>void animatePhoto(id)} onChanged={()=>void refreshGallery(chatCode)}/>
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
    <dialog className="chat-lightbox" ref={lightboxRef} onCancel={() => setLightbox(null)} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();moveLightbox(-1);}if(e.key==='ArrowRight'){e.preventDefault();moveLightbox(1);}}} onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}><button className="chat-lightbox-close chat-icon" onClick={() => setLightbox(null)} aria-label={tr('Закрыть фотографию', 'Close photo')}>×</button>{lightboxPhoto&&<img src={safeImage(lightboxPhoto.url)} draggable={false} alt={tr('Фотография из диалога', 'Conversation photo')} onPointerDown={e=>{lightboxPointer.current=e.clientX;}} onPointerUp={e=>{if(lightboxPointer.current!==null){const delta=e.clientX-lightboxPointer.current;if(Math.abs(delta)>45)moveLightbox(delta<0?1:-1);}lightboxPointer.current=null;}} onPointerCancel={()=>{lightboxPointer.current=null;}}/>}{lightboxPhotos.length>1&&<nav className="chat-lightbox-navigation" aria-label={tr('Полученные фотографии','Received photos')}><button className="chat-icon" disabled={lightboxIndex<=0} onClick={()=>moveLightbox(-1)} aria-label={tr('Предыдущая фотография','Previous photo')}>‹</button><span aria-live="polite">{lightboxIndex+1} / {lightboxPhotos.length}</span><button className="chat-icon" disabled={lightboxIndex>=lightboxPhotos.length-1} onClick={()=>moveLightbox(1)} aria-label={tr('Следующая фотография','Next photo')}>›</button></nav>}</dialog>
  </section>;
}



