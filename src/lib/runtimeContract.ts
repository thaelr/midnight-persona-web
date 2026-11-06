const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const string=(v:unknown)=>typeof v==='string';
const nullable=(v:unknown)=>v===null||string(v);
export function validCriticalResponse(path:string,value:unknown):boolean{
 if(!record(value))return false;
 if(path==='/web/me'||path==='/web/auth/bootstrap')return string(value.user_id)&&nullable(value.language)&&nullable(value.age_confirmed_at)&&nullable(value.terms_accepted_at)&&typeof value.needs_language_selection==='boolean'&&record(value.entitlements);
 if(path==='/web/commerce/entitlements')return nullable(value.subscription_sku)&&nullable(value.subscription_until)&&record(value.balances)&&Object.values(value.balances).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
 if(/^\/web\/commerce\/purchases(?:\/[^/]+)?$/.test(path)){
  if('purchase_id'in value)return string(value.purchase_id)&&['created','creating','creation_uncertain','pending','paid','fulfillment_pending','fulfilled','failed','expired'].includes(String(value.status))&&record(value.price)&&string(value.price.amount)&&string(value.price.currency)&&nullable(value.checkout_url);
  return (value.unlocked===true&&string(value.media_id))||(value.available===true&&typeof value.fulfilled==='boolean');
 }
 if(path.endsWith('/events'))return string(value.cursor)&&/^\d+$/.test(value.cursor)&&Array.isArray(value.events)&&value.events.every(e=>record(e)&&string(e.cursor)&&/^\d+$/.test(e.cursor)&&string(e.created_at)&&record(e.data)&&['message','scene','operation_status','quick_replies','media_offer','media_unlocked','video_delivered'].includes(String(e.type))&& (e.type!=='message'||string(e.data.id)&&string(e.data.text)&&['user','assistant'].includes(String(e.data.role)))&&(e.type!=='operation_status'||string(e.data.operation_id)&&string(e.data.status)));
 return true;
}
