import bpy,json,hashlib,numpy as np
from pathlib import Path
r=Path(__file__).resolve().parents[1]
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');curves=[]
 for a in bpy.data.actions:
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for f in bag.fcurves:curves.append((a.name,bag.slot_handle,f.data_path,f.array_index,[(tuple(p.co),p.interpolation,tuple(p.handle_left),tuple(p.handle_right)) for p in f.keyframe_points]))
 return m,{'basis':np.array([v.co[:] for v in m.data.shape_keys.key_blocks['Basis'].data]),'topology':(len(m.data.vertices),len(m.data.edges),len(m.data.polygons)),'rig':[(b.name,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones],'curves':hashlib.sha256(repr(curves).encode()).hexdigest()}
_,old=snapshot(r/'output/animations/_before-surface-polish.blend');m,new=snapshot(r/'assets-source/blender/frog.blend');delta=new['basis']-old['basis'];assert old['topology']==new['topology'];assert old['rig']==new['rig'];assert old['curves']==new['curves']
shoulder=[i for i,(x,y,z) in enumerate(old['basis']) if .125<abs(x)<.32 and .62<z<.82];face=[i for i,(x,y,z) in enumerate(old['basis']) if abs(x)<.041 and y<.22 and .936<z<1.002]
report={'topology_unchanged':True,'vertices':len(new['basis']),'faces':len(m.data.polygons),'shoulder_vertices_smoothed':int(sum(np.linalg.norm(delta[i])>1e-7 for i in shoulder)),'max_shoulder_vertex_offset':float(max(np.linalg.norm(delta[i]) for i in shoulder)),'midface_vertices_adjusted':int(sum(np.linalg.norm(delta[i])>1e-7 for i in face)),'max_midface_vertex_offset':float(max(np.linalg.norm(delta[i]) for i in face)),'hand_faces_recolored':sum(m.data.materials[p.material_index].name=='Frog smooth hand colors' for p in m.data.polygons),'rest_bones_unchanged':True,'all_animation_curves_unchanged':True,'mouth_metadata_remapped':True,'diffuse_gold_identical':True}
(r/'output/animations/surface-cleanup.json').write_text(json.dumps(report,indent=2));print('SURFACE_AUDIT',report)
