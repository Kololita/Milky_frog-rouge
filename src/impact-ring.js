import * as T from 'three';
export function createImpactRing(){
const impactRingAge={value:0};
const impactRingMaterial=new T.MeshBasicMaterial({color:'#d9bd70',transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide});
impactRingMaterial.onBeforeCompile=shader=>{
  shader.uniforms.impactRingAge=impactRingAge;
  shader.vertexShader='uniform float impactRingAge;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    transformed*=.55+1.4*clamp(impactRingAge/.45,0.,1.);
  `);
  shader.fragmentShader='uniform float impactRingAge;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    diffuseColor.a*=1.-clamp(impactRingAge/.45,0.,1.);
  `);
};
const impactRing=new T.Mesh(new T.RingGeometry(.86,1,48),impactRingMaterial);
impactRing.frustumCulled=false;
impactRing.rotation.x=-Math.PI/2;
impactRing.visible=false;
return {mesh:impactRing,update(elapsed){impactRing.visible=elapsed<.45;if(impactRing.visible)impactRingAge.value=elapsed;}};
}
