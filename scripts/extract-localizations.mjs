import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const copies={web:{ru:{},en:{}},commerce:{ru:{},en:{}}};
const files=fs.readdirSync('src',{recursive:true}).filter(p=>/\.tsx?$/.test(p));
for(const name of files){const filename=path.join('src',name);const source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,filename.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(node,namespace='web'){if(ts.isFunctionDeclaration(node)&&node.name?.text==='PurchaseContent')namespace='commerce';
  if(ts.isCallExpression(node)&&['t','tr'].includes(node.expression.getText(source))&&node.arguments.length===2&&node.arguments.every(ts.isStringLiteral)){const [ru,en]=node.arguments.map(a=>a.text);copies[namespace].ru[en]=ru;copies[namespace].en[en]=en;}
  ts.forEachChild(node,n=>visit(n,namespace));
 }visit(source);
}
const products=JSON.parse(fs.readFileSync('localization/product-types.json','utf8'));
for(const locale of ['ru','en'])copies.commerce[locale].product_types=products[locale];
for(const [namespace,locales] of Object.entries(copies))for(const [locale,copy]of Object.entries(locales)){const target=`localization/${locale}`;fs.mkdirSync(target,{recursive:true});fs.writeFileSync(`${target}/${namespace}.json`,JSON.stringify(Object.fromEntries(Object.entries(copy).sort(([a],[b])=>a.localeCompare(b))),null,2)+'\n');}
console.log(JSON.stringify(Object.fromEntries(Object.entries(copies).map(([namespace,locales])=>[namespace,Object.keys(locales.en).length]))));
