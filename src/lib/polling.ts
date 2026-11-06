export function pollDelay(failures:number,pending:boolean,random=Math.random){return failures?Math.round(Math.min(30_000,1000*2**Math.min(failures,5))*(.8+.4*random())):pending?1500:12_000;}
/** One request chain, no overlapping timers. Wake catches up immediately. */
export function startPolling(task:()=>Promise<boolean>,onError:(e:unknown)=>void,env={hidden:()=>document.visibilityState==='hidden',offline:()=>!navigator.onLine}){
 let stopped=false,blocked=false,busy=false,again=false,failures=0,timer:ReturnType<typeof setTimeout>|undefined;
 async function tick(){if(stopped||blocked)return;if(busy){again=true;return;}clearTimeout(timer);if(env.hidden()||env.offline())return;busy=true;let pending=false;
  try{pending=await task();failures=0;}catch(e){failures++;const status=e&&typeof e==='object'&&'status'in e?Number(e.status):0;blocked=status>=400&&status<500;onError(e);}finally{busy=false;if(!stopped&&!blocked){const immediate=again;again=false;timer=setTimeout(()=>void tick(),immediate?0:pollDelay(failures,pending));}}
 }
 const wake=()=>{if(!env.hidden()&&!env.offline())void tick();else clearTimeout(timer);};
 document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('focus',wake);void tick();
 return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('focus',wake);};
}
