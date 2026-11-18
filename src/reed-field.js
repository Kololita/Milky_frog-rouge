import * as THREE from 'three';

const FIELD_RADIUS=16.5;

export function reedFieldRadius(angle){
 return FIELD_RADIUS*(1+.13*Math.cos(2*angle-.7)+.067*Math.sin(3*angle+.35)+.031*Math.cos(5*angle));
}

export function createReedField(scene){
 const field=new THREE.Group();
 field.name='芦苇地';
 field.visible=false;
 scene.add(field);
 const clock={value:0};
 const land=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#555942',roughness:1}));
 land.rotation.x=-Math.PI/2;
 land.position.y=-.15;
 field.add(land);
 const surface=new THREE.MeshStandardMaterial({color:'#748076',roughness:.34,metalness:.2});
 surface.onBeforeCompile=shader=>{
  shader.uniforms.reedClock=clock;
  shader.vertexShader='varying vec2 fieldPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfieldPosition=position.xy;');
  shader.fragmentShader='varying vec2 fieldPosition; uniform float reedClock;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=fieldPosition;
   float distanceToBank=length(p*vec2(.84,1.));
   float bank=smoothstep(5.8,7.3,distanceToBank+sin(p.x*.9)*.85+sin(p.y*.7)*.36);
   float wave=sin(p.x*8.+p.y*4.+sin(p.y*2.-reedClock)*1.8-reedClock*2.2);
   float detail=sin(p.x*28.+sin(p.y*21.)*2.)*sin(p.y*32.);
   vec3 clay=vec3(.245,.216,.126)+detail*.035;
   vec3 water=vec3(.27,.33,.30)+wave*.027+pow(.5+.5*wave,13.)*.038;
   diffuseColor.rgb=mix(clay,water,bank);
  `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.95,.22,bank);');
 };
 const clearing=new THREE.Mesh(new THREE.PlaneGeometry(110,110),surface);
 clearing.rotation.x=-Math.PI/2;
 clearing.receiveShadow=true;
 field.add(clearing);

 // The foothills begin at the same contour used by the movement boundary.
 const mountain=new THREE.BufferGeometry();
 const positions=[],rockColors=[],indices=[];
 const rings=[0,2.4,6.8,11.4,20];
 const segments=112;
 const soil=new THREE.Color('#67634c'),rock=new THREE.Color('#777b70'),shade=new THREE.Color('#414b44');
 for(let j=0;j<rings.length;j++)for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2;
  const ridge=.52+.26*Math.sin(3*a+.6)+.15*Math.sin(9*a+.7)+.07*Math.sin(19*a);
  const radius=reedFieldRadius(a)+rings[j]+(j?Math.sin(17*a+j)*.65:0);
  const height=[.02,.34+ridge*.55,1.4+ridge*5.8,1.6+ridge*7.8,.4+ridge][j];
  positions.push(Math.cos(a)*radius,height,Math.sin(a)*radius);
  const color=soil.clone().lerp(rock,Math.min(1,height/4)).lerp(shade,.22*(.5+.5*Math.sin(i*2.1+j)));
  rockColors.push(color.r,color.g,color.b);
  if(j<rings.length-1){
   const here=j*segments+i,next=j*segments+(i+1)%segments;
   indices.push(here,next,here+segments,next,next+segments,here+segments);
  }
 }
 mountain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 mountain.setAttribute('color',new THREE.Float32BufferAttribute(rockColors,3));
 mountain.setIndex(indices);
 mountain.computeVertexNormals();
 const ridgeMesh=new THREE.Mesh(mountain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
 ridgeMesh.userData.cameraOcclusion=false;
 field.add(ridgeMesh);

 let seed=29483;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const reed=new THREE.BufferGeometry();
 const vertices=[],colors=[];
 function triangle(a,b,c,color){vertices.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);}
 const stalk=new THREE.Color('#7c793e'),leaf=new THREE.Color('#8b8748'),plume=new THREE.Color('#e0c497');
 for(const angle of [0,Math.PI*.5]){
  const dx=Math.cos(angle),dz=Math.sin(angle);
  const point=(w,y)=>[w*dx+.11*y*y,y,w*dz];
  triangle(point(-.018,0),point(.018,0),point(.012,1.12),stalk);
  triangle(point(-.018,0),point(.012,1.12),point(-.012,1.12),stalk);
  triangle(point(0,.36),point(.095,.52),point(.36,.77),leaf);
  triangle(point(0,.67),point(-.08,.8),point(-.30,1.02),leaf);
  triangle(point(-.035,1.07),point(.058,1.28),point(.14,1.53),plume);
  triangle(point(-.035,1.07),point(.14,1.53),point(-.018,1.35),plume);
 }
 reed.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 reed.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 reed.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1});
 material.onBeforeCompile=shader=>{
  shader.uniforms.reedClock=clock;
  shader.vertexShader='uniform float reedClock;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec2 anchor=instanceMatrix[3].xz;
   transformed.x+=position.y*position.y*(.10*sin(reedClock*1.8+anchor.x*.44+anchor.y*.52)+.035*sin(reedClock*3.1+anchor.y));
  `);
 };
 const reeds=new THREE.InstancedMesh(reed,material,4800);
 const pose=new THREE.Object3D(),tint=new THREE.Color();
 let count=0;
 for(let i=0;i<950;i++){
  const a=random()*Math.PI*2;
  const interior=i<210;
  const outer=reedFieldRadius(a);
  const r=interior?7.3*Math.sqrt(random()):6.2+(outer+1.5-6.2)*random()**.78;
  const x=Math.cos(a)*r,z=Math.sin(a)*r;
  for(let j=0;j<(interior?3:5);j++){
   pose.position.set(x+(random()-.5)*1.1,-.06,z+(random()-.5)*1.1);
   pose.rotation.y=random()*Math.PI*2;
   const size=interior?.11+random()*.14:.33+random()*.44;
   pose.scale.set(size,size,size);
   pose.updateMatrix();
   reeds.setMatrixAt(count,pose.matrix);
   reeds.setColorAt(count++,tint.setScalar(.68+random()*.32));
  }
 }
 reeds.count=count;
 reeds.userData.cameraOcclusion=false;
 field.add(reeds);
 return {root:field,boundaryRadius:reedFieldRadius,update(time){if(field.visible)clock.value=time;}};
}
