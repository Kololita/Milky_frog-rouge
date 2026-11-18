import {foundryFloor} from './foundry-art.js';
import * as T from 'three';
export const DRAIN={spacing:4,halfWidth:.15,bottom:-.25,water:-.18,radius:11.4};
export function drainHeight(x,z){return Math.hypot(x,z)>10.75||Math.min(Math.abs(x-Math.round(x/4)*4),Math.abs(z-Math.round(z/4)*4))<DRAIN.halfWidth?DRAIN.water:.04;}
export function createDrainFloor(root){
 const floor=foundryFloor();const side=new T.MeshStandardMaterial({color:'#303939',roughness:.5,metalness:.5});
 const baseMaterial=new T.MeshStandardMaterial({color:'#101719',roughness:.95,metalness:.05});baseMaterial.userData.reflectionIntensity=.04;side.userData.reflectionIntensity=.2;const base=new T.Mesh(new T.CylinderGeometry(11.4,11.4,.08,128),baseMaterial);base.position.y=-.29;base.receiveShadow=true;root.add(base);
 // Fin-lined channel walls reveal real depth and lead the water toward the edge.
 const finGeometry=new T.BoxGeometry(.025,.18,.035),matrices=[],dummy=new T.Object3D();
 for(const axis of [0,1])for(let grid=-8;grid<=8;grid+=4)for(let along=-11;along<=11;along+=.22)for(const sign of [-1,1]){
  const x=axis?grid+sign*.13:along,z=axis?along:grid+sign*.13;if(Math.hypot(x,z)>11.25)continue;
  dummy.position.set(x,-.12,z);dummy.rotation.y=axis?Math.PI/2:0;dummy.updateMatrix();matrices.push(dummy.matrix.clone());
 }
 const fins=new T.InstancedMesh(finGeometry,side,matrices.length);matrices.forEach((m,i)=>fins.setMatrixAt(i,m));fins.receiveShadow=true;root.add(fins);
 const outerWalk=new T.Shape();outerWalk.absarc(0,0,11.4,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,11.25,0,Math.PI*2,true);outerWalk.holes.push(hole);const edgeWalk=new T.Mesh(new T.ExtrudeGeometry(outerWalk,{depth:.2,bevelEnabled:false,curveSegments:96}),side);edgeWalk.rotation.x=-Math.PI/2;edgeWalk.position.y=-.2;edgeWalk.receiveShadow=true;root.add(edgeWalk);
 for(const radius of [10.75,11.25]){const rail=new T.Mesh(new T.TorusGeometry(radius,.028,8,192),side);rail.rotation.x=Math.PI/2;rail.position.y=-.015;root.add(rail);}
 const circle=Array.from({length:128},(_,i)=>[10.75*Math.cos(i*Math.PI/64),10.75*Math.sin(i*Math.PI/64)]);
 const clip=(points,axis,limit,sign)=>{const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ia=(a[axis]-limit)*sign>=0,ib=(b[axis]-limit)*sign>=0;if(ia)out.push(a);if(ia!==ib){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};
 for(let x=-3;x<3;x++)for(let z=-3;z<3;z++){let poly=circle;for(const [axis,limit,sign]of [[0,x*4+.15,1],[0,(x+1)*4-.15,-1],[1,z*4+.15,1],[1,(z+1)*4-.15,-1]])poly=clip(poly,axis,limit,sign);if(poly.length<3)continue;const shape=new T.Shape(poly.map(p=>new T.Vector2(...p)));const tile=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.21,bevelEnabled:true,bevelThickness:.02,bevelSize:.018,bevelSegments:2}),[floor,side]);tile.rotation.x=-Math.PI/2;tile.position.y=-.23;tile.castShadow=tile.receiveShadow=true;tile.name='raised-floor-slab';root.add(tile);}
}
