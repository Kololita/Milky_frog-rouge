import * as THREE from 'three';
import {electricChainStage} from './elemental-ultimates.js';

const rainVertex=`
 uniform float age;
 varying float depthFade;
 void main(){
  float y=5.8*fract(position.y-age*(1.45+.3*position.y));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position.x,y,position.z,1.);
  gl_PointSize=9.;
  depthFade=smoothstep(0.,.4,y)*(1.-smoothstep(4.8,5.8,y));
 }`;
const rainFragment=`
 varying float depthFade;
 void main(){
  vec2 p=gl_PointCoord-.5;
  float body=(1.-smoothstep(.035,.14,abs(p.x-p.y*.18)))*(1.-smoothstep(.23,.5,abs(p.y)));
  gl_FragColor=vec4(.65,.85,1.,body*depthFade*.62);
 }`;

export function createWeatherEffects(scene){
 const root=new THREE.Group();
 root.name='weather-ultimate-effects';
 root.userData.cameraOcclusion=false;
 scene.add(root);
 const blue=new THREE.Color('#a9d8ff');
 const edge=new THREE.Mesh(new THREE.RingGeometry(.988,1,80),new THREE.MeshBasicMaterial({
  color:blue,side:THREE.DoubleSide,transparent:true,depthWrite:false,opacity:.48,
 }));
 edge.rotation.x=-Math.PI/2;edge.visible=false;root.add(edge);
 const drops=new THREE.BufferGeometry(),points=[];
 for(let i=0;i<850;i++){
  const radius=Math.sqrt((i+.5)/850),angle=i*2.399963;
  points.push(radius*Math.cos(angle),((i*137)%853)/853,radius*Math.sin(angle));
 }
 drops.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 const rain=new THREE.Points(drops,new THREE.ShaderMaterial({
  vertexShader:rainVertex,fragmentShader:rainFragment,uniforms:{age:{value:0}},transparent:true,depthWrite:false,
 }));
 rain.frustumCulled=false;rain.visible=false;root.add(rain);
 const segments=10;
 const boltGeometry=new THREE.BufferGeometry();
 const positions=new THREE.BufferAttribute(new Float32Array(48*segments*2*3),3).setUsage(THREE.DynamicDrawUsage);
 boltGeometry.setAttribute('position',positions);
 const bolts=new THREE.LineSegments(boltGeometry,new THREE.LineBasicMaterial({
  color:'#f2e8ff',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
 }));
 bolts.frustumCulled=false;bolts.visible=false;root.add(bolts);
 const handLight=new THREE.Mesh(new THREE.IcosahedronGeometry(.095,1),new THREE.MeshBasicMaterial({
  color:'#d9d1ff',transparent:true,opacity:.83,depthWrite:false,blending:THREE.AdditiveBlending,
 }));
 handLight.visible=false;root.add(handLight);
 const chainTube=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,6),
  new THREE.MeshBasicMaterial({toneMapped:false}),positions.count/2);
 chainTube.frustumCulled=false;chainTube.visible=false;root.add(chainTube);
 const colors=['#ffffff','#ffe22d','#ff8c21','#ff3626'].map(value=>new THREE.Color(value));
 const chainColor=new THREE.Color(),boltWidth=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const tubePoint=new THREE.Object3D(),a=new THREE.Vector3(),b=new THREE.Vector3();
 const source=new THREE.Vector3(),destination=new THREE.Vector3();
 const start=new THREE.Vector3(),end=new THREE.Vector3(),last=new THREE.Vector3(),next=new THREE.Vector3();
 let strike=null,vertices=0;
 function addBolt(time,index,power=1){
  if(vertices+segments*2>positions.count)return;
  last.copy(start);
  for(let i=1;i<=segments;i++){
   next.copy(start).lerp(end,i/segments);
   if(i<segments){
    const phase=i*14.48+index*5.8+Math.floor(time*32)*2.83;
    next.x+=Math.sin(phase)*.14*power;next.y+=Math.cos(phase*.79)*.11*power;next.z+=Math.sin(phase*1.29)*.14*power;
   }
   positions.setXYZ(vertices++,last.x,last.y,last.z);
   positions.setXYZ(vertices++,next.x,next.y,next.z);
   last.copy(next);
  }
 }
 return {clear(){
  strike=null;edge.visible=rain.visible=bolts.visible=handLight.visible=chainTube.visible=false;
 },update(effect,time,events,hand){
  const raining=effect?.id==='rain',target=effect?.id==='thunder'?effect.target:null;
  rain.visible=raining;edge.visible=raining||Boolean(target?.alive);
  if(raining){
   rain.position.set(effect.x,0,effect.z);rain.scale.set(effect.stats.radius,1,effect.stats.radius);
   rain.material.uniforms.age.value=time-effect.start;
   edge.position.set(effect.x,.027,effect.z);edge.scale.setScalar(effect.stats.radius);
   edge.material.color.copy(blue);edge.material.opacity=.48;
  }else if(target?.alive){
   const charge=1-Math.max(0,effect.nextTick-time)/(effect.strikes?effect.stats.tick:effect.stats.firstStrike);
   edge.position.set(target.x,.031,target.z);edge.scale.setScalar(.41+.35*(1-charge));
   edge.material.color.set('#d5b7ff');edge.material.opacity=.32+.58*charge;
  }
  for(const event of events)if(event.type==='elementalLightning')strike={...event,at:time};
  vertices=0;
  const electric=effect?.id==='electric';
  const linkedTime=electric&&Number.isFinite(effect.linkedAt)?Math.max(0,time-effect.linkedAt):0;
  const intensity=electric?electricChainStage(effect.stats,linkedTime):0;
  chainColor.copy(colors[intensity]);
  handLight.visible=electric&&Boolean(hand);
  if(handLight.visible){
   hand.getWorldPosition(start);handLight.position.copy(start);
   handLight.material.color.copy(chainColor);
   handLight.scale.setScalar(.85+intensity*.38+.26*Math.sin(time*(30+intensity*8)));
   effect.links.forEach((actor,index)=>{
    end.set(actor.x,(actor.height??0)+actor.bodyHeight*.57,actor.z);
    source.copy(start);destination.copy(end);
    addBolt(time,index,1+intensity*.42);
    for(let branch=0;branch<band;branch++){
     const angle=index*3.55+branch*2.1+Math.floor(time*18)*.72;
     start.copy(source).lerp(destination,.23+branch*.14);
     end.copy(source).lerp(destination,.59+branch*.10);
     end.x+=Math.cos(angle)*(.18+.12*intensity);end.y+=.08+.13*intensity;
     end.z+=Math.sin(angle)*(.18+.12*intensity);
     addBolt(time,index*4+branch+1,.66);
    }
    start.copy(destination);
   });
  }
  const thickness=.006+intensity*.0075;
  chainTube.count=vertices/2;
  chainTube.visible=chainTube.count>0;
  if(chainTube.visible){
   chainTube.material.color.copy(chainColor);
   for(let i=0;i<chainTube.count;i++){
    a.fromBufferAttribute(positions,i*2);b.fromBufferAttribute(positions,i*2+1);
    boltWidth.subVectors(b,a);
    tubePoint.position.copy(a).lerp(b,.5);
    tubePoint.scale.set(thickness,boltWidth.length()+thickness,thickness);
    tubePoint.quaternion.setFromUnitVectors(up,boltWidth.normalize());
    tubePoint.updateMatrix();chainTube.setMatrixAt(i,tubePoint.matrix);
   }
   chainTube.instanceMatrix.needsUpdate=true;
  }
  const flash=strike&&time-strike.at<.24;
  if(flash){
   start.set(strike.x+.8,8,strike.z+.5);end.set(strike.x,Math.max(.4,strike.height*.57),strike.z);
   addBolt(time,11);start.x-=.42;addBolt(time,12);start.z-=.53;addBolt(time,13);
  }else strike=null;
  bolts.visible=vertices>0;
  bolts.material.color.copy(electric?chainColor:colors[0]);
  if(!electric)bolts.material.color.set('#f2e8ff');
  if(vertices){positions.needsUpdate=true;boltGeometry.setDrawRange(0,vertices);}
  bolts.material.opacity=flash?Math.max(.3,1-(time-strike.at)/.24):.94;
 }};
}
