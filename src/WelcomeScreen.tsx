import {useEffect,useRef,useState,type ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion,type Transition} from 'motion/react';
import {config,safeUrl} from './lib/config';
import {useCopy,type EnabledLanguage} from './lib/localization';
import {Icon} from './components/Icons';
import './welcome.css';

export type WelcomeStep='invitation'|'language'|'consent';

type WelcomeScreenProps={
 step:WelcomeStep;
 status:ReactNode;
 languages:EnabledLanguage[];
 language:string;
 busy:boolean;
 entering:boolean;
 enterAvailable:boolean;
 error:string;
 adult:boolean;
 agreed:boolean;
 legalReady:boolean;
 onEnter:()=>void;
 onEnterSettled:()=>void;
 onLanguage:(locale:string)=>void;
 onConsent:()=>void;
 onAdult:(value:boolean)=>void;
 onAgreed:(value:boolean)=>void;
 onPreview:()=>void;
};

const ENTER_DURATION=400;

/** Presentation only: session, consent, language and routing stay in App. */
export function WelcomeScreen({step,status,languages,language,busy,entering,enterAvailable,error,adult,agreed,legalReady,onEnter,onEnterSettled,onLanguage,onConsent,onAdult,onAgreed,onPreview}:WelcomeScreenProps){
 const t=useCopy(),reduce=useReducedMotion()??false;
 const [glitching,setGlitching]=useState(false);
 const busyRef=useRef(false),timer=useRef<number|undefined>(undefined);
 useEffect(()=>()=>{if(timer.current!==undefined)window.clearTimeout(timer.current);},[]);
 const enter=()=>{
  if(busyRef.current||entering)return;
  busyRef.current=true;setGlitching(true);onEnter();
  const settle=()=>{busyRef.current=false;setGlitching(false);onEnterSettled();};
  if(reduce)settle();else timer.current=window.setTimeout(settle,ENTER_DURATION);
 };
 const enterTransition:Transition=reduce?{duration:0}:{duration:.16,ease:[.22,1,.36,1]};
 const exitTransition:Transition=reduce?{duration:0}:{duration:.1,ease:[.22,1,.36,1]};
 const legalLinks=<div className="legal-links">{safeUrl(config.termsUrl)?<a href={safeUrl(config.termsUrl)} target="_blank" rel="noreferrer">{t("Условия сервиса","Terms of service")}</a>:<span>{t("Условия пока недоступны","Terms are not available yet")}</span>}{safeUrl(config.privacyUrl)?<a href={safeUrl(config.privacyUrl)} target="_blank" rel="noreferrer">{t("Конфиденциальность","Privacy policy")}</a>:<span>{t("Политика пока недоступна","Privacy policy is not available yet")}</span>}</div>;
 return <main className="welcome">
  {!config.introVideo&&!config.ambientVideo&&<div className="welcome-media" aria-hidden="true"><img src="/assets/midnight-violet-hero.webp" alt="" fetchPriority="high"/></div>}
  <div className="welcome-stage">
   {status?<div className="welcome-status">{status}</div>:<AnimatePresence mode="wait" initial={false}>
    {step==='invitation'&&<motion.div key="invitation" initial={{opacity:0}} animate={{opacity:1,transition:enterTransition}} exit={{opacity:0,transition:exitTransition}} className="welcome-step invitation">
     <h1 className="welcome-name" aria-label="Midnight Persona"><span className="welcome-name-inner">MIDNIGHT PERSONA</span></h1>
     <button type="button" className={`enter ${glitching?'is-glitching':''}`} data-motion-press aria-busy={entering||glitching} disabled={!enterAvailable} onClick={enter}><span className="enter-text">ENTER</span></button>
     {legalLinks}
     {!enterAvailable&&<button type="button" className="text-button preview-button" onClick={onPreview}>{t("Посмотреть интерфейс","Explore the interface")}<Icon name="arrow" size={16}/></button>}
    </motion.div>}
    {step==='language'&&<motion.div key="language" initial={{opacity:0}} animate={{opacity:1,transition:enterTransition}} exit={{opacity:0,transition:exitTransition}} className="welcome-step">
     <h2 className="welcome-step-title">{t("На каком языке?","Your language?")}</h2>
     <div className="language-options">{languages.map(l=><button key={l.locale} type="button" className="button secondary" disabled={busy} aria-pressed={language===l.locale} onClick={()=>onLanguage(l.locale)}>{l.display_name}</button>)}</div>
    </motion.div>}
    {step==='consent'&&<motion.div key="consent" initial={{opacity:0}} animate={{opacity:1,transition:enterTransition}} exit={{opacity:0,transition:exitTransition}} className="welcome-step">
     <h2 className="welcome-step-title">{t("Прежде чем познакомимся","Before we meet")}</h2>
     <div className="consent-checks">
      <label className="check-row"><input type="checkbox" checked={adult} onChange={e=>onAdult(e.target.checked)}/><span>{t("Мне исполнилось 18 лет","I am 18 or older")}</span></label>
      <label className="check-row"><input type="checkbox" checked={agreed} onChange={e=>onAgreed(e.target.checked)}/><span>{t("Я принимаю условия сервиса и политику конфиденциальности","I accept the terms and privacy policy")}</span></label>
     </div>
     <button type="button" className="button primary" disabled={!adult||!agreed||!legalReady||busy} onClick={onConsent}>{t("Войти в историю","Let the story begin")}<Icon name="arrow"/></button>
     {!legalReady&&<p className="welcome-note" role="status">{t("Владелец ещё не добавил утверждённые тексты документов.","The owner has not added the approved documents yet.")}</p>}
     {legalLinks}
    </motion.div>}
   </AnimatePresence>}
   {error&&<p className="welcome-error" role="alert">{error}<button type="button" className="text-button" onClick={()=>location.reload()}>{t("Повторить","Retry")}</button></p>}
  </div>
 </main>;
}
