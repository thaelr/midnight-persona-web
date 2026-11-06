import type {CSSProperties} from 'react';
const paths:Record<string,React.ReactNode>={
  arrow:<><path d="M4 12h15M13 5l7 7-7 7"/></>,back:<path d="M20 12H5m6-7-7 7 7 7"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,grid:<><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></>,card:<rect x="5" y="2.5" width="14" height="19" rx="2"/>,
  people:<><circle cx="12" cy="7" r="4"/><path d="M4 21c0-6 3-8 8-8s8 3 8 8"/></>,chat:<path d="M4 4h16v12H9l-5 5V4Z"/>,profile:<><circle cx="12" cy="8" r="4"/><path d="M3 21c1-5 5-7 9-7s8 2 9 7"/></>,plus:<path d="M12 4v16M4 12h16"/>,spark:<><path d="m12 2 2.6 7.3L22 12l-7.4 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/></>,globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18"/></>,check:<path d="m5 12 4 4L20 5"/>,lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,google:<path d="M20.4 11H12v4h4.7c-.8 2.5-2.5 3.5-4.7 3.5A6.5 6.5 0 1 1 16.6 7L19 4.6A10 10 0 1 0 22 12l-.2-1Z"/>,more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>
};
export function Icon({name,size=22,style}:{name:string;size?:number;style?:CSSProperties}){return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]||paths.spark}</svg>;}

export function CopyIcon({ kind }: { kind: 'person' | 'spark' | 'link' | 'globe' | 'help' | 'gift' }) {
  const paths = {
    person: <><path d="M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0"/><path d="M4 21c0-8 16-8 16 0"/></>,
    spark: <path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/>,
    link: <><path d="m10 7 3-3c5-5 11 1 6 6l-3 3M14 17l-3 3c-5 5-11-1-6-6l3-3M8 16l8-8"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18"/></>,
    help: <><path d="M8 8c0-5 9-5 9 0 0 4-5 3-5 7M12 19h.01"/><circle cx="12" cy="12" r="10"/></>,
    gift: <><path d="M4 10h16v11H4ZM3 6h18v4H3ZM12 6v15"/><path d="M12 6C1 6 8-4 12 6c4-10 11 0 0 0"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

