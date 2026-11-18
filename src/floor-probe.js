import {Box3,Vector3,Matrix4} from 'three';
/** Exact CPU clearance only; rendering skinning remains on the GPU. Cache each
 * bone transform once per sample instead of multiplying it for every vertex. */
export function createFloorProbe(model,{fullBody=false}={}) {
  model.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(model,true),point=new Vector3(),meshes=[],skeletons=new Map();
  const boneMatrix=new Matrix4(),worldBind=new Matrix4();
  const limit=bounds.min.y+(bounds.max.y-bounds.min.y)*.72;
  model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh || /^Frog_(?:eyelid|mouth|laugh)_/.test(mesh.name)) return;
    mesh.skeleton.update();const ids=[];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      if(fullBody || point.y<limit) ids.push(i);
    }
    if(ids.length) {
      const base=new Float64Array(ids.length*3),indices=new Uint16Array(ids.length*4),weights=new Float64Array(ids.length*4);
      const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
      for(let j=0;j<ids.length;j++) {
        const i=ids[j];point.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).toArray(base,j*3);
        for(let k=0;k<4;k++){indices[j*4+k]=skinIndex.getComponent(i,k);weights[j*4+k]=skinWeight.getComponent(i,k);}
      }
      if(!skeletons.has(mesh.skeleton))skeletons.set(mesh.skeleton,new Float64Array(mesh.skeleton.bones.length*16));
      meshes.push({mesh,ids,base,indices,weights,rows:new Float64Array(mesh.skeleton.bones.length*4)});
    }
  });
  return ()=>{
    model.updateWorldMatrix(true,true);
    let min=Infinity;
    for(const [skeleton,matrices] of skeletons)for(let i=0;i<skeleton.bones.length;i++) {
      boneMatrix.multiplyMatrices(skeleton.bones[i].matrixWorld,skeleton.boneInverses[i]);
      matrices.set(boneMatrix.elements,i*16);
    }
    for(const {mesh,ids,base,indices,weights,rows} of meshes) {
      // Keep the exact general Three.js path for active facial morphs.
      if(mesh.morphTargetInfluences?.some(w=>w!==0)) {
        for(const i of ids)min=Math.min(min,mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).y);
        continue;
      }
      worldBind.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);
      const e=worldBind.elements,matrices=skeletons.get(mesh.skeleton);
      for(let i=0;i<mesh.skeleton.bones.length;i++) {
        const m=i*16,r=i*4;
        rows[r]=e[1]*matrices[m]+e[5]*matrices[m+1]+e[9]*matrices[m+2];
        rows[r+1]=e[1]*matrices[m+4]+e[5]*matrices[m+5]+e[9]*matrices[m+6];
        rows[r+2]=e[1]*matrices[m+8]+e[5]*matrices[m+9]+e[9]*matrices[m+10];
        rows[r+3]=e[1]*matrices[m+12]+e[5]*matrices[m+13]+e[9]*matrices[m+14];
      }
      for(let j=0;j<ids.length;j++) {
        const v=j*3,x=base[v],y=base[v+1],z=base[v+2];let height=e[13];
        for(let k=0;k<4;k++) {
          const n=j*4+k,w=weights[n];if(w===0)continue;
          const r=indices[n]*4;height+=w*(rows[r]*x+rows[r+1]*y+rows[r+2]*z+rows[r+3]);
        }
        if(height<min)min=height;
      }
    }
    return Number.isFinite(min) ? min : 0;
  };
}
