import {useGpuBillboard} from './gpu-billboard.js';
import * as THREE from 'three';
import {ATTACK_STATS} from './battle-values.js';
import {equipmentIconUrl} from './equipment.js';
import {SKILL_STATS} from './skills.js';

const outlines={
 fist:[[-.12,-.13],[-.17,0],[-.14,.12],[-.07,.16],[0,.14],[.07,.16],[.14,.11],[.15,-.02],[.09,-.13],[-.12,-.13]],
 palm:[[-.09,-.15],[-.15,-.02],[-.21,.05],[-.19,.11],[-.12,.08],[-.12,.25],[-.07,.27],[-.04,.10],[-.02,.32],[.03,.32],[.04,.10],[.09,.28],[.14,.26],[.12,.08],[.17,.20],[.21,.17],[.16,-.02],[.09,-.15],[-.09,-.15]],
};
export function skillIconOpacity(elapsed){
 const smooth=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
 return smooth(elapsed/.12)*(1-smooth((elapsed-.75)/.25));
}
export function createSkillEffects(scene,model,player,doc,actions){
 const effects=new THREE.Group();effects.name='长臂虚影';effects.userData.cameraOcclusion=false;scene.add(effects);
 const geometry=Object.fromEntries(Object.entries(outlines).map(([name,points])=>{
  const path=new THREE.CurvePath();
  for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1],0),new THREE.Vector3(...points[i],0)));
  return [name,new THREE.TubeGeometry(path,96,.018,6,false)];
 }));
 const hands=['handL','handR'].map(name=>model.getObjectByName(name));
 const reach={
  reachOrigin:{value:new THREE.Vector3()},
  reachDirection:{value:new THREE.Vector3()},
  reachDistance:{value:0},
 };
 const lines=hands.map(()=>{const line=new THREE.Mesh(geometry.fist,new THREE.MeshBasicMaterial({color:'#ffe354',transparent:true,opacity:.95,depthTest:false,depthWrite:false,toneMapped:false}));useGpuBillboard(line,reach);line.renderOrder=40;line.scale.setScalar(1.3);line.visible=false;effects.add(line);return line;});
 const energy=doc.getElementById?.('player-energy'),icons=new Map(),loader=new THREE.TextureLoader();
 const iconUniforms={iconMap:{value:null},iconAge:{value:0},screenSize:{value:new THREE.Vector2(1,1)}};
 const icon=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({
  uniforms:iconUniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:`
   uniform vec2 screenSize;
   varying vec2 iconUv;
   void main(){
    iconUv=(uv-.5)*(72./54.)+.5;
    vec4 anchor=projectionMatrix*modelViewMatrix*vec4(0.,0.,0.,1.);
    anchor.xy+=(position.xy*144.+vec2(0.,54.))*anchor.w/screenSize;
    gl_Position=anchor;
   }`,
  fragmentShader:`
   uniform sampler2D iconMap;
   uniform float iconAge;
   varying vec2 iconUv;
   float iconMask(vec2 p){
    if(any(lessThan(p,vec2(0.)))||any(greaterThan(p,vec2(1.))))return 0.;
    return texture2D(iconMap,p).a;
   }
   void main(){
    vec4 color=texture2D(iconMap,iconUv);
    color.a=iconMask(iconUv);
    float glow=0.;
    for(int i=0;i<8;i++){
     float a=float(i)*.78539816;
     vec2 offset=vec2(cos(a),sin(a))*.105;
     glow+=iconMask(iconUv+offset)*.045;
    }
    float alpha=color.a+glow*(1.-color.a);
    vec3 rgb=(color.rgb*color.a+vec3(1.,.77,.36)*glow*(1.-color.a))/max(.0001,alpha);
    float fade=smoothstep(0.,.12,iconAge)*(1.-smoothstep(.75,1.,iconAge));
    gl_FragColor=vec4(rgb,alpha*fade);
    #include <colorspace_fragment>
   }`,
 }));
 icon.name='技能激活图标';icon.frustumCulled=false;icon.renderOrder=41;icon.visible=false;effects.add(icon);
 icon.onBeforeRender=renderer=>{
  iconUniforms.screenSize.value.set(Math.max(1,renderer.domElement.clientWidth),Math.max(1,renderer.domElement.clientHeight));
 };
 const point=new THREE.Vector3();let iconUntil=0,liftUntil=0,owner;
 const saved=new Map(),restored=new Map(),targets=[];
 const clip=actions.Jump?.getClip();
 for(const name of ['upper_armR','forearmR','handR']){
  const bone=model.getObjectByName(name),track=clip?.tracks.find(t=>t.name===`${name}.quaternion`);
  if(bone&&track)targets.push([bone,new THREE.Quaternion().fromArray(track.createInterpolant().evaluate(clip.duration*.48))]);
 }
 function prepare(){for(const [bone,q] of saved)bone.quaternion.copy(q);saved.clear();}
 function clear(){prepare();iconUntil=liftUntil=0;for(const line of lines)line.visible=false;icon.visible=false;energy?.classList.remove('draining-skill');}
 return {lines,prepare,clear,cancelPose(){prepare();liftUntil=0;},
  async preload(renderer,budget){
   for(const id of Object.keys(SKILL_STATS)){
    const texture=await loader.loadAsync(equipmentIconUrl(id));
    texture.colorSpace=THREE.SRGBColorSpace;
    icons.set(id,texture);
    renderer.initTexture(texture);
    await budget.checkpoint();
   }
  },
  update(battle,camera,events,gesture,currentAction,allowLift=true){
   for(const event of events)if(event.type==='skillStarted'){
    iconUntil=battle.time+1;liftUntil=allowLift?battle.time+.22:0;owner=currentAction;
    if(!icons.has(event.id)){
     const texture=loader.load(equipmentIconUrl(event.id));
     texture.colorSpace=THREE.SRGBColorSpace;
     icons.set(event.id,texture);
    }
    iconUniforms.iconMap.value=icons.get(event.id);
   }
   const alive=battle.player.health>0;
   if(alive&&battle.time<liftUntil&&owner===currentAction){
    const weight=Math.min(1,(liftUntil-battle.time)/.12);
    for(const [bone,target] of targets){let q=restored.get(bone);if(!q){q=new THREE.Quaternion();restored.set(bone,q);}q.copy(bone.quaternion);saved.set(bone,q);bone.quaternion.slerp(target,weight);}
   }else liftUntil=0;
   icon.visible=alive&&battle.time<iconUntil;
   if(icon.visible){
    icon.position.copy(player.position);icon.position.y+=2;
    iconUniforms.iconAge.value=battle.time-(iconUntil-1);
   }
   energy?.classList.toggle('draining-skill',alive&&battle.time<battle.player.drainUntil);
   for(const line of lines)line.visible=false;
   const stats=ATTACK_STATS[gesture?.name];
   if(!alive||battle.time>=battle.player.longarmUntil||!stats||battle.backThrow)return;
   const time=gesture.action.time;
   let hit=-1,nearest=Infinity;
   for(let i=0;i<stats.times.length;i++){const distance=Math.abs(time-stats.times[i]);if(time>=stats.times[i]-.16&&time<=stats.times[i]+.24&&distance<nearest){hit=i;nearest=distance;}}
   if(hit<0)return;
   const palm=['Attack4','CounterWave','RunAttack'].includes(gesture.name),both=['RunAttack','AirAttack'].includes(gesture.name);
   const index=gesture.name==='Attack1'||gesture.name==='Attack3'&&hit%2===0?0:1;
   const heading=player.rotation.y,fx=Math.sin(heading),fz=Math.cos(heading),range=stats.range*battle.attackRangeMultiplier;
   reach.reachOrigin.value.copy(player.position);
   reach.reachDirection.value.set(fx,0,fz);
   reach.reachDistance.value=range;
   player.updateMatrixWorld(true);
   for(let i=0;i<lines.length;i++){
    if(!both&&i!==index||!hands[i])continue;
    hands[i].getWorldPosition(point);
    lines[i].position.copy(point);
    lines[i].geometry=palm?geometry.palm:geometry.fist;
    lines[i].material.opacity=Math.max(.45,.95*(1-Math.abs(time-stats.times[hit])/.32));lines[i].visible=true;
   }
  },
 };
}
