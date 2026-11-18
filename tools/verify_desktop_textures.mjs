import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {verifyModelTextures} from '../src/assets.js';
const require=createRequire(import.meta.url);
const {contentSecurityPolicy}=require('../desktop/security.cjs');
const data=await fs.readFile(new URL('../public/models/characters/frog.glb',import.meta.url));
const nativeFetch=globalThis.fetch;globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const png=Buffer.from(await blob.arrayBuffer());assert(png.subarray(1,4).toString()==='PNG');return {width:png.readUInt32BE(16),height:png.readUInt32BE(20),close(){}};};
async function loadWithPolicy(policy){
 let requests=0;
 const connection=policy.split(';').find(d=>d.trim().startsWith('connect-src'))??'';
 globalThis.fetch=(url,...args)=>{
  if(String(url).startsWith('blob:')){requests++;if(!connection.split(/\s+/).includes('blob:'))return Promise.reject(new Error('CSP blocked embedded texture blob fetch'));}
  return nativeFetch(url,...args);
 };
 try{const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');return {model:gltf.scene,requests};}
 finally{globalThis.fetch=nativeFetch;}
}
const old=await loadWithPolicy(contentSecurityPolicy.replace("connect-src 'self' blob:","connect-src 'self'"));
assert.throws(()=>verifyModelTextures(old.model),/贴图未加载/);
const fixed=await loadWithPolicy(contentSecurityPolicy);assert(fixed.requests>0);verifyModelTextures(fixed.model);
const maps=[];fixed.model.traverse(object=>{if(object.isMesh&&object.material.map)maps.push({mesh:object.name,material:object.material.name,width:object.material.map.image.width,height:object.material.map.image.height});});
assert(maps.some(m=>m.material==='Original frog baked colors'));assert(maps.some(m=>m.material==='Frog smooth hand colors'));
await fs.writeFile(new URL('../output/desktop-texture-verification.json',import.meta.url),JSON.stringify({oldPolicyReproducesWhiteModel:true,embeddedTextureFetches:fixed.requests,maps},null,2));
console.log('DESKTOP_TEXTURES_VERIFIED',JSON.stringify({embeddedTextureFetches:fixed.requests,maps}));
