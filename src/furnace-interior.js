import {createFoundryAtmosphere} from './foundry-atmosphere.js';
import {loadFoundryProps,cloneFoundryProp} from './foundry-props.js';
import {addFoundryDetails,foundryMetal} from './foundry-art.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MOLTEN_POOL,FOUNDRY_CONTROL_ANGLES} from './cooling.js';
export function createFurnaceInterior(root,add,lava,stream){
 const detailsStart=root.children.length;
 const art=addFoundryDetails(root);
 for(const detail of root.children.slice(detailsStart))detail.userData.cameraOcclusion=false;
 const wall=foundryMetal('#65594b',1);wall.side=T.DoubleSide;const dark=art.black;
 // Segment the wall around real openings, rather than placing windows on a closed cylinder.
 const wallWidth=2*11.45*Math.tan(Math.PI/24)+.025;
 for(let quadrant=0;quadrant<4;quadrant++){
  const panels=[];
  for(let i=quadrant*6;i<(quadrant+1)*6;i++){
   const angle=i*Math.PI/12;
   const panel=(width,height,x,y)=>panels.push(new T.BoxGeometry(width,height,.35)
    .translate(x,y,0).rotateY(angle).translate(Math.sin(angle)*11.45,0,Math.cos(angle)*11.45));
   if(i%3===0){
    const opening=wallWidth*.38;
    panel(wallWidth,2.55,0,1.025);
    panel(wallWidth,1.6,0,5.9);
    for(const side of [-1,1])panel((wallWidth-opening)/2,2.8,side*(wallWidth+opening)/4,3.7);
   }else panel(wallWidth,6.95,0,3.225);
  }
  const section=new T.Mesh(mergeGeometries(panels),wall);
  for(const panel of panels)panel.dispose();
  section.name='foundry-wall-section';
  section.castShadow=section.receiveShadow=true;
  section.userData.cameraOcclusion=false;
  root.add(section);
 }
 const roofMaterial=dark.clone();roofMaterial.side=T.DoubleSide;
 const roof=add(new T.ConeGeometry(11.75,2.1,24,1,true),roofMaterial,0,7.55,0);roof.name='pitched-foundry-roof';roof.castShadow=false;roof.userData.cameraOcclusion=false;
 const {x,z,radius}=MOLTEN_POOL;
 createFoundryAtmosphere(root,MOLTEN_POOL,lava.uniforms.clock);
 const geo=new T.PlaneGeometry(4.4,4.4,48,48);geo.rotateX(-Math.PI/2);
 const pool=add(geo,lava,x,.68,z);pool.name='low-molten-reservoir';pool.userData.cameraFadeGroup='molten-reservoir';
 const bottom=.70,outlet=3.6;
 const pour=add(new T.CylinderGeometry(.19,.24,outlet-bottom,24,40,true),stream,x,(outlet+bottom)/2,z);pour.name='continuous-molten-inflow';pour.userData.cameraFadeGroup='molten-reservoir';
 pour.userData.cameraHull=[new T.CylinderGeometry(.20,.25,outlet-bottom,8)];
 const moltenLight=new T.PointLight('#ff6b17',18,8,2);moltenLight.position.set(x,1.5,z);root.add(moltenLight);
 const ready=loadFoundryProps().then(()=>{const pendant=cloneFoundryProp('pendant');pendant.position.y=5.65;pendant.userData.cameraOcclusion=false;root.add(pendant);
 for(let i=0;i<24;i++){const a=i*Math.PI/12;if(i%3===0){const frame=cloneFoundryProp('window');frame.position.set(Math.sin(a)*11.27,3.7,Math.cos(a)*11.27);frame.rotation.y=a;frame.userData.cameraOcclusion=false;root.add(frame);}if(i%3===1){const lamp=cloneFoundryProp('wall-lantern');lamp.position.set(Math.sin(a)*11.03,3.1,Math.cos(a)*11.03);lamp.rotation.y=a;lamp.userData.cameraOcclusion=false;root.add(lamp);}}
 for(const a of FOUNDRY_CONTROL_ANGLES){
  const control=cloneFoundryProp('control');
  control.position.set(Math.sin(a)*10.65,0,Math.cos(a)*10.65);control.rotation.y=a;
  control.userData.cameraHull=[new T.BoxGeometry(.95,1.27,.72).translate(0,.635,.04)];
  control.traverse(part=>{if(part.isMesh)part.userData.cameraFadeGroup='foundry-control-'+control.id;});
  root.add(control);
 }
 const reservoir=cloneFoundryProp('reservoir');reservoir.position.set(x,0,z);
 reservoir.userData.cameraHull=[new T.CylinderGeometry(2.55,2.57,.80,16).translate(0,.40,0)];
 for(let i=0;i<3;i++){
  const start=Math.PI*(.8+.1*i),end=start+Math.PI*.1;
  const a=new T.Vector2(2.75*Math.cos(start),-2.75*Math.sin(start));
  const b=new T.Vector2(2.75*Math.cos(end),-2.75*Math.sin(end));
  const heading=Math.atan2(a.y-b.y,b.x-a.x);
  const rail=new T.BoxGeometry(a.distanceTo(b)+.07,.52,.14);
  rail.rotateY(heading).translate((a.x+b.x)*.5,.74,(a.y+b.y)*.5);
  reservoir.userData.cameraHull.push(rail);
 }
 reservoir.traverse(part=>{if(part.isMesh)part.userData.cameraFadeGroup='molten-reservoir';});
 root.add(reservoir);
 const feed=cloneFoundryProp('feed');feed.position.set(x,0,z);
 feed.userData.cameraHull=[
  new T.BoxGeometry(4.05,.61,.61).translate(-2.1,5.75,0),
  new T.BoxGeometry(.65,2.18,.61).translate(-.10,4.69,0),
 ];
 feed.traverse(part=>{if(part.isMesh)part.userData.cameraFadeGroup='molten-reservoir';});
 root.add(feed);
 });
 return {ready};
}
