import * as T from 'three';

export function createGpuHealthBar({width,height,fillWidth,fillHeight,background,color,depth=.003}){
 const group=new T.Group();
 const fraction={value:1};
 let fill;
 for(const filled of [false,true]){
  const material=new T.MeshBasicMaterial({color:filled?color:background,side:T.DoubleSide});
  material.onBeforeCompile=shader=>{
   shader.uniforms.healthFraction=fraction;
   shader.uniforms.fillOffset={value:filled?new T.Vector2(fillWidth/2,depth):new T.Vector2()};
   shader.vertexShader='uniform float healthFraction;uniform vec2 fillOffset;\n'+shader.vertexShader
    .replace('#include <project_vertex>',`
     vec4 mvPosition=modelViewMatrix*vec4(0.,0.,0.,1.);
     vec3 offset=position;
     if(fillOffset.x>0.){
      offset.x=position.x*healthFraction-fillOffset.x*(1.-healthFraction);
      offset.z=fillOffset.y;
     }
     mvPosition.xyz+=offset;
     gl_Position=projectionMatrix*mvPosition;
    `);
  };
  const part=new T.Mesh(new T.PlaneGeometry(filled?fillWidth:width,filled?fillHeight:height),material);
  part.frustumCulled=false;
  group.add(part);
  if(filled)fill=material;
 }
 return {group,fill,setFraction(value){fraction.value=T.MathUtils.clamp(value,0,1);}};
}
