import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import openapiTS,{astToString,COMMENT_HEADER} from 'openapi-typescript';
test('the compiled REST contract is reproducible and equals the integration Gateway snapshot',async()=>{
 const generated=COMMENT_HEADER+astToString(await openapiTS(new URL('../contracts/openapi.web.json',import.meta.url)));
 assert.equal(await readFile(new URL('../src/lib/generated-api.d.ts',import.meta.url),'utf8'),generated,'run pnpm api:generate after a schema change');
 const gateway=process.env.GATEWAY_REPO_PATH
  ?pathToFileURL(resolve(process.env.GATEWAY_REPO_PATH,'docs/openapi.web.json'))
  :new URL('../../telegram-gateway/docs/openapi.web.json',import.meta.url);
 assert.deepEqual(JSON.parse(await readFile(gateway,'utf8')),JSON.parse(await readFile(new URL('../contracts/openapi.web.json',import.meta.url),'utf8')),'refresh the checked-in snapshot from Gateway');
});
