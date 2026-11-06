type SafeError={feature:string;operation:string;code:string;status?:number;request_id?:string;version:string};
const recent=new Map<string,number>();
/** An allowlist only: never serialize errors, request bodies, URLs or metadata. */
export function reportError(feature:string,operation:string,error:unknown){
 const e=error&&typeof error==='object'?error as {code?:unknown;status?:unknown;details?:{request_id?:unknown}}:{};
 const safe=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,100}$/.test(value)?value:undefined;
 const entry:SafeError={feature,operation,code:safe(e.code)??'unexpected_error',version:'web-integration-3.1',...(typeof e.status==='number'?{status:e.status}:{}),...(safe(e.details?.request_id)?{request_id:safe(e.details?.request_id)}:{})};
 const key=[feature,operation,entry.code,entry.status].join(':');const now=Date.now();
 if(now-(recent.get(key)??0)<60_000)return;
 if(recent.size>=50)recent.delete(recent.keys().next().value!);recent.set(key,now);
 console.warn('[Midnight Persona]',entry);
}
