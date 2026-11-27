import * as THREE from 'three';

const vertexShader=`
 uniform float age;
 attribute float phase;
 void main(){
  float angle=phase*6.2831853+age*1.35;
  float height=fract(phase+age*.52);
  float radius=.56+sin(height*3.14159265)*.15;
  vec3 offset=vec3(cos(angle)*radius,height*1.46,sin(angle)*radius);
  vec4 viewPosition=modelViewMatrix*vec4(position+offset,1.);
  gl_Position=projectionMatrix*viewPosition;
  gl_PointSize=max(3.,22./max(1.,-viewPosition.z));
 }`;
const fragmentShader=`
 uniform vec3 tint;
 uniform float opacity;
 void main(){
  float radius=length(gl_PointCoord-.5);
  gl_FragColor=vec4(tint,opacity*(1.-smoothstep(.06,.5,radius)));
 }`;

export function createElementalAura(scene,player){
 const group=new THREE.Group();
 group.visible=false;
 player.add(group);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.64,.014,6,44),
  new THREE.MeshBasicMaterial({transparent:true,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;
 ring.position.y=.055;
 group.add(ring);
 const count=24,geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));
 geometry.setAttribute('phase',new THREE.Float32BufferAttribute(Array.from({length:count},(_,i)=>i/count),1));
 const uniforms={age:{value:0},tint:{value:new THREE.Color()},opacity:{value:0}};
 const motes=new THREE.Points(geometry,new THREE.ShaderMaterial({
  uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 }));
 motes.frustumCulled=false;
 group.add(motes);
 const stone=new THREE.Group();
 stone.name='earth-spike-ball';
 stone.userData.cameraOcclusion=false;
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.91,2),new THREE.MeshStandardMaterial({color:'#6b4937',roughness:.92,flatShading:true}));
 core.castShadow=true;stone.add(core);
 const spikes=new THREE.InstancedMesh(new THREE.ConeGeometry(.18,.39,5),new THREE.MeshStandardMaterial({color:'#a97b59',roughness:.89,flatShading:true}),30);
 const point=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D();
 for(let i=0;i<spikes.count;i++){
  const y=1-2*(i+.5)/spikes.count,angle=i*2.399963;
  const radius=Math.sqrt(1-y*y);
  point.set(Math.cos(angle)*radius,y,Math.sin(angle)*radius);
  dummy.position.copy(point).multiplyScalar(.85);
  dummy.quaternion.setFromUnitVectors(up,point);
  dummy.scale.setScalar(.75+(i%5)*.075);
  dummy.updateMatrix();spikes.setMatrixAt(i,dummy.matrix);
 }
 spikes.castShadow=true;stone.add(spikes);stone.visible=false;scene.add(stone);

 const shock=new THREE.Mesh(new THREE.RingGeometry(.94,1,96),new THREE.MeshBasicMaterial({color:'#ffe4a0',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
 shock.rotation.x=-Math.PI/2;shock.visible=false;scene.add(shock);
 const vine=new THREE.Group();
 const vineMaterial=new THREE.MeshStandardMaterial({color:'#75974e',roughness:.82});
 const leafMaterial=new THREE.MeshStandardMaterial({color:'#b5d67a',roughness:.69});
 const stem=[];
 for(let i=0;i<=42;i++){
  const t=i/42,angle=t*Math.PI*5,r=.83-t*.25;
  stem.push(new THREE.Vector3(Math.cos(angle)*r,.04+t*.85,Math.sin(angle)*r));
 }
 vine.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stem),42,.033,5),vineMaterial));
 const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),leafMaterial,14);
 for(let i=0;i<leaves.count;i++){
  const index=i*3+2;
  dummy.position.copy(stem[index]);
  dummy.rotation.set(.5,Math.atan2(dummy.position.x,dummy.position.z),i%2?.65:-.65);
  dummy.scale.set(.043,.135,.02);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
 }
 vine.add(leaves);vine.visible=false;scene.add(vine);
 const rollAxis=new THREE.Vector3(),rollRotation=new THREE.Quaternion();
 return {
  roll(dx,dz,radius){
   const distance=Math.hypot(dx,dz);
   if(distance<1e-8)return;
   rollAxis.set(dz/distance,0,-dx/distance);
   stone.quaternion.premultiply(rollRotation.setFromAxisAngle(rollAxis,distance/radius)).normalize();
  },
  update(effect,time,exit){
   const id=effect?.id;
   group.visible=id==='water';shock.visible=id==='metal';vine.visible=id==='wood'&&Boolean(effect.target);
   const stoneRadius=id==='earth'?effect.stats.radius:
    exit?.elapsed<exit?.stats.crumbleDuration?exit.stats.radius*(1-exit.elapsed/exit.stats.crumbleDuration):0;
   stone.visible=stoneRadius>0;
   if(stone.visible){
    stone.position.set(player.position.x,stoneRadius,player.position.z);
    stone.scale.setScalar(stoneRadius);
   }
   if(!stone.visible)stone.quaternion.identity();
   if(!effect)return;
   const age=Math.max(0,time-effect.start);
   if(id==='water'){
    const fade=Math.min(1,age*8,Math.max(0,(effect.until-time)*4));
    ring.material.color.set(effect.stats.accent);
    ring.material.opacity=fade*(.44+.13*Math.sin(age*5));
    uniforms.tint.value.copy(ring.material.color);uniforms.opacity.value=fade*.84;uniforms.age.value=age;
   }else if(id==='metal'){
    const t=Math.min(1,age/effect.stats.duration);
    shock.position.set(effect.x,.035,effect.z);shock.scale.setScalar(Math.max(.01,effect.stats.radius*(1-(1-t)**2)));
    shock.material.opacity=.93*(1-t);
   }else if(id==='wood'&&effect.target){
    const enemy=effect.target,scale=Math.max(.58,enemy.radius*1.25);
    vine.position.set(enemy.x,0,enemy.z);vine.rotation.y=age*.24;
    vine.scale.set(scale,Math.min(1,age*7)*Math.min(2,enemy.bodyHeight)*.7+.001,scale);
   }
  },
 };
}
