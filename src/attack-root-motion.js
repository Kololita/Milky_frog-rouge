import { Vector3 } from 'three';

/** Keep authored vertical motion; transfer horizontal travel to the player. */
export function extractAttackRootMotion(clips, model, pattern = /^Attack[1-4]$/) {
  model.updateMatrixWorld(true);
  const spine = model.getObjectByName('spine');
  const motions = {};
  if (!spine) throw new Error('攻击缺少 spine 根骨骼');
  const parent = spine.parent.matrixWorld;
  const inverse = parent.clone().invert();
  for (const clip of clips.filter(c => pattern.test(c.name))) {
    const track = clip.tracks.find(t => t.name === 'spine.position');
    if (!track) throw new Error(`${clip.name} 缺少位移动画`);
    const start = new Vector3().fromArray(track.values);
    const values = new Float32Array(track.values.length);
    for (let i = 0; i < track.times.length; i++) {
      const local = new Vector3().fromArray(track.values, i*3);
      const worldDelta = local.clone().sub(start).applyMatrix4(parent).sub(new Vector3().applyMatrix4(parent));
      worldDelta.y = 0;
      worldDelta.toArray(values,i*3);
      const localDelta = worldDelta.clone().applyMatrix4(inverse).sub(new Vector3().applyMatrix4(inverse));
      local.sub(localDelta).toArray(track.values,i*3);
    }
    const motionTrack = track.clone(); motionTrack.values = values;
    motions[clip.name] = motionTrack.createInterpolant();
  }
  return motions;
}
