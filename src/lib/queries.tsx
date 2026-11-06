import {createContext,useContext} from 'react';
import {QueryClient,useQuery} from '@tanstack/react-query';
import {ApiError,type Gateway} from './gateway';
import {config} from './config';
export const retryRead=(attempt:number,error:unknown)=>attempt<2&&(!(error instanceof ApiError)||error.status===0&&error.code!=='request_aborted'||error.status>=500);
export const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30_000,gcTime:5*60_000,retry:retryRead,retryDelay:n=>Math.min(1000*2**n,10_000),refetchOnWindowFocus:true,refetchOnReconnect:true},mutations:{retry:false}}});
export const ServerContext=createContext({owner:'',locale:'en',enabled:false});
export const serverKey=(owner:string,locale:string,name:string,context='')=>['private',config.apiBaseUrl,owner,locale,name,context] as const;
export function useServerQuery<T>(name:string,read:(signal:AbortSignal)=>Promise<T>,options:{context?:string;enabled?:boolean;staleTime?:number;interval?:number}={}){
 const scope=useContext(ServerContext);
 return useQuery({queryKey:serverKey(scope.owner,scope.locale,name,options.context),queryFn:({signal})=>read(signal),enabled:scope.enabled&&options.enabled!==false,staleTime:options.staleTime??30_000,refetchInterval:options.interval??false,refetchIntervalInBackground:false});
}
export async function clearPrivateQueries(gateway:Gateway){gateway.abortPending();await queryClient.cancelQueries({queryKey:['private']});queryClient.removeQueries({queryKey:['private']});}
