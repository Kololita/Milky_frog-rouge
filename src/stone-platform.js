import {BoxGeometry,CylinderGeometry,Group,InstancedMesh,Mesh,MeshStandardMaterial,Object3D,RingGeometry} from 'three';

export function createStonePlatform(scene) {
  const group = new Group();
  group.name = '石槌守卫 · 露天石台';
  group.visible = false;
  scene.add(group);

  const slate = new MeshStandardMaterial({color:'#55534e',roughness:.91});
  const dark = new MeshStandardMaterial({color:'#494741',roughness:1});
  const cut = new MeshStandardMaterial({color:'#76716a',roughness:.87});
  const brass = new MeshStandardMaterial({color:'#ad9361',roughness:.64,metalness:.24});
  const paving = slate.clone();
  paving.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 pavingPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      pavingPosition = position.xz;
    `);
    shader.fragmentShader='varying vec2 pavingPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 blocks = pavingPosition / vec2(2.65, 1.82);
      blocks.x += mod(floor(blocks.y), 2.0) * 0.5;
      vec2 tile = floor(blocks);
      vec2 edge = min(fract(blocks), 1.0 - fract(blocks));
      vec2 aa = clamp(fwidth(pavingPosition) / vec2(2.65, 1.82), 0.001, 0.04);
      vec2 center = smoothstep(vec2(0.007), vec2(0.014) + aa, edge);
      float tone = fract(sin(dot(tile, vec2(12.9898, 78.233))) * 14375.5);
      float mottle = sin(pavingPosition.x * 4.0 + cos(pavingPosition.y * 3.0))
                   * cos(pavingPosition.y * 4.7 + pavingPosition.x * 1.7);
      diffuseColor.rgb *= mix(0.66, 0.92 + tone * 0.12 + 0.027 * mottle, center.x * center.y);
    `);
  };
  function tier(radius,foot,height,y,material) {
    const mesh = new Mesh(new CylinderGeometry(radius,foot,height,8),material);
    mesh.position.y = y;
    mesh.receiveShadow = true;
    mesh.userData.cameraOcclusion = false;
    group.add(mesh);
  }
  tier(64,64,.2,-.96,dark);
  tier(12.05,12.45,.45,-.615,slate);
  tier(11.5,12.05,.39,-.217,cut);
  tier(11.32,11.37,.03,-.016,paving);

  const pose = new Object3D();
  function batch(geometry,material,places,raised=false) {
    const mesh = new InstancedMesh(geometry,material,places.length);
    places.forEach(([x,y,z,yaw],i)=>{
      pose.position.set(x,y,z);
      pose.rotation.y=yaw;
      pose.updateMatrix();
      mesh.setMatrixAt(i,pose.matrix);
    });
    mesh.receiveShadow=true;
    mesh.castShadow=raised;
    mesh.userData.cameraOcclusion=raised;
    if(raised)mesh.userData.cameraFadeGroup='stone-platform-markers';
    group.add(mesh);
  }
  const border=Array.from({length:8},(_,i)=>{
    const yaw=(i+.5)*Math.PI/4;
    return [Math.sin(yaw)*10.46,.004,Math.cos(yaw)*10.46,yaw];
  });
  batch(new BoxGeometry(8.55,.012,.075),brass,border);
  const medallion = new Mesh(new RingGeometry(1.07,1.13,8).rotateX(-Math.PI/2),brass);
  medallion.position.y=.005;
  medallion.receiveShadow=true;
  medallion.userData.cameraOcclusion=false;
  group.add(medallion);
  const cross=[[-2.62,.004,0,0],[2.62,.004,0,0],[0,.004,-2.62,Math.PI/2],[0,.004,2.62,Math.PI/2]];
  batch(new BoxGeometry(2.65,.012,.065),brass,cross);
  const posts=Array.from({length:8},(_,i)=>{
    const yaw=i*Math.PI/4;
    return [Math.sin(yaw)*11.88,.54,Math.cos(yaw)*11.88,yaw];
  });
  batch(new BoxGeometry(.97,.23,.97),cut,posts.map(([x,,z,yaw])=>[x,-.2,z,yaw]),true);
  batch(new BoxGeometry(.62,1.72,.62),dark,posts,true);
  batch(new BoxGeometry(.77,.16,.77),cut,posts.map(([x,,z,yaw])=>[x,1.47,z,yaw]),true);
  return group;
}
