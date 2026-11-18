"""Local surface and hand-color cleanup; preserve topology, rest bones and all actions."""
import bpy,json,math,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
r=Path(__file__).resolve().parents[1];source=r/'assets-source/blender/frog.blend';digest=hashlib.sha256(source.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
if m.get('surface_cleanup_version'):
 print('Surface cleanup is already applied; export using refine_frog_mouth.py.');raise SystemExit(0)
def action_signature():
 payload=[]
 for a in bpy.data.actions:
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for f in bag.fcurves:payload.append((a.name,bag.slot_handle,f.data_path,f.array_index,[(tuple(p.co),p.interpolation,tuple(p.handle_left),tuple(p.handle_right)) for p in f.keyframe_points]))
 return hashlib.sha256(repr(payload).encode()).hexdigest()
signature=action_signature();bones=[(b.name,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones];topology=(len(m.data.vertices),len(m.data.edges),len(m.data.polygons))
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  if o.data.shape_keys.animation_data:o.data.shape_keys.animation_data.action=None
  for k in o.data.shape_keys.key_blocks:k.value=0
base=np.array([v.co[:] for v in m.data.shape_keys.key_blocks['Basis'].data]);neighbors=[set() for _ in base]
for e in m.data.edges:
 a,b=e.vertices;neighbors[a].add(b);neighbors[b].add(a)
def smoothstep(t):t=max(0,min(1,t));return t*t*(3-2*t)
shoulder={}
for i,(x,y,z) in enumerate(base):
 if .125<abs(x)<.32 and .62<z<.82:
  w=smoothstep((abs(x)-.125)/.035)*smoothstep((.32-abs(x))/.035)*smoothstep((z-.62)/.035)*smoothstep((.82-z)/.035)
  if w>0:shoulder[i]=w
points=base.copy()
for iteration in range(4):
 for rate in [.32,-.335]:
  delta=np.zeros_like(points)
  for i,w in shoulder.items():delta[i]=(points[list(neighbors[i])].mean(0)-points[i])*rate*w
  points+=delta
changes=points-base
for i in shoulder:
 length=np.linalg.norm(changes[i])
 if length>.0035:changes[i]*=.0035/length
face_count=0
for i,(x,y,z) in enumerate(base):
 if abs(x)<.041 and y<.22 and .936<z<1.002:
  w=math.exp(-((x/.023)**2+((z-.967)/.024)**2))*smoothstep((z-.936)/.01)*smoothstep((1.002-z)/.01)*smoothstep((.041-abs(x))/.009)
  changes[i,1]-=.0028*w;face_count+=int(w>.005)
for key in m.data.shape_keys.key_blocks:
 for i,v in enumerate(key.data):v.co+=Vector(changes[i])
for i,v in enumerate(m.data.vertices):v.co=m.data.shape_keys.key_blocks['Basis'].data[i].co
# Replace jagged polygon/UV cuffs with one continuous vertex-color transition.
gold=tuple(bpy.data.materials['Frog unified gold'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)
brown=tuple(bpy.data.materials['Frog brown hands'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)
mat=bpy.data.materials.get('Frog smooth hand colors') or bpy.data.materials.new('Frog smooth hand colors');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();shader=nodes.new('ShaderNodeBsdfPrincipled');out=nodes.new('ShaderNodeOutputMaterial');color=nodes.new('ShaderNodeVertexColor');color.layer_name='HandColor';mat.node_tree.links.new(color.outputs['Color'],shader.inputs['Base Color']);mat.node_tree.links.new(shader.outputs['BSDF'],out.inputs['Surface']);shader.inputs['Roughness'].default_value=.8;shader.inputs['Specular IOR Level'].default_value=.15;mat.diffuse_color=brown
if mat.name not in [x.name for x in m.data.materials]:m.data.materials.append(mat)
slot=list(m.data.materials).index(mat);attr=m.data.color_attributes.get('HandColor') or m.data.color_attributes.new(name='HandColor',type='FLOAT_COLOR',domain='CORNER');T=m.matrix_world.inverted()@rig.matrix_world
hand_colors={};hand_ids=set()
for side,s in [('L',1),('R',-1)]:
 wrist=T@rig.data.bones['hand.'+side].head_local;index=T@rig.data.bones['f_index.01.'+side].head_local;outer=T@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local;forward=((index+outer)*.5-wrist).normalized()
 for i,v in enumerate(m.data.vertices):
  if s*v.co.x<.32:continue
  d=v.co-wrist;along=d.dot(forward);radial=(d-forward*along).length
  if along>-.075 and radial<.13:
   w=smoothstep((along+.016)/.026);hand_colors[i]=tuple(gold[j]*(1-w)+brown[j]*w for j in range(3))+(1,);hand_ids.add(i)
hand_faces=0
for p in m.data.polygons:
 if any(i in hand_ids for i in p.vertices):
  p.material_index=slot;hand_faces+=1
  for li in p.loop_indices:attr.data[li].color=hand_colors.get(m.data.loops[li].vertex_index,gold)
# Match the reflectance of all yellow exterior repairs and hand colors.
for material in m.data.materials:
 sh=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if sh and material.name not in ['Frog oral lining','Frog oral depth']:
  sh.inputs['Roughness'].default_value=.8;sh.inputs['Specular IOR Level'].default_value=.15
# Discard stale split normals; keep only the actual mouth's exterior/interior hard seam.
edge_faces={tuple(sorted(e.vertices)):[] for e in m.data.edges}
for p in m.data.polygons:
 p.use_smooth=True
 for a,b in p.edge_keys:edge_faces[tuple(sorted((a,b)))].append(p.material_index)
sharp=m.data.attributes.get('sharp_edge') or m.data.attributes.new('sharp_edge','BOOLEAN','EDGE')
for e in m.data.edges:
 mats=edge_faces[tuple(sorted(e.vertices))];sharp.data[e.index].value=any(i in [4,5] for i in mats) and any(i not in [4,5] for i in mats)
m.data.normals_split_custom_set([(0,0,0)]*len(m.data.loops));m.data.update()
# Use the same exterior skin normals across material boundaries, excluding oral walls.
normal_sum=[Vector((0,0,0)) for _ in base]
for p in m.data.polygons:
 if p.material_index in [4,5]:continue
 for i in p.vertices:normal_sum[i]+=p.normal*p.area
for n in normal_sum:
 if n.length:n.normalize()
normals=[tuple(n.vector) for n in m.data.corner_normals]
for p in m.data.polygons:
 if p.material_index in [4,5]:continue
 for li in p.loop_indices:normals[li]=normal_sum[m.data.loops[li].vertex_index][:]
m.data.normals_split_custom_set(normals)
assert topology==(len(m.data.vertices),len(m.data.edges),len(m.data.polygons));assert bones==[(b.name,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones];assert signature==action_signature()
report={'topology_unchanged':True,'vertices':len(base),'faces':len(m.data.polygons),'shoulder_vertices_smoothed':sum(np.linalg.norm(changes[i])>1e-7 for i in shoulder),'max_shoulder_adjustment':max(np.linalg.norm(changes[i]) for i in shoulder),'midface_vertices_adjusted':face_count,'max_midface_adjustment':float(max(-changes[:,1])),'hand_faces_recolored':hand_faces,'rest_bones_unchanged':True,'all_animation_curves_unchanged':True,'material_roughness':.8,'skin_specular':.15,'normals':'continuous exterior skin normals; mouth interior split'}
m['surface_cleanup_version']=1
import sys;sys.path.insert(0,str(r/'tools'))
from frog_surface import smooth_skin_normals,bake_hand_gradient
smooth_skin_normals(m);bake_hand_gradient(m)
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1);assert digest==hashlib.sha256(source.read_bytes()).hexdigest();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(r/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
(r/'output/animations/surface-cleanup.json').write_text(json.dumps(report,indent=2,default=lambda v:int(v) if isinstance(v,np.integer) else float(v)));print('SURFACE_CLEANUP',report)
