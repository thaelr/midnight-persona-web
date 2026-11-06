import {useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {motion, useAnimationControls, useReducedMotion} from 'motion/react';
import {useCopy} from './lib/localization';
import {useOverlayBack} from './lib/overlayBack';
import type {AuthorizedPhoto} from './lib/photoViewer';
import {reducedTransition, sharedTransition, shortTransition} from './lib/motion';
import './photo-lightbox.css';

/** A DOM reference for this opening only; never persisted or used to grant access. */
export type PhotoLightboxSource = {
  id: string;
  url: string;
  element: HTMLButtonElement;
  image: HTMLImageElement | null;
};

type Props = {
  photos: AuthorizedPhoto[];
  selectedId: string;
  source: PhotoLightboxSource;
  onSelect: (id: string) => void;
  onClose: () => void;
};

function visibleSource(source: PhotoLightboxSource) {
  const image = source.image;
  if (!source.element.isConnected || source.element.dataset.photoId !== source.id ||
      !image?.isConnected || (image.currentSrc || image.src) !== source.url ||
      !image.complete || !image.naturalWidth) return null;
  const rect = image.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1 || rect.left < 0 || rect.top < 0 ||
      rect.right > innerWidth || rect.bottom > innerHeight) return null;
  // A source can be inside the viewport but clipped by the chat's own scroller.
  for (let parent: HTMLElement | null = image; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.display === 'none') return null;
    if (parent !== image && /(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) {
      const clip = parent.getBoundingClientRect();
      if (rect.left < clip.left - 1 || rect.right > clip.right + 1 ||
          rect.top < clip.top - 1 || rect.bottom > clip.bottom + 1) return null;
    }
  }
  return rect;
}

const identity = {x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1};
function sourceTransform(source: DOMRect, target: DOMRect) {
  return {x: source.left - target.left, y: source.top - target.top,
    scaleX: source.width / target.width, scaleY: source.height / target.height, opacity: 1};
}

function PhotoFrame({photo, thumbnail, direction, onFailure}: {
  photo: AuthorizedPhoto; thumbnail?: string; direction: number; onFailure: () => void;
}) {
  const t = useCopy();
  const reduced = useReducedMotion();
  const image = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    if (image.current?.complete && image.current.naturalWidth) setReady(true);
  }, []);
  return <motion.div className="photo-lightbox-frame"
    initial={direction && !reduced ? {x: direction * 18, opacity: .5} : false}
    animate={{x: 0, opacity: 1}} transition={reduced ? reducedTransition : shortTransition}>
    {!ready && !failed && thumbnail && <img className="photo-lightbox-image photo-lightbox-thumbnail" src={thumbnail} alt="" aria-hidden="true" draggable={false}/>}
    {!ready && <div className="photo-lightbox-placeholder" role="status">
      {failed ? t('Не удалось загрузить фотографию.', 'Could not load the photo.') :
        !thumbnail ? t('Фотография загружается…', 'Loading photo…') : null}
    </div>}
    <img ref={image} className="photo-lightbox-image photo-lightbox-full" src={photo.url}
      data-ready={ready} alt={t('Фотография из диалога', 'Conversation photo')} draggable={false}
      onLoad={() => setReady(true)} onError={() => {setFailed(true); setReady(false); onFailure();}}/>
  </motion.div>;
}

