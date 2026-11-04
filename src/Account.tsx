import {useCopy,useLocalization} from './lib/localization';
import {TelegramLink} from './Community';
import {ApiError} from './lib/gateway';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Gateway } from './lib/gateway';
import type { Catalog, Chat, Entitlements, Product, Profile, Purchase } from './lib/types';
import { config } from './lib/config';
import { Sheet } from './components/Sheet';
import './account.css';

type Language = string;
export type PurchaseRequest = { sku: string; chatCode: string; mediaId?: string; subscriptionChange?: 'upgrade'|'renew';animateMediaId?:string };
type Notify = (message: string) => void;

function CopyIcon({ kind }: { kind: 'person' | 'spark' | 'link' | 'globe' | 'help' | 'gift' }) {
  const paths = {
    person: <><path d="M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0"/><path d="M4 21c0-8 16-8 16 0"/></>,
    spark: <path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/>,
    link: <><path d="m10 7 3-3c5-5 11 1 6 6l-3 3M14 17l-3 3c-5 5-11-1-6-6l3-3M8 16l8-8"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18"/></>,
    help: <><path d="M8 8c0-5 9-5 9 0 0 4-5 3-5 7M12 19h.01"/><circle cx="12" cy="12" r="10"/></>,
    gift: <><path d="M4 10h16v11H4ZM3 6h18v4H3ZM12 6v15"/><path d="M12 6C1 6 8-4 12 6c4-10 11 0 0 0"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

function Row({ title, subtitle, icon, onClick, trailing }: { title: string; subtitle?: string; icon: Parameters<typeof CopyIcon>[0]['kind']; onClick: () => void; trailing?: string }) {
  return <button type="button" className="account-row" onClick={onClick}>
    <CopyIcon kind={icon}/><span className="account-row-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span>
    {trailing && <span className="account-trailing">{trailing}</span>}<span aria-hidden="true">↗</span>
  </button>;
}

function safeUrl(value: string | undefined, protocols: string[] = ['https:']) {
  if (!value) return null;
  try { const url = new URL(value); return protocols.includes(url.protocol) ? url.href : null; } catch { return null; }
}
function message(_error: unknown, fallback: string) { return fallback; }
function priceText(price: Product['price']) { return price ? `${price.amount} ${price.currency}` : '—'; }

export function ProfileView({ gateway, profile, onProfile, onPurchase, notify, onLinkGoogle, language, chats, onLinked }: {
  gateway: Gateway;
  profile: Profile;
  onProfile: (profile: Profile) => void;
  onPurchase: (sku: string, chatCode: string, mediaId?: string, subscriptionChange?:'upgrade'|'renew',animateMediaId?:string) => void;
  notify: Notify;
  onLinkGoogle: () => void;
  language: Language;
  chats: Chat[];
  onLinked:()=>void;
}) {
  const en = language === 'en';
  const t=useCopy();const {languages}=useLocalization();
  const [section, setSection] = useState<string | null>(null);
  const [name, setName] = useState(profile.display_name ?? '');
  const [note,setNote]=useState(profile.profile_text??'');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [rights, setRights] = useState<Entitlements | null>(null);
  const [error, setError] = useState('');
  const [selectedChat, setSelectedChat] = useState(chats[0]?.chat_code ?? '');

  useEffect(() => { setName(profile.display_name ?? '');setNote(profile.profile_text??''); }, [profile.display_name,profile.profile_text]);
  useEffect(() => { if (!selectedChat && chats[0]) setSelectedChat(chats[0].chat_code); }, [chats, selectedChat]);
  useEffect(() => {
    let live = true;
    Promise.all([gateway.catalog(selectedChat || undefined), gateway.entitlements()]).then(([nextCatalog, nextRights]) => {
      if (live) { setCatalog(nextCatalog); setRights(nextRights); setError(''); }
    }).catch(error => { if (live) setError(message(error, t('Не удалось загрузить возможности', 'Could not load your benefits'))); });
    return () => { live = false; };
  }, [gateway, selectedChat, profile]);

  const toggle = (next: string) => setSection(old => old === next ? null : next);
  const patch = async (data: { display_name?: string; language?: Language; profile_text?:string }) => {
    if (busy) return;
    setBusy(true);
    try { onProfile(await gateway.updateProfile(data)); notify(t('Сохранено', 'Saved')); setSection(null); }
    catch (error) { notify(message(error, t('Не удалось сохранить', 'Could not save'))); }
    finally { setBusy(false); }
  };
  const balanceNames: Record<string, string> = {
    fast_scene_skip: t('Пропуски сцен', 'Scene skips'),
    scene_skip: t('Пропуски сцен', 'Scene skips'),
    scene_unlock: t('Разблокировки сцен', 'Scene unlocks'),
    photo: t('Фотографии', 'Photos'),
    photo_unlock: t('Разблокировки фото', 'Photo unlocks'),
    free_scene_unlocks: t('Бесплатные разблокировки сцен', 'Free scene unlocks'),
    free_photo_unlocks: t('Бесплатные фотографии', 'Free photos'),
    free_fast_scene_skips: t('Бесплатные пропуски сцен', 'Free scene skips'),
  };
  const balances = Object.entries(rights?.balances ?? {}).filter(([, value]) => value > 0);
  const currentPlan = catalog?.products.find(item => item.sku === profile.subscription_sku);
  const until = profile.subscription_until && !Number.isNaN(Date.parse(profile.subscription_until))
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(profile.subscription_until)) : null;
  const telegram = safeUrl(config.supportTelegram);
  const faq = safeUrl(config.faqUrl);
  const email = config.supportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail) ? config.supportEmail : null;

  return <div className="account-page">
    <header className="account-heading"><span className="account-eyebrow">{t('ТВОЯ СТОРОНА ИСТОРИИ','YOUR SIDE OF THE STORY')}</span><h1>{t('Твоя сторона', 'Your side')}<span>.</span></h1><p>{t('Всё личное — в одном месте.', 'All the personal things, in one place.')}</p></header>
    <div className="account-card">
      <Row title={profile.display_name || t('Как тебя зовут?', 'What should we call you?')} subtitle={t('Имя и заметка', 'Name and note')} icon="person" onClick={() => toggle('name')}/>
      {section === 'name' && <form className="account-expand" onSubmit={event => { event.preventDefault(); if (name.trim()) void patch({ display_name: name.trim(),profile_text:note }); }}>
        <label>{t('Твоё имя', 'Your name')}<input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={120} autoComplete="nickname" required/></label>
        <label>{t('Чего ты хочешь?', 'What are you looking for?')}<textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={2000}/></label>
        <button className="account-primary" disabled={busy || !name.trim()}>{busy ? t('Сохраняем…', 'Saving…') : t('Сохранить', 'Save')}</button>
      </form>}
      <Row title={t('Подписка', 'Subscription')} subtitle={[currentPlan?.title ?? (profile.subscription_sku ? t('Подписка','Subscription') : t('Без подписки', 'No subscription')),rights?.subscription_active?t('Активна','Active'):rights&&profile.subscription_sku?t('Истекла','Expired'):null,until].filter(Boolean).join(' · ')} icon="spark" onClick={() => toggle('subscription')}/>
      {section === 'subscription' && <section className="account-expand" aria-label={t('Подписка', 'Subscription')}>
        {until && <p className="account-hint">{t('Срок действия: ', 'Valid until: ')}{until}</p>}
        {currentPlan?.description && <p>{currentPlan.description}</p>}
        {chats.length > 1 && <label>{t('Выбери диалог для доступных предложений', 'Choose a conversation for available offers')}<select value={selectedChat} onChange={event => setSelectedChat(event.target.value)}>{chats.map((chat, index) => <option key={chat.chat_code} value={chat.chat_code}>{t('Диалог', 'Conversation')} {index + 1}</option>)}</select></label>}
        {!chats.length && <p className="account-hint">{t('Сначала начни диалог с персонажем. Доступные предложения появятся здесь.', 'Start a conversation with a character to see your available offers.')}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        {!catalog && !error && <p className="account-hint" role="status">{t('Загружаем предложения…', 'Loading offers…')}</p>}
        {catalog?.products.filter(item => item.kind === 'subscription').map(item => <button type="button" className="account-offer" key={item.sku} onClick={() => onPurchase(item.sku, selectedChat,undefined,item.upgrade?'upgrade':undefined)} disabled={!selectedChat || catalog.pricing_requires_chat || !item.providers.length || !item.price}>
          <span><strong>{item.title}</strong><small>{item.description}</small></span><span>{priceText(item.upgrade?.price??item.price)} ↗</span>
        </button>)}
        {catalog && !catalog.products.some(item => item.kind === 'subscription') && <p className="account-hint">{t('Сейчас нет доступных предложений подписки.', 'There are no subscription offers available right now.')}</p>}
      </section>}
      {balances.length > 0 && <>
        <Row title={t('Мои возможности', 'My benefits')} subtitle={balances.map(([key, count]) => `${balanceNames[key] ?? t('Дополнительная возможность','Additional benefit')}: ${count}`).join(' · ')} icon="gift" onClick={() => toggle('benefits')}/>
        {section === 'benefits' && <div className="account-expand account-balances">{balances.map(([key, count]) => <div key={key}><span>{balanceNames[key] ?? t('Дополнительная возможность','Additional benefit')}</span><strong>{count}</strong></div>)}</div>}
      </>}
    </div>
    <div className="account-card account-connections">
      <Row title={t('Связать с Telegram', 'Link Telegram')} subtitle={t('История, подписка и воспоминания', 'History, subscription and memories')} icon="link" onClick={() => toggle('telegram')}/>
      {section === 'telegram' && <div className="account-expand"><TelegramLink gateway={gateway} onLinked={onLinked}/></div>}
      <Row title={t('Вход через Google', 'Google sign-in')} subtitle={t('Сохрани доступ к своему профилю', 'Keep access to your profile')} icon="person" onClick={onLinkGoogle}/>
    </div>
    <div className="account-section-label">{t('Настройки', 'Settings')}</div>
    <div className="account-card">
      <Row title={t('Язык', 'Language')} trailing={languages.find(l=>l.locale===language)?.display_name??language} icon="globe" onClick={() => toggle('language')}/>
      <Row title={t('Поддержка', 'Support')} icon="help" onClick={() => toggle('support')}/>
    </div>
    <footer className="account-footer">MIDNIGHT PERSONA <span>{t('ПОСЛЕ ПОЛУНОЧИ. ТВОИ ПРАВИЛА.','AFTER HOURS, YOUR RULES.')}</span></footer>
    {section === 'language' && <Sheet title={t('Язык', 'Language')} onClose={() => setSection(null)}>
      <div className="account-language" role="group" aria-label={t('Язык интерфейса', 'Interface language')}>
        {languages.map(({locale:value,display_name}) => <button type="button" key={value} className={language === value ? 'selected' : ''} disabled={busy} onClick={() => void patch({ language: value })}><span>{display_name}</span><span aria-hidden="true">{language === value ? '✓' : '○'}</span></button>)}
      </div>
    </Sheet>}
    {section === 'support' && <Sheet title={t('Мы рядом', 'We’re here')} onClose={() => setSection(null)}>
      <p className="account-hint">{t('Если что-то пошло не так, напиши нам.', 'If something went wrong, get in touch.')}</p>
      <div className="account-support">
        {telegram && <div><a href={telegram} target="_blank" rel="noopener noreferrer"><span>Telegram</span><span>↗</span></a><button type="button" aria-label={t('Скопировать ссылку','Copy link')} onClick={()=>void navigator.clipboard.writeText(telegram).then(()=>notify(t('Адрес скопирован','Address copied'))).catch(()=>notify(t('Не удалось скопировать адрес','Could not copy the address')))}>⧉</button></div>}
        {email && <div><a href={`mailto:${email}`}>{email}</a><button type="button" aria-label={t('Скопировать email', 'Copy email')} onClick={() => void navigator.clipboard.writeText(email).then(() => notify(t('Адрес скопирован', 'Address copied'))).catch(() => notify(t('Не удалось скопировать адрес', 'Could not copy the address')))}>⧉</button></div>}
        {faq && <a href={faq} target="_blank" rel="noopener noreferrer"><span>FAQ</span><span>↗</span></a>}
        {!telegram && !email && !faq && <p className="account-hint">{t('Контакты поддержки ещё не добавлены.', 'Support contact details have not been added yet.')}</p>}
      </div>
    </Sheet>}
  </div>;
}

type SavedAttempt = { clientMessageId: string; provider: string; purchaseId?: string; finished?: boolean; operationId?: string; pendingFeature?: boolean;animateMediaId?:string;chatCode?:string };
function readAttempt(key: string): SavedAttempt | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedAttempt>;
    return typeof value.clientMessageId === 'string' && typeof value.provider === 'string' ? value as SavedAttempt : null;
  } catch { return null; }
}
function writeAttempt(key: string, value: SavedAttempt) { localStorage.setItem(key, JSON.stringify(value)); }

