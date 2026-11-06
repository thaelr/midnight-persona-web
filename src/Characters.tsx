import {useCopy} from './lib/localization';
import {useEffect,useLayoutEffect,useState,useRef,useCallback,type ReactNode,type PointerEvent as ReactPointerEvent} from 'react';
import {motion,AnimatePresence,LayoutGroup,animate,useMotionValue,useMotionValueEvent,useTransform,useReducedMotion,useIsPresent,type MotionValue,type PanInfo} from 'motion/react';
import type {WebCharacter} from './lib/types';
import {safeUrl} from './lib/config';
import {Icon} from './components/Icons';
import {carouselTransition,sharedTransition,shortTransition,reducedTransition} from './lib/motion';
import './catalog-motion.css';

type Props={characters:WebCharacter[];language:string;selected:number|null;onSelect:(id:number)=>void;onBack:()=>void;onStart:(c:WebCharacter,mode:'fast'|'roleplay')=>void;onVote:()=>void;loading:boolean;error:string|null;onRetry:()=>void;offline?:boolean};
type Mode='swipe'|'grid';
const wrap=(n:number,count:number)=>((n%count)+count)%count;
const distance=(index:number,position:number,count:number)=>wrap(index-position+count/2,count)-count/2;
const read=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const keyOf=(c:WebCharacter)=>String(c.character_i);
function visible(node:HTMLElement|null,container?:HTMLElement|null){if(!node?.isConnected)return false;const r=node.getBoundingClientRect(),c=container?.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>Math.max(0,c?.top??0)&&r.top<Math.min(innerHeight,c?.bottom??innerHeight)&&r.right>0&&r.left<innerWidth;}
function Photo({character,layoutId,url=character.image_url}:{character:WebCharacter;layoutId?:string;url?:string|null}){
 const reduce=useReducedMotion(),source=safeUrl(url),[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[source]);
 return <motion.div className="portrait" layoutId={layoutId} transition={reduce?reducedTransition:sharedTransition} data-photo-id={character.character_i}>{source&&!failed?<img src={source} alt={character.name} draggable={false} onError={()=>setFailed(true)}/>:<div className="portrait-empty"><span>{character.name.slice(0,1)}</span><small>Midnight Persona</small></div>}</motion.div>;
}
function CatalogScreen({children,className,shared=false,onEscape}:{children:ReactNode;className:string;shared?:boolean;onEscape?:()=>void}){const present=useIsPresent(),reduce=useReducedMotion();return <motion.section layoutScroll className={className} inert={!present} aria-hidden={!present?true:undefined} data-catalog-present={present?'true':'false'} style={{pointerEvents:present?'auto':'none'}} onKeyDown={event=>{if(present&&event.key==='Escape'&&onEscape){event.preventDefault();event.stopPropagation();onEscape();}}} initial={false} animate={{opacity:1}} exit={{opacity:shared?1:0}} transition={reduce?reducedTransition:shortTransition}>{children}</motion.section>;}
/** The same entity stays mounted while crossing centre. Only offscreen slots recycle. */
function Card({character,index,count,position,width,mobile,mode,active,shared,onOpen,onStep,onVote,onFocus}:{character?:WebCharacter;index:number;count:number;position:MotionValue<number>;width:number;mobile:boolean;mode:Mode;active:boolean;shared:boolean;onOpen:(c:WebCharacter,source:HTMLButtonElement)=>void;onStep:(direction:number)=>void;onVote:()=>void;onFocus:()=>void}){
 const t=useCopy(),reduce=useReducedMotion();const d=useTransform(position,p=>distance(index,p,count));
 const x=useTransform(d,v=>v*width*(mobile?.82:.33));
 const scale=useTransform(d,v=>1-Math.min(Math.abs(v),1.8)*(mobile?.04:.14));
 const rotateY=useTransform(d,v=>reduce?0:-Math.max(-1.5,Math.min(1.5,v))*13);
 const opacity=useTransform(d,v=>mode==='grid'?1:mobile?Math.max(0,1-Math.abs(v)):Math.max(0,Math.min(1,(Math.min(1.8,count/2-.05)-Math.abs(v))/.45)));
 const zIndex=useTransform(d,v=>100-Math.round(Math.abs(v)*20));
 const pointerEvents=useTransform(d,v=>mode==='swipe'&&mobile&&Math.abs(v)>=.999?'none':'auto');
 const transform=mode==='swipe'?{x,scale,rotateY,opacity,pointerEvents}:{};
 const choose=(e:React.MouseEvent<HTMLButtonElement>)=>{if(mode==='swipe'&&!active){onStep(distance(index,position.get(),count)<0?-1:1);return;}if(character)onOpen(character,e.currentTarget);else onVote();};
 return <motion.div layout={shared&&active} style={mode==='swipe'?{zIndex}:undefined} transition={reduce?reducedTransition:sharedTransition} className={`catalog-slot ${active?'catalog-selected':''}`} data-catalog-id={character?keyOf(character):'vote'} data-selected={active?'true':'false'}>
  <motion.div className="catalog-card-motion" style={transform}>
   {character?<button className={mode==='grid'?'grid-card':'swipe-card'} data-catalog-source={keyOf(character)} tabIndex={mode==='grid'||active?0:-1} aria-hidden={mode==='swipe'&&!active?true:undefined} onFocus={()=>mode==='grid'&&onFocus()} onClick={choose}>
    <Photo character={character} layoutId={shared&&active?`catalog-photo-${character.character_i}`:undefined}/>
    {mode==='grid'?<div className="grid-caption"><h2>{character.name}</h2><Icon name="arrow"/></div>:<div className="swipe-caption"><span className="eyebrow">{t('ПОЗНАКОМИТЬСЯ','MEET')}</span><h2>{character.name}</h2><p>{character.description}</p><span className="circle-link"><Icon name="arrow"/></span></div>}
   </button>:<button className={mode==='grid'?'vote-banner':'vote-card'} data-catalog-source="vote" tabIndex={mode==='grid'||active?0:-1} aria-hidden={mode==='swipe'&&!active?true:undefined} onFocus={()=>mode==='grid'&&onFocus()} onClick={choose}>
    {mode==='grid'?<><Icon name="spark"/><span>{t('Кого пригласим следующим?','Who should join next?')}<small>{t('Голосование за новых персонажей','Vote for new characters')}</small></span><Icon name="arrow"/></>:<><Icon name="spark" size={60}/><span className="eyebrow">{t('ПРОДОЛЖЕНИЕ СЛЕДУЕТ','TO BE CONTINUED')}</span><h2>{t('Кого-то\nне хватает?','Someone\nmissing?')}</h2><p>{t('Помоги выбрать следующего персонажа.','Help us choose the next character.')}</p><span className="circle-link"><Icon name="arrow"/></span></>}
   </button>}
  </motion.div>
 </motion.div>;
}
export function Characters(p:Props){
 const t=useCopy(),reduce=useReducedMotion();const [mode,setMode]=useState<Mode>(()=>read('mp.view')==='grid'?'grid':'swipe');
 const initial=Number(read('mp.characterIndex'))||0;const [center,setCenter]=useState(initial),position=useMotionValue(initial),target=useRef(initial);
 const [mobile,setMobile]=useState(()=>matchMedia('(max-width:600px)').matches),[width,setWidth]=useState(0),[moving,setMoving]=useState(false),[shared,setShared]=useState(true),[busy,setBusy]=useState(false),[photoIndex,setPhotoIndex]=useState(0);
 const root=useRef<HTMLElement>(null),scroll=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),scrollPositions=useRef({grid:0,swipe:0});
 const selection=useRef(read('mp.characterId')??''),keys=p.characters.map(keyOf).concat('vote'),count=keys.length,signature=keys.join(','),at=wrap(center,count),activeKey=keys[at];
 const countRef=useRef(count);countRef.current=count;const keysRef=useRef(keys);keysRef.current=keys;
 const animation=useRef<ReturnType<typeof animate>|null>(null),gesture=useRef({start:initial,horizontal:false,vertical:false,engaged:false,cancelled:false}),suppressClick=useRef(false),detailPointer=useRef({x:0,y:0,moved:false});
 const origin=useRef<{id:string;url:string|null;mode:Mode;width:number;height:number}|null>(null),previousDetail=useRef<number|null>(null),restoreFocus=useRef<string|null>(null),galleryButton=useRef<HTMLButtonElement>(null),mounted=useRef(true);
 const current=p.characters.find(c=>c.character_i===p.selected);
 const stop=useCallback(()=>{animation.current?.stop();animation.current=null;},[]);
 useMotionValueEvent(position,'change',value=>{const next=Math.round(value);setCenter(old=>old===next?old:next);selection.current=keysRef.current[wrap(next,countRef.current)]??'';});
 useLayoutEffect(()=>{
  if(!p.characters.length)return;const index=keys.indexOf(selection.current),next=index<0?wrap(center,count):index;
  gesture.current.cancelled=true;gesture.current.horizontal=false;gesture.current.engaged=false;stop();target.current=next;position.set(next);setCenter(next);selection.current=keys[next];setMoving(false);
 },[signature]);
 useEffect(()=>{try{localStorage.setItem('mp.view',mode);if(p.characters.length){localStorage.setItem('mp.characterIndex',String(at));localStorage.setItem('mp.characterId',activeKey);}}catch{}},[mode,at,activeKey,p.characters.length]);
 useEffect(()=>{const query=matchMedia('(max-width:600px)');const resize=()=>{setMobile(query.matches);if(current&&origin.current&&(origin.current.width!==innerWidth||origin.current.height!==innerHeight))setShared(false);if(gesture.current.engaged||animation.current){gesture.current.cancelled=true;gesture.current.engaged=false;stop();const next=Math.round(position.get());target.current=next;position.set(next);setMoving(false);}};query.addEventListener('change',resize);window.addEventListener('resize',resize);return()=>{query.removeEventListener('change',resize);window.removeEventListener('resize',resize);};},[current?.character_i]);
 useLayoutEffect(()=>{const node=stage.current;if(!node)return;const measure=()=>setWidth(node.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[Boolean(current),p.loading,p.characters.length]);
 useLayoutEffect(()=>{if(!current&&scroll.current)scroll.current.scrollTop=scrollPositions.current[mode];if(previousDetail.current!==null&&!current){restoreFocus.current=origin.current?.id??null;const node=root.current?.querySelector<HTMLButtonElement>(`[data-catalog-source="${restoreFocus.current}"]`);node?.focus({preventScroll:true});}if(current?.character_i!==previousDetail.current){setPhotoIndex(0);if(current)galleryButton.current?.focus({preventScroll:true});}previousDetail.current=current?.character_i??null;},[current?.character_i,mode]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop();};},[stop]);
 const photos=current?[...new Set([current.image_url,...(current.gallery_photos??[]),current.gallery_photo_url,current.menu_photo_url].filter((url):url is string=>Boolean(url&&safeUrl(url))))]:[];
 const shownPhoto=photos[photoIndex]??photos[0]??current?.image_url;
 useEffect(()=>{if(!current||!photos.length)return;const urls=[photos[wrap(photoIndex-1,photos.length)],photos[wrap(photoIndex+1,photos.length)]];for(const url of new Set(urls)){const image=new Image();image.src=url;}},[current?.character_i,shownPhoto]);
 const snap=(next:number,velocity=position.getVelocity())=>{stop();target.current=next;if(reduce){position.set(next);setMoving(false);return;}setMoving(true);animation.current=animate(position,next,{...carouselTransition,velocity,onComplete:()=>{animation.current=null;if(mounted.current)setMoving(false);}});};
 const step=(delta:number)=>snap(target.current+delta);
 const selectGrid=(index:number)=>{selection.current=keys[index];target.current=index;position.set(index);setCenter(index);};
 const sourceNode=()=>root.current?.querySelector<HTMLElement>(`[data-catalog-source="${activeKey}"]`)??null;
 const toggle=()=>{suppressClick.current=false;stop();const next=Math.round(position.get());target.current=next;selection.current=keys[wrap(next,count)];setCenter(next);setMoving(false);setShared(visible(sourceNode(),scroll.current));if(scroll.current)scrollPositions.current[mode]=scroll.current.scrollTop;if(mode==='grid')position.set(next);setMode(value=>value==='swipe'?'grid':'swipe');};
 const open=(c:WebCharacter,source:HTMLButtonElement)=>{
  stop();const index=p.characters.findIndex(item=>item.character_i===c.character_i);target.current=index;position.set(index);setCenter(index);selection.current=keyOf(c);setMoving(false);
  setShared(visible(source,scroll.current));origin.current={id:keyOf(c),url:c.image_url,mode,width:innerWidth,height:innerHeight};if(scroll.current)scrollPositions.current[mode]=scroll.current.scrollTop;
  p.onSelect(c.character_i);
 };
 const back=()=>{if(!current)return;setShared(Boolean(shared&&photoIndex===0&&origin.current?.id===keyOf(current)&&origin.current.url===current.image_url&&origin.current.width===innerWidth&&origin.current.height===innerHeight));p.onBack();};
 const galleryStep=(delta:number)=>setPhotoIndex(index=>wrap(index+delta,Math.max(photos.length,1)));
 const panStart=()=>{gesture.current={start:position.get(),horizontal:false,vertical:false,engaged:false,cancelled:false};suppressClick.current=false;};
 const pan=(_:PointerEvent,info:PanInfo)=>{
  if(Math.hypot(info.offset.x,info.offset.y)>8)suppressClick.current=true;
  const g=gesture.current;if(g.vertical||g.cancelled)return;
  if(!g.horizontal){if(Math.abs(info.offset.y)>Math.abs(info.offset.x)*1.2&&Math.abs(info.offset.y)>8){g.vertical=true;return;}if(Math.abs(info.offset.x)<8||Math.abs(info.offset.x)<=Math.abs(info.offset.y)*1.2)return;g.horizontal=true;g.engaged=true;stop();g.start=position.get();target.current=Math.round(g.start);setMoving(true);}
  position.set(g.start-info.offset.x/Math.max(1,width*(mobile?.82:.33)));
 };
 const panEnd=(_:PointerEvent,info:PanInfo)=>{const g=gesture.current;if(!g.horizontal||g.cancelled)return;suppressClick.current=true;g.horizontal=false;const stride=Math.max(1,width*(mobile?.82:.33)),velocity=-info.velocity.x/stride;
  const projected=position.get()+Math.max(-.75,Math.min(.75,velocity*.16));snap(Math.round(projected),velocity);
 };
 const panCancel=()=>{const g=gesture.current;g.cancelled=true;if(g.engaged){g.horizontal=false;g.engaged=false;suppressClick.current=true;snap(Math.round(g.start),0);}};
 const detailDown=(e:ReactPointerEvent)=>{detailPointer.current={x:e.clientX,y:e.clientY,moved:false};};
 const detailUp=(e:ReactPointerEvent)=>{const v=detailPointer.current,dx=e.clientX-v.x,dy=e.clientY-v.y;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.2){v.moved=true;galleryStep(dx<0?1:-1);}};
 return <LayoutGroup id="catalog"><section ref={root} className="catalog-motion-root" data-catalog-mode={mode} data-catalog-active={activeKey} data-catalog-moving={moving?'true':'false'} data-catalog-detail={current?.character_i??''}>
 <AnimatePresence initial={false} mode="sync">{current?<CatalogScreen key={`detail-${current.character_i}`} className="character-detail catalog-detail" shared={shared&&photoIndex===0} onEscape={back}>
  <motion.div className="character-gallery" data-shared-transition={shared&&photoIndex===0?'true':'false'} onPointerDown={detailDown} onPointerUp={detailUp} onPointerCancel={()=>{detailPointer.current.moved=true;}}>
   <button ref={galleryButton} className="character-gallery-photo" onClick={()=>{if(detailPointer.current.moved){detailPointer.current.moved=false;return;}galleryStep(1);}} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();galleryStep(e.key==='ArrowRight'?1:-1);}}} aria-label={t('Следующая фотография','Next photo')}>
    <AnimatePresence initial={false} mode="sync"><motion.div key={shownPhoto??'empty'} className="catalog-detail-photo" initial={photoIndex===0?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={reduce?reducedTransition:shortTransition}><Photo character={current} url={shownPhoto} layoutId={shared&&photoIndex===0?`catalog-photo-${current.character_i}`:undefined}/></motion.div></AnimatePresence>
   </button>
   {photos.length>1&&<div className="character-photo-indicators">{photos.map((_,index)=><button key={index} className={photoIndex===index?'active':''} onClick={()=>setPhotoIndex(index)} aria-label={`${t('Фотография','Photo')} ${index+1}`} aria-current={photoIndex===index?'true':undefined}/>)}</div>}
  </motion.div>
  <motion.div className="detail-copy" initial={{opacity:0}} animate={{opacity:1}} transition={reduce?reducedTransition:shortTransition}><span className="eyebrow">{t('НОВАЯ ИСТОРИЯ','A NEW STORY')}</span><h1>{current.name}<span className="accent-dot">.</span></h1><p className="description">{current.description}</p><div className="detail-modes">{current.modes.map(value=><button disabled={busy} className="mode-button" key={value} onClick={()=>{if(busy)return;setBusy(true);Promise.resolve(p.onStart(current,value)).finally(()=>{if(mounted.current)setBusy(false);});}}><span>{value==='fast'?'Fast':'Roleplay'}<Icon name="arrow"/></span><small>{value==='fast'?t('Сразу к знакомству','Straight to the moment'):t('Твоя история, твой темп','Your story, your pace')}</small></button>)}</div><p className="small-note">{current.chat_code?t('У вас уже есть диалог. Продолжим с того места, где остановились.','Your conversation will continue where you left off.'):t('Выбери, как начнётся ваше знакомство.','Choose how your story begins.')}</p></motion.div>
  <motion.button className="back-to-choice" initial={{opacity:0,y:reduce?0:8}} animate={{opacity:1,y:0}} transition={reduce?reducedTransition:shortTransition} onClick={back}><Icon name="back"/>{t('Назад к выбору','Back to characters')}</motion.button>
 </CatalogScreen>:p.loading?<section key="loading" className="empty-view" aria-busy="true"><div className="loading-mark"/><h2>{t('Кое-кто уже на пути','Someone is on the way')}</h2><p>{t('Загружаем персонажей…','Loading characters…')}</p></section>:!p.characters.length?<section key="empty" className="empty-view"><div className="empty-art"><Icon name="people" size={70}/><span>*</span></div><span className="eyebrow">{t('МЕСТО ДЛЯ НОВЫХ ЗНАКОМСТВ','ROOM FOR NEW CONNECTIONS')}</span><h1>{t('Всё начинается\nс «привет».','It starts\nwith hello.')}</h1><p>{p.error||(p.offline?t('Персонажи появятся здесь после подключения сервиса.','Characters will appear when the service is connected.'):t('Пока здесь никого нет. Загляни чуть позже.','No characters yet. Come back soon.'))}</p>{!p.offline&&<button className="button secondary" onClick={p.onRetry}>{t('Обновить','Refresh')}<Icon name="arrow"/></button>}</section>:<CatalogScreen key="catalog" className={`characters-view ${mode}`} shared={shared}>
  <header className="section-heading"><div><span className="eyebrow">{t('ВСТРЕЧИ ПОСЛЕ ПОЛУНОЧИ','AFTER-HOURS CONNECTIONS')}</span><h1>{t('Кто сегодня?','Who tonight?')}<span className="handwritten">{t('выбирай сердцем','follow the feeling')}</span></h1></div><span className="catalog-count">{String(p.characters.length).padStart(2,'0')} {t('ПЕРСОНАЖА','CHARACTERS')}</span></header>
  <motion.div layoutScroll ref={scroll} className="characters-scroll" onScroll={e=>{scrollPositions.current[mode]=e.currentTarget.scrollTop;}}>
   <motion.div ref={stage} className={`catalog-stage ${mode==='grid'?'character-grid':'carousel'}`} data-shared-transition={shared?'true':'false'} onPointerDown={panStart} onPointerCancel={mode==='swipe'?panCancel:undefined} onPan={mode==='swipe'?pan:undefined} onPanEnd={mode==='swipe'?panEnd:undefined} onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}} onKeyDown={e=>{if(mode==='swipe'&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}}} tabIndex={mode==='swipe'?0:undefined} aria-roledescription={mode==='swipe'?'carousel':undefined} aria-label={t('Выбор персонажа','Choose a character')}>
    {keys.map((key,index)=>({key,index})).filter(({index})=>mode==='grid'||Math.abs(distance(index,center,count))<=2).map(({key,index})=><Card key={key} character={p.characters[index]} index={index} count={count} position={position} width={width} mobile={mobile} mode={mode} active={index===at} shared={shared} onOpen={open} onStep={step} onVote={p.onVote} onFocus={()=>selectGrid(index)}/>)}
   </motion.div>
  </motion.div>
  <button className="view-toggle icon-button" aria-label={mode==='swipe'?t('Открыть каталог','Open catalog'):t('Перейти к свайпу','Open carousel')} aria-pressed={mode==='grid'} onClick={toggle}><Icon name={mode==='swipe'?'grid':'card'}/></button>
  {mode==='swipe'&&<div className="carousel-controls"><button className="icon-button" onClick={()=>step(-1)} aria-label={t('Предыдущий персонаж','Previous character')}><Icon name="back"/></button><span className="mono" aria-live="polite">{String(at+1).padStart(2,'0')} <i>/ {String(count).padStart(2,'0')}</i></span><button className="icon-button" onClick={()=>step(1)} aria-label={t('Следующий персонаж','Next character')}><Icon name="arrow"/></button></div>}
 </CatalogScreen>}</AnimatePresence>
 </section></LayoutGroup>;
}
