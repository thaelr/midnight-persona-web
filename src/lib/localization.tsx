import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {Gateway} from './gateway';
import {config} from './config';
import {localeLanguage} from './auth';
export type EnabledLanguage={locale:string;display_name:string};
type Dictionary=Record<string,unknown>;
const fallback=[{locale:'ru',display_name:'Русский'},{locale:'en',display_name:'English'}];
type LocaleState={language:string;setLanguage:(v:string,manual?:boolean)=>void;manual:boolean;languages:EnabledLanguage[];languagesReady:boolean;languageError:boolean;retryLanguages:()=>void;copies:Record<string,Dictionary>};
const LocaleContext=createContext<LocaleState>({language:'en',setLanguage:()=>{},manual:false,languages:fallback,languagesReady:true,languageError:false,retryLanguages:()=>{},copies:{}});
export function translatePair(locale:string,copy:Dictionary,ru:string,en:string):string{const value=copy[en];return typeof value==='string'&&value.trim()?value:locale.split('-')[0]==='ru'?ru:en;}
export function LocalizationProvider({gateway,children}:{gateway:Gateway;children:ReactNode}){
 const [manual,setManual]=useState(()=>{try{return !!localStorage.getItem('mp.language');}catch{return false;}});
 const [language,change]=useState(()=>{try{return localStorage.getItem('mp.language')||localeLanguage(navigator.language)||'en';}catch{return 'en';}});
 const setLanguage=(value:string,explicit=true)=>{change(value);if(explicit){setManual(true);try{localStorage.setItem('mp.language',value);}catch{/* Rendering remains available without storage. */}}};
 const list=useQuery({queryKey:['public',config.apiBaseUrl,'languages'],queryFn:({signal})=>gateway.localizations(signal),enabled:!!config.apiBaseUrl,staleTime:300_000,gcTime:600_000,refetchInterval:60_000});
 const web=useQuery({queryKey:['public',config.apiBaseUrl,'copy',language,'web'],queryFn:({signal})=>gateway.localization(language,'web',signal),enabled:!!config.apiBaseUrl,staleTime:60_000,gcTime:300_000});
 const commerce=useQuery({queryKey:['public',config.apiBaseUrl,'copy',language,'commerce'],queryFn:({signal})=>gateway.localization(language,'commerce',signal),enabled:!!config.apiBaseUrl,staleTime:60_000,gcTime:300_000});
 const configured=Array.isArray(list.data?.languages)?list.data.languages.filter(l=>typeof l?.locale==='string'&&/^[a-z][a-z0-9-]*$/.test(l.locale)&&typeof l.display_name==='string'):[];
 const languages=configured.length?configured:fallback;
 const copies=useMemo(()=>({web:web.data?.copy??{},commerce:commerce.data?.copy??{}}),[web.data,commerce.data]);
 return <LocaleContext.Provider value={{language,setLanguage,manual,languages,languagesReady:true,languageError:list.isError,retryLanguages:()=>void list.refetch(),copies}}>{children}</LocaleContext.Provider>;
}
export const useLocalization=()=>useContext(LocaleContext);
export function useCopy(namespace='web'){const {language,copies}=useLocalization();return useMemo(()=>(ru:string,en:string)=>translatePair(language,copies[namespace]??{},ru,en),[language,copies,namespace]);}
