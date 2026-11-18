export const ACTOR_COLLISION=Object.freeze({maxStep:.025,padding:.002});

/** Re-evaluate contact every <=2.5cm. Remove only inward motion and retain
 * tangent motion, so grazing rolls slide around a body instead of sticking. */
export function moveActorMotion(from,to,enemy,radius=.4) {
  if(Array.isArray(enemy)){
    const targets=enemy.filter(e=>e.health>0&&!['thrown','down'].includes(e.state));
    const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/ACTOR_COLLISION.maxStep));
    const sx=(to.x-from.x)/steps,sz=(to.z-from.z)/steps;let point={x:from.x,z:from.z},blocked=false;
    for(let i=0;i<steps;i++){
      let next={x:point.x+sx,z:point.z+sz};
      for(const target of targets){const result=moveActorMotion(point,next,target,radius);next=result;blocked ||= result.blocked;}
      point=next;
    }
    return {...point,blocked};
  }
  if(!enemy||enemy.health<=0||['thrown','down'].includes(enemy.state))return {x:to.x,z:to.z,blocked:false};
  const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/ACTOR_COLLISION.maxStep));
  const sx=(to.x-from.x)/steps,sz=(to.z-from.z)/steps,length2=sx*sx+sz*sz;
  const clearance=radius+(enemy.radius??.36)+ACTOR_COLLISION.padding;
  let x=from.x,z=from.z,blocked=false;
  if(length2<1e-14)return {x,z,blocked};
  for(let i=0;i<steps;i++){
    let dx=x-enemy.x,dz=z-enemy.z,d=Math.hypot(dx,dz);
    if(d<clearance-1e-9){
      const nx=d>1e-8?dx/d:-sx/Math.sqrt(length2),nz=d>1e-8?dz/d:-sz/Math.sqrt(length2);
      x=enemy.x+nx*clearance;z=enemy.z+nz*clearance;dx=x-enemy.x;dz=z-enemy.z;
    }
    const dot=dx*sx+dz*sz,disc=dot*dot-length2*(dx*dx+dz*dz-clearance*clearance);
    let hit=dot<0&&disc>=0?(-dot-Math.sqrt(disc))/length2:Infinity;
    if(hit< -1e-7||hit>1){x+=sx;z+=sz;continue;}
    hit=Math.max(0,hit);blocked=true;
    x+=sx*hit;z+=sz*hit;
    dx=x-enemy.x;dz=z-enemy.z;d=Math.hypot(dx,dz);
    const nx=dx/d,nz=dz/d,rx=sx*(1-hit),rz=sz*(1-hit),inward=Math.min(0,rx*nx+rz*nz);
    x+=rx-nx*inward;z+=rz-nz*inward;
  }
  return {x,z,blocked};
}
