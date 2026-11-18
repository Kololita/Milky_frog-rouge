"""Surface-fitted facial animation with matched facial joints and skinning."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

STAGES = [i/8 for i in range(1,9)]
JAW_TRAVEL = .012
LAUGH_FRAMES = 104

def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)

def expression_values(t,name):
 def pulse(t):return smooth(t/.12) if t<.12 else smooth((1-t)/.10) if t>.90 else 1
 if name=='Blink':return smooth(t/.25) if t<.25 else 1 if t<.4 else smooth((1-t)/.6),0
 # Squeezed eyes and a wide grin with short laugh pulses, as in the reference GIF.
 u=pulse(t);beat=math.sin(t*math.tau*8-.3)
 closing=smooth(t/.06) if t<.06 else smooth((1-t)/.04) if t>.96 else 1.0
 return closing,u*(.89+.11*beat)

def apply_expression(objects,closing,opening):
 for obj in objects:
  for key in obj.data.shape_keys.key_blocks:
   if key.name=='Basis':continue
   if key.name=='LaughOpen':key.value=opening
   elif '_' in key.name:
    family,step=key.name.rsplit('_',1);u=closing if family=='Blink' else opening
    key.value=max(0,1-abs(u-float(step))/ .125)
   else:key.value=0

def jaw_pose(rig,mesh,opening):
 p=rig.pose.bones['jaw'];delta=mesh.matrix_world.to_3x3()@Vector((0,0,-JAW_TRAVEL*opening))
 p.location=(rig.matrix_world@p.bone.matrix_local).to_3x3().inverted()@delta

def finalize_expression_clearance(mesh,rig,objects,actions):
 """Correct the actual animated skin, including interpolation between frames."""
 scene=bpy.context.scene;helpers=[o for o in objects if o!=mesh and (not mesh.get('mouth_topology_version') or o.name.startswith('Frog eyelid'))]
 layer_pairs=[('Frog eyelid crease L','Frog eyelid L'),('Frog eyelid crease R','Frog eyelid R')]
 if not mesh.get('mouth_topology_version'):layer_pairs.append(('Frog laugh tongue','Frog mouth interior'))
 minima={o.name:1 for o in helpers};layers={a:1 for a,b in layer_pairs}
 def evaluated(obj,transform):
  ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh()
  pts=[transform@ev.matrix_world@v.co for v in data.vertices];faces=[tuple(p.vertices) for p in data.polygons];ev.to_mesh_clear();return pts,faces
 def surface(bvh,p):
  hit=bvh.ray_cast(Vector((p.x,-1,p.z)),Vector((0,1,0)),2)[0]
  return None if hit is None else hit.y-p.y
 for name,end in [('Blink',13),('Laugh',LAUGH_FRAMES)]:
  action=actions[name];rig.animation_data.action=actions['Idle'] if name=='Blink' else action
  for obj in objects:
   sk=obj.data.shape_keys;sk.animation_data.action=action
   sk.animation_data.action_slot=next(s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name)
  for i in range((end-1)*4+1):
   f=1+i/4;scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
   b=rig.data.bones['face'];deform=rig.matrix_world@rig.pose.bones['face'].matrix@b.matrix_local.inverted()@rig.matrix_world.inverted()
   transform=mesh.matrix_world.inverted()@deform.inverted();pts,faces=evaluated(mesh,transform);body=BVHTree.FromPolygons(pts,faces)
   evaluations={};bvhs={}
   for obj in helpers:
    if sum(k.value for k in obj.data.shape_keys.key_blocks if k.name!='Basis')<.003:continue
    verts,polys=evaluated(obj,transform);evaluations[obj.name]=(verts,polys);bvhs[obj.name]=BVHTree.FromPolygons(verts,polys)
    for ids in polys:
     a,b,c=[verts[k] for k in ids]
     if (b-a).cross(c-a).length<1e-11:continue
     for p in [a,b,c,(a+b+c)/3,(a+b)/2,(b+c)/2,(c+a)/2]:
      distance=surface(body,p)
      if distance is not None:minima[obj.name]=min(minima[obj.name],distance)
   for layer,parent in layer_pairs:
    if layer not in evaluations or parent not in bvhs:continue
    for p in evaluations[layer][0]:
     distance=surface(bvhs[parent],p)
     if distance is not None:layers[layer]=min(layers[layer],distance)
 corrections={name:max(0,.001-minimum) for name,minimum in minima.items()}
 for layer,parent in layer_pairs:
  corrections[layer]=max(corrections[layer],corrections[parent]+.0006-layers[layer])
 for obj in helpers:
  delta=corrections[obj.name]
  for key in obj.data.shape_keys.key_blocks:
   for v in key.data:v.co.y-=delta
  for v in obj.data.vertices:v.co.y-=delta
 for obj in objects:
  obj.data.shape_keys.animation_data.action=None
  for key in obj.data.shape_keys.key_blocks:key.value=0
 path=Path(__file__).resolve().parents[1]/'output/animations/face-rig-repair.json'
 report=json.loads(path.read_text());report['animated_skin_sweep']={'Blink_samples':49,'Laugh_samples':(LAUGH_FRAMES-1)*4+1,'minimum_clearance_before_correction':minima,'additional_forward_correction':corrections,'layer_clearance_before_correction':layers}
 path.write_text(json.dumps(report,indent=2))

def ensure_expressions(mesh,rig,rebuild=True):
 root=Path(__file__).resolve().parents[1]
 if mesh.get('mouth_topology_version'):
  from frog_mouth import ensure_true_mouth
  return ensure_true_mouth(mesh,rig)
 if not rebuild:
  names=['Frog eyelid L','Frog eyelid crease L','Frog eyelid R','Frog eyelid crease R','Frog mouth interior','Frog laugh tongue']
  if all(bpy.data.objects.get(name) for name in names):
   objects=[mesh,*[bpy.data.objects[name] for name in names]]
   for obj in objects:
    if obj.data.shape_keys.animation_data:obj.data.shape_keys.animation_data.action=None
    for key in obj.data.shape_keys.key_blocks:key.value=0
   return objects
 if rig.animation_data:rig.animation_data.action=None
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 if not mesh.data.shape_keys:mesh.shape_key_add(name='Basis')
 sk=mesh.data.shape_keys
 if sk.animation_data:sk.animation_data.action=None
 for key in sk.key_blocks:key.value=0
 basis=[v.co.copy() for v in sk.key_blocks['Basis'].data]
 polygons=[list(p.vertices) for p in mesh.data.polygons]
 base_tree=BVHTree.FromPolygons(basis,polygons)
 def front(tree,x,z):
  hit=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)[0]
  if hit is None:raise ValueError(('Face surface missing',x,z))
  return hit.y
 to_rig=rig.matrix_world.inverted()@mesh.matrix_world
 changed=[]
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.object.mode_set(mode='EDIT')
 def fit(name,head,tail,parent=None):
  b=rig.data.edit_bones[name];b.use_connect=False
  if parent:b.parent=rig.data.edit_bones[parent]
  b.head=to_rig@Vector(head);b.tail=to_rig@Vector(tail);b.align_roll(Vector((0,0,1)));changed.append(name)
 for side,cx in [('L',.076),('R',-.074)]:
  fit('eye.'+side,(cx,.213,.968),(cx,.168,.968),'face')
  for family,start in [('T',0),('B',math.pi)]:
   points=[]
   for i in range(5):
    angle=start+i*math.pi/4;x=cx+.031*math.cos(angle);z=.968+.032*math.sin(angle)
    points.append((x,front(base_tree,x,z)+.001,z))
   previous='face'
   for i in range(4):
    name=f'lid.{family}.{side}'+(f'.{i:03d}' if i else '')
    fit(name,points[i],points[i+1],previous);previous=name
 fit('jaw',(.001,.228,.909),(.001,.176,.866),'face')
 for side,s in [('L',1),('R',-1)]:
  for family,z in [('T',.907),('B',.899)]:
   points=[(0,.169,z),(s*.026,.175,z+.001),(s*.053,.194,.909)]
   fit(f'lip.{family}.{side}',points[0],points[1],'face')
   fit(f'lip.{family}.{side}.001',points[1],points[2],f'lip.{family}.{side}')
 bpy.ops.object.mode_set(mode='OBJECT')
 # Unify local facial weights; conflicting automatic cheek/lid/nose groups
 # otherwise move the face and its attached covers by different amounts.
 jaw_weights=[];reweighted=0;binding_reused=mesh.get('face_binding_version')==3
 groups={g.name:g for g in mesh.vertex_groups}
 for i,co in enumerate(basis):
  if binding_reused:
   jaw_weights.append(next((g.weight for g in mesh.data.vertices[i].groups if mesh.vertex_groups[g.group].name=='jaw'),0))
   continue
  x,y,z=co
  jw=smooth((.905-z)/.019)*smooth((.075-abs(x))/.020)*smooth((z-.805)/.035) if y<.24 else 0
  old=[(groups[mesh.vertex_groups[g.group].name],g.weight) for g in mesh.data.vertices[i].groups]
  merged={g.name:w for g,w in old}
  merged['face']=merged.get('face',0)+merged.pop('jaw',0)
  if y<.265 and z>.825 and abs(x)<.165:
   blend=smooth((z-.825)/.035)*smooth((.265-y)/.018)*smooth((.165-abs(x))/.025)
   merged={name:w*(1-blend) for name,w in merged.items()}
   merged['face']=merged.get('face',0)+blend*(1-jw);merged['jaw']=merged.get('jaw',0)+blend*jw
   reweighted+=1
  kept=sorted(((name,w) for name,w in merged.items() if w>1e-6),key=lambda item:item[1],reverse=True)[:4]
  total=sum(w for name,w in kept)
  for g,w in old:g.remove([i])
  for name,w in kept:groups[name].add([i],w/total,'REPLACE')
  jaw_weights.append(next((w/total for name,w in kept if name=='jaw'),0))
 mesh['face_binding_version']=3
 # Lip shaping is restricted below the eyes.
 for name in ['Blink','LaughOpen']:
  key=sk.key_blocks.get(name) or mesh.shape_key_add(name=name)
  for dst,src in zip(key.data,basis):dst.co=src
 key=sk.key_blocks['LaughOpen']
 for i,co in enumerate(basis):
  x,y,z=co
  if y<.24 and .83<z<.933:
   d=z-.904;w=smooth((.075-abs(x))/.024)*smooth((.933-z)/.012)*smooth((z-.83)/.035)
   key.data[i].co.z+=(-.003+.007*math.tanh(d/.006))*w
 mouth_delta=[v.co-b for v,b in zip(key.data,basis)]
 trees={}
 def tree(u):
  u=round(u,6)
  if u not in trees:
   pts=[b+d*u+Vector((0,0,-JAW_TRAVEL*u*w)) for b,d,w in zip(basis,mouth_delta,jaw_weights)]
   trees[u]=BVHTree.FromPolygons(pts,polygons)
  return trees[u]
 # Replace single linear targets by intermediate surface-fitted poses.
 for obj in list(bpy.context.scene.objects):
  if obj!=mesh and obj.type=='MESH' and obj.name.startswith(('Frog eyelid','Frog mouth','Frog laugh')):
   data=obj.data;bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(data)
 skin_point=min(mesh.data.vertices,key=lambda v:abs(v.co.x-.122)+2*abs(v.co.z-.947)+abs(v.co.y-.225))
 loop=next(l for l in mesh.data.loops if l.vertex_index==skin_point.index)
 skin_uv=mesh.data.uv_layers.active.data[loop.index].uv.copy()
 report={'fitted_bones':changed,'reweighted_face_vertices':reweighted,'binding_reused':binding_reused,'stages':STAGES,'surface_checks':{}}
 objects=[mesh]
 def material(name,color):
  mat=bpy.data.materials.get(name) or bpy.data.materials.new(name);mat.diffuse_color=color;mat.use_nodes=True
  if name=='Frog mouth interior':
   nodes=mat.node_tree.nodes;nodes.clear();output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeEmission')
   shader.inputs['Color'].default_value=color;shader.inputs['Strength'].default_value=1
   mat.node_tree.links.new(shader.outputs[0],output.inputs['Surface'])
  else:
   mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
   mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
  return mat
 def make(name,faces,parameters,evaluate,family,bone,mat,skin=False):
  positions={u:[evaluate(p,u) for p in parameters] for u in [0,*STAGES]}
  data=bpy.data.meshes.new(name);data.from_pydata(positions[0],[],faces);data.update()
  obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.parent=rig;obj.matrix_world=mesh.matrix_world.copy()
  data.materials.append(mat)
  if skin:
   uv=data.uv_layers.new(name='UVMap')
   for item in uv.data:item.uv=skin_uv
  for polygon in data.polygons:polygon.use_smooth=True
  obj.vertex_groups.new(name=bone).add(list(range(len(parameters))),1,'REPLACE')
  obj.modifiers.new('Matched facial skin','ARMATURE').object=rig
  obj.shape_key_add(name='Basis')
  for u in STAGES:
   key=obj.shape_key_add(name=f'{family}_{u:.3f}')
   for dst,co in zip(key.data,positions[u]):dst.co=co
  # Test triangle interiors too; a clear boundary alone does not prevent pokes.
  minimum=1;deficit=0
  for n in range(1,41):
   u=n/40;lo=math.floor(u*8)/8;hi=min(1,lo+.125);mix=(u-lo)*8
   coords=[Vector(a).lerp(Vector(b),mix) for a,b in zip(positions[lo],positions[hi])]
   clearance_tree=base_tree if family=='Blink' else tree(u)
   for a,b,c in faces:
    for v in [(coords[a]+coords[b]+coords[c])/3,coords[a],coords[b],coords[c]]:
     actual=v.copy()
     if bone=='jaw':actual.z-=JAW_TRAVEL*u
     clearance=front(clearance_tree,actual.x,actual.z)-actual.y
     minimum=min(minimum,clearance);deficit=max(deficit,.0008-clearance)
  correction=deficit+.00015 if deficit>0 else 0
  if correction>0:
   for key in obj.data.shape_keys.key_blocks:
    for v in key.data:v.co.y-=correction
   for v in data.vertices:v.co.y-=correction
  report['surface_checks'][name]={'minimum_sampled_clearance_before_correction':minimum,'forward_correction':correction,'minimum_clearance_after_correction':minimum+correction}
  obj['surface_forward_offset']=correction
  objects.append(obj);return obj
 for side,cx in [('L',.076),('R',-.074)]:
  params=[(i/20,j/8) for j in range(9) for i in range(21)];faces=[]
  for j in range(8):
   for i in range(20):
    a=j*21+i;faces.extend([(a,a+1,a+22),(a,a+22,a+21)])
  def lid(p,u,cx=cx):
   a,v=p;x=cx+.037*(2*a-1);h=.037*math.sqrt(max(0,1-(2*a-1)**2));z=.968+h-2*h*u*v
   return (x,front(base_tree,x,z)-.0016,z)
  lid_obj=make('Frog eyelid '+side,faces,params,lid,'Blink','lid.T.'+side,mesh.data.materials[0],True)
  params=[(i/24,s) for i in range(25) for s in [-1,1]];faces=[]
  for i in range(24):
   a=i*2;faces.extend([(a,a+1,a+3),(a,a+3,a+2)])
  def crease(p,u,cx=cx,offset=lid_obj['surface_forward_offset']):
   a,s=p;x=cx+.025*(2*a-1)*min(1,2*u);h=.034*math.sqrt(max(0,1-((x-cx)/.033)**2));z=.968+h-1.55*h*u+s*.0004*u
   return (x,front(base_tree,x,z)-.0035-offset,z)
  make('Frog eyelid crease '+side,faces,params,crease,'Blink','lid.T.'+side,material('Frog eyelid crease '+side,(.04,.018,.006,1)))
 params=[(0,0)]+[(r/4,math.tau*i/48) for r in range(1,5) for i in range(48)]
 faces=[(0,1+i,1+(i+1)%48) for i in range(48)]
 for r in range(3):
  for i in range(48):
   a=1+r*48+i;b=1+r*48+(i+1)%48;c=a+48;d=b+48;faces.extend([(a,b,d),(a,d,c)])
 def mouth(p,u):
  r,a=p;x=.001+.055*r*math.cos(a)*math.sqrt(u);z=.904-.018*u+.030*r*math.sin(a)*u+.004*((x-.001)/.055)**2*u
  return (x,front(tree(u),x,z)-.0017,z)
 mouth_obj=make('Frog mouth interior',faces,params,mouth,'Laugh','face',material('Frog mouth interior',(.012,.002,.003,1)))
 mouth_trees={}
 def mouth_tree(u):
  if u not in mouth_trees:
   lo=math.floor(u*8)/8;hi=min(1,lo+.125);mix=(u-lo)*8
   keys=mouth_obj.data.shape_keys.key_blocks
   a=keys['Basis'] if lo==0 else keys[f'Laugh_{lo:.3f}'];b=keys[f'Laugh_{hi:.3f}']
   coords=[va.co.lerp(vb.co,mix) for va,vb in zip(a.data,b.data)]
   mouth_trees[u]=BVHTree.FromPolygons(coords,faces)
  return mouth_trees[u]
 def tongue(p,u):
  r,a=p;x=.001+.020*r*math.cos(a)*math.sqrt(u);z=.904-.034*u+.007*r*math.sin(a)*u
  y=front(mouth_tree(u),x,z)-.0015 if u else mouth_obj.data.shape_keys.key_blocks['Basis'].data[0].co.y-.0015
  return (x,y,z+JAW_TRAVEL*u)
 make('Frog laugh tongue',faces,params,tongue,'Laugh','jaw',material('Frog laugh tongue',(.45,.065,.11,1)))
 (root/'output/animations/face-rig-repair.json').write_text(json.dumps(report,indent=2))
 return objects
