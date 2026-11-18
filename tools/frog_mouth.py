"""An actual welded mouth opening, oral pouch, and a volumetric tongue."""
import bpy,bmesh,json,math,numpy as np
from mathutils import Vector,Matrix
from pathlib import Path

JAW_TRAVEL=.012

def mouth_material(name,color,roughness=.85):
 mat=bpy.data.materials.get(name) or bpy.data.materials.new(name);mat.use_nodes=True;mat.diffuse_color=color
 nodes=mat.node_tree.nodes;nodes.clear();shader=nodes.new('ShaderNodeBsdfPrincipled');output=nodes.new('ShaderNodeOutputMaterial')
 shader.inputs['Base Color'].default_value=color;shader.inputs['Roughness'].default_value=roughness
 shader.inputs['Specular IOR Level'].default_value=.15
 mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface']);mat.use_backface_culling=False
 return mat

def head_surface_y(x,z,profile):
 x=(x-.001)/.072;z=(z-.890)/.05
 return float(np.array([1,x,z,x*x,x*z,z*z])@np.array(profile))

def patch_positions(layout,u,profile=None):
 result=[]
 for control in layout:
  role,angle,blend,boundary,jaw_weight=control[:5]
  if role==9:
   # Intermediate exterior support rings. Preserve the original mouth motion,
   # while sampling its rounded neutral surface instead of a wide flat bridge.
   rim=[4,angle,1,control[3],control[5]]
   rest=patch_positions([rim],0,profile)[0]
   co=Vector(control[3]).lerp(rest,blend)
   co.y=head_surface_y(co.x,co.z,profile)
   co+=(patch_positions([rim],u,profile)[0]-rest)*blend
   result.append(co)
   continue
  c,s=math.cos(angle),math.sin(angle);boundary=Vector(boundary);boundary.z-=JAW_TRAVEL*u*jaw_weight
  x=.001+(.048+.002*u)*c
  z=.904+.003*c*c+u*(.019*max(s,0)-.045*max(-s,0)+.001*c*c)+(.00035 if profile else .0008)*s
  y=head_surface_y(x,z,profile) if profile else .173+.025*((x-.001)/.058)**2+.6*(z-.904)**2
  edge=Vector((x,y,z));outer=edge+Vector((.0025*c,-.0015,.002*s))
  if role in [1,2]:
   co=boundary.lerp(edge if blend==.5 else outer,blend)
   if blend==.5:co.y-=.001*math.sin(math.pi*blend)
  elif role==3:co=outer
  elif role==4:co=edge
  elif role==5:co=Vector((.001+(x-.001)*.98,y+.005,z))
  elif role==6:co=Vector((.001+.047*c,.210+.012*c*c,.889+.035*s))
  elif role==7:co=Vector((.001+.035*c,.244+.004*c*c,.888+.028*s))
  else:co=Vector((.001,.253,.888))
  # Shape keys are authored before the traditional FK jaw deformation.
  co.z+=JAW_TRAVEL*u*jaw_weight
  result.append(co)
 return result

