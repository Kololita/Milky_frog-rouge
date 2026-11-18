export function useGpuBillboard(mesh,reach=null){
 mesh.frustumCulled=false;
 mesh.material.onBeforeCompile=shader=>{
  if(reach){
   Object.assign(shader.uniforms,reach);
   shader.vertexShader='uniform vec3 reachOrigin,reachDirection;uniform float reachDistance;\n'+shader.vertexShader;
  }
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 mvPosition=modelViewMatrix*vec4(0.,0.,0.,1.);
   ${reach?`
    vec3 anchor=modelMatrix[3].xyz;
    float along=dot(anchor-reachOrigin,reachDirection);
    vec3 displacement=reachDirection*max(.05,reachDistance-along);
    mvPosition.xyz+=mat3(viewMatrix)*displacement;
   `:''}
   float billboardScale=length(modelViewMatrix[0].xyz);
   mvPosition.xyz+=transformed*billboardScale;
   gl_Position=projectionMatrix*mvPosition;
  `);
 };
 mesh.material.customProgramCacheKey=()=> reach?'gpu-reach-billboard':'gpu-camera-billboard';
}
