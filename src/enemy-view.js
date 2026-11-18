import {skipActorShadows} from './actor-shadows.js';
import {createGpuHealthBar} from './gpu-health-bar.js';
import {attackWarningRemaining,setBladeWarningTiming,warningPulseGLSL} from './attack-warning.js';
import * as THREE from 'three';
import {createImpactParticles} from './gpu-particles.js';
import {bossAnimationPose} from './boss-animation.js';
import {bossBladeWarning} from './samurai.js';
import {createMonsterVisuals} from './monster-visuals.js';
import {createBossGrip} from './boss-grip.js';
import {isDamagingMove} from './enemy-move.js';
export {createArenaView,BOSS_ARENA_RADIUS} from './arena-view.js';
export {createWaveView} from './wave-view.js';
export {createEnemyProjectileView} from './enemy-projectile-view.js';

/** A small training automaton made entirely from shared primitive geometry. */
function attackSector(color,opacity){
  const sector={value:new THREE.Vector2()};
  const timing={value:new THREE.Vector3(0,1,-1)};
  const profile={value:new THREE.Vector3(.15,.30,0)};
  const material=new THREE.MeshBasicMaterial({color,opacity,transparent:true,side:THREE.DoubleSide,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.sector=sector;
    shader.uniforms.warningTiming=timing;
    shader.uniforms.warningProfile=profile;
    shader.fragmentShader='uniform vec3 warningTiming, warningProfile;\n'+warningPulseGLSL+'\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float remaining=warningTiming.z-warningTiming.x;
      float pulse=warningPulse(remaining);
      float progress=min(1.,warningTiming.x/warningTiming.y);
      diffuseColor.rgb*=1.+.7*pulse;
      diffuseColor.a=min(1.,warningProfile.x+warningProfile.y*progress+
        warningProfile.z+.35*pulse);
    `);
    shader.vertexShader='uniform vec2 sector;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float u=float(gl_VertexID-1)/48.;
      float angle=(2.*u-1.)*sector.y;
      transformed=gl_VertexID==0?vec3(0.):vec3(sin(angle),0.,cos(angle))*sector.x;
    `);
  };
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,48),material);
  mesh.frustumCulled=false;
  return {mesh,set(move,enemy,duration,boss=false){
    sector.value.set(move.reach,move.halfAngle);
    const cue=enemy.move?.contactPhase!=null?enemy.hitAt:enemy.telegraph;
    timing.value.set(enemy.elapsed,Math.max(.001,duration),cue??-1e6);
    profile.value.set(boss ? .10 : .15,boss ? .28 : .30,boss&&enemy.elapsed>=enemy.telegraph ? .18 : 0);
  }};
}
export function createEnemyView(scene) {
  const group=new THREE.Group(),body=new THREE.Group();group.name='练习傀儡';group.userData.cameraOcclusion=false;group.add(body);scene.add(group);
  const shell=new THREE.MeshStandardMaterial({color:'#bc664d',roughness:.65,metalness:.1});
  const dark=new THREE.MeshStandardMaterial({color:'#36434a',roughness:.6,metalness:.25});
  const trim=new THREE.MeshStandardMaterial({color:'#f2c67a',roughness:.55,metalness:.2});
  const eye=new THREE.MeshStandardMaterial({color:'#f9efc8',emissive:'#d5ac55',emissiveIntensity:.3});
  const mesh=(geometry,material,parent,position)=>{
    const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.castShadow=true;m.receiveShadow=false;skipActorShadows(material);parent.add(m);return m;
  };
  mesh(new THREE.CapsuleGeometry(.29,.38,6,16),shell,body,[0,.83,0]);
  mesh(new THREE.SphereGeometry(.22,16,12),trim,body,[0,1.31,0]);
  mesh(new THREE.BoxGeometry(.31,.09,.09),dark,body,[0,1.32,.19]);
  const legs=[];
  for(const side of [-1,1]) {
    mesh(new THREE.SphereGeometry(.033,8,6),eye,body,[side*.082,1.32,.248]);
    const leg=new THREE.Group();leg.position.set(side*.17,.46,0);body.add(leg);legs.push(leg);
    mesh(new THREE.CylinderGeometry(.09,.10,.34,10),dark,leg,[0,-.19,0]);
    mesh(new THREE.BoxGeometry(.19,.11,.29),dark,leg,[0,-.395,.045]);
  }
  mesh(new THREE.TorusGeometry(.291,.035,6,24),trim,body,[0,.70,0]).rotation.x=Math.PI/2;
  const arms=[];
  for(const side of [-1,1]) {
    const shoulder=new THREE.Group();shoulder.position.set(side*.36,1.03,0);body.add(shoulder);
    mesh(new THREE.SphereGeometry(.105,10,8),dark,shoulder,[0,0,0]);
    mesh(new THREE.CapsuleGeometry(.075,.20,4,10),shell,shoulder,[0,-.16,0]);
    const elbow=new THREE.Group();elbow.position.y=-.30;shoulder.add(elbow);
    mesh(new THREE.CapsuleGeometry(.085,.12,4,10),trim,elbow,[0,-.12,0]);
    mesh(new THREE.SphereGeometry(.12,12,8),shell,elbow,[0,-.26,0]);
    arms.push({shoulder,elbow});
  }
  const basicSector=attackSector('#ec704d',.25),warning=basicSector.mesh;
  warning.position.y=.016;group.add(warning);
  const healthBar=createGpuHealthBar({width:.90,height:.10,fillWidth:.84,fillHeight:.055,background:'#37434a',color:'#e89174'});
  const health=healthBar.group;
  health.position.y=1.76;
  group.add(health);
  const dazeStars=new THREE.Group();dazeStars.name='晕眩星星';dazeStars.position.y=1.73;dazeStars.visible=false;group.add(dazeStars);
  const starShape=new THREE.Shape();
  for(let i=0;i<10;i++){const angle=Math.PI/2+i*Math.PI/5,r=i%2?.031:.074;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(i)starShape.lineTo(x,y);else starShape.moveTo(x,y);}
  starShape.closePath();
  const starGeometry=new THREE.ShapeGeometry(starShape),starMaterial=new THREE.MeshBasicMaterial({color:'#ffda65',side:THREE.DoubleSide});
  const starClock={value:0};
  starMaterial.onBeforeCompile=shader=>{
    shader.uniforms.starClock=starClock;
    shader.vertexShader='uniform float starClock;\n'+shader.vertexShader.replace('#include <project_vertex>',`
      float phase=starClock*7.+float(gl_InstanceID)*1.5707963;
      vec3 center=vec3(sin(phase)*.31,.018*cos(phase*2.),cos(phase)*.31);
      vec4 mvPosition=modelViewMatrix*vec4(center,1.);
      mvPosition.xy+=position.xy;
      gl_Position=projectionMatrix*mvPosition;
    `);
  };
  const stars=new THREE.InstancedMesh(starGeometry,starMaterial,4);
  stars.frustumCulled=false;
  dazeStars.add(stars);
  const impactParticles=createImpactParticles(scene);
  const bossArmor=new THREE.Group();bossArmor.name='samurai · 重甲';body.add(bossArmor);
  const armor=new THREE.MeshStandardMaterial({color:'#34324f',metalness:.65,roughness:.4});
  const bladeMaterial=new THREE.MeshStandardMaterial({color:'#529fff',emissive:'#1684ff',emissiveIntensity:.45,metalness:.7,roughness:.3});
  mesh(new THREE.BoxGeometry(.68,.40,.43),armor,bossArmor,[0,1.06,0]);
  mesh(new THREE.ConeGeometry(.27,.29,5),armor,bossArmor,[0,1.57,0]);
  for(const side of [-1,1])mesh(new THREE.OctahedronGeometry(.18),armor,bossArmor,[side*.39,1.16,0]);
  const sword=mesh(new THREE.BoxGeometry(.11,.80,.055),bladeMaterial,arms[0].elbow,[0,-.57,.05]);
  sword.name='samurai剑';
  const swordRestPosition=sword.position.clone(),swordRestRotation=sword.quaternion.clone();
  const swordPosition=new THREE.Vector3(),swordRotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),plantedRotation=new THREE.Quaternion();
  let plantedAnchor=null;
  mesh(new THREE.BoxGeometry(.32,.055,.11),goldMaterial(),sword,[0,.39,0]);
  mesh(new THREE.CylinderGeometry(.04,.04,.28,10),dark,sword,[0,.55,0]);
  const supportGrip=createBossGrip(arms[1].shoulder,arms[1].elbow,sword);
  function goldMaterial(){return new THREE.MeshStandardMaterial({color:'#c6a36a',metalness:.7,roughness:.4});}
  const bossSector=attackSector('#e6a556',.22),bossWarning=bossSector.mesh;
  bossWarning.position.y=.027;group.add(bossWarning);
  const empowered=new THREE.Mesh(new THREE.TorusGeometry(.55,.022,6,40),new THREE.MeshBasicMaterial({color:'#ffcd57',transparent:true,opacity:.75,depthWrite:false}));
  empowered.rotation.x=-Math.PI/2;empowered.position.y=.08;group.add(empowered);
  const monsterVisuals=createMonsterVisuals(group);
  const baseColor=new THREE.Color('#bc664d'),white=new THREE.Color('#fff0cf'),bossColor=new THREE.Color('#6b567d'),phaseColor=new THREE.Color('#912f40');
  function updateFallbackPose(battle,e,boss,dead) {
      sword.position.copy(swordRestPosition);sword.quaternion.copy(swordRestRotation);
      const twoHanded=bossHeavyActive(e);
      const gripWeight=twoHanded?Math.max(0,Math.min(1,e.state==='windup'?e.elapsed/Math.max(.001,e.telegraph*.16):1-Math.max(0,(e.elapsed/e.recovery-.7)/.3))):0;
      sword.position.y-=.2*gripWeight;
      const red=bossBladeWarning(e);bladeMaterial.color.set(red?'#ff3939':'#529fff');bladeMaterial.emissive.set(red?'#ff1010':'#1684ff');bladeMaterial.emissiveIntensity=red?2:.45;setBladeWarningTiming(bladeMaterial,attackWarningRemaining(e));
      bossArmor.visible=boss||battle.encounter.kind==='elite';sword.visible=boss;body.scale.setScalar(boss?1.35:1);
      const moving=e.state==='chase'||e.state==='circle'||(!boss&&e.state==='recover'&&e.moving),wind=e.state==='windup'?Math.min(1,e.elapsed/(e.telegraph??battle.enemyStats.windup)):0;
      const swing=e.state==='recover'?Math.max(0,1-e.elapsed/.3):0;
      body.position.set(0,moving?.018*Math.sin(battle.enemyTime*13):0,0);
      for(let i=0;i<legs.length;i++)legs[i].rotation.x=moving?.35*Math.sin(battle.enemyTime*10+i*Math.PI):0;
      body.rotation.z=dead?Math.min(.9,e.elapsed*4):e.state==='hurt'?-.12*Math.sin(e.elapsed*18):0;
      body.rotation.x=e.state==='knockback'?-.28:e.state==='windup'?-.12*wind:.16*swing;
      body.scale.setScalar((boss?1.35:1)*(dead?Math.max(.05,1-e.elapsed/battle.enemyStats.respawn):1));
      if(battle.enemyStats.color)baseColor.set(battle.enemyStats.color);else baseColor.set('#bc664d');
      shell.color.copy(boss?(e.phase===2?phaseColor:bossColor):baseColor).lerp(white,Math.min(1,e.flash/.12));
      for(let i=0;i<arms.length;i++) {
        const {shoulder,elbow}=arms[i];
        shoulder.rotation.y=0;
        shoulder.rotation.z=(i===0?-.15:.15);
        shoulder.rotation.x=moving?Math.sin(battle.enemyTime*10+i*Math.PI)*.3:0;
        elbow.rotation.x=-.45;
        if(i===0){shoulder.rotation.x+=wind*.25-swing*1.65;elbow.rotation.x-=wind*.85-swing*.35;}
      }
      body.rotation.y=0;
      if(e.isMob&&e.move&&!battle.enemyStats.visual&&['windup','recover'].includes(e.state)){
        const prep=e.state==='windup'?Math.min(1,e.elapsed/e.telegraph):1;
        const cut=e.state==='windup'?Math.max(0,Math.min(1,(e.elapsed-e.telegraph)/e.swingDuration)):1;
        const weight=e.state==='recover'?Math.max(0,1-e.elapsed/.4):1;
        const motion=e.move.motion,hook=motion==='hook'||motion==='low-hook';
        body.rotation.y=(hook?-.45*prep+.9*cut:-.12*prep+.25*cut)*weight;
        body.position.y-=motion==='low-hook'?.27*prep*weight:0;
        if(motion==='shoulder')body.rotation.x=(-.18*prep+.55*cut)*weight;
        for(let i=0;i<arms.length;i++){
          const active=motion==='double-punch'||i===(hook?1:0);
          if(!active)continue;
          arms[i].shoulder.rotation.set((-.45*prep-1.25*cut)*weight,hook?(i?1:-1)*(.85*prep-1.6*cut)*weight:0,(i?1:-1)*.2);
          arms[i].elbow.rotation.x=(-1.25*prep+1.05*cut)*weight;
        }
        body.rotation.x=(-.12*prep+.28*cut)*weight;
      }
      if(boss&&!dead&&!['hurt','knockback','dazed','thrown','down','rising'].includes(e.state)){
        const pose=bossAnimationPose(e);arms[0].shoulder.rotation.set(pose.armX,pose.armY,pose.armZ);arms[0].elbow.rotation.x=pose.elbowX;
        body.rotation.set(pose.torsoX,pose.torsoY,pose.torsoZ);body.position.y+=pose.height;
        arms[1].shoulder.rotation.set(pose.offArmX,0,pose.offArmZ);arms[1].elbow.rotation.x=pose.offElbowX;
        if(moving)for(let i=0;i<arms.length;i++)arms[i].shoulder.rotation.x+=.12*Math.sin(battle.enemyTime*10+i*Math.PI);
      }
      if(!dead&&e.throwVisual&&['thrown','down','rising'].includes(e.state)){
        const p=e.throwVisual,u=e.state==='rising'?Math.max(0,Math.min(1,1-(e.riseUntil-battle.enemyTime)/e.riseDuration)):0;
        const ease=u*u*(3-2*u),pitch=p.pitch*(1-ease),center=p.center+((boss?1.35:1)*.83-p.center)*ease;
        const offset=(boss?1.35:1)*.83;
        body.rotation.set(pitch,0,0);body.position.set(0,center-Math.cos(pitch)*offset,-Math.sin(pitch)*offset);
        for(let i=0;i<arms.length;i++){arms[i].shoulder.rotation.set(-.4,0,i===0?-.4:.4);arms[i].elbow.rotation.x=-.8;}
      }
      if(boss&&e.state==='recover'&&e.extracting){
        group.updateMatrixWorld(true);sword.getWorldPosition(swordPosition);sword.getWorldQuaternion(swordRotation);
        if(!plantedAnchor){plantedAnchor=swordPosition.clone();plantedAnchor.y=.40*1.35-.035;}
        const u=Math.max(0,Math.min(1,(e.elapsed/e.recovery-.7)/.3)),release=u*u*(3-2*u);
        swordPosition.lerpVectors(plantedAnchor,swordPosition,release);
        sword.parent.worldToLocal(swordPosition);sword.position.copy(swordPosition);
        sword.parent.getWorldQuaternion(parentRotation).invert();
        plantedRotation.identity().slerp(swordRotation,release);sword.quaternion.copy(parentRotation.multiply(plantedRotation));
      }else plantedAnchor=null;
      if(twoHanded)supportGrip(gripWeight);
  }
  return {group,body,warning,health,dazeStars,impactParticles,sword,arms,monsterVisuals,
    update(battle,camera,dt,events=[]) {
      impactParticles.update(dt,events);
      const e=battle.enemy,dead=e.state==='dead';group.visible=battle.enabled;
      empowered.visible=!dead&&e.effects.has('damageIncrease');
      empowered.scale.setScalar((e.radius+.15)/.55*(1+.05*Math.sin(battle.enemyTime*5)));
      empowered.material.opacity=.55+.2*Math.sin(battle.enemyTime*6);
      const boss=battle.enemyStats.visual==='samurai';
      group.position.set(e.x,0,e.z);
      group.rotation.y=e.heading;
      body.visible=!monsterVisuals.update(battle);
      if(body.visible)updateFallbackPose(battle,e,boss,dead);
      else plantedAnchor=null;
      bossWarning.visible=boss&&e.state==='windup'&&!e.hitResolved;
      if(bossWarning.visible){
        bossSector.set(e.move,e,e.hitAt??e.windup,true);
        bossWarning.material.color.set(e.move.windup<.8?'#a6e6f1':'#f39b4a');
      }
      const attack=e.move??battle.enemyStats;
      const canWarn=isDamagingMove(attack)&&!attack.projectile&&Number.isFinite(attack.reach)&&Number.isFinite(attack.halfAngle);
      if(canWarn)basicSector.set(attack,e,e.telegraph??battle.enemyStats.windup);
      warning.visible=!boss&&e.state==='windup'&&canWarn;
      health.visible=!dead;
      healthBar.setFraction(e.health/e.maxHealth);
      dazeStars.visible=e.state==='dazed'&&!dead;
      health.position.y=(e.uiHeight??1.76)+(dazeStars.visible?.29:0);dazeStars.position.y=(e.uiHeight??1.76)-.03;
      if(dazeStars.visible)starClock.value=battle.enemyTime;
    },
  };
}
function bossHeavyActive(enemy){return enemy.move?.motion==='buried-overhead'&&(enemy.state==='windup'||enemy.state==='recover'&&enemy.extracting);}
