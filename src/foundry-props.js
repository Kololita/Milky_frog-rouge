import * as T from 'three';
import {loadModel} from './model-loading.js';
import {foundryMetal,foundryTexturesReady} from './foundry-art.js';
let loading;
const templates=new Map(),materials=new Map();
const definitions={Foundry_Bronze:['#a37548',.78,.32],Foundry_Iron:['#777b7d',.82,.36],Foundry_Machined:['#b8bdc0',.9,.24],Foundry_EnamelRed:['#982c1b',.48,.34],Foundry_Recess:['#24282b',.3,.65],Foundry_Firebrick:['#80614c',.05,.85],Foundry_SafetyGold:['#c28b29',.6,.4]};
export function loadFoundryProps(){
 return loading??=Promise.all([foundryTexturesReady(),...['valve','reservoir','feed','pendant','window','wall-lantern','control'].map(async id=>{
  if(templates.has(id))return;
  const gltf=await loadModel(`/models/environment/foundry-${id}.glb?v=2`);
  templates.set(id,gltf.scene);
 })]).catch(error=>{loading=null;throw error;});
}
export function cloneFoundryProp(id){
 const template=templates.get(id);if(!template)throw Error(`Foundry prop not preloaded: ${id}`);
 const model=template.clone(true);model.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;
 const original=o.material,name=original.name,d=definitions[name];if(!d)return;
 if(!materials.has(name)){const m=foundryMetal(d[0],3);m.name=name;m.metalness=d[1];m.roughness=d[2];if(name==='Foundry_Firebrick')m.bumpScale=.025;materials.set(name,m);}
 o.material=materials.get(name);
 });return model;
}
