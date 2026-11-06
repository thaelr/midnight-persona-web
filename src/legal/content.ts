import termsRu from './documents/terms.ru.txt?raw';
import termsEn from './documents/terms.en.txt?raw';
import privacyRu from './documents/privacy.ru.txt?raw';
import privacyEn from './documents/privacy.en.txt?raw';

/** The owner inserts the four approved editions here. Empty means unpublished. Plain text; no HTML. */
export const legalContent={terms:{ru:termsRu,en:termsEn},privacy:{ru:privacyRu,en:privacyEn}};
export const legalDocumentsReady=(language:string)=>Boolean(legalContent.terms[language==='ru'?'ru':'en'].trim()&&legalContent.privacy[language==='ru'?'ru':'en'].trim());
