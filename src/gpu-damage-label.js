import * as T from 'three';

const atlases=new WeakMap();
function digitAtlas(doc){
 if(atlases.has(doc))return atlases.get(doc);
 const canvas=doc.createElement('canvas');
 canvas.width=480;canvas.height=64;
 const ctx=canvas.getContext('2d');
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 46px system-ui';
 ctx.fillStyle='#fff1c0';ctx.shadowColor='#342718';ctx.shadowBlur=8;ctx.shadowOffsetY=4;
 for(let digit=0;digit<10;digit++){
  ctx.save();
  ctx.beginPath();
  ctx.rect(digit*48+1,0,46,64);
  ctx.clip();
  ctx.fillText(String(digit),digit*48+24,29);
  ctx.restore();
 }
 const texture=new T.CanvasTexture(canvas);
 texture.colorSpace=T.SRGBColorSpace;
 texture.generateMipmaps=false;
 texture.minFilter=T.LinearFilter;
 atlases.set(doc,texture);
 return texture;
}

export function createGpuDamageLabel(scene,doc){
 const capacity=24,geometry=new T.PlaneGeometry(1,1);
 const digits=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage);
 geometry.setAttribute('digit',digits);
 const screenSize={value:new T.Vector2(1,1)},digitCount={value:0};
 const material=new T.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{screenSize,digitCount,labelMap:{value:digitAtlas(doc)}},
  vertexShader:`
   uniform vec2 screenSize;
   uniform float digitCount;
   attribute float digit;
   varying vec2 labelUv;
   void main(){
    labelUv=vec2((digit*48.+mix(.5,47.5,uv.x))/480.,uv.y);
    vec4 anchor=projectionMatrix*modelViewMatrix*vec4(0.,0.,0.,1.);
    float x=(float(gl_InstanceID)-.5*(digitCount-1.))*15.;
    anchor.xy+=vec2(x+position.x*24.,(position.y+.5)*32.)*2.*anchor.w/screenSize;
    gl_Position=anchor;
   }`,
  fragmentShader:`
   uniform sampler2D labelMap;
   varying vec2 labelUv;
   void main(){
    gl_FragColor=texture2D(labelMap,labelUv);
    #include <colorspace_fragment>
   }`
 });
 const mesh=new T.InstancedMesh(geometry,material,capacity);
 mesh.count=0;
 mesh.name='战斗伤害数字';mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=42;
 mesh.userData.cameraOcclusion=false;
 mesh.onBeforeRender=renderer=>screenSize.value.set(Math.max(1,renderer.domElement.clientWidth),Math.max(1,renderer.domElement.clientHeight));
 scene.add(mesh);
 let displayed='';
 return {
  mesh,
  setText(value){
   if(displayed===value)return;
   displayed=value;
   const text=String(value).replace(/[^0-9]/g,'').slice(0,capacity);
   mesh.count=digitCount.value=text.length;
   for(let i=0;i<text.length;i++)digits.setX(i,text.charCodeAt(i)-48);
   digits.clearUpdateRanges();
   digits.addUpdateRange(0,text.length);
   digits.needsUpdate=true;
  },
  dispose(){scene.remove(mesh);geometry.dispose();material.dispose();mesh.dispose();}
 };
}