def build_mouth(mesh,rig):
 if mesh.get('mouth_topology_version',0)>=1:return
 root=Path(__file__).resolve().parents[1]
 if rig.animation_data:rig.animation_data.action=None
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 for obj in bpy.context.scene.objects:
  if obj.type=='MESH' and obj.data.shape_keys:
   if obj.data.shape_keys.animation_data:obj.data.shape_keys.animation_data.action=None
   for key in obj.data.shape_keys.key_blocks:key.value=0
 bpy.context.view_layer.update()
 # Keep a clean skin UV sample; the painted old smile is removed with the patch.
 sample=min(mesh.data.vertices,key=lambda v:abs(v.co.x)+2*abs(v.co.z-.938)+abs(v.co.y-.18))
 loop=next(l for l in mesh.data.loops if l.vertex_index==sample.index)
 skin_uv=mesh.data.uv_layers.active.data[loop.index].uv.copy()
 initial_vertices=len(mesh.data.vertices);initial_faces=len(mesh.data.polygons)
 mesh.shape_key_clear()
 bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
 old_ids=bm.verts.layers.int.new('mouth_original_vertex')
 for i,v in enumerate(bm.verts):v[old_ids]=i+1
 deform=bm.verts.layers.deform.active
 face_group=mesh.vertex_groups['face'].index;jaw_group=mesh.vertex_groups['jaw'].index
 selected={f for f in bm.faces if f.calc_center_median().y<.23 and ((f.calc_center_median().x-.001)/.072)**2+((f.calc_center_median().z-.890)/.047)**2<1}
 assert selected,'No mouth patch selected'
 frontier=[e for e in bm.edges if len(e.link_faces)==2 and sum(f in selected for f in e.link_faces)==1]
 neighbors={}
 for e in frontier:
  a,b=e.verts;neighbors.setdefault(a,[]).append(b);neighbors.setdefault(b,[]).append(a)
 assert all(len(n)==2 for n in neighbors.values()),'Mouth patch has a branched boundary'
 start=min(neighbors,key=lambda v:v.co.x);cycle=[start];previous=None;current=start
 while True:
  nxt=next(v for v in neighbors[current] if v!=previous)
  if nxt==start:break
  assert nxt not in cycle,'Mouth boundary is not a simple loop'
  cycle.append(nxt);previous,current=current,nxt
 assert len(cycle)==len(neighbors),'Multiple mouth boundaries'
 area=sum(a.co.x*b.co.z-b.co.x*a.co.z for a,b in zip(cycle,cycle[1:]+cycle[:1]))
 if area<0:cycle.reverse()
 boundary=[v.co.copy() for v in cycle]
 outside=[tuple(v.co) for v in bm.verts if not v.link_faces or any(f not in selected for f in v.link_faces)]
 angles=[math.atan2((v.co.z-.890)/.047,(v.co.x-.001)/.072) for v in cycle]
 # A circular angular order keeps the upper/lower lips consistent across sides.
 jaw_boundary=[v[deform].get(jaw_group,0) for v in cycle]
 removed=len(selected);bmesh.ops.delete(bm,geom=list(selected),context='FACES')
 lining=mouth_material('Frog oral lining',(.095,.012,.018,1));deep=mouth_material('Frog oral depth',(.012,.002,.004,1))
 for mat in [lining,deep]:
  if mat.name not in [m.name for m in mesh.data.materials]:mesh.data.materials.append(mat)
 lining_index=list(mesh.data.materials).index(lining);deep_index=list(mesh.data.materials).index(deep)
 uv_layer=bm.loops.layers.uv.active
 controls=[];new_verts=[];rings=[cycle]
 for role,blend in [(1,.34),(2,.68),(3,1),(4,1),(5,1),(6,1),(7,1)]:
  ring=[]
  for i,a in enumerate(angles):
   s=math.sin(a)
   lip_jaw=max(0,-s)**.65
   weight=jaw_boundary[i]*(1-blend)+lip_jaw*blend if role in [1,2] else lip_jaw if role in [3,4,5] else .25*lip_jaw
   control=[role,a,blend,list(boundary[i]),weight];co=patch_positions([control],0)[0]
   v=bm.verts.new(co);v[deform][face_group]=1-weight
   if weight:v[deform][jaw_group]=weight
   controls.append(control);new_verts.append(v);ring.append(v)
  rings.append(ring)
 new_faces=[]
 for r in range(len(rings)-1):
  outer,inner=rings[r],rings[r+1]
  for i in range(len(cycle)):
   j=(i+1)%len(cycle);f=bm.faces.new((outer[i],outer[j],inner[j],inner[i]));f.smooth=True
   f.material_index=0 if r<4 else lining_index if r<6 else deep_index
   for loop in f.loops:loop[uv_layer].uv=skin_uv
   new_faces.append(f)
 cap_control=[8,0,1,[.001,.253,.888],0];cap=bm.verts.new(Vector((.001,.253,.888)));cap[deform][face_group]=1
 controls.append(cap_control);new_verts.append(cap)
 for i in range(len(cycle)):
  f=bm.faces.new((rings[-1][i],rings[-1][(i+1)%len(cycle)],cap));f.material_index=deep_index;f.smooth=True
  for loop in f.loops:loop[uv_layer].uv=skin_uv
  new_faces.append(f)
 bmesh.ops.recalc_face_normals(bm,faces=new_faces)
 assert all(len(e.link_faces)==2 for f in new_faces for e in f.edges),'Mouth is not welded/manifold'
 bm.verts.index_update();new_ids=[v.index for v in new_verts];boundary_ids=[v.index for v in cycle]
 after_set={tuple(v.co) for v in bm.verts};assert all(co in after_set for co in outside),'A vertex outside the mouth patch moved'
 bm.to_mesh(mesh.data);bm.free();mesh.data.update()
 mesh.shape_key_add(name='Basis');mesh.shape_key_add(name='Blink');mesh.shape_key_add(name='LaughOpen')
 mesh['mouth_topology_version']=1;mesh['mouth_controls']=json.dumps(controls);mesh['mouth_vertex_ids']=json.dumps(new_ids);mesh['mouth_boundary_ids']=json.dumps(boundary_ids)
 update_mouth_shapes(mesh)
 # Remove the former external black disk and flat tongue.
 for name in ['Frog mouth interior','Frog laugh tongue']:
  obj=bpy.data.objects.get(name)
  if obj:data=obj.data;bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(data)
 (root/'output/animations/mouth-model-info.json').write_text(json.dumps({'method':'welded mouth opening and volumetric oral pouch','removed_patch_faces':removed,'boundary_vertices':len(cycle),'original_vertices':initial_vertices,'vertices':len(mesh.data.vertices),'original_faces':initial_faces,'faces':len(mesh.data.polygons),'cavity_depth':.080,'mouth_patch_manifold':True,'outside_patch_vertices_preserved':True,'mouth_vertex_ids':new_ids,'mouth_boundary_ids':boundary_ids},indent=2))

