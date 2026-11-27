import {retreatHopPose} from './enemy-move.js';
import {skipActorShadows} from './actor-shadows.js';
import {createFlames} from './flame-view.js';
import {createRiggedEnemy,hasEnemyModel} from './enemy-models.js';
import {createMonsterEffects} from './monster-effects.js';
import * as THREE from 'three';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const material=(color,metalness=.1)=>new THREE.MeshStandardMaterial({color,roughness:.6,metalness});
function mesh(parent,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=false;skipActorShadows(mat);parent.add(m);return m;}
function joint(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function rod(parent,a,b,r,mat){const first=new THREE.Vector3(...a),last=new THREE.Vector3(...b),delta=last.sub(first);const m=mesh(parent,new THREE.CylinderGeometry(r,r,delta.length(),6),mat);m.position.copy(first).addScaledVector(delta,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
function buildShellbug(){
 const root=new THREE.Group(),blue=material('#386c7f',.4),dark=material('#233943'),edge=material('#78bdc2'),ivory=material('#e1d8b4');
 const shell=mesh(root,new THREE.SphereGeometry(1,18,12),blue,0,.43,-.08);shell.scale.set(.56,.34,.68);
 const head=mesh(root,new THREE.SphereGeometry(.25,12,8),dark,0,.32,.51);head.scale.set(1,.7,1);
 for(const side of [-1,1]){
  mesh(root,new THREE.SphereGeometry(.042,8,6),new THREE.MeshBasicMaterial({color:'#ffca67'}),side*.13,.4,.70);
  const horn=mesh(root,new THREE.ConeGeometry(.09,.37,7),ivory,side*.18,.32,.81);horn.rotation.x=Math.PI/2;
 }
 const legs=[];
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const leg=joint(root,side*.39,.32,(i-1)*.38);rod(leg,[0,0,0],[side*.31,-.03,.08],.045,edge);rod(leg,[side*.31,-.03,.08],[side*.44,-.29,.13],.035,dark);legs.push({part:leg,phase:i*Math.PI*.7+(side===1?Math.PI:0)});
 }
 for(let i=0;i<5;i++){const spike=mesh(root,new THREE.ConeGeometry(.055,.10,6),edge,0,.50-Math.abs(i-2)*.035,(i-2)*.19);spike.rotation.x=(i-2)*.12;}
 shell.scale.y=.24;shell.position.y=.30;head.position.y=.25;
 return {root,mats:[blue,dark,edge,ivory],animate(e,time,prep,strike,recover){const spiny=e.move?.motion==='spikes',w=1-recover;root.rotation.x=spiny?0:(-.12*prep+.15*strike)*w;for(const {part,phase} of legs)part.rotation.y=e.moving?.25*Math.sin(time*14+phase):0;shell.scale.y=.24*(1+.04*Math.sin(time*5)*prep);}};
}
function buildLantern(){
 const root=new THREE.Group(),metal=material('#426c85',.5),aqua=material('#80cce4'),coreMat=new THREE.MeshStandardMaterial({color:'#fae1a1',emissive:'#ffbb4a',emissiveIntensity:1,roughness:.3});
 const glass=mesh(root,new THREE.SphereGeometry(.34,16,12),new THREE.MeshStandardMaterial({color:'#9be1ed',transparent:true,opacity:.2,roughness:.2,depthWrite:false}),0,.55,0);
 const core=mesh(root,new THREE.OctahedronGeometry(.18),coreMat,0,.55,0);
 for(const y of [.24,.85]){const ring=mesh(root,new THREE.TorusGeometry(.25,.035,6,20),metal,0,y,0);ring.rotation.x=Math.PI/2;}
 for(let i=0;i<4;i++){const angle=i*Math.PI/2;rod(root,[Math.sin(angle)*.21,.25,Math.cos(angle)*.21],[Math.sin(angle)*.21,.85,Math.cos(angle)*.21],.025,aqua);}
 mesh(root,new THREE.ConeGeometry(.28,.18,8),metal,0,.97,0);
 const tails=[];for(let i=0;i<4;i++){const a=i*Math.PI/2,t=joint(root,Math.sin(a)*.16,.23,Math.cos(a)*.16);rod(t,[0,0,0],[Math.sin(a)*.12,-.20,Math.cos(a)*.12],.018,aqua);tails.push(t);}
 return {root,mats:[metal,aqua],animate(e,time,prep,strike,recover){const buff=e.move?.kind==='buff',ranged=e.move?.kind==='projectile';root.position.y+=.045*Math.sin(time*3);core.rotation.y=time*(buff?4:1.6);core.scale.setScalar(1+prep*(buff?.8:.5));coreMat.emissive.set(buff?'#ffe36a':'#ffbb4a');coreMat.emissiveIntensity=1+prep*(buff?3:1.5);glass.scale.setScalar(1+prep*.12);for(let i=0;i<tails.length;i++)tails[i].rotation.z=(buff?.4:.18)*Math.sin(time*4+i);}};
}
function buildSpitter(){
 const root=new THREE.Group(),skin=material('#a96145'),cream=material('#e7b47f'),dark=material('#463c50'),crystal=new THREE.MeshStandardMaterial({color:'#e75f73',emissive:'#d73455',emissiveIntensity:.7});
 const torso=mesh(root,new THREE.SphereGeometry(1,14,10),skin,0,.57,-.04);torso.scale.set(.4,.37,.53);
 const head=joint(root,0,.86,.28);const skull=mesh(head,new THREE.SphereGeometry(.28,12,8),skin);skull.scale.set(1,.8,1.2);
 const muzzle=mesh(head,new THREE.ConeGeometry(.19,.37,8),cream,0,-.07,.30);muzzle.rotation.x=Math.PI/2;
 const jaw=joint(head,0,-.14,.1);const lower=mesh(jaw,new THREE.BoxGeometry(.25,.06,.33),dark,0,0,.15);
 for(const side of [-1,1]){
  mesh(head,new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:'#c8e4a0'}),side*.21,.06,.18);
  rod(head,[side*.16,0,.15],[side*.38,.14,.34],.045,crystal);
 }
 const tail=joint(root,0,.5,-.42);const shaft=mesh(tail,new THREE.ConeGeometry(.22,.95,8),skin,0,-.03,-.37);shaft.rotation.x=-Math.PI/2;
 for(let i=0;i<3;i++)mesh(root,new THREE.ConeGeometry(.09,.24,5),crystal,0,.96-i*.04,-.1-i*.22);
 const legs=[];for(const side of [-1,1])for(const z of [-.3,.28]){
  const leg=joint(root,side*.26,.45,z);rod(leg,[0,0,0],[side*.25,-.12,.07],.07,skin);rod(leg,[side*.25,-.12,.07],[side*.28,-.41,.16],.045,dark);legs.push(leg);
 }
 return {root,mats:[skin,cream,dark],animate(e,time,prep,strike,recover){
  const w=1-recover,swipe=e.move?.motion==='tail-sweep';root.rotation.x=e.move?.retreat?-.17*prep*w:.07*prep*w;
  head.rotation.x=-.18*prep*w;jaw.rotation.x=e.move?.kind==='movement'?0:(.1+.55*prep-.5*strike)*w;
  tail.rotation.y=swipe?(-1.3*prep+2.6*strike)*w:.14*Math.sin(time*4);
  crystal.emissiveIntensity=.6+(e.move?.kind==='movement'?0:prep*1.8*w);for(let i=0;i<legs.length;i++)legs[i].rotation.x=e.moving?.4*Math.sin(time*12+i*Math.PI*.7):0;
 }};
}
function buildMirrorGuard(){
 const root=new THREE.Group(),steel=material('#647e98',.65),dark=material('#303a58'),cloth=material('#785b8d'),rim=material('#d1dce2',.6),glass=new THREE.MeshStandardMaterial({color:'#71d4e7',metalness:.8,roughness:.18,emissive:'#246b85',emissiveIntensity:.3});
 const body=mesh(root,new THREE.ConeGeometry(.34,.75,6),cloth,0,.83,0);body.rotation.y=Math.PI/6;
 mesh(root,new THREE.BoxGeometry(.44,.40,.28),steel,0,1.13,0);mesh(root,new THREE.OctahedronGeometry(.23),steel,0,1.5,0);
 mesh(root,new THREE.BoxGeometry(.22,.05,.055),glass,0,1.52,.19);
 const feet=[];for(const side of [-1,1]){const leg=joint(root,side*.15,.60,0);rod(leg,[0,0,0],[0,-.5,0],.07,dark);mesh(leg,new THREE.BoxGeometry(.18,.12,.3),steel,0,-.52,.06);feet.push(leg);}
 const shieldArm=joint(root,.32,1.23,0);rod(shieldArm,[0,0,0],[.12,-.26,.12],.065,steel);
 const shield=joint(shieldArm,.14,-.20,.22);const edge=mesh(shield,new THREE.CylinderGeometry(.37,.37,.09,8),rim);edge.rotation.x=Math.PI/2;
 const face=mesh(shield,new THREE.CylinderGeometry(.31,.31,.10,8),glass,0,0,.015);face.rotation.x=Math.PI/2;
 const bladeArm=joint(root,-.31,1.24,0);rod(bladeArm,[0,0,0],[-.05,-.38,.1],.055,steel);
 const blade=mesh(bladeArm,new THREE.ConeGeometry(.10,.61,3),rim,-.05,-.54,.13);blade.rotation.z=Math.PI;
 const halo=mesh(shield,new THREE.TorusGeometry(.42,.035,6,32),new THREE.MeshBasicMaterial({color:'#a5f4ff'}),0,0,.09);
 halo.name='mirror_parry_halo';shield.name='mirror_shield';shieldArm.name='mirror_shield_arm';
 return {root,mats:[steel,dark,cloth,rim],animate(e,time,prep,strike,recover){
  const w=1-recover,parry=e.move?.kind==='parry',throwing=e.move?.motion==='shield-throw';
  const success=time<(e.parryGlowUntil??-Infinity),feedback=success?smooth((time-(e.parryFeedbackStart??time))/Math.max(.01,e.parryFeedbackDuration??.35)):0;
  const push=success?Math.sin(Math.PI*feedback):0;
  const raised=parry&&e.state==='windup'?1:prep;
  shieldArm.rotation.set(THREE.MathUtils.lerp((-raised+(throwing?-1.1:0)*strike)*w,-1.15,push),0,-.1);
  shield.position.set(.14,-.20-.14*push,.22);
  bladeArm.rotation.set((-1.5*prep+2.1*strike)*w,e.move?.motion==='riposte'?(-.8*prep+1.6*strike)*w:0,.1);
  root.rotation.y=e.move?.motion==='riposte'?(-.25*prep+.65*strike)*w:0;
  halo.visible=Boolean(parry&&e.state==='windup'&&e.elapsed>=e.move.parryStart&&e.elapsed<=e.move.parryEnd||success);
  halo.material.color.set(success?'#ffd35a':'#a5f4ff');glass.color.set(success?'#e8c46a':'#71d4e7');glass.emissive.set(success?'#c38a21':'#246b85');
  halo.rotation.z=time*3;glass.emissiveIntensity=halo.visible?2:.3;shield.scale.setScalar(throwing?1-.65*strike*w:1);
  for(let i=0;i<feet.length;i++)feet[i].rotation.x=e.moving?.3*Math.sin(time*10+i*Math.PI):0;
 }};
}
function buildStonekeeper(){
 const root=new THREE.Group(),stone=material('#737d88',.2),dark=material('#3d4753'),rim=material('#aab5bc'),gold=new THREE.MeshStandardMaterial({color:'#d9a55b',emissive:'#835d21',emissiveIntensity:.5});
 mesh(root,new THREE.BoxGeometry(.87,.77,.61),stone,0,1.12,0);
 const head=mesh(root,new THREE.DodecahedronGeometry(.29,0),rim,0,1.82,0);head.scale.set(1,.9,.9);
 for(const side of [-1,1]){
  mesh(root,new THREE.BoxGeometry(.27,.14,.05),dark,side*.13,1.82,.25);
  mesh(root,new THREE.BoxGeometry(.10,.045,.055),gold,side*.13,1.84,.28);
  mesh(root,new THREE.DodecahedronGeometry(.24),stone,side*.57,1.4,0);
  mesh(root,new THREE.BoxGeometry(.33,.40,.33),dark,side*.29,.51,0);
  mesh(root,new THREE.BoxGeometry(.46,.22,.59),stone,side*.32,.14,.12);
 }
 rod(root,[-.22,.89,.322],[-.02,1.15,.322],.018,gold);rod(root,[-.02,1.15,.322],[.20,1.39,.322],.018,gold);
 const arm=joint(root,-.61,1.42,0);rod(arm,[0,0,0],[0,-.47,0],.13,dark);mesh(arm,new THREE.BoxGeometry(.28,.28,.28),rim,0,-.48,0);
 rod(arm,[0,-.46,.06],[0,-1.04,.06],.055,dark);mesh(arm,new THREE.BoxGeometry(.76,.37,.42),stone,0,-1.0,.06);
 for(const side of [-1,1])mesh(arm,new THREE.BoxGeometry(.065,.4,.44),rim,side*.31,-1.0,.06);
 const off=joint(root,.61,1.42,0);rod(off,[0,0,0],[0,-.43,0],.12,dark);mesh(off,new THREE.DodecahedronGeometry(.20),stone,0,-.48,0);
 return {root,mats:[stone,dark,rim],animate(e,time,prep,strike,recover){const weight=1-recover,sweep=e.move?.motion==='sweep',slam=e.move?.motion==='quake';arm.rotation.set((-.15-2.25*prep+2.9*strike)*weight,sweep?(-1.1*prep+2.3*strike)*weight:0,-.13);off.rotation.x=(e.move?.motion==='rock-throw'?(-2.5*prep+3*strike):slam?(-2*prep+2.5*strike):-.3*prep)*weight;root.rotation.x=(-.12*prep+.3*strike)*weight;root.rotation.y=sweep?(-.25*prep+.65*strike)*weight:0;root.position.y-=(slam?.18:.07)*strike*weight;}};
}
function buildScythemoth(){
 const root=new THREE.Group(),green=material('#719d61'),dark=material('#304e3d'),blade=material('#d6e4b4',.25),gold=material('#edca68');
 const torso=mesh(root,new THREE.CapsuleGeometry(.16,.55,5,10),green,0,1.15,-.03);torso.rotation.x=-.12;
 const abdomen=mesh(root,new THREE.ConeGeometry(.20,.5,8),dark,0,.86,-.27);abdomen.rotation.x=-.5;
 const head=mesh(root,new THREE.ConeGeometry(.28,.24,3),green,0,1.76,.06);head.rotation.z=Math.PI;head.rotation.y=Math.PI/2;
 for(const side of [-1,1]){
  mesh(root,new THREE.SphereGeometry(.085,10,7),gold,side*.20,1.77,.12);
  rod(root,[side*.09,1.85,.02],[side*.21,2.1,.03],.012,dark);
  for(let i=0;i<2;i++){const z=(i-.5)*.30;rod(root,[side*.12,.94,z],[side*.35,.49,z-.14],.035,green);rod(root,[side*.35,.49,z-.14],[side*.47,.04,z+.12],.025,dark);}
 }
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.33,-.12,.16,-.54);shape.quadraticCurveTo(.15,-.24,-.08,-.12);shape.lineTo(0,0);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:12}),arms=[];
 for(const side of [-1,1]){
  const arm=joint(root,side*.18,1.48,.06);rod(arm,[0,0,0],[side*.17,-.22,.17],.035,green);mesh(arm,geometry,blade,side*.17,-.20,.17).scale.x=side;arms.push(arm);
  rod(root,[side*.12,1.1,.1],[side*.24,.94,.27],.025,dark);
 }
 return {root,mats:[green,dark,blade,gold],animate(e,time,prep,strike,recover){const w=1-recover;for(let i=0;i<arms.length;i++){const active=['thrust','pounce'].includes(e.move?.motion)||e.move?.motion===(i===0?'cut-left':'cut-right');arms[i].rotation.set(active?(-1.4*prep+1.8*strike)*w:-.25,active?(i===0?1:-1)*(.5*prep-.85*strike)*w:0,(i===0?-.3:.3));}root.rotation.z=.09*Math.sin(time*5)*(e.moving?1:0);root.rotation.x=(e.move?.motion==='pounce'?.4:-.12)*strike*w;}};
}
function buildCinderWarden(){
 const root=new THREE.Group(),iron=material('#48423c',.65),bronze=material('#96754b',.5),dark=material('#2b3030'),ember=material('#d99148');
 // The boiler IS the torso: no human head, apron or separate backpack.
 mesh(root,new THREE.CylinderGeometry(.43,.48,.94,14),iron,0,1.0,0);
 for(const y of [.58,1.4])mesh(root,new THREE.TorusGeometry(.44,.045,6,24),bronze,0,y,0).rotation.x=Math.PI/2;
 mesh(root,new THREE.CylinderGeometry(.26,.42,.20,12),iron,0,1.56,0);mesh(root,new THREE.CylinderGeometry(.12,.16,.40,10),bronze,0,1.81,0);
 const door=joint(root,0,1.05,.43);mesh(door,new THREE.CylinderGeometry(.24,.24,.06,12),ember).rotation.x=Math.PI/2;
 for(let i=-1;i<=1;i++)mesh(door,new THREE.BoxGeometry(.027,.37,.08),iron,i*.10,0,.04);
 for(const side of [-1,1])mesh(root,new THREE.SphereGeometry(.035,8,6),ember,side*.15,1.34,.43);
 const chimney=createFlames(root,{count:8,radius:.09,height:.18});chimney.root.position.y=1.93;
 const legs=[];for(const side of [-1,1]){const leg=joint(root,side*.24,.56,0);rod(leg,[0,0,0],[side*.06,-.4,.02],.09,dark);mesh(leg,new THREE.BoxGeometry(.25,.16,.36),iron,side*.06,-.46,.08);legs.push(leg);}
 const arm=joint(root,-.48,1.29,0);rod(arm,[0,0,0],[0,-.34,.15],.075,bronze);const tongs=joint(arm,0,-.34,.15);
 // Twin articulated jaws, not the old shovel blade.
 for(const side of [-1,1]){rod(tongs,[side*.055,0,-.15],[side*.07,0,.95],.022,iron);rod(tongs,[side*.07,0,.95],[side*.15,0,1.18],.025,bronze);rod(tongs,[side*.15,0,1.18],[side*.04,0,1.32],.026,bronze);}
 const off=joint(root,.48,1.29,0);rod(off,[0,0,0],[.12,-.38,.08],.075,bronze);
 return {root,mats:[iron,bronze,dark],animate(e,time,prep,strike,recover){
  const w=1-recover,sweep=e.move?.motion==='tongs-sweep',thrust=e.move?.motion==='tongs-thrust',slam=e.move?.motion==='tongs-slam',head=e.move?.motion==='boiler-headbutt',breath=e.move?.motion==='furnace-breath'&&e.state==='windup',casting=e.move?.motion==='ignite-ring'&&['windup','recover'].includes(e.state);
  arm.rotation.set(slam?(-1.5*prep+2.3*strike)*w:thrust?(-.35*prep+.65*strike)*w:sweep?(-.55*prep+.6*strike)*w:.08,sweep?(-1.1*prep+2*strike)*w:0,casting?-.65*prep*w:0);off.rotation.z=casting?.65*prep*w:0;
  root.rotation.x=e.move?.motion==='boiler-retreat'?-.18*Math.sin(Math.PI*Math.min(1,e.elapsed/.16)):breath?.08:head?(-.18*prep+.65*strike)*w:slam?.2*strike*w:thrust?.16*strike*w:0;
  root.position.y=head?-.12*strike*w:0;
  legs.forEach((leg,i)=>leg.rotation.x=e.moving?Math.sin(time*5+i*Math.PI)*.28:0);
  chimney.update(e.health>0&&!e.effects.has('cooling'),time,breath||casting?.75:.32);door.children[0].material.emissive.set('#bb4819');door.children[0].material.emissiveIntensity=breath?.3+.5*prep:casting?.6*prep:.12;
 }};
}
const proceduralModels={
 cinderWarden:buildCinderWarden,shellbug:buildShellbug,lantern:buildLantern,
 spitter:buildSpitter,mirrorGuard:buildMirrorGuard,stonekeeper:buildStonekeeper,scythemoth:buildScythemoth,
};

