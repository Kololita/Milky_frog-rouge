import {AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,Quaternion,Vector3,AnimationMixer,Box3,Matrix4,PropertyBinding} from 'three';
import {createLoadingBudget} from './loading-budget.js';

export function createPlayerHitClips(clips, model) {
 const job=bakePlayerHitClips(clips,model);
 let step=job.next();
 while(!step.done)step=job.next();
 return step.value;
}

export async function preparePlayerHitClips(clips, model) {
 const job=bakePlayerHitClips(clips,model),budget=createLoadingBudget();
 let step=job.next();
 while(!step.done){
  await budget.checkpoint();
  step=job.next();
 }
 return step.value;
}

/** Reuse the character's authored joints; only the armature root adds the airborne fall. */
function* bakePlayerHitClips(clips,model){
 const byName=new Map(clips.map(c=>[c.name,c]));if(!['Idle','Hit','Sit','Crouch','Block'].every(n=>byName.has(n)))return [];
 const definitions=[
  {name:'HitRecoil',duration:.65,poses:[[0,'Idle',0],[.10,'Block',.13],[.22,'Hit',.18],[.42,'Hit',.25],[.65,'Idle',0]]},
  {name:'HitSit',duration:3,poses:[[0,'Idle',0],[.6,'Sit',1.6],[1,'Sit',1.6],[1.65,'SeatRise',1.6],[2.25,'Crouch',.15],[3,'Idle',0]]},
  {name:'HitLaunch',duration:6,poses:[[0,'Idle',0],[.75,'Sit',1.6],[2.625,'Sit',1.6],[3.84,'Sit',1.6],[5.06,'Crouch',.15],[6,'Idle',0]],fall:true},
 ];
 const results=[];
 for(const def of definitions){
  const tracks=[];
  const legAxis=new Map();if(model){model.updateMatrixWorld(true);for(const side of ['L','R']){const bone=model.getObjectByName('thigh'+side);if(bone)legAxis.set('thigh'+side,new Vector3(1,0,0).applyQuaternion(bone.parent.getWorldQuaternion(new Quaternion()).invert()));}}
  for(const ref of byName.get('Idle').tracks){
   if(!/\.(quaternion|position)$/.test(ref.name)||ref.name==='jaw.position'||ref.name.startsWith('metarig.'))continue;
   const times=[],values=[],previous=new Quaternion();
   for(const [time,name,at]of def.poses){const arm=/^(?:upper_arm|forearm|hand|palm|f_|thumb)/.test(ref.name),sourceName=(name==='Sit'||name==='SeatRise')&&arm?(ref.name.startsWith('upper_arm')?'Crouch':'Idle'):name==='SeatRise'?'Sit':name,clip=byName.get(sourceName),source=clip.tracks.find(t=>t.name===ref.name)??ref,value=Array.from(source.createInterpolant().evaluate(Math.min(at,clip.duration)));if(ref.name.endsWith('.quaternion')){const q=new Quaternion().fromArray(value).normalize();if(name==='Sit'||name==='SeatRise'){const axis=legAxis.get(ref.name.replace('.quaternion',''));if(axis)q.premultiply(new Quaternion().setFromAxisAngle(axis,-.85));if(!def.fall&&ref.name==='spine001.quaternion')q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),name==='SeatRise'?.55:-1.6));if(ref.name==='spine.quaternion')q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.12));if(ref.name.startsWith('upper_arm'))q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),ref.name.includes('L')?-.22:.22));}if(times.length&&q.dot(previous)<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(value);previous.copy(q);}times.push(time);values.push(...value);}
   tracks.push(new (ref.name.endsWith('.quaternion')?QuaternionKeyframeTrack:VectorKeyframeTrack)(ref.name,times,values));
  }
  if(def.fall){
   const root=byName.get('Idle').tracks.find(t=>t.name==='metarig.position'),base=root?Array.from(root.createInterpolant().evaluate(0)):[-.0665,-.0412,0];
   const stages=[[0,0,0],[.18,-.45,.32],[.45,-Math.PI/2,.32],[1.4,-Math.PI/2,.32],[1.85,-1.15,.25],[2.15,-.65,.12],[2.7,0,0],[3.2,0,0]],times=stages.map(s=>s[0]*6/3.2);
   tracks.push(new QuaternionKeyframeTrack('metarig.quaternion',times,stages.flatMap(([,a])=>new Quaternion().setFromAxisAngle(new Vector3(1,0,0),a).toArray())));
   tracks.push(new VectorKeyframeTrack('metarig.position',times,stages.flatMap(([,a,h])=>[base[0],base[1]+h,base[2]])));
  }
  const result=new AnimationClip(def.name,def.duration,tracks.map(track=>easeTrack(track,def.duration)));
  if(def.name==='HitLaunch')staggerLegRecovery(result);
  yield;
  if(model&&def.name!=='HitRecoil'){
   yield* groundSeat(result,model,byName.get('Idle'));
   yield* bakeGroundSupport(result,model,byName.get('Idle'));
  }
  results.push(result);
 }
 return results;
}