def update_mouth_shapes(mesh):
 ids=json.loads(mesh['mouth_vertex_ids']);controls=json.loads(mesh['mouth_controls'])
 keys=mesh.data.shape_keys.key_blocks
 profile=json.loads(mesh['mouth_surface_profile']) if mesh.get('mouth_surface_profile') else None
 for i,co in zip(ids,patch_positions(controls,0,profile)):
  mesh.data.vertices[i].co=co;keys['Basis'].data[i].co=co
 for dst,src in zip(keys['LaughOpen'].data,keys['Basis'].data):dst.co=src.co
 for i,co in zip(ids,patch_positions(controls,1,profile)):keys['LaughOpen'].data[i].co=co

def refine_flat_mouth(mesh,rig):
 """Project the skin onto the surrounding head and remove the bridge loop."""
 if mesh.get('mouth_topology_version',0)>=3:return
 root=Path(__file__).resolve().parents[1]
 ids=json.loads(mesh['mouth_vertex_ids']);controls=json.loads(mesh['mouth_controls']);boundary_ids=json.loads(mesh['mouth_boundary_ids'])
 before=(len(mesh.data.vertices),len(mesh.data.polygons));key_name=mesh.data.shape_keys.name
 slots={name:next(s for s in bpy.data.actions[name].slots if s.target_id_type=='KEY' and s.name_display==key_name) for name in ['Blink','Laugh']}
 if rig.animation_data:rig.animation_data.action=None
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 for v,p in zip(mesh.data.vertices,mesh.data.shape_keys.key_blocks['Basis'].data):v.co=p.co
 mesh.shape_key_clear()
 bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table()
 boundary=[bm.verts[i] for i in boundary_ids];original=bm.verts.layers.int.get('mouth_original_vertex')
 outside={v[original]:v.co.copy() for v in bm.verts if v[original]}
 generated=set(ids);sample=set(boundary)
 for v in boundary:sample.update(e.other_vert(v) for e in v.link_edges if e.other_vert(v).index not in generated)
 def features(x,z):x=(x-.001)/.072;z=(z-.890)/.05;return np.array([1,x,z,x*x,x*z,z*z])
 coords=np.array([tuple(v.co) for v in sample]);profile=np.linalg.lstsq(np.array([features(x,z) for x,y,z in coords]),coords[:,1],rcond=None)[0].tolist()
 # Rebuild only the generated patch. The original face boundary is untouched.
 rim_controls=[c for c in controls if c[0]==4]
 bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ids],context='VERTS')
 deform=bm.verts.layers.deform.active;face_group=mesh.vertex_groups['face'].index;jaw_group=mesh.vertex_groups['jaw'].index
 rings=[boundary];new_verts=[];new_controls=[]
 for role in [4,6,7]:
  ring=[]
  for c in rim_controls:
   angle=c[1];w=max(0,-math.sin(angle))**.65*(1 if role==4 else .25)
   control=[role,angle,1,c[3],w];v=bm.verts.new(patch_positions([control],0,profile)[0]);v[deform][face_group]=1-w
   if w:v[deform][jaw_group]=w
   ring.append(v);new_verts.append(v);new_controls.append(control)
  rings.append(ring)
 material_slots={m.name:i for i,m in enumerate(mesh.data.materials)};uv=bm.loops.layers.uv.active;faces=[];n=len(boundary)
 for r in range(3):
  for i in range(n):
   j=(i+1)%n;f=bm.faces.new((rings[r][i],rings[r][j],rings[r+1][j],rings[r+1][i]));f.smooth=True
   f.material_index=material_slots[['Frog mouth skin','Frog oral lining','Frog oral depth'][r]];faces.append(f)
   for l in f.loops:l[uv].uv=(.5,.5)
 control=[8,0,1,[.001,.253,.888],0];cap=bm.verts.new(Vector(control[3]));cap[deform][face_group]=1
 new_controls.append(control);new_verts.append(cap)
 for i in range(n):
  f=bm.faces.new((rings[-1][i],rings[-1][(i+1)%n],cap));f.smooth=True;f.material_index=material_slots['Frog oral depth'];faces.append(f)
 bmesh.ops.recalc_face_normals(bm,faces=faces)
 # Split exterior skin normals from the inner wall at the knife-thin mouth seam.
 for i in range(n):bm.edges.get((rings[1][i],rings[1][(i+1)%n])).smooth=False
 assert all(e.is_manifold for f in faces for e in f.edges)
 for v in bm.verts:
  if v[original]:assert (v.co-outside[v[original]]).length<1e-8
 bm.verts.index_update();new_ids=[v.index for v in new_verts];boundary_ids=[v.index for v in boundary]
 bm.to_mesh(mesh.data);bm.free();mesh.data.update()
 mesh.shape_key_add(name='Basis');mesh.data.shape_keys.name=key_name;mesh.shape_key_add(name='Blink');mesh.shape_key_add(name='LaughOpen')
 assert mesh.data.shape_keys.name==key_name
 mesh['mouth_topology_version']=3;mesh['mouth_surface_profile']=json.dumps(profile);mesh['mouth_controls']=json.dumps(new_controls);mesh['mouth_vertex_ids']=json.dumps(new_ids);mesh['mouth_boundary_ids']=json.dumps(boundary_ids)
 update_mouth_shapes(mesh);blend_mouth_skin(mesh)
 sk=mesh.data.shape_keys;sk.animation_data_create()
 for name in ['Blink','Laugh']:
  track=sk.animation_data.nla_tracks.new();track.name='Face_'+name;track.mute=True
  strip=track.strips.new(name,1,bpy.data.actions[name]);strip.action_slot=slots[name]
 report={'method':'flush head surface and knife-thin mouth seam','vertices_before':before[0],'vertices_after':len(mesh.data.vertices),'faces_before':before[1],'faces_after':len(mesh.data.polygons),'removed_bridge_vertices':30,'removed_bridge_faces':30,'mouth_patch_faces':len(faces),'retained_mouth_loops':3,'closed_seam_height':.0007,'surrounding_head_vertices_unchanged':True,'sharp_rim_edges':n,'head_surface_profile':profile}
 (root/'output/animations/flat-mouth-info.json').write_text(json.dumps(report,indent=2));print('FLAT_MOUTH_READY',report)

