import {readFile,writeFile,copyFile} from 'node:fs/promises';
import openapiTS,{astToString,COMMENT_HEADER} from 'openapi-typescript';
const source=process.argv.indexOf('--source');if(source>=0)await copyFile(process.argv[source+1],'contracts/openapi.web.json');
const generated=COMMENT_HEADER+astToString(await openapiTS(new URL('../contracts/openapi.web.json',import.meta.url)));
if(process.argv.includes('--check')){if(generated!==await readFile('src/lib/generated-api.d.ts','utf8'))throw new Error('OpenAPI types are stale. Run pnpm api:generate.');}
else await writeFile('src/lib/generated-api.d.ts',generated);
