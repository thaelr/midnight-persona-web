import type {Gallery,Message} from './types';

export interface AuthorizedPhoto {id:string;url:string;createdAt:string}
/** Only URLs already returned for an owned/delivered photo may enter the viewer. */
export function authorizedPhotos(messages:Message[],media:Gallery['media']):AuthorizedPhoto[]{
 const photos=new Map<string,AuthorizedPhoto>();
 for(const message of messages)if(message.media_kind==='photo'&&message.media_id&&message.photo_url)photos.set(message.media_id,{id:message.media_id,url:message.photo_url,createdAt:message.created_at});
 for(const item of media)if(item.unlocked&&item.photo_url)photos.set(item.media_id,{id:item.media_id,url:item.photo_url,createdAt:item.created_at??photos.get(item.media_id)?.createdAt??''});
 return [...photos.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