def fit_teeth_to_flat_mouth(mesh,teeth):
 if not mesh.get('mouth_surface_profile'):return
 profile=json.loads(mesh['mouth_surface_profile']);keys=teeth.data.shape_keys.key_blocks
 for i,p in enumerate(keys['Basis'].data):
  lower=i//160==1;x=p.co.x-.001;depth=.006 if i%16>=8 else 0
  line_z=.904+.003*(x/.048)**2
  p.co.y=head_surface_y(p.co.x,line_z,profile)+.008+depth+(.012 if lower else 0)
  teeth.data.vertices[i].co=p.co
  for k in range(1,9):
   u=k/8;c=max(-1,min(1,x/(.048+.002*u)));s=math.sqrt(1-c*c)
   lip_z=.904+.003*c*c+u*((-.045 if lower else .019)*s+.001*c*c)+(-1 if lower else 1)*.00035*s
   neutral_center=.891 if lower else .916
   offset=p.co.z-neutral_center
   target_z=lip_z+(.0015 if lower else -.0015)
   v=keys[f'Laugh_{u:.3f}'].data[i]
   v.co=Vector((p.co.x,p.co.y*(1-u)+(head_surface_y(p.co.x,lip_z,profile)+.008+depth)*u,neutral_center*(1-u)+target_z*u+offset+(.012*u if lower else 0)))

