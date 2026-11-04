import {createContext,useContext,useEffect,useMemo,useState,useCallback,type ReactNode} from 'react';
import type {Gateway} from './gateway';
import {config} from './config';

export type EnabledLanguage={locale:string;display_name:string};
type Dictionary=Record<string,unknown>;
type LocaleState={language:string;setLanguage:(language:string)=>void;languages:EnabledLanguage[];languagesReady:boolean;languageError:boolean;retryLanguages:()=>void;copies:Record<string,Dictionary>};
const initialLanguages:EnabledLanguage[]=[{locale:'ru',display_name:'Русский'},{locale:'en',display_name:'English'}];
const LocaleContext=createContext<LocaleState>({language:'ru',setLanguage:()=>{},languages:initialLanguages,languagesReady:false,languageError:false,retryLanguages:()=>{},copies:{}});
const cache=new Map<string,{at:number;value:Dictionary}>();
export function translatePair(locale:string,copy:Dictionary,ru:string,en:string):string{
 const value=copy[en];
 return typeof value==='string'&&value.trim()?value:locale.split('-')[0]==='ru'?ru:en;
}
export function LocalizationProvider({gateway,children}:{gateway:Gateway;children:ReactNode}){
 const [language,setLanguage]=useState(()=>{try{return localStorage.getItem('mp.language')||'ru';}catch{return 'ru';}});
 const [languages,setLanguages]=useState<EnabledLanguage[]>(config.apiBaseUrl?[]:initialLanguages);
 const [languagesReady,setLanguagesReady]=useState(!config.apiBaseUrl);
 const [languageError,setLanguageError]=useState(false);
 const [languageAttempt,setLanguageAttempt]=useState(0);
 const retryLanguages=useCallback(()=>setLanguageAttempt(n=>n+1),[]);
 const [copies,setCopies]=useState<Record<string,Dictionary>>({});
 useEffect(()=>{if(!config.apiBaseUrl)return;let active=true;setLanguageError(false);gateway.localizations().then(r=>{if(!r.languages.length)throw new Error('languages_unavailable');if(active){setLanguages(r.languages);setLanguagesReady(true);}}).catch(()=>{if(active){setLanguageError(true);setLanguagesReady(false);}});return()=>{active=false;};},[gateway,languageAttempt]);
 useEffect(()=>{let active=true;setCopies({});if(!config.apiBaseUrl)return;const load=async()=>{
   const entries=await Promise.all(['web','commerce'].map(async namespace=>{const key=`${config.apiBaseUrl}:${language}:${namespace}`,saved=cache.get(key);if(saved&&Date.now()-saved.at<60_000)return [namespace,saved.value] as const;
    try{const result=await gateway.localization(language,namespace);cache.set(key,{at:Date.now(),value:result.copy});return [namespace,result.copy] as const;}catch{return [namespace,{}] as const;}}));
   if(active)setCopies(Object.fromEntries(entries));
  };void load();const timer=setInterval(()=>void load(),60_000);return()=>{active=false;clearInterval(timer);};},[gateway,language]);
 const value=useMemo(()=>({language,setLanguage,languages,languagesReady,languageError,retryLanguages,copies}),[language,languages,languagesReady,languageError,retryLanguages,copies]);
 return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocalization(){return useContext(LocaleContext);}
export function useCopy(namespace='web'){
 const {language,copies}=useLocalization();
 return useMemo(()=>(ru:string,en:string)=>translatePair(language,copies[namespace]??{},ru,en),[language,copies,namespace]);
}
