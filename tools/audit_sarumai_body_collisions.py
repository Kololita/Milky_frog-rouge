import bpy,json,sys
from pathlib import Path
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree
root=Path.cwd()
if '--glb'in sys.argv:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60;bpy.ops.import_scene.gltf(filepath=str(root/'docs/sarumai.glb'))
else:bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/sarumai.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=bpy.data.objects['samurai_body'];blade=bpy.data.objects['samurai_blade'];groups={g.index:g.name for g in body.vertex_groups}
core=[]
for f in body.data.polygons:
 p=sum((body.matrix_world@body.data.vertices[i].co for i in f.vertices),V())/len(f.vertices)
 if abs(p.x)<.46 and p.z>.05:
  w=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group]in ['root','pelvis','spine','chest','neck','head']or groups[g.group].startswith('leg_'))for i in f.vertices)/len(f.vertices)
  if w>.55:core.append(tuple(f.vertices))
hands=[]
for f in body.data.polygons:
 w=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group].startswith('finger_')or groups[g.group].startswith('hand_'))for i in f.vertices)/len(f.vertices)
 if w>.65:hands.append(tuple(f.vertices))
print('CORE_FACES',len(core));report={};deps=bpy.context.evaluated_depsgraph_get()
for action in bpy.data.actions:
 if action.name not in ['Idle','Walk','Hurt','Death','CrossLeft','CrossRight','Overhead','Rising','RisingLeft','RisingRight','ShortThrust','LongThrust','RoundSweep','BuriedOverhead','Extract','DoubleLeft','DoubleRight','Backstep','CounterThrust','PhaseShift']:continue
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];hits=[]
 for sample in range(121):
  frame=sample/2
  source_frame=frame*float(action.frame_range[1])/60;bpy.context.scene.frame_set(int(source_frame),subframe=source_frame%1);e=body.evaluated_get(deps);mesh=e.to_mesh();points=[e.matrix_world@v.co for v in mesh.vertices];tree=BVHTree.FromPolygons(points,core,all_triangles=False,epsilon=.0001);hand_hits=len(tree.overlap(BVHTree.FromPolygons(points,hands)));e.to_mesh_clear();e=blade.evaluated_get(deps);mesh=e.to_mesh();bt=BVHTree.FromPolygons([e.matrix_world@v.co for v in mesh.vertices],[tuple(f.vertices)for f in mesh.polygons]);overlap=tree.overlap(bt);e.to_mesh_clear();inside=[]
  for side in 'LR':
   p=rig.matrix_world@(rig.pose.bones['hand_'+side].matrix@V((0,.045,0)));votes=0;nearest=tree.find_nearest(p)
   if nearest and nearest[3]>.012:
    for direction in [V((1,.013,.007)),V((.017,1,.009)),V((.011,.003,1))]:
     pos=p.copy();n=0
     for _ in range(12):
      loc,normal,index,d=tree.ray_cast(pos,direction,5)
      if loc is None:break
      n+=1;pos=loc+direction*.0005
     votes+=n%2
    if votes>=2:inside.append(side)
  if overlap or inside or hand_hits:hits.append({'frame':frame,'blade_faces':len(overlap),'hands':inside,'hand_faces':hand_hits})
 report[action.name]=hits;print(action.name,len(hits),'worst',max(hits,key=lambda x:x['blade_faces'])if hits else None)
(root/('output/sarumai-glb-collision-audit.json'if '--glb'in sys.argv else 'output/sarumai-body-collision-audit.json')).write_text(json.dumps(report,indent=2))
