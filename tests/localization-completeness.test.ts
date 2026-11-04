import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

test('every visible literal translation pair exists in matching RU/EN server dictionary',()=>{
 const root=new URL('../',import.meta.url);const dictionaries=Object.fromEntries(['web','commerce'].map(ns=>[ns,Object.fromEntries(['ru','en'].map(locale=>[locale,JSON.parse(fs.readFileSync(new URL(`localization/${locale}/${ns}.json`,root),'utf8'))]))])) as Record<string,Record<string,Record<string,unknown>>>;
 let count=0;
 for(const path of fs.readdirSync(new URL('src/',root),{recursive:true}).filter(p=>/\.tsx?$/.test(String(p)))){const filename=String(path),source=ts.createSourceFile(filename,fs.readFileSync(new URL(`src/${filename.replaceAll('\\','/')}`,root),'utf8'),ts.ScriptTarget.Latest,true,filename.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function visit(node:ts.Node,namespace='web'){if(ts.isFunctionDeclaration(node)&&node.name?.text==='PurchaseContent')namespace='commerce';if(ts.isCallExpression(node)&&['t','tr'].includes(node.expression.getText(source))&&node.arguments.length===2&&node.arguments.every(ts.isStringLiteral)){const en=(node.arguments[1] as ts.StringLiteral).text;for(const locale of ['ru','en'])assert.equal(typeof dictionaries[namespace][locale][en],'string',`${filename} ${namespace}/${locale}: ${en}`);count++;}ts.forEachChild(node,n=>visit(n,namespace));}visit(source);
 }
 assert.ok(count>250);
 for(const namespace of ['web','commerce'])assert.deepEqual(Object.keys(dictionaries[namespace].ru),Object.keys(dictionaries[namespace].en));
 for(const locale of ['ru','en'])for(const key of ['base','full','photo','scene_unlock','fast_scene_skip','video_unlock','video_pass']){const types=dictionaries.commerce[locale].product_types as Record<string,{title:string;description:string}>;assert.ok(types[key].title);assert.ok(types[key].description);}
});
