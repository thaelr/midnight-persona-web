/** Read only allowlisted error codes; never render provider error descriptions. */
export function consumeOAuthError(url:URL):{code:string|null;cleanUrl:string}{
 const query=url.searchParams,fragment=new URLSearchParams(url.hash.slice(1));
 const code=query.get('error_code')??fragment.get('error_code')??query.get('error')??fragment.get('error');
 const keys=['error','error_code','error_description'];
 for(const key of keys)query.delete(key);
 if(keys.some(key=>fragment.has(key))){for(const key of keys)fragment.delete(key);url.hash=fragment.toString();}
 return {code,cleanUrl:url.pathname+url.search+url.hash};
}
