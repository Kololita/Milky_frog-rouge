import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
path=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root/'assets-source/blender/frog.blend'
bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data.action=bpy.data.actions['Laugh']
names=[p.name for p in rig.pose.bones if p.name.startswith(('upper_arm.','forearm.','hand.','f_','thumb.'))]
samples={n:[] for n in names};positions={s:[] for s in ['L','R']}
for frame in range(1,105):
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
 for n in names:samples[n].append(rig.pose.bones[n].rotation_quaternion.copy())
 inv=(rig.matrix_world@rig.pose.bones['spine.001'].matrix).inverted()
 for side in positions:positions[side].append(inv@(rig.matrix_world@rig.pose.bones['hand.'+side].head))
report={}
for n,qs in samples.items():
 steps=[math.degrees(a.rotation_difference(b).angle) for a,b in zip(qs,qs[1:])]
 # Abs quaternion dots ignore antipodal representations.
 steps=[min(s,360-s) for s in steps]
 accel=[]
 for a,b,c in zip(qs,qs[1:],qs[2:]):
  mid=a.slerp(c,.5);angle=math.degrees(mid.rotation_difference(b).angle);accel.append(min(angle,360-angle)*2)
 report[n]={'maxStep':max(steps[15:91]),'maxJitter':max(accel[15:90]),'worstFrame':16+max(range(75),key=lambda i:accel[15+i])}
result={'bones':dict(sorted(report.items(),key=lambda p:p[1]['maxJitter'],reverse=True)), 'wristLocalSecondDifference':{s:max((p[i+1]-p[i]*2+p[i-1]).length for i in range(16,91)) for s,p in positions.items()}}
out=root/'output/animations'/('laugh-jitter-before.json' if '--' not in sys.argv else 'laugh-jitter-after.json');out.write_text(json.dumps(result,indent=2));print('JITTER',json.dumps({'top':dict(list(result['bones'].items())[:12]),'wrist':result['wristLocalSecondDifference']}))
