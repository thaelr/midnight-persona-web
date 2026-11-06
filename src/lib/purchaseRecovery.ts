import type {Gateway} from './gateway';
import type {Purchase} from './types';
const rotations=new Map<string,number>();

/** Recover only receipts in this authenticated account's existing browser store. */
export async function recoverPurchases(gateway:Gateway,storage:Storage,prefix:string,onSettled:(purchase:Purchase&{animation_error?:string})=>void,isCurrent=()=>true){
 let pending=false,lastError:unknown;
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>Boolean(key?.startsWith(prefix)));
 const offset=rotations.get(prefix)??0;const ordered=[...keys.slice(offset),...keys.slice(0,offset)];let processed=0;
 for(const key of ordered){if(!isCurrent())break;if(processed>=10){pending=true;break;}let saved:Record<string,unknown>;try{saved=JSON.parse(storage.getItem(key)||'null');}catch{continue;}
  if(!saved||typeof saved.purchaseId!=='string'||(saved.receiptNotified&&saved.deliveryCompleted!==false))continue;
  processed++;pending=true;try{const receipt=await gateway.purchase(saved.purchaseId);if(!isCurrent())break;let deliveryCompleted=true;let animationError:string|undefined;let deliveryId=receipt.video_delivery_id??(typeof saved.animationDeliveryId==='string'?saved.animationDeliveryId:null);
   if(receipt.status==='fulfilled'&&!receipt.review_required&&!deliveryId&&typeof saved.animateMediaId==='string'&&typeof saved.chatCode==='string'){
    try{const delivery=await gateway.requestVideo(saved.chatCode,saved.animateMediaId,`full:${receipt.purchase_id}`);deliveryId=delivery.delivery_id;const latest=JSON.parse(storage.getItem(key)||'null');if(latest?.purchaseId===saved.purchaseId)storage.setItem(key,JSON.stringify({...latest,animationDeliveryId:deliveryId}));}catch(error){const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';if(['stale_scene','video_unavailable','media_offer_not_found'].includes(code)){animationError=code;deliveryCompleted=true;}else deliveryCompleted=false;}
   }
   if(deliveryId){try{const delivery=await gateway.videoDelivery(deliveryId);deliveryCompleted=delivery.status==='delivered';}catch{deliveryCompleted=false;}}
   if(['fulfilled','failed','expired'].includes(receipt.status)||receipt.review_required){const latest=JSON.parse(storage.getItem(key)||'null');if(latest?.purchaseId!==saved.purchaseId)continue;storage.setItem(key,JSON.stringify({...latest,receiptNotified:true,deliveryCompleted,...(animationError?{animationError,animationErrorNotified:true}:{})}));if(!saved.receiptNotified||(animationError&&!saved.animationErrorNotified))onSettled({...receipt,...(animationError?{animation_error:animationError}:{})});}
  }catch(error){lastError=error;}
 }
 rotations.set(prefix,keys.length?(offset+processed)%keys.length:0);if(rotations.size>20)rotations.delete(rotations.keys().next().value!);if(lastError)throw lastError;return pending;
}
