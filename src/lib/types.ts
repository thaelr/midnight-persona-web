/** Public Gateway contracts, audited at web commit 5871dc6cff4ca4c4ce9e7d58e90815e238aa13eb. */
export type SceneMode = 'fast' | 'roleplay';
export type Language = string;
export type WebAction = 'scene_start' | 'message' | 'reset';

export interface WebProfile {
  user_id: string;
  display_name: string | null;
  language: string | null;
  language_confirmed_at?: string | null;
  profile_text?: string | null;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  subscription_sku: string | null;
  subscription_until: string | null;
  entitlements: Record<string, unknown>;
  needs_language_selection: boolean;
}
export interface WebCharacter {
  character_i: number;
  name: string;
  description: string;
  image_url: string | null;
  gallery_photo_url?: string | null;
  menu_photo_url?: string | null;
  gallery_photos?: string[];
  modes: SceneMode[];
  chat_code: string | null;
}
export interface WebChat {
  chat_code: string;
  character_i: number;
  scene_mode: SceneMode | null;
  scene_session_id: string | null;
  turn_no: number;
  scene_turn_no: number;
  updated_at: string;
  unread_count?: number;
  last_message?: WebMessage | null;
}
export interface WebOperation {
  operation_id: string;
  event_id: string;
  status: string;
  action: WebAction;
  chat_code: string;
}
export interface WebMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source: string;
  scene_session_id: string | null;
  turn_no: number;
  created_at: string;
  client_message_id?: string;
  media_kind?: 'photo' | 'video';
  media_id?: string;
  video_delivery_id?: string;
  photo_url?: string | null;
}
export interface SceneEventData {
  scene_session_id: string | null;
  character_i: number;
  turn_no: number;
  scene_turn_no: number;
  scene_mode?: SceneMode;
  [key: string]: unknown;
}
export type OperationStatusData =
  | { operation_id: string; event_id: string; status: string; action: WebAction; error_code: string | null; [key: string]: unknown }
  | { purchase_id: string; operation_id: string; action: 'purchase'; status: string; error_code: string | null; [key: string]: unknown }
  | { operation_id: string; action: 'scene_unlock'; status: 'completed' };
export type QuickReply = string | { option_index: number; reply_text: string; next_replies: unknown[] | null };
export interface QuickRepliesData {
  scene_session_id: string;
  turn_no: number;
  options: QuickReply[];
}
export interface Money { amount: string; currency: string }
export interface MediaOfferData {
  media_id: string;
  media_kind: 'photo';
  scene_session_id: string;
  sku: string;
  price?: Money | null;
  unlocked?: boolean;
  [key: string]: unknown;
}
export interface MediaUnlockedData {
  media_id: string;
  media_kind: 'photo';
  scene_session_id: string | null;
  source?: string;
  [key: string]: unknown;
}
type EventEnvelope<T extends string, D> = { cursor: string; type: T; data: D; created_at: string };
export type WebEvent =
  | EventEnvelope<'message', WebMessage>
  | EventEnvelope<'scene', SceneEventData>
  | EventEnvelope<'operation_status', OperationStatusData>
  | EventEnvelope<'quick_replies', QuickRepliesData>
  | EventEnvelope<'media_offer', MediaOfferData>
  | EventEnvelope<'media_unlocked', MediaUnlockedData>
  | EventEnvelope<'video_delivered', {id:string;delivery_id:string;video_delivery_id:string;video_id:string;media_kind:'video';scene_session_id:string;created_at:string;source:string}>;
export interface History { messages: WebMessage[]; next_before: string | null }
export interface EventPage { events: WebEvent[]; cursor: string }
export interface Continuation { offered: boolean; separator: '---'; messages: WebMessage[]; chat: WebChat }
export interface CreateChatResult { chat: WebChat; operation: WebOperation | null }
export interface ProfilePatch { display_name?: string; language?: Language; profile_text?: string }
export interface CreateChatInput { character_i: number; scene_mode: SceneMode; client_message_id?: string }
export interface MessageInput { client_message_id: string; text: string }
export interface ResetInput { client_message_id: string; scene_mode?: SceneMode }
export interface HistoryQuery { before?: string; limit?: number }
export interface EventsQuery { after?: string; limit?: number }

export interface Product {
  sku: string;
  kind: 'subscription' | 'photo' | 'feature';
  title: string;
  description: string;
  price: Money | null;
  original_price: Money | null;
  promo_key: string | null;
  subscription_days?: number;
  feature_key?: string;
  providers: string[];
  subscription_tier?: 'base' | 'full';
  upgrade?: {subscription_change:'upgrade';base_sku:string;price:Money;days:number} | null;
  redeemable?: boolean;
}
export interface Catalog { products: Product[]; providers: string[]; pricing_requires_chat: boolean }
export interface Entitlements { subscription_sku: string | null; subscription_until: string | null; balances: Record<string, number>;subscription_active?:boolean;subscription_tier?:'base'|'full';full_active?:boolean }
export type PurchaseStatus = 'created' | 'creating' | 'creation_uncertain' | 'pending' | 'paid' | 'fulfillment_pending' | 'fulfilled' | 'failed' | 'expired';
export interface Purchase {
  purchase_id: string;
  status: PurchaseStatus;
  sku: string;
  kind: Product['kind'];
  provider: string;
  price: Money;
  checkout_url: string | null;
  media_id: string | null;
  created_at: string;
  updated_at: string;
  video_delivery_id?: string | null;
  review_required?: boolean;
}
export interface PurchaseInput {
  client_message_id: string;
  chat_code: string;
  sku: string;
  provider?: string;
  media_id?: string;
  subscription_change?: 'upgrade' | 'renew';
}
export interface MediaMetadata {created_at?:string;scene_session_id?:string|null;animation_available?:boolean;video_access?:'full'|'video_pass'|null;video_delivery_id?:string|null;video_delivery_status?:string;ready_at?:string;panel_media_id?:string;}
export interface MediaAccess extends MediaMetadata { unlocked: true; media_id: string; media_kind: 'photo'; photo_url?: string | null }
export interface LockedMedia extends MediaMetadata {
  unlocked: false;
  media_id: string;
  media_kind: 'photo';
  sku: string;
  scene_session_id: string;
  conditions: { price: Money | null; price_required: number | null };
}
export interface Gallery { media: Array<MediaAccess | LockedMedia>;video_deliveries?:VideoDelivery[] }
export interface FeatureAccess {
  available: true;
  fulfilled: boolean;
  feature_key: 'scene_unlock' | 'fast_scene_skip';
  operation_id?: string;
  reason?: 'already_entitled';
}
export type PurchaseResult = Purchase | MediaAccess | FeatureAccess;
export type UnlockResult = Purchase | MediaAccess;
export interface UnlockInput { client_message_id: string; provider?: string }
export interface VideoAvailability {media_id:string;animation_available:boolean;video_id:string|null;full_active:boolean;video_pass_active:boolean;panel_delivered:boolean;scene_session_id:string;}
export interface VideoDelivery {delivery_id:string;video_id:string;status:string;ready_at:string;access_path:string;video_url?:string;expires_at?:string;}
export interface PhotoPanel {media_id:string;photo_url:string|null;unlocked:boolean;scene_session_id:string;actions:{previous:boolean;next:boolean;more:boolean};offer?:{media_id:string;sku:string;conditions:{price:Money|null;price_required:number|null}}}

// Friendly aliases for view components; these are the same server contracts.
export type Profile = WebProfile;
export type Character = WebCharacter;
export type Chat = WebChat;
export type Message = WebMessage;


