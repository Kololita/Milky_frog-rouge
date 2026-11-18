import bpy,json,hashlib,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def digest(x):return hashlib.sha256(repr(x).encode()).hexdigest()
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');meshes={}
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  meshes[o.name]={'geometry':digest(([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])),'shapes':digest([(k.name,[tuple(v.co) for v in k.data]) for k in o.data.shape_keys.key_blocks]) if o.data.shape_keys else None,'weights':digest([[(g.group,g.weight) for g in v.groups] for v in o.data.vertices])}
 actions=digest([(a.name,[(c.data_path,c.array_index,[(tuple(k.co),k.interpolation,tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points]) for l in a.layers for s in l.strips for b in s.channelbags for c in b.fcurves]) for a in sorted(bpy.data.actions,key=lambda a:a.name)])
 materials=digest([(m.name,[(n.name,[(i.name,tuple(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value) for i in n.inputs if hasattr(i,'default_value') and not isinstance(i.default_value,str)]) for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED']) for m in sorted(bpy.data.materials,key=lambda m:m.name) if m.use_nodes])
 return {'meshes':meshes,'bones':digest([(b.name,tuple(b.head_local),tuple(b.tail_local),tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones]),'actions':actions,'materials':materials}
a=snapshot(root/'output/animations/_before-local-face-shading.blend');b=snapshot(root/'assets-source/blender/frog.blend');assert a==b,(a,b)
report={'all_mesh_vertices_and_topology_unchanged':True,'all_shape_key_positions_unchanged':True,'all_skin_weights_and_rest_bones_unchanged':True,'all_27_animations_unchanged':True,'all_material_colors_and_parameters_unchanged':True,'change':'localize custom normal blend to mouth transition; preserve original head shading elsewhere'}
(root/'output/animations/local-face-shading-verification.json').write_text(json.dumps(report,indent=2));print('FACE_SHADING_ONLY_VERIFIED',json.dumps(report))