def simplify_mouth(mesh,rig):
 """Remove three crowded loops and relax the folded mouth-to-face boundary."""
 if mesh.get('mouth_topology_version',0)>=2:return
 root=Path(__file__).resolve().parents[1]
 ids=json.loads(mesh['mouth_vertex_ids']);boundary_ids=json.loads(mesh['mouth_boundary_ids'])
 old_controls=json.loads(mesh['mouth_controls']);original_count=(len(mesh.data.vertices),len(mesh.data.polygons))
 if rig.animation_data:rig.animation_data.action=None
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 mesh.shape_key_clear()
 bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table()
 cycle=[bm.verts[i] for i in boundary_ids]
 original_layer=bm.verts.layers.int.get('mouth_original_vertex')
 old_vertices={v[original_layer]:v.co.copy() for v in bm.verts if v[original_layer]}
 bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ids],context='VERTS')
 # The old polar mapping reversed at three concave boundary sections.
 # Relax positions and use a strictly increasing angular parameter.
 boundary=[v.co.copy() for v in cycle];n=len(cycle)
 for _ in range(3):
  boundary=[p.lerp((boundary[(i-1)%n]+boundary[(i+1)%n])*.5,.42) for i,p in enumerate(boundary)]
 # A quadratic facial surface removes the original zigzag depth changes.
 samples=[];local=set(cycle)
 for v in cycle:
  local.update(e.other_vert(v) for e in v.link_edges)
 for v in local:
  x,y,z=v.co
  samples.append((x,z,y))
 def basis(x,z):return np.array([1,x,z-.9,x*x,x*(z-.9),(z-.9)**2])
 fit=np.linalg.lstsq(np.array([basis(x,z) for x,z,y in samples]),np.array([y for x,z,y in samples]),rcond=None)[0]
 moved=[]
 for v,p in zip(cycle,boundary):
  p.y=float(basis(p.x,p.z)@fit);v.co=p;moved.append(v[original_layer])
 # Relax only the adjacent mouth skin, leaving eyes and the rest of the face alone.
 for v in local-set(cycle):
  x,y,z=v.co
  if y<.235 and abs(x-.001)<.077 and .841<z<.948:
   v.co.y=.35*y+.65*float(basis(x,z)@fit);moved.append(v[original_layer])
 angles=np.unwrap([math.atan2((p.z-.890)/.047,(p.x-.001)/.072) for p in boundary])
 equal=np.arange(n)*math.tau/n+float(angles[0])
 for _ in range(3):
  extended=np.r_[angles[-1]-math.tau,angles,angles[0]+math.tau]
  angles=(extended[:-2]+2*extended[1:-1]+extended[2:])/4
 angles=.65*angles+.35*equal
 assert min(np.diff(np.r_[angles,angles[0]+math.tau]))>.025,'Folded mouth angular order'
 deform=bm.verts.layers.deform.active;face_group=mesh.vertex_groups['face'].index;jaw_group=mesh.vertex_groups['jaw'].index
 controls=[];new_verts=[];rings=[cycle]
 for role,blend in [(2,.5),(4,1),(6,1),(7,1)]:
  ring=[]
  for i,a in enumerate(angles):
   lip_jaw=max(0,-math.sin(a))**.65
   weight=cycle[i][deform].get(jaw_group,0)*(1-blend)+lip_jaw*blend if role==2 else lip_jaw if role==4 else .25*lip_jaw
   control=[role,float(a),blend,list(cycle[i].co),weight]
   v=bm.verts.new(patch_positions([control],0)[0]);v[deform][face_group]=1-weight
   if weight:v[deform][jaw_group]=weight
   new_verts.append(v);controls.append(control);ring.append(v)
  rings.append(ring)
 uv=bm.loops.layers.uv.active
 skin_index=next(i for i,m in enumerate(mesh.data.materials) if m.name=='Frog mouth skin')
 lining_index=next(i for i,m in enumerate(mesh.data.materials) if m.name=='Frog oral lining')
 depth_index=next(i for i,m in enumerate(mesh.data.materials) if m.name=='Frog oral depth')
 faces=[]
 for r in range(len(rings)-1):
  for i in range(n):
   j=(i+1)%n;f=bm.faces.new((rings[r][i],rings[r][j],rings[r+1][j],rings[r+1][i]));f.smooth=True
   f.material_index=skin_index if r<2 else lining_index if r==2 else depth_index
   faces.append(f)
   for l in f.loops:l[uv].uv=(.5,.5)
 control=[8,0,1,[.001,.253,.888],0];v=bm.verts.new(Vector(control[3]));v[deform][face_group]=1
 controls.append(control);new_verts.append(v)
 for i in range(n):
  f=bm.faces.new((rings[-1][i],rings[-1][(i+1)%n],v));f.smooth=True;f.material_index=depth_index;faces.append(f)
 bmesh.ops.recalc_face_normals(bm,faces=list(set(faces)|{f for v in local for f in v.link_faces}))
 assert all(e.is_manifold for f in faces for e in f.edges)
 for v in bm.verts:
  if v[original_layer] and v[original_layer] not in moved:assert (v.co-old_vertices[v[original_layer]]).length<1e-8
 bm.verts.index_update();new_ids=[v.index for v in new_verts];boundary_ids=[v.index for v in cycle]
 bm.to_mesh(mesh.data);bm.free();mesh.data.update()
 mesh.shape_key_add(name='Basis');mesh.shape_key_add(name='Blink');mesh.shape_key_add(name='LaughOpen')
 mesh['mouth_topology_version']=2;mesh['mouth_controls']=json.dumps(controls);mesh['mouth_vertex_ids']=json.dumps(new_ids);mesh['mouth_boundary_ids']=json.dumps(boundary_ids)
 mesh['mouth_relaxed_original_vertex_ids']=json.dumps(moved)
 update_mouth_shapes(mesh);blend_mouth_skin(mesh)
 report={'method':'four ordered mouth loops with relaxed facial boundary','vertices_before':original_count[0],'vertices_after':len(mesh.data.vertices),'faces_before':original_count[1],'faces_after':len(mesh.data.polygons),'patch_faces_before':240,'patch_faces_after':len(faces),'removed_loops':3,'retained_loops':4,'relaxed_original_vertices':len(moved),'outside_mouth_vertices_preserved':True,'minimum_angular_step':float(min(np.diff(np.r_[angles,angles[0]+math.tau]))),'mouth_patch_manifold':True}
 (root/'output/animations/mouth-smoothing-info.json').write_text(json.dumps(report,indent=2));print('MOUTH_SIMPLIFIED',report)

