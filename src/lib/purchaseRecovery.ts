import type {Gateway} from './gateway';
import type {Purchase} from './types';

/** Recover only receipts in this authenticated account's existing browser store. */
export async function recoverPurchases(gateway:Gateway,storage:Storage,prefix:string,onSettled:(purchase:Purchase&{animation_error?:string})=>void){
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>Boolean(key?.startsWith(prefix)));
 for(const key of keys){let saved:Record<string,unknown>;try{saved=JSON.parse(storage.getItem(key)||'null');}catch{continue;}
  if(!saved||typeof saved.purchaseId!=='string'||(saved.receiptNotified&&saved.deliveryCompleted!==false))continue;
  try{const receipt=await gateway.purchase(saved.purchaseId);let deliveryCompleted=true;let animationError:string|undefined;let deliveryId=receipt.video_delivery_id??(typeof saved.animationDeliveryId==='string'?saved.animationDeliveryId:null);
   if(receipt.status==='fulfilled'&&!receipt.review_required&&!deliveryId&&typeof saved.animateMediaId==='string'&&typeof saved.chatCode==='string'){
    try{const delivery=await gateway.requestVideo(saved.chatCode,saved.animateMediaId,`full:${receipt.purchase_id}`);deliveryId=delivery.delivery_id;const latest=JSON.parse(storage.getItem(key)||'null');if(latest?.purchaseId===saved.purchaseId)storage.setItem(key,JSON.stringify({...latest,animationDeliveryId:deliveryId}));}catch(error){const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';if(['stale_scene','video_unavailable','media_offer_not_found'].includes(code)){animationError=code;deliveryCompleted=true;}else deliveryCompleted=false;}
   }
   if(deliveryId){try{const delivery=await gateway.videoDelivery(deliveryId);deliveryCompleted=delivery.status==='delivered';}catch{deliveryCompleted=false;}}
   if(['fulfilled','failed','expired'].includes(receipt.status)||receipt.review_required){const latest=JSON.parse(storage.getItem(key)||'null');if(latest?.purchaseId!==saved.purchaseId)continue;storage.setItem(key,JSON.stringify({...latest,receiptNotified:true,deliveryCompleted,...(animationError?{animationError,animationErrorNotified:true}:{})}));if(!saved.receiptNotified||(animationError&&!saved.animationErrorNotified))onSettled({...receipt,...(animationError?{animation_error:animationError}:{})});}
  }catch{/* Recheck later, never create a new purchase. */}
 }
}
