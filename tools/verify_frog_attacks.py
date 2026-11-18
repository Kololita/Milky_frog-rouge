"""Guard the source mesh, rest rig and all pre-existing non-attack animation."""
import bpy, hashlib, json, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]

def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
 def curves(action):
  rows=[]
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for c in bag.fcurves:
      if not any(tag in c.data_path for tag in ['pose.bones["f_', 'pose.bones["thumb.']):rows.append((c.data_path,c.array_index,[(tuple(p.co),p.interpolation) for p in c.keyframe_points]))
  return sorted(rows,key=str)
 return {'mesh':[tuple(v.co) for v in main.data.vertices],
  'faces':[tuple(p.vertices) for p in main.data.polygons],
  'bones':[(b.name,tuple(b.head_local),tuple(b.tail_local) if '.03.' not in b.name else None,b.parent.name if b.parent else '') for b in rig.data.bones if '.04.' not in b.name or not b.name.startswith(('f_', 'thumb.'))],
  'actions':{a.name:curves(a) for a in bpy.data.actions if not a.name.startswith(('Attack','Dodge'))}}

before=snapshot(root/'output/animations/_before-fingers-dodge.blend')
after=snapshot(root/'assets-source/blender/frog.blend')
for key in before:assert before[key]==after[key],f'Unrelated {key} changed'
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));inv=main.matrix_world.inverted()
def p(name):return inv@rig.matrix_world@rig.pose.bones[name].head
def flex(a,b,c):return 180-math.degrees((a-b).angle(c-b))
report={'preserved_mesh_rest_rig_and_other_actions':True,'poses':{}}
for stage,frame in [(1,7),(2,11),(3,5),(3,11),(3,17),(4,9),(4,15),(4,22)]:
 rig.animation_data.action=bpy.data.actions[f'Attack{stage}'];scene.frame_set(frame);bpy.context.view_layer.update()
 points={n:list(p(n)) for n in ['upper_arm.L','forearm.L','hand.L','upper_arm.R','forearm.R','hand.R','shin.R','foot.R','foot.L']}
 angles={s:flex(p('upper_arm.'+s),p('forearm.'+s),p('hand.'+s)) for s in ['L','R']}
 for s in ['L','R']:assert angles[s]<160,(stage,frame,'folded arm',angles)
 if stage==1:
  assert points['hand.L'][1]<.08 and points['hand.R'][2]<.60,points
 if stage==2:
  assert p('hand.R').y<.02 and p('hand.L').z<.60,'Right punch, left fist chambered'
  assert angles['R']<45,'Right straight punch is not extended'
  assert p('foot.R').y<p('foot.L').y-.14,'Right step is missing'
 if stage==3:
  active='R' if frame==11 else 'L';other='L' if active=='R' else 'R'
  assert p('hand.'+active).y<.08 and p('hand.'+other).z<.60,(frame,points)
 if stage==3 and frame==17:
  assert p('foot.L').y<p('foot.R').y-.07,'Left step is missing'
 if stage==4 and frame==9:
  # A rightward lean maps the upper torso's +Z direction towards local -X.
  relative=rig.data.bones['spine.001'].matrix_local.to_3x3() @ rig.pose.bones['spine.001'].rotation_quaternion.to_matrix() @ rig.data.bones['spine.001'].matrix_local.to_3x3().inverted()
  assert (relative@Vector((0,0,1))).x<-.06,'Charge should lean slightly to the right'
 if stage==4 and frame==22:
  assert p('foot.R').y<p('foot.L').y-.18,points
 report['poses'][f'{stage}-{frame}']={'elbowFlex':angles,'points':points}
# Compare feet across clip boundaries in the same world, including root travel.
def end_points(stage,frame):
 rig.animation_data.action=bpy.data.actions[f'Attack{stage}'];scene.frame_set(frame);bpy.context.view_layer.update()
 return [p('foot.'+s).copy() for s in ['L','R']]
for a,end,b,travel in [(2,24,3,.075),(3,26,4,.12)]:
 previous=end_points(a,end);following=end_points(b,1)
 errors=[(x-(y+Vector((0,-travel,0)))).length for x,y in zip(previous,following)]
 assert max(errors)<.001,(a,b,'Foot jump at transition',errors)
 report[f'transition_{a}_{b}_foot_errors']=errors
(root/'output/animations/attack-source-verification.json').write_text(json.dumps(report,indent=2))
print('ATTACK_SOURCE_VERIFIED',json.dumps(report))