def blend_mouth_skin(mesh):
 """Match the original surrounding skin without retaining the painted smile."""
 ids=json.loads(mesh['mouth_vertex_ids']);controls=json.loads(mesh['mouth_controls']);new_ids=set(ids)
 boundary=json.loads(mesh['mouth_boundary_ids']);original=mesh.data.materials[0]
 image=next(n.image for n in original.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
 w,h=image.size;pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
 vertex_loops={}
 for polygon in mesh.data.polygons:
  if polygon.material_index!=0 or any(i in new_ids for i in polygon.vertices):continue
  centroid=sum((mesh.data.uv_layers.active.data[i].uv for i in polygon.loop_indices),Vector((0,0)))/len(polygon.loop_indices)
  for i in polygon.loop_indices:vertex_loops.setdefault(mesh.data.loops[i].vertex_index,[]).append((i,centroid))
 def sample(i):
  loop,centroid=vertex_loops[i][0];uv=mesh.data.uv_layers.active.data[loop].uv.lerp(centroid,.025)
  rgb=pixels[min(h-1,max(0,int(uv.y*h))),min(w-1,max(0,int(uv.x*w))),:3]
  return np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 anchors=np.array([sample(i) for i in boundary]);coords=np.array([tuple(mesh.data.vertices[i].co) for i in boundary])
 def features(x,z):return np.array([1,x,z-.904,x*x,(z-.904)**2,x*(z-.904)])
 coefficients=np.linalg.lstsq(np.array([features(v[0],v[2]) for v in coords]),anchors,rcond=None)[0]
 colors={i:anchors[n] for n,i in enumerate(boundary)}
 for i,control in zip(ids,controls):
  role,angle,blend,b,jaw=control[:5]
  if role>4 and role!=9:continue
  p=mesh.data.vertices[i].co;color=np.clip(features(p.x,p.z)@coefficients,anchors.min(axis=0)*.92,np.minimum(1,anchors.max(axis=0)*1.08))
  if role in [1,2,9]:
   index=int(np.argmin(np.linalg.norm(coords-np.array(b),axis=1)));color=anchors[index]*(1-blend)+color*blend
  colors[i]=color
 mat=bpy.data.materials.get('Frog mouth skin')
 if not mat:
  mat=original.copy();mat.name='Frog mouth skin';nodes=mat.node_tree.nodes;shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
  for link in list(shader.inputs['Base Color'].links):mat.node_tree.links.remove(link)
  node=nodes.new('ShaderNodeVertexColor');node.layer_name='MouthSkin';mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
 if mat.name not in [m.name for m in mesh.data.materials]:mesh.data.materials.append(mat)
 slot=list(mesh.data.materials).index(mat)
 attr=mesh.data.color_attributes.get('MouthSkin') or mesh.data.color_attributes.new(name='MouthSkin',type='FLOAT_COLOR',domain='CORNER')
 for value in attr.data:value.color=(1,1,1,1)
 for polygon in mesh.data.polygons:
  if polygon.material_index==0 and any(i in new_ids for i in polygon.vertices):polygon.material_index=slot
  if polygon.material_index!=slot:continue
  for loop in polygon.loop_indices:
   color=colors[mesh.data.loops[loop].vertex_index];attr.data[loop].color=(*color,1)
 if mesh.get('mouth_surface_profile'):shade_flat_mouth(mesh)
 unified=bpy.data.materials.get('Frog unified gold')
 if unified:
  source=next(n for n in unified.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  target=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  for link in list(target.inputs['Base Color'].links):mat.node_tree.links.remove(link)
  for name in ['Base Color','Roughness','Specular IOR Level']:target.inputs[name].default_value=source.inputs[name].default_value


def shade_flat_mouth(mesh):
 """Keep head-surface shading independent of the mouth's inward-facing walls."""
 if mesh.get('surface_cleanup_version'):
  from frog_surface import smooth_skin_normals
  smooth_skin_normals(mesh);return
 profile=json.loads(mesh['mouth_surface_profile']);border=set(json.loads(mesh['mouth_boundary_ids']))
 skin_slot=next(i for i,m in enumerate(mesh.data.materials) if m.name=='Frog mouth skin')
 mesh.data.update();normals=[tuple(n.vector) for n in mesh.data.corner_normals];outer={i:Vector((0,0,0)) for i in border}
 for p in mesh.data.polygons:
  if p.material_index!=0:continue
  for i in p.vertices:
   if i in border:outer[i]+=p.normal*p.area
 for i,n in outer.items():n.normalize()
 for p in mesh.data.polygons:
  for loop_index in p.loop_indices:
   i=mesh.data.loops[loop_index].vertex_index
   if p.material_index!=skin_slot and i not in border:continue
   v=mesh.data.vertices[i].co;x=(v.x-.001)/.072;z=(v.z-.890)/.05
   dx=(profile[1]+2*profile[3]*x+profile[4]*z)/.072
   dz=(profile[2]+profile[4]*x+2*profile[5]*z)/.05
   normals[loop_index]=tuple(Vector((dx,-1,dz)).normalized())
 mesh.data.normals_split_custom_set(normals)
 shader=next(n for n in mesh.data.materials[skin_slot].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 shader.inputs['Roughness'].default_value=.75;shader.inputs['Specular IOR Level'].default_value=.15

def ensure_teeth(mesh,rig):
 """Ten smaller closed bevelled crowns on each dental arch."""
 obj=bpy.data.objects.get('Frog laugh teeth')
 if obj and obj.get('simple_teeth_version')==3:return obj
 if obj:
  data=obj.data;bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(data)
 verts=[];faces=[];b=.0009;hw=.0041;hh=.008
 outline=[(-hw+b,-hh),(hw-b,-hh),(hw,-hh+b),(hw,hh-b),(hw-b,hh),(-hw+b,hh),(-hw,hh-b),(-hw,-hh+b)]
 for lower in [False,True]:
  for tooth in range(10):
   cx=.001+(tooth-4.5)*.0086;start=len(verts)
   for depth in [0,.006]:
    for x,z in outline:verts.append((cx+x,.185+depth,(.891 if lower else .916)+z))
   faces.append(tuple(start+i for i in range(8)));faces.append(tuple(start+8+i for i in reversed(range(8))))
   for i in range(8):j=(i+1)%8;faces.append((start+i,start+8+i,start+8+j,start+j))
 data=bpy.data.meshes.new('Frog upper10 lower10 teeth');data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 for p in data.polygons:p.use_smooth=True
 obj=bpy.data.objects.new('Frog laugh teeth',data);bpy.context.collection.objects.link(obj);obj.parent=rig;obj.matrix_world=mesh.matrix_world.copy()
 data.materials.append(mouth_material('Frog simple teeth',(.88,.85,.72,1),.42))
 obj.vertex_groups.new(name='face').add(list(range(160)),1,'REPLACE');obj.vertex_groups.new(name='jaw').add(list(range(160,320)),1,'REPLACE')
 obj.modifiers.new('Teeth face and jaw skin','ARMATURE').object=rig
 obj.shape_key_add(name='Basis')
 for i in range(1,9):obj.shape_key_add(name=f'Laugh_{i/8:.3f}')
 obj['tooth_count']=20;obj['upper_tooth_count']=10;obj['lower_tooth_count']=10
 obj['mouth_attachment']='upper arch follows face; lower arch follows jaw with fitted mouth shapes';obj['simple_teeth_version']=3
 return obj

def fit_tongue_behind_teeth(tongue,teeth):
 """Maintain a depth gap behind both dental arches throughout every morph stage."""
 keys=tongue.data.shape_keys.key_blocks;dental=teeth.data.shape_keys.key_blocks
 basis=keys['Basis'];center_x=.001;radius_x=.021;radius_y=.006;radius_z=.007
 for key in keys:
  u=0 if key.name=='Basis' else float(key.name.rsplit('_',1)[1])
  tk=dental['Basis' if u==0 else key.name]
  rear=max(v.co.y for v in tk.data if abs(v.co.x-center_x)<.030)
  center_y=rear+.004+radius_y
  for i,v in enumerate(key.data):
   # Existing tongue uses two poles followed by nine 24-vertex latitude rings.
   if i<2:x=0;dy=0;z=radius_z*(1 if i==0 else -1)
   else:
    j=(i-2)//24+1;n=(i-2)%24;a=math.pi*j/10;b=math.tau*n/24
    x=radius_x*math.sin(a)*math.cos(b);dy=radius_y*math.sin(a)*math.sin(b);z=radius_z*math.cos(a)
   v.co=(center_x+x,center_y+dy,.885+.006*u+z)
 for v,b in zip(tongue.data.vertices,basis.data):v.co=b.co
 tongue['dental_clearance']=.004;tongue['oral_fit_version']=2

def ensure_true_mouth(mesh,rig):
 from frog_muzzle import restore as restore_muzzle,apply as apply_muzzle
 muzzle=bool(mesh.get('muzzle_profile_version'))
 if muzzle:restore_muzzle([mesh,*[bpy.data.objects[n] for n in ['Frog laugh tongue','Frog laugh teeth'] if n in bpy.data.objects]])
 update_mouth_shapes(mesh)
 blend_mouth_skin(mesh)
 eyes=[bpy.data.objects[name] for name in ['Frog eyelid L','Frog eyelid crease L','Frog eyelid R','Frog eyelid crease R']]
 obj=bpy.data.objects.get('Frog laugh tongue')
 if not obj:
  # An ellipsoid, rather than a pink surface painted onto the opening.
  verts=[(.001,.204,.893),(.001,.204,.877)];faces=[];segments=24;rows=10
  for j in range(1,rows):
   a=math.pi*j/rows
   for i in range(segments):
    b=math.tau*i/segments;verts.append((.001+.021*math.sin(a)*math.cos(b),.204+.013*math.sin(a)*math.sin(b),.885+.008*math.cos(a)))
  for i in range(segments):
   n=(i+1)%segments;faces.append((0,2+i,2+n));faces.append((1,2+(rows-2)*segments+n,2+(rows-2)*segments+i))
  for j in range(rows-2):
   for i in range(segments):
    n=(i+1)%segments;a=2+j*segments+i;b=2+j*segments+n;faces.append((a,a+segments,b+segments,b))
  data=bpy.data.meshes.new('Frog volumetric tongue');data.from_pydata(verts,[],faces);data.update()
  obj=bpy.data.objects.new('Frog laugh tongue',data);bpy.context.collection.objects.link(obj);obj.parent=rig;obj.matrix_world=mesh.matrix_world.copy()
  data.materials.append(mouth_material('Frog tongue flesh',(.42,.065,.10,1),.62))
  for p in data.polygons:p.use_smooth=True
  obj.vertex_groups.new(name='jaw').add(list(range(len(verts))),1,'REPLACE');obj.modifiers.new('Tongue jaw skin','ARMATURE').object=rig
  obj.shape_key_add(name='Basis')
  for i in range(1,9):
   u=i/8;key=obj.shape_key_add(name=f'Laugh_{u:.3f}')
   for v,b in zip(key.data,obj.data.shape_keys.key_blocks['Basis'].data):v.co=b.co+Vector((0,-.003*u,.006*u))
 teeth=ensure_teeth(mesh,rig)
 fit_teeth_to_flat_mouth(mesh,teeth)
 fit_tongue_behind_teeth(obj,teeth)
 if muzzle:
  apply_muzzle([mesh,obj,teeth])
  from frog_surface import smooth_skin_normals
  smooth_skin_normals(mesh)
 for o in [mesh,*eyes,obj,teeth]:
  if o.data.shape_keys.animation_data:o.data.shape_keys.animation_data.action=None
  for key in o.data.shape_keys.key_blocks:key.value=0
 return [mesh,*eyes,obj,teeth]

