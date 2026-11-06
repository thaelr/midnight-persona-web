/** The owner inserts the four approved editions here. Empty means unpublished. Plain text; no HTML. */
export const legalContent={terms:{ru:'',en:''},privacy:{ru:'',en:''}};
export const legalDocumentsReady=(language:string)=>Boolean(legalContent.terms[language==='ru'?'ru':'en'].trim()&&legalContent.privacy[language==='ru'?'ru':'en'].trim());