export function createMonsterVisuals(parent){
 const entries=Object.create(null), effects=new Map();
 let current;
 function resolve(stats){
  const rigged=hasEnemyModel(stats.model),id=rigged?stats.model:stats.visual;
  if(!id)return null;
  let entry=entries[id];
  if(entry?.rigged===rigged)return entry;
  const next=rigged?createRiggedEnemy(id):proceduralModels[id]?.();
  if(!next)return null;
  next.rigged=rigged;
  if(!rigged)next.root.name=id;
  const fx=effects.get(id)??createMonsterEffects(id);
  effects.set(id,fx);
  entry?.root.removeFromParent();
  next.root.add(fx.root);
  parent.add(next.root);
  entries[id]=next;
  return next;
 }
 return {entries,update(battle){
  const e=battle.enemy,entry=resolve(battle.enemyStats);
  if(current!==entry){
   if(current)current.root.visible=false;
   current=entry;
   if(current)current.root.visible=true;
  }
  if(!entry)return false;
  const root=entry.root;
  root.position.set(0,e.height??0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);
  const prep=e.state==='windup'?smooth(e.elapsed/Math.max(.01,e.telegraph)):e.state==='recover'?1:0;
  const strike=e.state==='windup'?smooth((e.elapsed-e.telegraph)/Math.max(.01,e.swingDuration)):e.state==='recover'?1:0;
  const recover=e.state==='recover'?smooth(e.elapsed/Math.min(.5,e.recovery)):0;
  const hop=retreatHopPose(e);
  if(hop){
   root.position.y+=hop.lift;
   root.scale.y-=hop.compression;
  }
  entry.animate(e,battle.enemyTime,prep,strike,recover,hop);
  for(const mat of entry.mats){mat.emissive.set('#eee4b1');mat.emissiveIntensity=Math.min(.7,e.flash*4);}
  effects.get(entry.rigged?battle.enemyStats.model:battle.enemyStats.visual)
    .animate(e,battle.enemyTime,prep,strike,recover,entry.model,battle.rainZone);
  if(e.state==='dazed')root.rotation.z=.06*Math.sin(battle.enemyTime*9);
  if(e.state==='dead'&&!entry.rigged)root.rotation.z=-1.25;
  if(e.throwVisual&&['thrown','down','rising'].includes(e.state)){
   const u=e.state==='rising'?smooth(1-(e.riseUntil-battle.enemyTime)/e.riseDuration):0,p=e.throwVisual,centerHeight=battle.enemyStats.bodyHeight*.5,pitch=p.pitch*(1-u),center=p.center+(centerHeight-p.center)*u;
   root.rotation.set(pitch,0,0);root.position.set(0,center-Math.cos(pitch)*centerHeight,-Math.sin(pitch)*centerHeight);
  }
  return true;
 }};
}