// Mixer bindings skip unchanged values. Explicit sampling prevents offline IK
// and chest corrections from accumulating during a held source pose.
function poseSampler(clip,model){
 const bindings=clip.tracks.map(track=>({binding:PropertyBinding.create(model,track.name),sample:track.createInterpolant()}));
 return t=>{for(const {binding,sample}of bindings)binding.setValue(sample.evaluate(t),0);};
}

/** Bake ground contact once at load time, instead of probing every rendered frame. */
function* groundSeat(clip,model,idle){
 const saved=[];model.traverse(o=>saved.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const root=model.getObjectByName('metarig');if(!root)return;
 const mixer=new AnimationMixer(model);mixer.clipAction(idle).play();mixer.update(0);model.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(model,true),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3()),p=new Vector3(),meshes=[];
 model.traverse(mesh=>{if(!mesh.isSkinnedMesh||/^Frog_/.test(mesh.name))return;const seat=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);if(p.y>bounds.min.y+size.y*.28&&p.y<bounds.min.y+size.y*.56&&p.z<center.z)seat.push(i);}if(seat.length)meshes.push({mesh,seat});});
 mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();const samplePose=poseSampler(clip,model),times=[],values=[];
 for(let k=0;k<=66;k++){
  const t=clip.duration*k/66;action.time=t;mixer.update(0);samplePose(t);model.updateMatrixWorld(true);
  const enter=Math.max(0,Math.min(1,(t-.15)/.45)),leave=1-Math.max(0,Math.min(1,(t-1.2)/1.05)),weight=Math.min(enter,leave);
  let seatMin=Infinity,allMin=Infinity;for(const {mesh,seat}of meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);allMin=Math.min(allMin,p.y);}for(const i of seat){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);seatMin=Math.min(seatMin,p.y);}}
  const correction=Number.isFinite(allMin)?Math.max(clip.name==='HitSit'&&Number.isFinite(seatMin)?(bounds.min.y+.005-seatMin)*weight:0,bounds.min.y-allMin-.005):0;
  times.push(t);values.push(root.position.x,root.position.y+correction,root.position.z);
  yield;
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);for(const [o,position,q,scale]of saved){o.position.copy(position);o.quaternion.copy(q);o.scale.copy(scale);}model.updateMatrixWorld(true);
 clip.tracks=clip.tracks.filter(t=>t.name!=='metarig.position');clip.tracks.push(new VectorKeyframeTrack('metarig.position',times,values));
}

function easeTrack(track,duration){
 const quaternion=track.name.endsWith('.quaternion'),stride=quaternion?4:3,times=[],values=[];let segment=0;
 const a=new Quaternion(),b=new Quaternion();
 for(let frame=0;frame<=Math.ceil(duration*60);frame++){
  const t=Math.min(duration,frame/Math.ceil(duration*60)*duration);while(segment<track.times.length-2&&t>track.times[segment+1])segment++;
  const u=Math.max(0,Math.min(1,(t-track.times[segment])/(track.times[segment+1]-track.times[segment]))),blend=u*u*(3-2*u);times.push(t);
  if(quaternion){a.fromArray(track.values,segment*4);b.fromArray(track.values,(segment+1)*4);values.push(...a.slerp(b,blend).normalize().toArray());}
  else for(let k=0;k<stride;k++)values.push(track.values[segment*stride+k]+(track.values[(segment+1)*stride+k]-track.values[segment*stride+k])*blend);
 }
 return new (quaternion?QuaternionKeyframeTrack:VectorKeyframeTrack)(track.name,times,values);
}


