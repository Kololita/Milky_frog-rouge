import * as T from 'three';
// GPU advected molten surface: layered flow, cooling crust and displaced convection.
export function createLavaMaterial(){
 const field=`
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+7.1;a*=.5;}return n;}
 vec2 flow(vec2 p,float t){float radius=length(p);float turn=t*.11/(1.+radius*.35);float c=cos(turn),s=sin(turn);p=mat2(c,-s,s,c)*p;p+=normalize(p+vec2(.001))*.09*sin(radius*3.-t*.85);vec2 q=vec2(fbm(p*1.3+vec2(t*.08,0)),fbm(p*1.3+vec2(4.7,-t*.07)));return p+q*.85+vec2(sin(p.y*2.+t*.13),cos(p.x*2.-t*.11))*.12;}
 float heightAt(vec2 p,float t){vec2 q=flow(p,t);return (fbm(q*3.+t*.025)-.5)*.10+sin(length(p)*9.-t*1.1)*.008+sin(length(p)*15.-t*3.)*.018*exp(-length(p)*1.4);}
 `;
 return new T.ShaderMaterial({uniforms:{clock:{value:0},vertical:{value:0},surfaceRadius:{value:0},roomReflection:{value:null},hasRoomReflection:{value:false}},side:T.DoubleSide,vertexShader:`uniform float clock,vertical,surfaceRadius;varying vec3 world;varying vec3 local;${field}
 void main(){vec3 p=position;if(abs(normal.y)>.5)p.y+=heightAt(p.xz,clock);if(vertical>.5)p+=normal*(.009*sin(p.y*10.+clock*6.)+.005*sin(p.y*22.+clock*9.));local=p;world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform float clock,vertical,surfaceRadius;varying vec3 world;varying vec3 local;${field}
 uniform samplerCube roomReflection;
 uniform bool hasRoomReflection;
 vec3 traceRoomReflection(vec3 origin,vec3 direction){
  // Exit point on the local reflection probe's enclosing box.
  vec3 low=vec3(-11.4,0.,-11.4),high=vec3(11.4,8.5,11.4);
  vec3 directionSign=mix(vec3(-1.),vec3(1.),step(vec3(0.),direction));
  vec3 exitPlane=mix(low,high,step(vec3(0.),direction));
  vec3 exitDistance=(exitPlane-origin)/(directionSign*max(abs(direction),vec3(.0001)));
  float travel=min(exitDistance.x,min(exitDistance.y,exitDistance.z));
  return origin+direction*max(0.,travel)-vec3(0.,2.,0.);
 }

 void main(){vec2 p=local.xz;if(surfaceRadius>0.&&length(p)>surfaceRadius)discard;if(vertical>.5)p=vec2(atan(local.z,local.x)*.4,local.y+clock*.8);vec2 q=flow(p,clock);vec2 cell=q*1.65;vec2 base=floor(cell),f=fract(cell);float nearest=10.,second=10.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 seed=vec2(hash(base+g),hash(base+g+19.));vec2 r=g+.5+.30*sin(clock*.12+seed*6.283)-f;float d=dot(r,r);if(d<nearest){second=nearest;nearest=d;}else second=min(second,d);}
 float seam=second-nearest;float aa=max(fwidth(seam)*1.5,.005);float cracks=1.-smoothstep(.008,.027+aa,seam);float cooling=fbm(q*7.+3.);float impact=exp(-length(p)*3.4);float hot=clamp(cracks*.88+smoothstep(.62,.9,fbm(q*2.-clock*.025))*.23+impact*.65,0.,1.);
 if(vertical>.5)hot=.3+.65*smoothstep(.2,.75,fbm(vec2(p.x*8.,p.y*.7)));
 vec3 crust=mix(vec3(.025,.012,.009),vec3(.18,.035,.008),cooling);vec3 molten=mix(vec3(1.4,.12,.008),vec3(2.8,.85,.08),hot);vec3 color=mix(crust,molten,pow(hot,1.6));
 // Reuse raster derivatives of the displaced surface instead of evaluating four expensive height fields per pixel.
 vec3 n=normalize(cross(dFdx(world),dFdy(world)));vec3 view=normalize(cameraPosition-world);
 if(dot(n,view)<0.)n=-n;
 float detailFade=1.-smoothstep(.02,.10,length(fwidth(p)));
 n=normalize(n+vec3(sin(q.y*17.-clock*.8),0.,cos(q.x*19.+clock*.65))*.035*detailFade);
 float gloss=pow(max(0.,dot(reflect(-normalize(vec3(.4,1.,.3)),n),view)),48.);color+=vec3(1.,.55,.20)*gloss*.45;float bubbles=pow(max(0.,sin(nearest*32.-clock*1.8)),20.)*smoothstep(.12,.0,nearest)*.35;color+=vec3(1.4,.45,.03)*bubbles;
 if(hasRoomReflection&&vertical<.5){
  vec3 reflected=reflect(-view,n);
  vec3 probeDirection=traceRoomReflection(world,reflected);
  float fresnel=pow(1.-max(0.,dot(n,view)),5.);
  vec3 reflection=textureCube(roomReflection,probeDirection).rgb;
  color+=reflection*mix(.025,.20,fresnel)*(1.-.55*hot);
 }
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}
