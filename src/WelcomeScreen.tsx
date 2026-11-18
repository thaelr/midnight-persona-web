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
 consentChecked:boolean;
 legalReady:boolean;
 onEnter:()=>void;
 onEnterSettled:()=>void;
 onLanguage:(locale:string)=>void;
 onConsent:()=>void;
 onConsentChange:(value:boolean)=>void;
 onPreview:()=>void;
};

const ENTER_DURATION=400;

/** Presentation only: session, consent, language and routing stay in App. */
export function WelcomeScreen({step,status,languages,language,busy,entering,enterAvailable,error,consentChecked,legalReady,onEnter,onEnterSettled,onLanguage,onConsent,onConsentChange,onPreview}:WelcomeScreenProps){
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
     <h1 className="welcome-name" aria-label="Midnight Persona"><span className="welcome-name-inner"><img src="/assets/midnight-persona.svg" alt=""/></span></h1>
     <button type="button" className={`enter ${glitching?'is-glitching':''}`} data-motion-press aria-busy={entering||glitching} disabled={!enterAvailable} onClick={enter}><span className="enter-text">ENTER</span></button>
     {!enterAvailable&&<button type="button" className="text-button preview-button" onClick={onPreview}>{t("Посмотреть интерфейс","Explore the interface")}<Icon name="arrow" size={16}/></button>}
    </motion.div>}
    {step==='language'&&<motion.div key="language" initial={{opacity:0}} animate={{opacity:1,transition:enterTransition}} exit={{opacity:0,transition:exitTransition}} className="welcome-step language-step">
     <div className="language-options">{languages.map(l=><button key={l.locale} type="button" lang={l.locale} className="language-option" disabled={busy} aria-pressed={language===l.locale} onClick={()=>onLanguage(l.locale)}><span>{l.display_name}</span></button>)}</div>
    </motion.div>}
    {step==='consent'&&<motion.div key="consent" initial={{opacity:0}} animate={{opacity:1,transition:enterTransition}} exit={{opacity:0,transition:exitTransition}} className="welcome-step">
     <div className="consent-checks">
      <label className="check-row">
       <input type="checkbox" checked={consentChecked} onChange={e=>onConsentChange(e.target.checked)}/>
       <span className="consent-box" aria-hidden="true"><img src="/assets/consent-cross.svg" alt=""/></span>
       <span>{t("Мне есть 18 лет, и я принимаю условия сервиса.","I'm 18 or older and agree to the Terms of Service.")}</span>
      </label>
     </div>
     <button type="button" className="continue-button" disabled={!consentChecked||!legalReady||busy} onClick={onConsent}><span>BEGIN</span></button>
     {!legalReady&&<p className="welcome-note" role="status">{t("Владелец ещё не добавил утверждённые тексты документов.","The owner has not added the approved documents yet.")}</p>}
     {legalLinks}
    </motion.div>}
   </AnimatePresence>}
   {error&&<p className="welcome-error" role="alert">{error}<button type="button" className="text-button" onClick={()=>location.reload()}>{t("Повторить","Retry")}</button></p>}
  </div>
 </main>;
}