/** Separate recovery beats: left leg plants first, right leg follows. */
function staggerLegRecovery(clip){
 for(const track of clip.tracks){
  const match=track.name.match(/^(?:thigh|shin|foot|toe\d*|heel\d*)(L|R)\./);if(!match)continue;
  const sample=track.clone().createInterpolant(),stride=track.getValueSize();
  for(let i=0;i<track.times.length;i++){
   const t=track.times[i]*3.2/6;if(t<2.05)continue;
   const start=match[1]==='L'?2.05:2.35,end=match[1]==='L'?2.85:3.2;
   const u=Math.max(0,Math.min(1,(t-start)/(end-start)));
   track.values.set(Array.from(sample.evaluate((2.05+u*(3.2-2.05))*6/3.2)).slice(0,stride),i*stride);
  }
 }
}

const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
/** Bake world-space hand contacts into ordinary quaternion tracks; no runtime IK. */
function* bakeGroundSupport(clip,model,idle){
 const saved=[];model.traverse(o=>saved.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const mixer=new AnimationMixer(model);mixer.clipAction(idle).play();mixer.update(0);model.updateMatrixWorld(true);
 const supportBounds=new Box3().setFromObject(model,true),floor=supportBounds.min.y;
 const supportWidth=supportBounds.getSize(new Vector3()).x*.48,supportCenter=supportBounds.getCenter(new Vector3()).x;
 const chains=['L','R'].map(side=>({side,upper:model.getObjectByName('upper_arm'+side),lower:model.getObjectByName('forearm'+side),hand:model.getObjectByName('hand'+side),idleWrist:model.getObjectByName('hand'+side)?.quaternion.clone()})).filter(c=>c.upper&&c.lower&&c.hand);
 mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();const samplePose=poseSampler(clip,model);
 const root=model.getObjectByName('metarig'),chest=model.getObjectByName('spine001'),rootValues=[],chestValues=[],meshes=[];model.traverse(o=>{if(!o.isSkinnedMesh)return;const indices=[],skin=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;for(let i=0;i<o.geometry.attributes.position.count;i++){let strongest=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,strongest))strongest=k;const name=o.skeleton.bones[skin.getComponent(i,strongest)].name;if(!/^(?:upper_arm|forearm|hand|palm|f_|thumb)/.test(name))indices.push(i);}meshes.push({mesh:o,indices});});
 const baked=new Map(chains.flatMap(c=>[c.upper,c.lower,c.hand].map(b=>[b.name,[]]))),times=[];
 for(let frame=0;frame<=Math.ceil(clip.duration*60);frame++){
  const t=clip.duration*frame/Math.ceil(clip.duration*60);action.time=t;mixer.update(0);samplePose(t);model.updateMatrixWorld(true);times.push(t);
  if(clip.name==='HitLaunch'&&chest){chest.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.55*smooth(1.8,2.15,t*3.2/6)*(1-smooth(2.35,2.85,t*3.2/6))));model.updateMatrixWorld(true);}
  // Recheck the final blended pose before planting either palm (feet can dip between source poses).
  let bottom=Infinity;const vertex=new Vector3();for(const {mesh,indices} of meshes){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);bottom=Math.min(bottom,vertex.y);}}
  if(root&&bottom<floor-.003){const scale=root.parent.getWorldScale(new Vector3()).y;root.position.y+=(floor-.003-bottom)/scale;model.updateMatrixWorld(true);}
  if(root)rootValues.push(...root.position.toArray());if(chest)chestValues.push(...chest.quaternion.toArray());
  for(const c of chains){
   const left=c.side==='L',fall=clip.name==='HitLaunch';
   const weight=fall?smooth(left?1.38:1.62,left?1.86:2.10,t*3.2/6)*(1-smooth(left?2.4:2.65,left?2.85:3.12,t*3.2/6)):smooth(left?.2:.25,.65,t)*(1-smooth(left?1.55:1.75,left?2.4:2.65,t));
   if(weight>0){
    const shoulder=c.upper.getWorldPosition(new Vector3()),side=left?1:-1;
    const neutral=c.idleWrist;
    const hip=model.getObjectByName('spine').getWorldPosition(new Vector3());
    const planted=new Vector3(supportCenter+side*supportWidth,floor+.045,shoulder.z-.02);
    const target=c.hand.getWorldPosition(new Vector3()).lerp(planted,weight);
    // Lift and withdraw around the flank, never through the belly.
    target.x=supportCenter+side*Math.max(side*(target.x-supportCenter),supportWidth*weight);
    solveSupportArm(c,target,new Vector3(supportCenter+side*(supportWidth+.18),shoulder.y*.45,hip.z-.18),weight);
    const parentWorld=c.hand.parent.getWorldQuaternion(new Quaternion());
    // The hand's local Y follows the fingers; local X is perpendicular to its palm.
    // Mirrored palms use opposite normals, with fingers pointing away from the body.
    const forward=new Vector3(side,0,0),normal=new Vector3(0,left?-1:1,0);
    const across=new Vector3().crossVectors(normal,forward).normalize();
    const world=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(normal,forward,across));
    const local=parentWorld.invert().multiply(world);
    // Restore the relaxed wrist as the palm leaves the floor. Capture in the
    // current forearm frame, instead of reusing yesterday's contact frame.
    const release=fall?(left?2.4:2.65)*6/3.2:(left?1.55:1.75);
    if(t>release&&!c.releasePose)c.releasePose=c.hand.quaternion.clone().slerp(local,weight);
    if(c.releasePose)c.hand.quaternion.copy(c.releasePose).slerp(neutral,smooth(release,release+.45,t));
    else c.hand.quaternion.copy(neutral).slerp(local,weight);
    model.updateMatrixWorld(true);
   }
   if(weight===0)c.hand.quaternion.copy(c.idleWrist);
   c.previousWeight=weight;
   for(const bone of [c.upper,c.lower,c.hand]){
    const values=baked.get(bone.name),q=bone.quaternion.clone();if(values.length&&q.dot(new Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(...q.toArray());
   }
  }
  yield;
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);for(const [o,p,q,s]of saved){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}model.updateMatrixWorld(true);
 if(root){clip.tracks=clip.tracks.filter(t=>t.name!=='metarig.position');clip.tracks.push(new VectorKeyframeTrack('metarig.position',times,rootValues));}if(chest&&clip.name==='HitLaunch'){clip.tracks=clip.tracks.filter(t=>t.name!=='spine001.quaternion');clip.tracks.push(new QuaternionKeyframeTrack('spine001.quaternion',times,chestValues));}
 for(const [name,values]of baked){clip.tracks=clip.tracks.filter(t=>t.name!==name+'.quaternion');clip.tracks.push(new QuaternionKeyframeTrack(name+'.quaternion',times,values));}
}

