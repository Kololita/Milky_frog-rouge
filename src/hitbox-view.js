import * as THREE from 'three';

export function hitboxPoints(hit){
 const points=[],y=hit.yMin??.035,point=(x,z)=>new THREE.Vector3(x,y,z);
 if(hit.shape==='capsule'){
  const dx=hit.toX-hit.x,dz=hit.toZ-hit.z,angle=Math.atan2(dx,dz),r=hit.radius;
  for(let i=0;i<=24;i++){const a=angle-Math.PI/2+i*Math.PI/24;points.push(point(hit.toX+Math.sin(a)*r,hit.toZ+Math.cos(a)*r));}
  for(let i=0;i<=24;i++){const a=angle+Math.PI/2+i*Math.PI/24;points.push(point(hit.x+Math.sin(a)*r,hit.z+Math.cos(a)*r));}
  points.push(points[0].clone());return points;
 }
 const full=hit.radial||hit.halfAngle>=Math.PI,half=full?Math.PI:hit.halfAngle;
 if(!full)points.push(point(hit.x,hit.z));
 for(let i=0;i<=64;i++){const a=hit.heading-half+2*half*i/64;points.push(point(hit.x+Math.sin(a)*hit.range,hit.z+Math.cos(a)*hit.range));}
 if(!full)points.push(point(hit.x,hit.z));return points;
}
export function hitboxWirePoints(hit){
 const base=hitboxPoints(hit),segments=[],top=hit.yMax??1.4;
 for(let i=1;i<base.length;i++){
  segments.push(base[i-1],base[i],new THREE.Vector3(base[i-1].x,top,base[i-1].z),new THREE.Vector3(base[i].x,top,base[i].z));
 }
 for(let i=0;i<base.length;i+=8)segments.push(base[i],new THREE.Vector3(base[i].x,top,base[i].z));
 const last=base.at(-1);segments.push(last,new THREE.Vector3(last.x,top,last.z));return segments;
}
export function createHitboxView(scene){
 const group=new THREE.Group();group.name='攻击判定调试';group.userData.cameraOcclusion=false;scene.add(group);
 const geometries=[67,65,51].map(count=>{
  const vertices=[];
  const vertex=(i,top)=>vertices.push(i,top,0);
  for(let i=1;i<count;i++){
   vertex(i-1,0);vertex(i,0);vertex(i-1,1);vertex(i,1);
  }
  for(let i=0;i<count;i+=8){vertex(i,0);vertex(i,1);}
  vertex(count-1,0);vertex(count-1,1);
  return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 });
 const material=new THREE.ShaderMaterial({
  depthTest:false,depthWrite:false,transparent:true,
  uniforms:{tint:{value:new THREE.Color()},center:{value:new THREE.Vector2()},endpoint:{value:new THREE.Vector2()},shape:{value:new THREE.Vector4()},heightRange:{value:new THREE.Vector2()}},
  vertexShader:`
   uniform vec2 center,endpoint,heightRange;
   uniform vec4 shape;
   void main(){
    float i=position.x,angle=shape.y;
    vec2 origin=center;
    float radius=shape.z;
    if(shape.x==2.){
     if(i==50.)i=0.;
     if(i<25.){origin=endpoint;angle+=-1.5707963+i*3.14159265/24.;}
     else angle+=1.5707963+(i-25.)*3.14159265/24.;
    }else if(shape.x==1.){
     angle+=-3.14159265+i*6.2831853/64.;
    }else if(i==0.||i==66.){
     radius=0.;
    }else{
     angle+=((i-1.)/32.-1.)*shape.w;
    }
    vec2 p=origin+vec2(sin(angle),cos(angle))*radius;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p.x,mix(heightRange.x,heightRange.y,position.y),p.y,1.);
   }`,
  fragmentShader:`
   uniform vec3 tint;
   void main(){
    gl_FragColor=vec4(tint,.95);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const colors={player:new THREE.Color('#298bff'),enemy:new THREE.Color('#ff3030')};
 let entries=[],lastTime=0;
 function clear(){for(const item of entries)group.remove(item.line);entries=[];}
 return {group,clear,update(battle,events,enabled){
  group.visible=enabled;if(!enabled||battle.time<lastTime)clear();lastTime=battle.time;if(!enabled)return;
  for(const event of events)if(event.type==='debugHitbox'){
   const capsule=event.shape==='capsule';
   const kind=capsule?2:event.radial||event.halfAngle>=Math.PI?1:0;
   const heading=capsule?Math.atan2(event.toX-event.x,event.toZ-event.z):event.heading;
   const line=new THREE.LineSegments(geometries[kind],material);
   line.renderOrder=50;line.frustumCulled=false;
   line.onBeforeRender=()=>{
    const u=material.uniforms;
    u.tint.value.copy(colors[event.owner]);
    u.center.value.set(event.x,event.z);
    u.endpoint.value.set(event.toX??event.x,event.toZ??event.z);
    u.shape.value.set(kind,heading,capsule?event.radius:event.range,event.halfAngle??Math.PI);
    u.heightRange.value.set(event.yMin??.035,event.yMax??1.4);
    material.uniformsNeedUpdate=true;
   };
   group.add(line);entries.push({line,until:battle.time+.18});
  }
  entries=entries.filter(item=>{if(battle.time<item.until)return true;group.remove(item.line);return false;});
 }};
}
