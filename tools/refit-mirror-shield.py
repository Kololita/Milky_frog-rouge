import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V,Quaternion as Q,Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/blender/rigged/mirrorGuard.blend'))
bpy.context.preferences.filepaths.save_version=0
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rest={b.name:b.matrix_local.copy()for b in rig.data.bones}
def arm(side,goal,delta):
 upper='upper_arm_'+side;lower='forearm_'+side;hand='hand_'+side
 origin=rig.pose.bones[upper].head.copy();goal=V(goal);axis=(goal-origin).normalized();l1=rig.data.bones[upper].length;l2=rig.data.bones[lower].length;d=min((goal-origin).length,l1+l2-.006);along=(l1*l1+d*d-l2*l2)/(2*d)
 pole=V((-.55 if side=='L'else .55,.10,.8));perp=pole-origin-axis*(pole-origin).dot(axis);perp.normalize();elbow=origin+axis*along+perp*math.sqrt(max(0,l1*l1-along*along));end=origin+axis*d
 source_normal=(rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local).cross(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local).normalized();normal=(elbow-origin).cross(end-elbow).normalized()
 for n,a,b in [(upper,origin,elbow),(lower,elbow,end)]:
  sy=(rig.data.bones[n].tail_local-rig.data.bones[n].head_local).normalized();ty=(b-a).normalized();sz=source_normal.cross(sy).normalized();tz=normal.cross(ty).normalized();rot=Matrix((normal,ty,tz)).transposed().to_quaternion()@Matrix((source_normal,sy,sz)).transposed().to_quaternion().inverted()@rest[n].to_quaternion();rig.pose.bones[n].matrix=Matrix.Translation(a)@rot.to_matrix().to_4x4();bpy.context.view_layer.update()
 rig.pose.bones[hand].matrix=Matrix.Translation(end)@delta.to_matrix().to_4x4()@rest[hand].to_3x3().to_4x4();bpy.context.view_layer.update()
 if 'elbow_'+side in rig.pose.bones:rig.pose.bones['elbow_'+side].rotation_quaternion=rig.pose.bones[lower].rotation_quaternion.copy()
def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)

# Refit the glass to the actual plate, retaining its eight sectors.
n=V((-.5340766,-.8423528,.0721385));u=V((.837306,-.538817,-.092711));v=n.cross(u).normalized();center=V((-.367025,-.022812,.932995))
plate=bpy.data.objects['mirrorGuard_shield'];dist=sorted((plate.matrix_world@p.co-center).dot(n)for p in plate.data.vertices);depth=dist[int(len(dist)*.88)]+.002
for i in range(8):
 o=bpy.data.objects.get('MirrorFacet_'+str(i))
 if not o:continue
 a=i*math.tau/8;b=(i+1)*math.tau/8
 for vert,(r,t) in zip(o.data.vertices,[(.24,a),(.84,a),(.84,b),(.24,b)]):vert.co=center+n*depth+u*(math.cos(t)*.32*r)+v*(math.sin(t)*.37*r)
for name in ['Parry']:
 action=bpy.data.actions[name];rig.animation_data.action=action
 for frame in range(61):
  bpy.context.scene.frame_set(frame);arm('L',(-.12,-.38,1.10),n.rotation_difference(V((0,-math.cos(math.radians(10)),math.sin(math.radians(10))))))
  for bn in ['upper_arm_L','forearm_L','hand_L','elbow_L']:
   if bn in rig.pose.bones:
    for prop in ['location','rotation_quaternion','scale']:rig.pose.bones[bn].keyframe_insert(prop,frame=frame)
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender/rigged/mirrorGuard.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/enemies/mirrorGuard.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True)
for dest in ['docs/mirrorGuard.glb','assets-source/blender/mirrorGuard.glb']:shutil.copy2(ROOT/'public/models/enemies/mirrorGuard.glb',ROOT/dest)
