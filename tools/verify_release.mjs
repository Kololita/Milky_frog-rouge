import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractFile,listPackage} from '@electron/asar';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expected=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const release=path.join(root,'release',expected),archive=path.join(release,'win-unpacked','resources','app.asar');
const manifest=JSON.parse(extractFile(archive,'package.json').toString());assert.equal(manifest.version,expected);assert.equal(manifest.main,'desktop/main.cjs');
const packaged=file=>extractFile(archive,path.join(...file.split('/')));
const html=packaged('dist/index.html').toString();for(const id of ['home-screen','run-screen','assembly-board','equipment-effects','equipment-start'])assert(html.includes(`id="${id}"`));
assert(html.includes(expected));assert(html.includes('自定义游戏'));
const policy=packaged('desktop/security.cjs').toString(),main=packaged('desktop/main.cjs').toString(),preload=packaged('desktop/preload.cjs').toString();assert(policy.includes("connect-src 'self' blob:"));assert(main.includes("'.svg':'image/svg+xml'"));assert(main.includes('milk-heroes-assembly-v2')&&preload.includes('milk-heroes-assembly-v2'));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
let assetCount=0,modelCount=0;
async function verifyAssets(relative=''){
 for(const entry of await fs.readdir(path.join(root,'public',relative),{withFileTypes:true})){
  const file=path.posix.join(relative.replaceAll('\\','/'),entry.name);
  if(entry.isDirectory()){await verifyAssets(file);continue;}if(entry.name==='.gitkeep')continue;
  assert.equal(hash(packaged(`dist/${file}`)),hash(await fs.readFile(path.join(root,'public',file))),`Packaged asset mismatch: ${file}`);assetCount++;if(file.endsWith('.glb'))modelCount++;
 }
}
await verifyAssets();
const entries=listPackage(archive).map(name=>name.replaceAll('\\','/'));assert(!entries.some(name=>/^\/(?:assets-source|tools|output|src)\//.test(name)));
const artifacts=[];
const name=`Naiwa-${expected}-Setup-x64.exe`,data=await fs.readFile(path.join(release,name));
assert(data.length>1e6);assert.equal(data.subarray(0,2).toString(),'MZ');artifacts.push({name,bytes:data.length,sha256:hash(data)});
const report={version:manifest.version,assetCount,modelCount,allPublicAssetsMatch:true,assemblyPersistence:true,sourceFilesExcluded:true,artifacts};
await fs.writeFile(path.join(root,'output',`release-${expected}-verification.json`),JSON.stringify(report,null,2));
await fs.writeFile(path.join(release,'SHA256SUMS.txt'),artifacts.map(item=>`${item.sha256}  ${item.name}`).join('\r\n')+'\r\n');
console.log('RELEASE_VERIFIED',JSON.stringify(report));
