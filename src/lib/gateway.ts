import { config } from './config';
import type {
  Catalog, Continuation, CreateChatInput, CreateChatResult, Entitlements, EventPage,
  EventsQuery, Gallery, History, HistoryQuery, MessageInput, ProfilePatch,
  Purchase, PurchaseInput, PurchaseResult, ResetInput, UnlockInput, UnlockResult,
  WebCharacter, WebChat, WebOperation, WebProfile, VideoAvailability, VideoDelivery, PhotoPanel,
} from './types';

export type ApiErrorDetails = Record<string, unknown>;
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetails;
  constructor(status: number, code: string, details: ApiErrorDetails = {}) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface GatewayOptions {
  /** Optional override is useful for a same-origin proxy and contract tests. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function normalizeBaseUrl(input: string): string {
  const value = input.trim().replace(/\/+$/, '');
  if (!value) throw new ApiError(0, 'gateway_not_configured');
  // Relative paths enable a same-origin deployment without forwarding a bearer
  // through an unrelated proxy. Protocol-relative URLs are deliberately refused.
  if (value.startsWith('/') && !value.startsWith('//') && !/[?#\\]/.test(value)) return value;
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
      || url.username || url.password || url.search || url.hash) throw new Error('invalid');
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new ApiError(0, 'invalid_gateway_url');
  }
}

function queryString(query?: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

function publicErrorDetails(body: Record<string, unknown>): ApiErrorDetails {
  // Never attach a raw response body or request headers to a UI error.
  const details: ApiErrorDetails = {};
  if (typeof body.request_id === 'string') details.request_id = body.request_id;
  if (Array.isArray(body.issues)) details.issues = body.issues;
  return details;
}

/**
 * One request per method call. In particular, uncertain message/payment writes
 * are never automatically retried. The caller retains its client_message_id
 * and decides whether to retry that same operation.
 */
export function createGateway(getToken: () => Promise<string | null>, options: GatewayOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: object, query?: object, publicRequest=false): Promise<T> {
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? config.apiBaseUrl);
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new ApiError(0, 'request_timeout', { outcome_unknown: method !== 'GET' }));
      }, timeoutMs);
    });
    const execute = async (): Promise<T> => {
      let token: string | null;
      try { token = publicRequest?null:await getToken(); }
      catch { throw new ApiError(401, 'session_unavailable'); }
      if (!token&&!publicRequest) throw new ApiError(401, 'unauthorized');
      // A slow token provider must not start an HTTP write after the UI timed out.
      if (controller.signal.aborted) throw new ApiError(0, 'request_timeout', { outcome_unknown: false });
      const response = await fetchImpl(`${baseUrl}${path}${queryString(query)}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(token?{Authorization: `Bearer ${token}`} : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      let data: unknown;
      try { data = await response.json(); }
      catch {
        if (!response.ok) throw new ApiError(response.status, 'http_error');
        throw new ApiError(response.status, 'invalid_response');
      }
      if (!response.ok) {
        const code = isRecord(data) && typeof data.error === 'string' ? data.error : 'http_error';
        throw new ApiError(response.status, code, isRecord(data) ? publicErrorDetails(data) : {});
      }
      if (!isRecord(data)) throw new ApiError(response.status, 'invalid_response');
      return data as T;
    };
    try {
      return await Promise.race([execute(), timeout]);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(0, 'request_timeout', { outcome_unknown: method !== 'GET' });
      throw new ApiError(0, 'network_error', { outcome_unknown: method !== 'GET' });
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  const chatPath = (code: string) => `/web/chats/${encodeURIComponent(code)}`;
  return {
    localizations: () => request<{languages:Array<{locale:string;display_name:string}>}>('GET','/web/localizations',undefined,undefined,true),
    localization: (locale:string, namespace:string) => request<{locale:string;namespace:string;copy:Record<string,unknown>}>('GET',`/web/localizations/${encodeURIComponent(locale)}/${encodeURIComponent(namespace)}`,undefined,undefined,true),
    bootstrap: () => request<WebProfile>('POST', '/web/auth/bootstrap', {}),
    me: () => request<WebProfile>('GET', '/web/me'),
    updateProfile: (input: ProfilePatch) => request<WebProfile>('PATCH', '/web/me', input),
    confirmAge: () => request<WebProfile>('POST', '/web/me/confirm-age', { confirmed: true }),
    acceptTerms: () => request<WebProfile>('POST', '/web/me/accept-terms', { accepted: true }),
    characters: () => request<{ characters: WebCharacter[] }>('GET', '/web/characters'),
    character: (id: number) => request<WebCharacter>('GET', `/web/characters/${encodeURIComponent(id)}`),
    chats: () => request<{ chats: WebChat[] }>('GET', '/web/chats'),
    createChat: (input: CreateChatInput) => request<CreateChatResult>('POST', '/web/chats', input),
    chat: (code: string) => request<WebChat>('GET', chatPath(code)),
    messages: (code: string, query?: HistoryQuery) => request<History>('GET', `${chatPath(code)}/messages`, undefined, query),
    sendMessage: (code: string, input: MessageInput) => request<WebOperation>('POST', `${chatPath(code)}/messages`, input),
    events: (code: string, query?: EventsQuery) => request<EventPage>('GET', `${chatPath(code)}/events`, undefined, query),
    reset: (code: string, input: ResetInput) => request<WebOperation>('POST', `${chatPath(code)}/reset`, input),
    catalog: (chatCode?: string) => request<Catalog>('GET', '/web/commerce/catalog', undefined, { chat_code: chatCode }),
    entitlements: () => request<Entitlements>('GET', '/web/commerce/entitlements'),
    createPurchase: (input: PurchaseInput) => request<PurchaseResult>('POST', '/web/commerce/purchases', input),
    purchase: (id: string) => request<Purchase>('GET', `/web/commerce/purchases/${encodeURIComponent(id)}`),
    gallery: (code: string) => request<Gallery>('GET', `${chatPath(code)}/media`),
    unlockMedia: (code: string, id: string, input: UnlockInput) => request<UnlockResult>('POST', `${chatPath(code)}/media/${encodeURIComponent(id)}/unlock`, input),
    photoPanel:(code:string,anchor:string,currentMediaId?:string)=>request<PhotoPanel>('GET',`${chatPath(code)}/media/${encodeURIComponent(anchor)}/panel`,undefined,{current_media_id:currentMediaId}),
    photoPanelAction:(code:string,anchor:string,input:{client_message_id:string;action:'photo_prev'|'photo_next'|'photo_regen';current_media_id?:string})=>request<PhotoPanel>('POST',`${chatPath(code)}/media/${encodeURIComponent(anchor)}/panel`,input),
    continuation: (code: string) => request<Continuation>('GET', `${chatPath(code)}/continuation`),
    videoAvailability: (code:string,mediaId:string)=>request<VideoAvailability>('GET',`${chatPath(code)}/media/${encodeURIComponent(mediaId)}/video`),
    requestVideo: (code:string,mediaId:string,clientId:string)=>request<VideoDelivery>('POST',`${chatPath(code)}/media/${encodeURIComponent(mediaId)}/video`,{client_message_id:clientId}),
    videoDelivery: (id:string)=>request<VideoDelivery>('GET',`/web/commerce/video-deliveries/${encodeURIComponent(id)}`),
    summaries:()=>request<{chats:ChatSummary[]}>('GET','/web/chat-summaries'),
    markRead:(code:string,messageId:string)=>request<{read:boolean}>('POST',`${chatPath(code)}/read`,{message_id:messageId}),
    publications:(before?:string)=>request<{posts:Publication[];next_before:string|null}>('GET','/web/publications',undefined,{before,limit:50}),
    voting:()=>request<{campaign:VotingCampaign|null}>('GET','/web/voting'),
    vote:(id:string,candidateId:string)=>request<{campaign:VotingCampaign|null}>('POST',`/web/voting/${encodeURIComponent(id)}/vote`,{candidate_id:candidateId}),
    telegramLinkStatus:()=>request<{linked:boolean;telegram_user_id:string|null;available:boolean}>('GET','/web/me/telegram-link'),
    telegramLinkStart:()=>request<{challenge:string;client_id:string;expires_at:string}>('POST','/web/me/telegram-link',{}),
    telegramLinkComplete:(challenge:string,idToken:string)=>request<{linked:true;user_id:string}>('POST','/web/me/telegram-link/complete',{challenge,id_token:idToken}),
  };
}

export interface ChatSummary {chat_code:string;last_message:import('./types').WebMessage|null;unread_count:number;last_read_message_id:string|null}
export interface Publication {id:string;title:string;body:string;published_at:string}
export interface VotingCampaign {id:string;title:string;candidates:Array<{id:string;name:string;description:string;image_url:string|null}>;selected_candidate_id:string|null}

export type Gateway = ReturnType<typeof createGateway>;
