import {createBoilerRoom} from './boiler-room.js';
import {createReedField} from './reed-field.js';
import {createStonePlatform} from './stone-platform.js';
import * as THREE from 'three';
export const BOSS_ARENA_RADIUS=11;
/** Shared runtime geometry; no browser-only asset URLs or native packaging hooks. */
export function createArenaView(scene,ground,grid,doc=globalThis.document){
  const boiler=createBoilerRoom(scene,doc);
  const stonePlatform=createStonePlatform(scene);
  const reedField=createReedField(scene);
  const group=new THREE.Group();group.name='samurai 独立训练场';group.visible=false;scene.add(group);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(11.3,11.3,.18,96),new THREE.MeshStandardMaterial({color:'#444759',roughness:.9}));floor.position.y=-.075;floor.receiveShadow=true;group.add(floor);
  const gold=new THREE.MeshStandardMaterial({color:'#c0a879',metalness:.45,roughness:.65});
  for(const radius of [3,6,10.8]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,4,96),gold);ring.rotation.x=Math.PI/2;ring.position.y=.023;group.add(ring);}
  const stone=new THREE.MeshStandardMaterial({color:'#66717d',roughness:.74,metalness:.08});
  const trim=new THREE.MeshStandardMaterial({color:'#aaa28e',roughness:.55,metalness:.32});
  const dark=new THREE.MeshStandardMaterial({color:'#3c4754',roughness:.64,metalness:.22});
  const glass=new THREE.MeshStandardMaterial({color:'#e4b77a',emissive:'#d58d42',emissiveIntensity:.65,roughness:.36,metalness:.08});
  const anchors=Array.from({length:12},(_,i)=>({angle:i*Math.PI/6,x:Math.sin(i*Math.PI/6)*12.3,z:Math.cos(i*Math.PI/6)*12.3}));
  const profile=points=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),32);
  const columnParts=[];
  function instances(name,geometry,material,y=0,offsetX=0,offsetZ=0,collision=false){
    const mesh=new THREE.InstancedMesh(geometry,material,anchors.length);mesh.name=name;mesh.userData.cameraFadeGroup='arena-pillars';mesh.userData.cameraCollision=collision;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
    for(let i=0;i<anchors.length;i++){const a=anchors[i];q.setFromAxisAngle(new THREE.Vector3(0,1,0),a.angle);position.set(a.x+offsetX*Math.cos(a.angle)+offsetZ*Math.sin(a.angle),y,a.z-offsetX*Math.sin(a.angle)+offsetZ*Math.cos(a.angle));matrix.compose(position,q,scale);mesh.setMatrixAt(i,matrix);}
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);columnParts.push(mesh);return mesh;
  }
  instances('柱座 · 倒角石基',profile([[0,0],[.50,0],[.56,.06],[.56,.15],[.49,.22],[.44,.24],[0,.24]]),dark,0,0,0,true);
  instances('柱身 · 圆角石柱',profile([[0,.22],[.40,.22],[.43,.29],[.37,.36],[.33,.45],[.33,2.75],[.38,2.84],[.42,2.89],[.42,2.98],[0,2.98]]),stone,0,0,0,true);
  for(const y of [.36,2.78])instances('柱身金属束环',new THREE.TorusGeometry(.365,.025,8,32).rotateX(Math.PI/2),trim,y);
  instances('柱冠 · 承灯台',profile([[0,2.94],[.43,2.94],[.49,3.01],[.49,3.10],[.42,3.16],[0,3.16]]),dark);
  // Lanterns sit above the cap; their light cores never intersect the stone shaft.
  instances('灯座连接颈',new THREE.CylinderGeometry(.14,.18,.04,16),dark,3.18);
  instances('灯座',new THREE.CylinderGeometry(.22,.25,.08,8),trim,3.22);
  instances('琥珀灯芯',new THREE.CylinderGeometry(.125,.125,.28,8),glass,3.44);
  for(const x of [-.17,.17])for(const z of [-.17,.17])instances('灯架',new THREE.BoxGeometry(.025,.34,.025),dark,3.44,x,z);
  instances('灯檐',new THREE.CylinderGeometry(.08,.29,.15,8),dark,3.685);
  instances('灯顶饰',new THREE.SphereGeometry(.055,12,8),trim,3.79);
  const baseGround=ground.material.color.clone(),baseBackground=scene.background.clone(),baseFog=scene.fog.color.clone();
  const fogNear=scene.fog.near,fogFar=scene.fog.far,reedSky=new THREE.Color("#afb6a6");
  const arenaGround=new THREE.Color('#272c39'),arenaSky=new THREE.Color('#9ba3b6'),stoneSky=new THREE.Color('#bab3a3');
  return {group,columnParts,boiler,stonePlatform,reedField,setMode(mode){
    const practice=mode==='practice',foundry=mode==='cinderWarden',stone=mode==='stonekeeper',reeds=mode==='samurai';
    reedField.root.visible=reeds;
    scene.fog.near=reeds?12:fogNear;
    scene.fog.far=reeds?40:fogFar;
    boiler.setMode(foundry);
    stonePlatform.visible=stone;
    ground.visible=!foundry&&!stone&&!reeds;
    group.visible=!practice&&!foundry&&!stone&&!reeds;
    grid.visible=practice;
    ground.material.color.copy(practice?baseGround:arenaGround);
    scene.background.copy(practice?baseBackground:reeds?reedSky:stone?stoneSky:arenaSky);
    scene.fog.color.copy(practice?baseFog:reeds?reedSky:stone?stoneSky:arenaSky);
  }};
}
