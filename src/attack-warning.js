export function attackWarningRemaining(enemy){
 if(enemy.state!=='windup')return -1;
 const cue=enemy.move?.contactPhase!=null?enemy.hitAt:enemy.telegraph;
 return Number.isFinite(cue)?cue-enemy.elapsed:-1;
}

/** One brightness pulse during the final 150ms before the swing. */
export function attackWarningPulse(enemy){
 const remaining=attackWarningRemaining(enemy);
 if(!Number.isFinite(remaining)||remaining<=0||remaining>.15)return 0;
 return Math.sin(Math.PI*(1-remaining/.15));
}

export const warningPulseGLSL=`
float warningPulse(float remaining) {
 return remaining>0. && remaining<=.15 ? sin(3.14159265*(1.-remaining/.15)) : 0.;
}`;

const bladeTimings=new WeakMap();
export function setBladeWarningTiming(material,remaining){
 let timing=bladeTimings.get(material);
 if(!timing){
  timing={value:remaining};
  bladeTimings.set(material,timing);
  const compile=material.onBeforeCompile;
  const cacheKey=material.customProgramCacheKey();
  material.customProgramCacheKey=()=>cacheKey+'|blade-warning-pulse';
  material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.uniforms.bladeWarningRemaining=timing;
   shader.fragmentShader='uniform float bladeWarningRemaining;\n'+warningPulseGLSL+'\n'+
    shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      #include <emissivemap_fragment>
      totalEmissiveRadiance*=1.+1.5*warningPulse(bladeWarningRemaining);
    `);
  };
  material.needsUpdate=true;
 }
 timing.value=remaining;
}