export function PhotoLightbox({photos, selectedId, source, onSelect, onClose}: Props) {
  const t = useCopy();
  const reduced = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const alive = useRef(true);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [direction, setDirection] = useState(0);
  const failedUrl = useRef<string | null>(null);
  const index = photos.findIndex(photo => photo.id === selectedId);
  const photo = photos[index];
  const initialUrl = useRef(photo?.url);
  const current = useRef({photo, onClose}); current.current = {photo, onClose};
  const preview = useRef({
    available: Boolean(source.image?.complete && source.image.naturalWidth &&
      (source.image.currentSrc || source.image.src) === source.url),
    ratio: source.image?.naturalWidth && source.image.naturalHeight ?
      source.image.naturalWidth / source.image.naturalHeight : 3 / 4,
  }).current;
  const thumbnail = photo?.id === source.id && preview.available ? source.url : undefined;

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const item = current.current.photo;
    const origin = item?.id === source.id && item.url === initialUrl.current &&
      failedUrl.current !== item.url ? visibleSource(source) : null;
    // Measure the untransformed layout, including a resize during this opening.
    const node = stage.current;
    const modalBounds = dialog.current?.getBoundingClientRect();
    const target = node && modalBounds ? new DOMRect(modalBounds.left + node.offsetLeft,
      modalBounds.top + node.offsetTop, node.offsetWidth, node.offsetHeight) : null;
    const returnToSource = !reduced && origin && target && target.width > 0 && target.height > 0;
    void controls.start({...returnToSource ? sourceTransform(origin, target) : {opacity: 0},
      transition: reduced ? reducedTransition : returnToSource ? sharedTransition : shortTransition}).then(() => {
      if (!alive.current) return;
      dialog.current?.close();
      current.current.onClose();
      if (source.element.isConnected && source.element.dataset.photoId === source.id &&
          source.element.getClientRects().length && getComputedStyle(source.element).visibility !== 'hidden' &&
          !source.element.closest('[inert],[hidden]')) source.element.focus({preventScroll: true});
    });
  };
  useOverlayBack(true, requestClose);

  useLayoutEffect(() => {
    alive.current = true;
    const modal = dialog.current;
    const node = stage.current;
    if (modal && !modal.open) modal.showModal();
    const origin = visibleSource(source);
    const target = node?.getBoundingClientRect();
    controls.set(!reduced && origin && target?.width && target.height ? sourceTransform(origin, target) : {...identity, opacity: 0});
    void controls.start({...identity, transition: reduced ? reducedTransition : origin ? sharedTransition : shortTransition});
    return () => {alive.current = false; controls.stop(); modal?.close();};
  }, [controls]);

  // A removed authorization/photo or chat unmount never retains an old frame.
  useLayoutEffect(() => {if (!photo) onClose();}, [Boolean(photo), onClose]);
  const move = (step: number) => {
    if (closingRef.current) return;
    const next = photos[index + step];
    if (next) {setDirection(step); onSelect(next.id);}
  };

  return <dialog ref={dialog} className="chat-lightbox photo-lightbox" data-closing={closing}
    aria-label={t('Просмотр фотографии', 'Photo viewer')}
    onCancel={event => {event.preventDefault(); requestClose();}}
    onClick={event => {if (event.target === event.currentTarget) requestClose();}}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    }}>
    <button autoFocus className="chat-lightbox-close chat-icon" onClick={requestClose}
      aria-label={t('Закрыть фотографию', 'Close photo')}>×</button>
    <motion.div ref={stage} className="photo-lightbox-stage" initial={{opacity: 0}} animate={controls}
      style={{'--photo-ratio': preview.ratio} as CSSProperties}>
      <motion.div className="photo-lightbox-gesture" drag={closing ? false : 'x'}
        dragConstraints={{left: 0, right: 0}} dragElastic={reduced ? 0 : .12} dragMomentum={false}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 45 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.25) move(info.offset.x < 0 ? 1 : -1);
        }}>
        {photo && <PhotoFrame key={`${photo.id}:${photo.url}`} photo={photo} thumbnail={thumbnail}
          direction={direction} onFailure={() => {failedUrl.current = photo.url;}}/>}
      </motion.div>
    </motion.div>
    {photos.length > 1 && <nav className="chat-lightbox-navigation" aria-label={t('Полученные фотографии', 'Received photos')}>
      <button className="chat-icon" disabled={index <= 0 || closing} onClick={() => move(-1)} aria-label={t('Предыдущая фотография', 'Previous photo')}>‹</button>
      <span aria-live="polite">{index + 1} / {photos.length}</span>
      <button className="chat-icon" disabled={index >= photos.length - 1 || closing} onClick={() => move(1)} aria-label={t('Следующая фотография', 'Next photo')}>›</button>
    </nav>}
  </dialog>;
}
