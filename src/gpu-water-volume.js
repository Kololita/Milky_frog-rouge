import * as T from 'three';
import {compileStartupTarget} from './startup-warmup.js';

// Sixteen height slices packed into a 4 by 4 atlas.
export function createGpuWaterVolume(renderer) {
  const target = new T.WebGLRenderTarget(512,512,{depthBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  const scene = new T.Scene(), camera = new T.Camera();
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(7200*3),3));
  const material = new T.ShaderMaterial({
    uniforms:{particles:{value:null}},
    transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,
    vertexShader:`
      uniform sampler2D particles;
      varying float weight;
      varying vec2 cell;
      void main(){
        int id=gl_VertexID%2400;
        vec4 p=texelFetch(particles,ivec2(id%60,id/60),0);
        float height=(p.y+.24)/.16;
        float slice=floor(height)+float(gl_VertexID/2400)-1.;
        cell=(p.xz/22.7+.5)*128.;
        weight=max(0.,1.-abs(slice+.5-height)*.65);
        gl_PointSize=5.;
        if(p.w<=0.||slice<0.||slice>=16.||weight<=0.){
          gl_Position=vec4(2.,2.,2.,1.);return;
        }
        vec2 tile=vec2(mod(slice,4.),floor(slice/4.));
        gl_Position=vec4((tile*128.+cell)/256.-1.,0.,1.);
      }`,
    fragmentShader:`
      varying float weight;
      varying vec2 cell;
      void main(){
        vec2 offset=(vec2(gl_PointCoord.x,1.-gl_PointCoord.y)-.5)*5.;
        vec2 pixel=cell+offset;
        if(any(lessThan(pixel,vec2(0.)))||any(greaterThanEqual(pixel,vec2(128.))))discard;
        gl_FragColor=vec4(weight*exp(-dot(offset,offset)*.5)*.14,0.,0.,1.);
      }`
  });
  const points = new T.Points(geometry,material);
  points.frustumCulled=false;
  scene.add(points);
  const clear = new T.Color();
  return {
    texture:target.texture,
    prepareShaders(){return compileStartupTarget(renderer,target,scene,camera);},
    update(particles){
      material.uniforms.particles.value=particles;
      const previous=renderer.getRenderTarget(), alpha=renderer.getClearAlpha();
      const autoClear=renderer.autoClear;
      renderer.getClearColor(clear);
      try{
        renderer.setRenderTarget(target);
        renderer.setClearColor(0,0);
        renderer.autoClear=true;
        renderer.render(scene,camera);
      }finally{
        renderer.setRenderTarget(previous);
        renderer.setClearColor(clear,alpha);
        renderer.autoClear=autoClear;
      }
    },
    dispose(){target.dispose();geometry.dispose();material.dispose();}
  };
}
