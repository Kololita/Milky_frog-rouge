import bpy,json,math
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data.action=bpy.data.actions['Laugh']
ids={s:[v.index for v in m.data.vertices if sum(g.weight for g in v.groups if m.vertex_groups[g.group].name.endswith('.'+s) and m.vertex_groups[g.group].name.startswith(('hand.','f_','thumb.','palm.')))>.6] for s in ['L','R']}
minimum=1;max_angle=0
for f in range(25,79):
 bpy.context.scene.frame_set(f);bpy.context.view_layer.update();b=rig.data.bones['spine.003'];deform=rig.matrix_world@rig.pose.bones[b.name].matrix@b.matrix_local.inverted()@rig.matrix_world.inverted();transform=m.matrix_world.inverted()@deform.inverted()
 e=m.evaluated_get(bpy.context.evaluated_depsgraph_get());d=e.to_mesh();pts=[transform@e.matrix_world@v.co for v in d.vertices];e.to_mesh_clear()
 left=min(pts[i].x for i in ids['L']);right=max(pts[i].x for i in ids['R']);minimum=min(minimum,left-right)
 for side in ['L','R']:
  fore=rig.pose.bones['forearm.'+side];wrist=rig.pose.bones['hand.'+side].head
  index=rig.pose.bones['f_index.01.'+side].head;outer=rig.pose.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head
  angle=math.degrees((fore.tail-fore.head).angle((index+outer)*.5-wrist));max_angle=max(max_angle,angle)
 assert max_angle<8,max_angle

 assert left>0 and right<0,(f,left,right)
report={'hands_stay_on_own_side':True,'minimum_gap_between_hand_vertices':minimum,'samples':54,'maximum_palm_forearm_angle_degrees':max_angle,'hand_vertices':{s:len(ids[s]) for s in ids},'fitted_eyes':json.loads((r/'output/animations/eye-boundaries.json').read_text())};print('REFINEMENT_VERIFIED',report);(r/'output/animations/refinement-verification.json').write_text(json.dumps(report,indent=2))
