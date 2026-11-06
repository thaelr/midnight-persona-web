import type {ReactNode} from 'react';
import {config} from './lib/config';
import {useCopy} from './lib/localization';
import {Icon} from './components/Icons';
import './welcome.css';

/** Presentation only: session, consent, language and routing stay in App. */
export function WelcomeScreen({children}:{children:ReactNode}){
 const t=useCopy();
 return <main className={`welcome ${!config.introVideo&&!config.ambientVideo?'with-art':''}`}>
  {!config.introVideo&&!config.ambientVideo&&<div className="welcome-media" aria-hidden="true"><img src="/assets/midnight-violet-hero.webp" alt="" fetchPriority="high"/></div>}
  <div className="welcome-meta"><span className="tiny-label">{t('СИМУЛЯТОР ОБЩЕНИЯ С ВИРТУАЛЬНЫМИ ДЕВУШКАМИ','AI CONVERSATION SIMULATOR')}</span></div>
  <div className="welcome-title"><h1>{t('У каждой —\nсвой характер.','Every character\nhas a personality.')}<em>{t('У каждого разговора —\nсвоё настроение.','Every conversation\nhas a mood.')}</em></h1><p>{t('Знакомься с AI-персонажами с индивидуальными характерами. Наша технология учитывает их настроение и контекст вашего разговора.','Meet AI characters with distinct personalities. Our technology takes their mood and your conversation’s context into account.')}</p></div>
  <div className="welcome-bottom"><div className="welcome-mark"><Icon name="spark" size={16}/><span>{t('Вымышленные персонажи. Ответы создаются ИИ. · 18+','Fictional characters. AI-generated conversations. · 18+')}</span></div><div className="entry-panel">{children}<div className="legal-links"><a href="/terms">{t("Условия сервиса","Terms of service")}</a><a href="/privacy">{t("Конфиденциальность","Privacy policy")}</a></div></div></div>
 </main>;
}
