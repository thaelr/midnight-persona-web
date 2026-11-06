const blockers=new Set<string>();
export function setActivity(key:string,active:boolean){if(active)blockers.add(key);else blockers.delete(key);if(typeof window!=='undefined')window.dispatchEvent(new Event('mp-activity'));}
export function isUpdateSafe(){return blockers.size===0&&(typeof document==='undefined'||!Array.from(document.querySelectorAll('video:not([data-background])')).some(v=>!(v as HTMLVideoElement).paused&&!(v as HTMLVideoElement).ended));}
