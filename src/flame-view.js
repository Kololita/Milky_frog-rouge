import * as T from 'three';
export function updateWaterClip(material,zones){for(let i=0;i<4;i++){const z=zones?.[i];material.uniforms['water'+i].value.set(z?.x??0,z?.z??0,z?.until??-1);}}
export const waterClipGLSL=`
 uniform vec3 water0,water1,water2,water3;
 uniform float clock;
 bool touchesWater(vec2 position,vec3 zone,float radiusSquared){
  vec2 offset=position-zone.xy;
  return clock<zone.z && dot(offset,offset)<radiusSquared;
 }
 bool waterClips(vec2 position,float radiusSquared){
  return touchesWater(position,water0,radiusSquared)||touchesWater(position,water1,radiusSquared)||
   touchesWater(position,water2,radiusSquared)||touchesWater(position,water3,radiusSquared);
 }
`;
/** Small pooled flame ribbons, shared by status feedback and the furnace. */
export function createFlames(parent,{count=12,radius=.28,height=.65}={}){
 const root=new T.Group();root.name='火焰';root.userData.cameraOcclusion=false;parent.add(root);root.visible=false;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{water0:{value:new T.Vector3()},water1:{value:new T.Vector3()},water2:{value:new T.Vector3()},water3:{value:new T.Vector3()},clock:{value:0},strength:{value:0},flameBounds:{value:new T.Vector2(radius,height)}},vertexShader:'varying vec3 waterWorld;varying vec2 v;uniform float clock;uniform vec2 flameBounds;void main(){v=uv;float id=float(gl_InstanceID),a=id*2.39996,c=cos(a),s=sin(a);vec3 p=position;p.x+=sin(clock*5.+uv.y*8.+position.y*3.)*.035*uv.y;p.y*=.85+.2*sin(clock*5.+id);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z)+vec3(c*flameBounds.x,.15+mod(id,3.)*flameBounds.y/3.,s*flameBounds.x);waterWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:waterClipGLSL+'varying vec3 waterWorld;varying vec2 v;uniform float strength;void main(){if(waterClips(waterWorld.xz,16.))discard;float width=(1.-v.y)*.48;float flicker=.82+.18*sin(clock*9.+v.y*11.);float a=(1.-smoothstep(width*.25,width,abs(v.x-.5)))*sin(v.y*3.14159)*strength*flicker;vec3 c=mix(vec3(.95,.24,.035),vec3(1.,.8,.30),1.-v.y);gl_FragColor=vec4(c,a*.85);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 const flames=new T.InstancedMesh(new T.PlaneGeometry(.22,.52,1,5),material,count);
 flames.frustumCulled=false;
 root.add(flames);
 return {root,update(active,time,strength=1,zones=[]){
  root.visible=Boolean(active);
  if(!active)return;
  updateWaterClip(material,zones);
  material.uniforms.clock.value=time;
  material.uniforms.strength.value=strength;
 }};
}