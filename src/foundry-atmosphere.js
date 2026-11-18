import * as T from 'three';
export function createFoundryAtmosphere(root,pool,clock){
 const fogMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,uniforms:{clock,worldToLocal:{value:new T.Matrix4()},kind:{value:0}},vertexShader:'varying vec3 localPoint;void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec3 localPoint;uniform mat4 worldToLocal;uniform float clock,kind;
 float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+1.),f.x),f.y),f.z);}
 void main(){vec3 origin=(worldToLocal*vec4(cameraPosition,1.)).xyz,dir=normalize(localPoint-origin);float b=dot(origin,dir),c=dot(origin,origin)-1.,d=b*b-c;if(d<0.)discard;float begin=max(0.,-b-sqrt(d)),end=-b+sqrt(d),stepSize=(end-begin)/18.,opacity=0.;
 for(int i=0;i<18;i++){vec3 p=origin+dir*(begin+(float(i)+.5)*stepSize);float n=noise(p*3.8+vec3(clock*.09,-clock*.24,0.))*.68+noise(p*9.+vec3(0.,-clock*.46,clock*.03))*.32;float density=smoothstep(.25,.72,n)*smoothstep(1.,.45,length(p));if(kind>.5){float cone=.22+(1.-p.y)*.35;density*=smoothstep(cone,cone*.55,length(p.xz))*.35;}opacity+=density*stepSize*.19;}
 gl_FragColor=vec4(kind>.5?vec3(1.,.76,.43):vec3(.55,.43,.32),min(.22,opacity));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const steam=new T.Mesh(new T.SphereGeometry(1,20,12),fogMaterial);steam.position.set(pool.x,2.05,pool.z);steam.scale.set(2.2,1.65,2.2);steam.userData.cameraOcclusion=false;steam.renderOrder=4;root.add(steam);
 const shaftMaterial=fogMaterial.clone();shaftMaterial.uniforms.clock=clock;shaftMaterial.uniforms.kind.value=1;
 const shaft=new T.Mesh(steam.geometry,shaftMaterial);shaft.position.set(0,3,0);shaft.scale.set(3.5,2.6,3.5);shaft.userData.cameraOcclusion=false;shaft.renderOrder=4;root.add(shaft);
 steam.name='foundry-steam';
 shaft.name='foundry-light-shaft';
 for(const mesh of [steam,shaft])mesh.onBeforeRender=()=>mesh.material.uniforms.worldToLocal.value.copy(mesh.matrixWorld).invert();
 const count=96,geometry=new T.BufferGeometry(),seeds=new Float32Array(count*3);
 for(let i=0;i<count;i++){seeds[i*3]=(i*.61803398875)%1;seeds[i*3+1]=(i*.75487766)%1;seeds[i*3+2]=(i*.41421356)%1;}
 geometry.setAttribute('position',new T.BufferAttribute(seeds,3));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{clock},vertexShader:`uniform float clock;varying float fade;void main(){float t=fract(position.x+clock*.34),a=position.y*6.28318;float r=.08+t*(.4+position.z*.9);vec3 p=vec3(cos(a)*r,.70+sin(t*3.14159)*(.15+position.z*.8),sin(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.);fade=sin(t*3.14159);gl_PointSize=clamp(14./max(1.,-mv.z),1.,4.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float fade;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),2.)*fade;gl_FragColor=vec4(1.,.48,.08,a);}`});
 const sparks=new T.Points(geometry,material);sparks.position.set(pool.x,0,pool.z);sparks.frustumCulled=false;sparks.userData.cameraOcclusion=false;root.add(sparks);
}