function solveSupportArm(c,target,pole,weight){
 const a=c.upper.getWorldPosition(new Vector3()),b=c.lower.getWorldPosition(new Vector3()),end=c.hand.getWorldPosition(new Vector3());
 const l1=a.distanceTo(b),l2=b.distanceTo(end),direction=target.clone().sub(a),distance=Math.max(.001,Math.min(direction.length(),(l1+l2)*.998));direction.normalize();
 const bend=pole.clone().sub(a).addScaledVector(direction,-pole.clone().sub(a).dot(direction)).normalize();
 const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const elbow=a.clone().addScaledVector(direction,along).addScaledVector(bend,height),wrist=a.clone().addScaledVector(direction,distance);
 for(const [bone,child,destination]of [[c.upper,c.lower,elbow],[c.lower,c.hand,wrist]]){
  const origin=bone.getWorldPosition(new Vector3()),from=child.getWorldPosition(new Vector3()).sub(origin).normalize(),to=destination.clone().sub(origin).normalize();
  const world=new Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new Quaternion()));
  const local=bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world);bone.quaternion.slerp(local,weight);bone.updateWorldMatrix(false,true);
 }
 // Refine against the actual transformed chain, including the imported rig's scale.
 if(weight>.95)for(let pass=0;pass<6;pass++)for(const bone of [c.lower,c.upper]){
  const origin=bone.getWorldPosition(new Vector3()),from=c.hand.getWorldPosition(new Vector3()).sub(origin).normalize(),to=wrist.clone().sub(origin).normalize();
  const world=new Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new Quaternion()));
  const local=bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world);bone.quaternion.slerp(local,smooth(.95,1,weight));bone.updateWorldMatrix(false,true);
 }
}
