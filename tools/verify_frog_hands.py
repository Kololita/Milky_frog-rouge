"""Check real distal weights and anatomical closed/open finger trajectories."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));scene=bpy.context.scene
assert len(rig.data.bones)==149
report={'bones':149,'extra_joints':{},'poses':{}}
for s,prefixes in [('L',['f_index','f_ring','f_pinky','thumb']),('R',['f_index','f_middle','f_ring','thumb'])]:
 for prefix in prefixes:
  name=f'{prefix}.04.{s}';b=rig.data.bones[name];assert b.parent.name==f'{prefix}.03.{s}' and b.use_deform
  group=mesh.vertex_groups[name];ids=[v.index for v in mesh.data.vertices for g in v.groups if g.group==group.index and g.weight>.01]
  assert len(ids)>5,(name,len(ids));report['extra_joints'][name]={'weighted_vertices':len(ids)}
for name,frame,s,closed in [('Attack1',7,'L',True),('Attack2',11,'R',True),('Attack4',19,'R',False),('Run',8,'R',True)]:
 rig.animation_data.action=bpy.data.actions[name];scene.frame_set(frame);bpy.context.view_layer.update()
 def p(n):return rig.matrix_world@rig.pose.bones[n+'.'+s].head
 wrist=p('hand');i=p('f_index.01');o=p('f_pinky.01' if s=='L' else 'f_ring.01');f=((i+o)*.5-wrist).normalized();n=f.cross(o-i).normalized()*(-1 if s=='L' else 1)
 values={}
 prefixes=['f_index','f_ring','f_pinky'] if s=='L' else ['f_index','f_middle','f_ring']
 for prefix in prefixes:
  tip=rig.matrix_world@rig.pose.bones[prefix+'.04.'+s].tail;rootp=p(prefix+'.01')
  direction=(p(prefix+'.02')-rootp).normalized();offset=(tip-rootp).dot(f)
  if closed:assert offset<.005,(name,prefix,'finger tip still extended',offset)
  else:assert direction.dot(f)>.96,(name,prefix,'palm finger is hooked',direction.dot(f))
  values[prefix]={'tip_forward_offset':offset,'base_forward_alignment':direction.dot(f)}
 thumbtip=rig.matrix_world@rig.pose.bones['thumb.04.'+s].tail
 thumbdepth=(thumbtip-wrist).dot(n)
 if closed:assert thumbdepth<.055,(name,'thumb protrudes',thumbdepth)
 values['thumb_palm_normal_offset']=thumbdepth
 report['poses'][name+'-'+s]=values
# The exporter uses four influences. Keep source and runtime hand skin equal.
hand_groups={g.index for g in mesh.vertex_groups if g.name.startswith(('hand.','palm.','f_','thumb.'))}
for v in mesh.data.vertices:
 if sum(g.weight for g in v.groups if g.group in hand_groups)>.08:
  weights=[g.weight for g in v.groups if g.weight>1e-8]
  assert len(weights)<=4,(v.index,len(weights));assert abs(sum(weights)-1)<1e-5
(root/'output/animations/hand-kinematics-verification.json').write_text(json.dumps(report,indent=2));print('HANDS_VERIFIED',json.dumps(report))