export function PurchaseSheet(props: {
  gateway: Gateway;
  request: PurchaseRequest | null;
  onClose: () => void;
  notify: Notify;
  onComplete: () => void;
  language?: Language;
}) {
  if (!props.request) return null;
  return <PurchaseContent key={`${props.request.chatCode}:${props.request.sku}:${props.request.mediaId ?? ''}:${props.request.subscriptionChange??'renew'}`} {...props} request={props.request}/>;
}

function PurchaseContent({ gateway, request, onClose, notify, onComplete, language = 'ru' }: {
  gateway: Gateway; request: PurchaseRequest; onClose: () => void; notify: Notify; onComplete: () => void; language?: Language;
}) {
  const en = language === 'en';
  const t=useCopy('commerce');
  const [product, setProduct] = useState<Product | null>(null);
  const [provider, setProvider] = useState('');
  const [storageKey, setStorageKey] = useState('');
  const [attempt, setAttempt] = useState<SavedAttempt | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [freeOperationPending, setFreeOperationPending] = useState(false);
  const announced = useRef(false);
  const submitting = useRef(false);
  const callbacks = useRef({ notify, onComplete });
  const hasPurchaseLock = typeof navigator !== 'undefined' && !!navigator.locks;
  callbacks.current = { notify, onComplete };

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [catalog, me] = await Promise.all([gateway.catalog(request.chatCode), gateway.me()]);
        if (!live) return;
        const item = catalog.products.find(item => item.sku === request.sku);
        if (!item || catalog.pricing_requires_chat) throw new Error(t('Это предложение сейчас недоступно.', 'This offer is currently unavailable.'));
        setProduct(item);
        const key = `mp:purchase:${encodeURIComponent(config.apiBaseUrl)}:${me.user_id}:${request.chatCode}:${request.sku}:${request.mediaId ?? ''}:${request.subscriptionChange??'renew'}`;
        setStorageKey(key);
        const saved = readAttempt(key);
        setAttempt(saved);
        setProvider(saved?.provider ?? item.providers[0] ?? '');
        if (saved?.purchaseId) {
          const existing = await gateway.purchase(saved.purchaseId);
          if (live) setPurchase(existing);
        } else if (saved?.finished && live) setFinished(true);
        else if (saved?.pendingFeature && live) setFreeOperationPending(true);
      } catch (error) { if (live) setError(message(error, t('Не удалось загрузить предложение.', 'Could not load this offer.'))); }
      finally { if (live) setLoading(false); }
    };
    void load();
    return () => { live = false; };
  }, [gateway, request.chatCode, request.sku, request.mediaId,request.subscriptionChange]);

  useEffect(() => {
    if (!purchase) return;
    if(purchase.review_required){setError(t('Оплата требует проверки поддержки.','This payment needs support review.'));return;}
    if (purchase.status === 'fulfilled') {
      setFinished(true);
      // Do not write from the polling effect: another tab may already have started a new,
      // explicit purchase. The persisted receipt is enough to restore terminal status.
      if (!announced.current) { announced.current = true; callbacks.current.notify(t('Покупка выполнена', 'Purchase completed')); callbacks.current.onComplete(); }
      return;
    }
    if (purchase.status === 'failed' || purchase.status === 'expired') return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const updated = await gateway.purchase(purchase.purchase_id);
        if (live) { setPurchase(updated); setError(''); }
      } catch (error) { if (live) setError(message(error, t('Не удалось обновить статус. Проверяем ещё раз…', 'Could not update the status. Checking again…'))); }
      finally { if (live) timer = setTimeout(poll, 4000); }
    };
    timer = setTimeout(poll, 3000);
    return () => { live = false; clearTimeout(timer); };
  }, [gateway, purchase?.purchase_id, purchase?.status, storageKey, attempt?.clientMessageId]);

  const submitFree = async () => {if(submitting.current||!storageKey||!product)return;setBusy(true);try{const key=storageKey+':redeem';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}const result=await gateway.createPurchase({client_message_id:id,chat_code:request.chatCode,sku:request.sku,...(request.mediaId?{media_id:request.mediaId}:{})});if('available'in result&&result.available){setFinished(result.fulfilled);setFreeOperationPending(!result.fulfilled);callbacks.current.onComplete();callbacks.current.notify(t('Действие принято','Action accepted'));}}catch(e){setError(e instanceof ApiError&&e.status===402?t('Бесплатного бонуса нет. Выбери способ оплаты.','No free benefit is available. Choose a payment method.'):t('Не удалось использовать бонус.','Could not use this benefit.'));}finally{setBusy(false);}};
  const submit = async () => {
    if (submitting.current || !product || !storageKey || purchase || finished) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      if (!hasPurchaseLock) {
        if (attempt?.purchaseId) setPurchase(await gateway.purchase(attempt.purchaseId));
        else setError(t('Покупки в этом браузере недоступны. Открой приложение в актуальном браузере.', 'Purchases are unavailable in this browser. Open the app in an up-to-date browser.'));
        return;
      }
      await navigator.locks.request(`mp-commerce:${storageKey}`, async () => {
        // A second tab can have submitted since this sheet was opened. Re-read while
        // holding the shared lock; never generate another ID for a live attempt.
        let current = readAttempt(storageKey);
        if (current) { setAttempt(current); setProvider(current.provider); }
        if (current?.purchaseId) { setPurchase(await gateway.purchase(current.purchaseId)); return; }
        if (current?.finished) { setFinished(true); return; }
        if (current?.pendingFeature) { setFreeOperationPending(true); return; }
        if (!current) {
          current = { clientMessageId: crypto.randomUUID(), provider, ...(request.animateMediaId?{animateMediaId:request.animateMediaId,chatCode:request.chatCode}:{}) };
          writeAttempt(storageKey, current);
          setAttempt(current);
        }
        const result = await gateway.createPurchase({
          client_message_id: current.clientMessageId,
          chat_code: request.chatCode,
          sku: request.sku,
          ...(current.provider?{provider:current.provider}:{}),
          ...(request.subscriptionChange?{subscription_change:request.subscriptionChange}:{}),
          ...(request.mediaId ? { media_id: request.mediaId } : {}),
        });
        if ('purchase_id' in result) {
          const saved = { ...current, purchaseId: result.purchase_id };
          setAttempt(saved); setPurchase(result);
          writeAttempt(storageKey, saved);
        } else if ('unlocked' in result && result.unlocked) {
          const saved = { ...current, finished: true };
          writeAttempt(storageKey, saved); setAttempt(saved);
          setFinished(true); callbacks.current.onComplete(); callbacks.current.notify(t('Фотография открыта', 'Photo unlocked'));
        } else if ('available' in result) {
          if (result.fulfilled) {
            const saved = { ...current, finished: true };
            writeAttempt(storageKey, saved); setAttempt(saved);
            setFinished(true); callbacks.current.onComplete(); callbacks.current.notify(t('Действие выполнено', 'Action completed'));
          } else {
            const saved = { ...current, pendingFeature: true, operationId: result.operation_id };
            writeAttempt(storageKey, saved); setAttempt(saved); setFreeOperationPending(true);
            callbacks.current.onComplete();
          }
        }
      });
    } catch (error) {
      setError(message(error, t('Не удалось завершить запрос. Повторная попытка использует ту же операцию.', 'The request could not be completed. A retry uses the same operation.')));
    } finally { submitting.current = false; setBusy(false); }
  };

  const status: Record<Purchase['status'], string> = {
    created: t('Покупка создана', 'Purchase created'), creating: t('Готовим оплату…', 'Preparing checkout…'),
    creation_uncertain: t('Уточняем статус оплаты…', 'Confirming the checkout status…'), pending: t('Ожидаем оплату', 'Awaiting payment'),
    paid: t('Оплата получена', 'Payment received'), fulfillment_pending: t('Выполняем покупку…', 'Completing your purchase…'),
    fulfilled: t('Готово', 'Completed'), failed: t('Покупка не завершена', 'Purchase did not complete'), expired: t('Срок оплаты истёк', 'Checkout expired'),
  };
  const checkout = safeUrl(purchase?.checkout_url ?? undefined);
  const actionableCheckout = purchase && ['created', 'pending'].includes(purchase.status) && checkout;
  const startNewAttempt = async () => {
    if (!hasPurchaseLock || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      await navigator.locks.request(`mp-commerce:${storageKey}`, async () => {
        const latest = readAttempt(storageKey);
        if (latest && latest.clientMessageId !== attempt?.clientMessageId) {
          setAttempt(latest);
          if (latest.purchaseId) setPurchase(await gateway.purchase(latest.purchaseId));
          throw new Error(t('В другой вкладке уже есть новый запрос. Закрой и открой это окно, чтобы обновить статус.', 'Another tab already has a new request. Close and reopen this window to refresh its status.'));
        }
        if (latest?.pendingFeature) throw new Error(t('Действие ещё выполняется.', 'The action is still in progress.'));
        if (latest?.purchaseId) {
          const existing = await gateway.purchase(latest.purchaseId);
          if (!['fulfilled', 'failed', 'expired'].includes(existing.status)) {
            setPurchase(existing);
            throw new Error(t('Текущая покупка ещё выполняется.', 'The current purchase is still in progress.'));
          }
        } else if (latest && !latest.finished) throw new Error(t('Сначала нужно проверить предыдущий запрос.', 'Check the previous request first.'));
        localStorage.removeItem(storageKey);
        setAttempt(null); setPurchase(null); setFinished(false); setFreeOperationPending(false); setError('');
        announced.current = false;
      });
    } catch (error) { setError(message(error, t('Не удалось подготовить новую покупку.', 'Could not prepare a new purchase.'))); }
    finally { submitting.current = false; setBusy(false); }
  };
  let body: ReactNode;
  if (loading) body = <p role="status" className="account-hint">{t('Загружаем условия…', 'Loading the offer…')}</p>;
  else if (finished) body = <div className="account-purchase-result"><span aria-hidden="true">✓</span><h3>{t('Всё готово', 'You’re all set')}</h3><p>{t('Возможности обновлены.', 'Your benefits have been updated.')}</p><button type="button" className="account-primary" onClick={onClose}>{t('Продолжить', 'Continue')}</button>{product?.kind !== 'photo' && <button type="button" disabled={!hasPurchaseLock || busy} className="account-secondary" onClick={() => void startNewAttempt()}>{t('Новая покупка', 'New purchase')}</button>}</div>;
  else body = <>
    {product && <><p className="account-purchase-description">{product.description}</p><div className="account-purchase-price"><span>{t('Стоимость', 'Price')}</span><strong>{priceText(purchase?.price ?? (request.subscriptionChange==='upgrade'?product.upgrade?.price??product.price:product.price))}</strong></div></>}
    {purchase ? <>
      <p className="account-status" role="status"><span aria-hidden="true">◉</span>{status[purchase.status]}</p>
      {actionableCheckout && <a className="account-primary account-pay-link" href={checkout} target="_blank" rel="noopener noreferrer">{t('Перейти к оплате', 'Open checkout')} ↗</a>}
      {['failed', 'expired'].includes(purchase.status) && <button type="button" disabled={!hasPurchaseLock || busy} className="account-secondary" onClick={() => void startNewAttempt()}>{t('Попробовать новую покупку', 'Start a new purchase')}</button>}
      {!['failed', 'expired'].includes(purchase.status) && <p className="account-hint">{t('Можно закрыть это окно. Статус покупки сохранится.', 'You can close this window. Your purchase status will be saved.')}</p>}
    </> : freeOperationPending ? <p className="account-status" role="status">{t('Действие принято. Результат появится в диалоге.', 'Action accepted. The result will appear in your conversation.')}</p> : product && <>
      {!attempt&&['scene_unlock','fast_scene_skip'].includes(product.feature_key??'')&&<button type="button" className="account-secondary" disabled={busy} onClick={()=>void submitFree()}>{t('Использовать доступный бонус','Use an available benefit')}</button>}{product.providers.length > 0 && <label className="account-provider">{t('Способ оплаты', 'Payment method')}<select value={provider} disabled={!!attempt || busy} onChange={event => setProvider(event.target.value)}>{product.providers.map(value => <option key={value} value={value}>{value === 'nowpayments' ? 'NOWPayments' : value}</option>)}</select></label>}
      {!product.providers.length && <p className="account-hint">{t('Для этого предложения пока нет доступного способа оплаты.', 'There is no available payment method for this offer yet.')}</p>}
      {!hasPurchaseLock && !attempt?.purchaseId && <p className="account-hint">{t('Покупки в этом браузере недоступны. Открой приложение в актуальном браузере.', 'Purchases are unavailable in this browser. Open the app in an up-to-date browser.')}</p>}
      {attempt && <p className="account-hint">{t('Незавершённый запрос сохранён. Повторная проверка не создаёт вторую покупку.', 'Your unfinished request is saved. Checking again does not create a second purchase.')}</p>}
      <button type="button" className="account-primary" disabled={busy || (!attempt?.purchaseId && (!hasPurchaseLock || (product.kind==='subscription'&&(!provider||!product.price))))} onClick={() => void submit()}>{busy ? t('Подождём…', 'One moment…') : attempt ? t('Повторить проверку', 'Check again') : t('Подтвердить покупку', 'Confirm purchase')}</button>
    </>}
  </>;
  return <Sheet title={product?.title ?? t('Покупка', 'Purchase')} onClose={onClose}><div className="account-purchase">{body}{error && <p className="account-error" role="alert">{error}</p>}</div></Sheet>;
}



