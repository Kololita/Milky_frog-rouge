import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {createGpuWaterVolume} from './gpu-water-volume.js';
import {compileStartupQuad} from './startup-warmup.js';

// State stays in floating-point textures. Each texel stores one particle.
export function createGpuDrainMotion(renderer, width, height) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) return null;

  const integration = `
    uniform vec2 resolution;
    uniform sampler2D drainPosition,drainVelocity;
    layout(location=0) out vec4 nextPosition;
    layout(location=1) out vec4 nextVelocity;
    uniform float dt;
    uniform vec3 emitters[4];
    uniform vec2 emissionWindow[4];
    uniform float simulationTime,emissionChance;
    uniform float tick;
    uniform sampler2D waterDensity;
    uniform bool hasDensity;
    uniform sampler2D volumeDensity;
    float volumeAt(vec3 p){
      float slice=floor((p.y+.24)/.16);
      vec2 cell=(p.xz/22.7+.5)*128.;
      if(slice<0.||slice>=16.||any(lessThan(cell,vec2(0.)))||any(greaterThanEqual(cell,vec2(128.))))return 0.;
      vec2 tile=vec2(mod(slice,4.),floor(slice/4.));
      return texture2D(volumeDensity,(tile*128.+floor(cell)+.5)/512.).r;
    }
    float hash(float x){return fract(sin(x*127.1)*43758.5453);}
    float floorHeight(vec2 p){
      vec2 edge=abs(p-4.*floor(p/4.+.5));
      return length(p)>10.75||min(edge.x,edge.y)<.15?-.18:.04;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution.xy;
      vec4 p=texture2D(drainPosition,uv);
      vec4 velocityState=texture2D(drainVelocity,uv);
      vec3 v=velocityState.xyz;
      float channel=velocityState.w;
      float id=floor(gl_FragCoord.x)+floor(gl_FragCoord.y)*resolution.x;
      int source=int(mod(id,4.));
      if(p.w<=0.){
        channel=0.;
        vec2 window=emissionWindow[source];
        if(simulationTime>=window.x&&simulationTime<window.y&&hash(id+tick*3.71)<emissionChance){
          float a=hash(id+tick*2.19)*6.283185;
          float speed=2.6+hash(id+tick)*1.6;
          p=vec4(emitters[source],24.);
          v=vec3(cos(a)*speed,2.+hash(id+tick*5.1)*2.,sin(a)*speed);
        }
      }else{
        float floorY=floorHeight(p.xz);
        vec2 center=4.*floor(p.xz/4.+.5);
        vec2 offset=center-p.xz;
        if(length(p.xz)>=10.75)channel=0.;
        else if(channel==0.&&floorY<0.&&p.y<-.05)
          channel=abs(offset.y)<abs(offset.x)?1.:2.;
        if(p.y>floorY+.005){
          v.y-=9.81*dt;
          if(p.y>.08){
            vec3 x=vec3(.17734,0.,0.),y=vec3(0.,.16,0.),z=vec3(0.,0.,.17734);
            vec3 gradient=vec3(volumeAt(p.xyz+x)-volumeAt(p.xyz-x),
                               volumeAt(p.xyz+y)-volumeAt(p.xyz-y),
                               volumeAt(p.xyz+z)-volumeAt(p.xyz-z));
            v-=gradient*dt*2.;
          }
        }
        else{
          p.y=floorY;
          v.y=0.;
          bool alongX=channel==0.?abs(offset.y)<abs(offset.x):channel==1.;
          float lateral=alongX?offset.y:offset.x;
          float along=alongX?p.x:p.z;
          float slope=abs(lateral)<.075?2.8*(along<0.?-1.:1.):0.;
          float side=lateral*(abs(lateral)<.075?28.:12.);
          v.xz=(v.xz+(alongX?vec2(slope,side):vec2(side,slope))*dt)*exp(-1.4*dt);
          // A shallow-water pressure approximation from the last rendered density field.
          if(hasDensity&&floorY<0.){
            vec2 uv=p.xz*vec2(1.,-1.)/22.7+.5;
            vec2 texel=1./vec2(256.);
            float dx=texture2D(waterDensity,uv+vec2(texel.x,0.)).r-texture2D(waterDensity,uv-vec2(texel.x,0.)).r;
            float dz=texture2D(waterDensity,uv-vec2(0.,texel.y)).r-texture2D(waterDensity,uv+vec2(0.,texel.y)).r;
            vec2 gradient=vec2(dx,dz);
            if(channel==1.)gradient.y=0.;
            if(channel==2.)gradient.x=0.;
            v.xz-=gradient*dt*3.;
          }
        }
        p.xyz+=v*dt;
        if(channel==1.){
          p.z=clamp(p.z,center.y-.12,center.y+.12);
          if(abs(p.z-center.y)>=.119)v.z=0.;
        }
        if(channel==2.){
          p.x=clamp(p.x,center.x-.12,center.x+.12);
          if(abs(p.x-center.x)>=.119)v.x=0.;
        }
        float nextFloor=floorHeight(p.xz);
        if(p.y<nextFloor){p.y=nextFloor;v.y=abs(v.y)*.08;}
        p.w=length(p.xz)>11.35?0.:max(0.,p.w-dt);
      }
      nextPosition=p;nextVelocity=vec4(v,channel);
    }
  `;
  const targets=Array.from({length:2},()=>new T.WebGLRenderTarget(width,height,{
    count:2,type:T.FloatType,depthBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter
  }));
  const volume=createGpuWaterVolume(renderer);
  const uniforms={
    resolution:{value:new T.Vector2(width,height)},
    drainPosition:{value:null},drainVelocity:{value:null},
    dt:{value:0},tick:{value:0},
    emitters:{value:new Float32Array(12)},emissionWindow:{value:new Float32Array(8)},
    simulationTime:{value:0},emissionChance:{value:0},
    waterDensity:{value:null},hasDensity:{value:false},
    volumeDensity:{value:volume.texture},
  };
  const material=new T.ShaderMaterial({
    glslVersion:T.GLSL3,uniforms,fragmentShader:integration,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    depthTest:false,depthWrite:false,
  });
  const quad=new FullScreenQuad(material);
  let active=0;
  const clear=new T.Color();
  function reset(){
    const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();
    renderer.getClearColor(clear);
    try{
      renderer.setClearColor(0,0);
      for(const target of targets){renderer.setRenderTarget(target);renderer.clear(true,false,false);}
    }finally{
      renderer.setRenderTarget(previous);
      renderer.setClearColor(clear,alpha);
    }
    active=0;
  }
  reset();
  return {
    reset,
    async prepareShaders(){
      await volume.prepareShaders();
      await compileStartupQuad(renderer,targets[1-active],[material]);
    },
    refreshPressure(){
      volume.update(targets[active].textures[0]);
    },
    setEmitters(emitters,windows){
      uniforms.emitters.value.set(emitters);
      uniforms.emissionWindow.value.set(windows);
    },
    step(dt,tick,time,chance,density){
      const current=targets[active],next=targets[1-active];
      uniforms.drainPosition.value=current.textures[0];
      uniforms.drainVelocity.value=current.textures[1];
      uniforms.dt.value=dt;
      uniforms.tick.value=tick;
      uniforms.simulationTime.value=time;
      uniforms.emissionChance.value=chance;
      uniforms.waterDensity.value=density;
      uniforms.hasDensity.value=Boolean(density);
      const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
      try{
        renderer.autoClear=false;
        renderer.setRenderTarget(next);
        quad.render(renderer);
      }finally{
        renderer.setRenderTarget(previous);
        renderer.autoClear=autoClear;
      }
      active=1-active;
    },
    get positions(){return targets[active].textures[0];},
    dispose(){volume.dispose();quad.dispose();material.dispose();for(const target of targets)target.dispose();}
  };
}
