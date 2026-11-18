"""Rig the lantern and hammer guardian from low meshes; bake all runtime clips."""
import bpy,math,json,sys,bmesh,heapq,os
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(Path(__file__).resolve().parent))
from enemy_materials import apply_enemy_materials
V=Vector
smooth=lambda u:(lambda x:x*x*(3-2*x))(max(0,min(1,u)))
OUT=ROOT/'public/models/enemies';EDIT=ROOT/'assets-source/blender/rigged'
if os.getenv('NAIWA_ENEMY_RIG_STAGE'):
 OUT=EDIT=Path(os.environ['NAIWA_ENEMY_RIG_STAGE']).resolve()
OUT.mkdir(exist_ok=True,parents=True);EDIT.mkdir(exist_ok=True,parents=True)

def segment(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-9)));return (p-a-d*t).length

def rebuild_hammer_grip(weapon,bind):
 # The fused sculpt has missing shaft faces and knuckle material in its grip section.
 bm=bmesh.new();bm.from_mesh(weapon.data);bm.transform(bind.inverted())
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003)
 cuts=(-.28,.385)
 for y in cuts:
  bmesh.ops.bisect_plane(bm,geom=[*bm.verts,*bm.edges,*bm.faces],dist=.00001,plane_co=(0,y,0),plane_no=(0,1,0))
 middle=[f for f in bm.faces if cuts[0]<f.calc_center_median().y<cuts[1]]
 bmesh.ops.delete(bm,geom=middle,context='FACES')
 def cut_loop(y):
  edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.y-y)<.0001 for v in e.verts)]
  links={}
  for edge in edges:
   a,b=edge.verts;links.setdefault(a,[]).append(b);links.setdefault(b,[]).append(a)
  if not links or any(len(adjacent)!=2 for adjacent in links.values()):raise RuntimeError(f'Stone hammer grip cut at {y} is not a closed ring')
  first=min(links,key=lambda v:v.co.x);loop=[first];previous,current=first,links[first][0]
  while current!=first:
   loop.append(current)
   previous,current=current,next(v for v in links[current] if v!=previous)
  if len(loop)!=len(links):raise RuntimeError('Stone hammer grip has multiple cut rings')
  area=sum(a.co.x*b.co.z-b.co.x*a.co.z for a,b in zip(loop,loop[1:]+loop[:1]))
  if area<0:loop=[first]+list(reversed(loop[1:]))
  distances=[0.]
  for a,b in zip(loop,loop[1:]+loop[:1]):distances.append(distances[-1]+(a.co-b.co).length)
  return [(d/distances[-1],v) for d,v in zip(distances,loop+[first])]
 lower,upper=map(cut_loop,cuts)
 # Bridge the two cut sections without changing the sculpted head, ferrule or exposed shaft.
 grip=bpy.data.materials.new('Stonekeeper · wooden grip');grip.diffuse_color=(.14,.072,.035,1);grip.roughness=.86
 grip.use_nodes=True
 wood=grip.node_tree.nodes.get('Principled BSDF');wood.inputs['Base Color'].default_value=grip.diffuse_color;wood.inputs['Roughness'].default_value=.86
 material=len(weapon.data.materials);weapon.data.materials.append(grip)
 # Stitch the preserved rings by perimeter distance so unequal vertex counts leave no gaps.
 i=j=0
 while i<len(lower)-1 or j<len(upper)-1:
  a,b=lower[i][1],upper[j][1]
  if j==len(upper)-1 or i<len(lower)-1 and lower[i+1][0]<=upper[j+1][0]:
   i+=1;face=bm.faces.new((a,lower[i][1],b))
  else:
   j+=1;face=bm.faces.new((a,upper[j][1],b))
  face.material_index=material;face.smooth=True
 # The old cut also retained a loose triangle from the boot near the ferrule.
 pending=set(bm.verts);pieces=[]
 while pending:
  component=[pending.pop()]
  for vertex in component:
   for edge in vertex.link_edges:
    neighbor=edge.other_vert(vertex)
    if neighbor in pending:pending.remove(neighbor);component.append(neighbor)
  pieces.append(component)
 primary=set(max(pieces,key=len))
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in primary],context='VERTS')
 caps=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)['faces']
 for face in caps:
  face.smooth=True
  if cuts[0]<face.calc_center_median().y<cuts[1]:face.material_index=material
  else:
   uv=bm.loops.layers.uv.active
   if uv:
    for loop in face.loops:
     neighbor=next((p for p in loop.vert.link_loops if p.face not in caps),None)
     if neighbor:loop[uv].uv=neighbor[uv].uv
 # Leave clearance between the detached ferrule and the original left boot.
 outward=bind.to_3x3().inverted()@V((-.035,0,0))
 for vertex in bm.verts:vertex.co+=outward*smooth((-vertex.co.y-1.15)/.12)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 for face in bm.faces:
  if -1.14<face.calc_center_median().y<.385:face.material_index=material
 bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>3])
 bm.to_mesh(weapon.data);bm.free()

def build(name):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets-source/blender/{name}_low.glb'))
 mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');world=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=Matrix.Identity(4);mesh.data.transform(world)
 for o in list(bpy.context.scene.objects):
  if o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
 pts=[v.co for v in mesh.data.vertices];lo=V([min(p[i] for p in pts) for i in range(3)]);hi=V([max(p[i] for p in pts) for i in range(3)]);scale=(1 if name=='lantern' else 2.15)/(hi.z-lo.z);center=(lo+hi)*.5
 for v in mesh.data.vertices:
  v.co=V(((v.co.x-center.x)*scale,(v.co.y-center.y)*scale,(v.co.z-lo.z)*scale))
  if name=='stonekeeper':v.co.x-=.22
 mesh.name=name+'_body';bones={}
 def bone(n,a,b,parent=None):bones[n]=(V(a),V(b),parent)
 bone('root',(0,0,0),(0,0,.15))
 if name=='lantern':
  bone('body',(0,0,.32),(0,0,.73),'root');bone('crown',(0,0,.73),(0,0,1),'body');bone('core',(0,-.12,.46),(0,-.12,.55),'body')
  for i in range(4):
   a=i*math.pi/2;direction=V((math.cos(a),math.sin(a),0));points=[direction*.025+V((0,0,.32)),direction*.06+V((0,0,.20)),direction*.12+V((0,0,.10)),direction*.23+V((0,0,.01))]
   for j in range(3):bone(f'ribbon_{i}_{j}',points[j],points[j+1],'body' if j==0 else f'ribbon_{i}_{j-1}')
  clips=['Idle','Walk','Pulse','Empower','Firebolt','Hurt','Death']
 else:
  bone('pelvis',(0,0,.75),(0,0,1.04),'root');bone('spine',(0,0,1.04),(0,.08,1.38),'pelvis');bone('chest',(0,.08,1.38),(0,.08,1.7),'spine');bone('head',(-.02,-.04,1.73),(-.02,-.04,2.02),'chest')
  bone('clavicle_L',(-.12,.08,1.64),(-.40,.12,1.61),'chest');bone('clavicle_R',(.12,.08,1.64),(.45,-.04,1.63),'chest')
  arms={'L':[(-.40,.12,1.61),(-.61,.40,1.43),(-.77,.15,1.30),(-.94,.01,1.27)],'R':[(.45,-.04,1.63),(.70,-.16,1.35),(.63,-.38,1.10),(.56,-.50,.94)]}
  for side,points in arms.items():
   for j,n in enumerate(['upper_arm','forearm','hand']):bone(n+'_'+side,points[j],points[j+1],'clavicle_'+side if j==0 else ['upper_arm','forearm'][j-1]+'_'+side)
  for side,points in arms.items():
   elbow=V(points[1]);wrist=V(points[2]);bone('elbow_'+side,elbow,elbow+(wrist-elbow).normalized()*.12,'upper_arm_'+side)
  bone('hammer',(-.89,.01,1.28),(-.98,.06,1.96),'hand_L')
  for side in ['L','R']:
   wrist=V(arms[side][2]);palm=V(arms[side][3]);forward=(palm-wrist).normalized();across=V((0,0,1)) if side=='L' else V((1,0,0))
   curl=forward.cross(across).normalized()
   for digit in range(5):
    base=palm+across*((digit-2)*.048)+(V((.035,.015,.025)) if digit==0 else V((0,0,0)))
    count=2 if digit==0 else 3;points=[base]
    for j in range(count):
     # Rest chains follow the already sculpted closed fingers, rather than straightening the mesh.
     points.append(points[-1]+forward*(.038 if j==0 else -.020)+curl*(.030 if j<2 else -.025))
    for j in range(count):bone(f'finger_{side}_{digit}_{j}',points[j],points[j+1],'hand_'+side if j==0 else f'finger_{side}_{digit}_{j-1}')
  for side,s in [('L',-1),('R',1)]:
   bone('thigh_'+side,(s*.23,0,.78),(s*.28,-.04,.45),'pelvis');bone('shin_'+side,(s*.28,-.04,.45),(s*.34,0,.17),'thigh_'+side);bone('foot_'+side,(s*.34,0,.17),(s*.34,-.32,.12),'shin_'+side)
  clips=['Idle','Walk','Smash','Sweep','Quake','RockThrow','ShoulderRush','Stomp','Uppercut','Hurt','Death']
 data=bpy.data.armatures.new(name+'_skeleton');rig=bpy.data.objects.new(name+'_rig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
 for n,(a,b,parent) in bones.items():
  eb=data.edit_bones.new(n);eb.head=a;eb.tail=b
  if parent:eb.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
 groups={n:mesh.vertex_groups.new(name=n) for n in bones}
 weights=[]
 for v in mesh.data.vertices:
  p=v.co;x,y,z=p
  if name=='lantern':
   if z<.30:
    candidates=[n for n in bones if n.startswith('ribbon_')]
   elif (p-V((0,-.15,.49))).length<.055:candidates=['core']
   elif z>.72:candidates=['crown']
   else:candidates=['body']
  else:
   weapon=(x<-.66 and z>1.60 and y<.43) or ((x+.77+.10*z)**2+(y-.02+.03*z)**2<(.18 if z<.2 else .105)**2)
   if weapon:candidates=['hand_L']
   elif z<.78:candidates=[n for n in bones if n.startswith(('thigh','shin','foot'))]
   elif x<-.35 and z>1.05:candidates=['upper_arm_L','forearm_L','hand_L']
   elif x>.36 and z>.72:candidates=['upper_arm_R','forearm_R','hand_R']
   elif z>1.72 and abs(x)<.3:candidates=['head']
   else:candidates=['pelvis','spine','chest']
  nearest=min(candidates,key=lambda n:segment(p,*bones[n][:2]));weights.append({nearest:1.0})
 neighbors=[set() for _ in mesh.data.vertices]
 for edge in mesh.data.edges:a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 # Texture seams may contain coincident vertices; share influence smoothing across them.
 seam={}
 for v in mesh.data.vertices:seam.setdefault(tuple(round(c,5) for c in v.co),[]).append(v.index)
 for ids in seam.values():
  for i in ids:neighbors[i].update(j for j in ids if j!=i)
 for iteration in range(100):
  updated=[]
  for i,w in enumerate(weights):
   q={n:v*.5 for n,v in w.items()}
   for j in neighbors[i]:
    for n,v in weights[j].items():q[n]=q.get(n,0)+v*.5/max(1,len(neighbors[i]))
   top=sorted(q.items(),key=lambda p:-p[1])[:4];total=sum(v for _,v in top);updated.append({n:v/total for n,v in top})
  weights=updated
 if name=='stonekeeper':
  for i,v in enumerate(mesh.data.vertices):
   p=v.co
   for side in ['L','R']:
    elbow=V(arms[side][1]);amount=.45*smooth((.22-(p-elbow).length)/.12)
    if amount>0:
     weights[i]={n:w*(1-amount) for n,w in weights[i].items()};weights[i]['elbow_'+side]=amount
    palm=V(arms[side][3]);wrist=V(arms[side][2]);axis=(palm-wrist).normalized();along=(p-palm).dot(axis)
    if (p-palm).length<.48 and along>-.10:
     candidates=[n for n in bones if n.startswith('finger_'+side)]
     nearest=min(candidates,key=lambda n:segment(p,*bones[n][:2]));d=segment(p,*bones[nearest][:2]);amount=.4*smooth((along+.04)/.10)*smooth((.14-d)/.08)
     blend=smooth((.48-(p-palm).length)/.10)*smooth((along+.07)/.10)*smooth((p.x-.30)/.12 if side=='R' else (-.50-p.x)/.15)
     blend=max(blend,smooth((.24-(p-palm).length)/.07))
     q={n:v*(1-blend) for n,v in weights[i].items()};q['hand_'+side]=q.get('hand_'+side,0)+blend*(1-amount)
     digit=nearest.rsplit('_',1)[0];chain={n:1/(.025+segment(p,*bones[n][:2]))**2 for n in candidates if n.startswith(digit+'_')};chain_total=sum(chain.values())
     for n,value in chain.items():q[n]=q.get(n,0)+blend*amount*value/chain_total
     top=sorted(q.items(),key=lambda p:-p[1])[:4];total=sum(v for _,v in top);weights[i]={n:v/total for n,v in top}
  # Keep the gripping wrist/cuff on the forearm subtree, not on the upper arm.
  for i,v in enumerate(mesh.data.vertices):
   amount=smooth((.30-(v.co-V(arms['L'][2])).length)/.12)
   if amount:
    old=weights[i];allowed={n:w for n,w in old.items() if n in ['forearm_L','hand_L'] or n.startswith('finger_L_')}
    total=sum(allowed.values());allowed={n:w/total for n,w in allowed.items()} if total>.001 else {'hand_L':1.}
    q={n:w*(1-amount) for n,w in old.items()}
    for n,w in allowed.items():q[n]=q.get(n,0)+w*amount
    weights[i]=q
 if name=='stonekeeper':
  # The sculpted closed fist must move as a single forearm/hand subtree.
  # Geodesic selection avoids capturing the adjacent belly or skirt in a spatial sphere.
  surface=[v.co.copy()for v in mesh.data.vertices];graph=[[]for v in surface]
  for edge in mesh.data.edges:
   a,b=edge.vertices;length=(surface[a]-surface[b]).length;graph[a].append((b,length));graph[b].append((a,length))
  seeds=[min(range(len(surface)),key=lambda i:(surface[i]-V(point)).length)for point in [(.56,-.66,.95),(.75,-.50,.94),(.32,-.52,1.00),(.56,-.50,.75),(.56,-.50,.94)]]
  distance={i:0. for i in seeds};queue=[(0.,i)for i in seeds];heapq.heapify(queue)
  while queue:
   length,i=heapq.heappop(queue)
   if length>distance[i]+1e-8 or length>.55:continue
   for j,step in graph[i]:
    candidate=length+step
    if candidate<distance.get(j,1e9):distance[j]=candidate;heapq.heappush(queue,(candidate,j))
  fist_vertices=[]
  for i,p in enumerate(surface):
   amount=smooth((.48-distance.get(i,1e9))/.20)*smooth((1.40-p.z)/.12)
   if amount>0:
    old=weights[i];allowed={n:w for n,w in old.items()if n in ['forearm_R','hand_R']or n.startswith('finger_R_')};total=sum(allowed.values());allowed={n:w/total for n,w in allowed.items()}if total>.001 else{'hand_R':1.}
    q={n:w*(1-amount)for n,w in old.items()}
    for n,w in allowed.items():q[n]=q.get(n,0)+w*amount
    top=sorted(q.items(),key=lambda p:-p[1])[:4];total=sum(w for n,w in top);weights[i]={n:w/total for n,w in top}
    if amount>1-1e-7:fist_vertices.append(i)
  mesh['locked_fist_vertex_count']=len(fist_vertices)
  locked_report=json.dumps({'sourceVertices':len(fist_vertices),'restPositions':[[surface[i].x,surface[i].z,-surface[i].y]for i in fist_vertices]},indent=2)
  (ROOT/'output/enemy-models/stonekeeper-locked-fist.json').write_text(locked_report)
  (EDIT/'stonekeeper-locked-fist.json').write_text(locked_report)
 for i,w in enumerate(weights):
  for n,v in w.items():groups[n].add([i],v,'REPLACE')
 mesh.parent=rig;mod=mesh.modifiers.new('Armature','ARMATURE');mod.object=rig
 for p in mesh.data.polygons:p.use_smooth=True
 apply_enemy_materials(mesh,name)
 if name=='stonekeeper':
  bind=data.bones['hammer'].matrix_local.copy();inverse=bind.inverted()
  # Restore the knuckles around the handle before closing both split surfaces.
  def weapon_face(face):
   p=face.calc_center_median();x,y,z=p
   grip=inverse@p
   if -.225<grip.y<.15:return math.hypot(grip.x-.009,grip.z+.039)<.053
   return (x<-.66 and z>1.60 and y<.43) or ((x+.77+.10*z)**2+(y-.02+.03*z)**2<(.135 if z<.2 else .13)**2)
  bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table()
  seam_ids=list({v.index for f in bm.faces if weapon_face(f) for v in f.verts if 1.15<v.co.z<1.55 and v.co.x<-.75});bm.free()
  for group in mesh.vertex_groups:group.remove(seam_ids)
  mesh.vertex_groups['hand_L'].add(seam_ids,1,'REPLACE')
  weapon=mesh.copy();weapon.data=mesh.data.copy();bpy.context.collection.objects.link(weapon);weapon.name='stonekeeper_hammer'
  for obj,keep in [(weapon,True),(mesh,False)]:
   bm=bmesh.new();bm.from_mesh(obj.data);remove=[f for f in bm.faces if weapon_face(f)!=keep];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(obj.data);bm.free()
  bm=bmesh.new();bm.from_mesh(mesh.data)
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003)
  pending=set(bm.verts);loose=[]
  while pending:
   component=[pending.pop()]
   for vertex in component:
    for edge in vertex.link_edges:
     neighbor=edge.other_vert(vertex)
     if neighbor in pending:pending.remove(neighbor);component.append(neighbor)
   if len(component)<12 and all((v.co-V(arms['L'][2])).length<.45 for v in component):loose.extend(component)
  if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
  seams=[e for e in bm.edges if e.is_boundary and all((inverse@v.co).y<.39 and math.hypot((inverse@v.co).x,(inverse@v.co).z)<.19 for v in e.verts)]
  caps=bmesh.ops.holes_fill(bm,edges=seams,sides=0)['faces']
  for face in caps:face.smooth=True
  bmesh.ops.face_attribute_fill(bm,faces=caps,use_normals=False,use_data=True)
  bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>3])
  bm.to_mesh(mesh.data);bm.free()
  rebuild_hammer_grip(weapon,bind)
  # A rigid child object of the weapon bone, with its pivot on the shaft axis.
  for mod in list(weapon.modifiers):weapon.modifiers.remove(mod)
  for g in weapon.vertex_groups:weapon.vertex_groups.remove(g)
  weapon.parent_type='BONE';weapon.parent_bone='hammer';weapon.location=(0,-data.bones['hammer'].length,0)

 rest={n:data.bones[n].matrix_local.copy() for n in bones}
 def reset():
  for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
  bpy.context.view_layer.update()
 def rotate(n,axis,angle):
  q=rest[n].to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted()@Quaternion(V(axis),angle)@q;bpy.context.view_layer.update()
 def point(n):return rig.pose.bones[n].head.copy()
 def orient(n,a,b):
  rb=data.bones[n];q=(rb.tail_local-rb.head_local).rotation_difference(b-a);rig.pose.bones[n].matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@rb.matrix_local.to_3x3().to_4x4();bpy.context.view_layer.update()
 def bend_limb(upper,lower,target,pole):
  origin=point(upper);goal=V(target);pole=V(pole)
  l1=(bones[upper][1]-bones[upper][0]).length;l2=(bones[lower][1]-bones[lower][0]).length
  axis=(goal-origin).normalized();d=max(abs(l1-l2)+.003,min((goal-origin).length,l1+l2-.003))
  along=(l1*l1+d*d-l2*l2)/(2*d);perp=(pole-origin)-axis*(pole-origin).dot(axis);perp.normalize()
  joint=origin+axis*along+perp*math.sqrt(max(0,l1*l1-along*along));end=origin+axis*d
  orient(upper,origin,joint);orient(lower,joint,end)
  return joint,end
 def arm(side,target,pole,weight,shaft=None,wrist_direction=None):
  upper='upper_arm_'+side;lower='forearm_'+side;hand='hand_'+side
  if wrist_direction is None:
   elbow,end=bend_limb(upper,lower,target,pole)
  else:
   # Aim the forearm across the handle and move the elbow to carry the whole arm.
   shaft=V(shaft).normalized();wrist_direction=V(wrist_direction)
   axis=(wrist_direction-shaft*wrist_direction.dot(shaft)).normalized()
   shoulder=point(upper);upper_length=data.bones[upper].length;lower_length=data.bones[lower].length
   wanted_elbow=target-axis*lower_length
   elbow=shoulder+(wanted_elbow-shoulder).normalized()*upper_length;end=elbow+axis*lower_length
   orient(upper,shoulder,elbow);orient(lower,elbow,end)
  if shaft is not None:
   shaft=V(shaft).normalized()
   bind_shaft=(bones['hammer'][1]-bones['hammer'][0]).normalized()
   bind_palm=(bones[hand][1]-bones[hand][0]).normalized()
   aim=bind_shaft.rotation_difference(shaft)
   palm=aim@bind_palm;forearm=(end-elbow).normalized()
   # Twist the held shaft around its own axis to keep the palm in line with the forearm.
   palm_plane=palm-shaft*palm.dot(shaft);arm_plane=forearm-shaft*forearm.dot(shaft)
   roll=math.atan2(shaft.dot(palm_plane.cross(arm_plane)),palm_plane.dot(arm_plane))
   aim=Quaternion(shaft,roll)@aim
   rig.pose.bones[hand].matrix=Matrix.Translation(end)@aim.to_matrix().to_4x4()@rest[hand].to_3x3().to_4x4()
  bpy.context.view_layer.update()
  for n in [upper,lower,hand]:
   pb=rig.pose.bones[n];pb.rotation_quaternion=Quaternion().slerp(pb.rotation_quaternion,weight);pb.location=(0,0,0)
  rig.pose.bones['elbow_'+side].rotation_quaternion=rig.pose.bones[lower].rotation_quaternion.copy()
  bpy.context.view_layer.update()
 def crouch(amount,lean,yaw):
  pelvis=rig.pose.bones['pelvis'];matrix=pelvis.matrix.copy();matrix.translation.z-=amount;matrix.translation.y-=amount*.22;pelvis.matrix=matrix
  rotate('spine',(0,0,1),yaw);rotate('chest',(1,0,0),lean)
  for side in ['L','R']:
   thigh,shin,foot=[n+'_'+side for n in ['thigh','shin','foot']]
   ankle=bones[foot][0];s=-1 if side=='L' else 1
   _,end=bend_limb(thigh,shin,ankle,(s*.44,-.65,.42))
   rig.pose.bones[foot].matrix=Matrix.Translation(end)@rest[foot].to_3x3().to_4x4()
   bpy.context.view_layer.update()
 grip_targets={}
 def grip_hand(side,center,pole,weight):
  # Transport the elbow plane as a frame; shortest-axis rotations flip near 180 degrees.
  upper,lower,hand=[n+'_'+side for n in ['upper_arm','forearm','hand']]
  offset=V((-.89,.01,1.28))-bones[hand][0] if side=='L' else bones[hand][1]-bones[hand][0]
  rest_normal=(bones[upper][1]-bones[upper][0]).cross(bones[lower][1]-bones[lower][0]).normalized()
  def frame(axis,normal):
   axis=axis.normalized();normal=(normal-axis*normal.dot(axis)).normalized()
   return Matrix((normal,axis,normal.cross(axis))).transposed()
  center=(bones[hand][0]+offset).lerp(V(center),weight)
  target=center-offset.lerp(V((0,-.16,-.06)),weight)
  pole=bones[lower][0].lerp(V(pole),weight)
  def solve(target):
   elbow,end=bend_limb(upper,lower,target,pole)
   origin=point(upper);normal=(elbow-origin).cross(end-elbow).normalized()
   for n,a,b in [(upper,origin,elbow),(lower,elbow,end)]:
    q=frame(b-a,normal)@frame(bones[n][1]-bones[n][0],rest_normal).transposed()
    rig.pose.bones[n].matrix=Matrix.Translation(a)@q.to_4x4()@rest[n].to_3x3().to_4x4()
    bpy.context.view_layer.update()
   return end,q.to_quaternion()
  if side=='R':
   for _ in range(10):
    end,aim=solve(target);target=target.lerp(center-aim@offset,.2)
  end,aim=solve(target)
  rig.pose.bones[hand].matrix=Matrix.Translation(end)@aim.to_matrix().to_4x4()@rest[hand].to_3x3().to_4x4()
  bpy.context.view_layer.update()
  for n in [upper,lower,hand]:
   pb=rig.pose.bones[n];q=pb.rotation_quaternion.copy().normalized()
   previous=grip_targets.get(n,Quaternion())
   if q.dot(previous)<0:q.negate()
   grip_targets[n]=q.copy()
   pb.rotation_quaternion=q
   pb.location=(0,0,0)
  rig.pose.bones['elbow_'+side].rotation_quaternion=rig.pose.bones[lower].rotation_quaternion.copy()
  bpy.context.view_layer.update()
  return point(hand)+rig.pose.bones[hand].matrix.to_quaternion()@rest[hand].to_quaternion().inverted()@offset
 def pose(action,t):
  reset();phase=t*math.tau;prep=smooth(t/.45);hit=smooth((t-.45)/.25);recover=1-smooth((t-.70)/.30);w=prep*recover
  if name=='lantern':
   rotate('body',(1,0,0),(.11*math.sin(phase) if action=='Walk' else .04*math.sin(phase)))
   for i in range(4):
    for j in range(3):rotate(f'ribbon_{i}_{j}',(1,0,0),(.09 if action=='Walk' else .04)*math.sin(phase+i*1.5+j*.5))
   if action=='Pulse':rig.pose.bones['body'].scale=(1+.12*w,1+.12*w,1-.04*w);rotate('body',(1,0,0),-.14*w+.22*hit*recover)
   if action=='Empower':rotate('body',(0,0,1),.13*math.sin(phase));rig.pose.bones['core'].scale=(1+.2*w,)*3;rig.pose.bones['crown'].location.y=.015*w
   if action=='Firebolt':rotate('body',(1,0,0),-.15*w+.30*hit*recover)
   if action=='Hurt':rotate('body',(0,1,0),.12*math.sin(math.pi*t))
   if action=='Death':rotate('root',(1,0,0),1.35*smooth(t))
  else:
   if action=='Walk':
    for side,s in [('L',1),('R',-1)]:
     a=phase+(0 if s>0 else math.pi);rotate('thigh_'+side,(1,0,0),.22*math.sin(a));rotate('shin_'+side,(1,0,0),-.28*max(0,math.sin(a)));rotate('foot_'+side,(1,0,0),-.11*math.sin(a))
    rotate('spine',(0,0,1),.025*math.sin(phase));rotate('upper_arm_R',(1,0,0),-.08*math.sin(phase))
    rotate('upper_arm_L',(0,1,0),.06)
   if action in ['ShoulderRush','Stomp','Uppercut']:
    load=smooth(t/.45);drive=smooth((t-.45)/.175);release=1-smooth((t-.70)/.30)
    coil=load*release;push=drive*release
    if action=='Stomp':
     crouch(.05*coil+.14*push,.12*coil+.2*push,-.12*coil)
     arm('R',V(arms['R'][2]).lerp(V((.89,-.50,1.44)),coil),(1.18,-.1,1.38),coil)
     lift=coil*(1-drive)
     foot=bones['foot_R'][0]+V((.035*lift,-.20*lift,.44*lift))
     _,end=bend_limb('thigh_R','shin_R',foot,(.48,-.85,.50))
     rig.pose.bones['foot_R'].matrix=Matrix.Translation(end)@rest['foot_R'].to_3x3().to_4x4()
    elif action=='ShoulderRush':
     crouch(.13*coil+.06*push,.17*coil+.43*push,-.30*coil+.80*push)
     arm('R',V(arms['R'][2]).lerp(V((.66,-.58,1.40)),coil),(1.0,-.14,1.5),coil)
    else:
     crouch(.24*coil-.20*push,.38*coil-.42*push,-.34*coil+.63*push)
     fist=V(arms['R'][2]).lerp(V((.67,-.39,.99)),load).lerp(V((.47,-.91,1.86)),drive)
     arm('R',fist,(1.08,-.16,1.12),coil)
   if action in ['Smash','Sweep']:
    ready=smooth(t/.45);strike=smooth((t-.45)/.175);back=smooth((t-.70)/.30)
    weight=smooth(t/.20)*(1-smooth((t-.70)/.30))
    shaft_rest=(bones['hammer'][1]-bones['hammer'][0]).normalized()
    if action=='Smash':
     present=smooth(t/.17);load=smooth((t-.34)/.11)
     body_drop=smooth((t-.45)/.115)
     crouch((.05*present-.035*load+.235*body_drop)*(1-back),(.09*present-.15*load+.22*body_drop)*(1-back),(.19*present-.16*body_drop)*(1-back))
     shaft=shaft_rest
     grip=V((-.89,.01,1.28)).lerp(V((-.22,-.89,1.43)),present)
     grip=grip.lerp(V((-.28,-.86,1.12)),strike)
     grip.z+=.19*load*(1-strike)
     grip.y-=.32*math.sin(math.pi*back)
     support=.52
    else:
     crouch((.16*ready+.12*strike)*(1-back),(.30*ready+.25*strike)*(1-back),(-.44*ready+.90*strike)*(1-back))
     angle=-1.12+2.24*strike
     shaft=V((math.sin(angle),-math.cos(angle),-.22)).normalized()
     grip=V((-.89,.01,1.28)).lerp(V((-.72,-1.04,.78)),ready).lerp(V((-.35,-1.14,.68)),strike)
     support=0
    shaft=shaft_rest.lerp(shaft,smooth((t-.25)/.20)).normalized()
    shaft=Quaternion().slerp(shaft.rotation_difference(shaft_rest),smooth((t-.70)/.16))@shaft
    if action=='Smash':
     invert=smooth((t-.185)/.165)*(1-smooth((t-.80)/.13))
     shaft=V((-math.sin(math.pi*invert)+shaft_rest.x*(1-invert),-.15*math.sin(math.pi*invert)+shaft_rest.y*(1-invert),math.cos(math.pi*invert))).normalized()
     grip.z+=.48*smooth((t-.70)/.12)*(1-back)
    return_hand=smooth((t-.80)/.20)
    grip=grip.lerp(V((-.89,.01,1.28)),return_hand)
    grip.x-=.10*math.sin(math.pi*min(1,t/.25)) if t<.25 else 0
    centre=grip_hand('L',grip,(-1.15,.60,1.28),weight)
    slide=(.55 if action=='Smash' else .65)*smooth(t/(.175 if action=="Smash" else .25))*(1-smooth((t-.83)/.17))

    if action=="Smash":slide+=.55*math.sin(math.pi*smooth((t-.80)/.13))+.24*math.sin(math.pi*smooth((t-.83)/.17))
    aim=shaft_rest.rotation_difference(shaft)
    rig.pose.bones['hammer'].matrix=Matrix.Translation(centre+shaft*slide)@aim.to_matrix().to_4x4()@rest['hammer'].to_3x3().to_4x4()
    bpy.context.view_layer.update()
    if support:
     # Keep both hands on the shaft through impact and the start of extraction.
     brace=smooth((t-.04)/.135)*(1-smooth((t-.70)/.125))
     safe=V((.75,-.70,1.10))
     support_target=safe.lerp(centre-shaft*(support),brace)
     support_target.x+=.12*brace+.10*math.sin(math.pi*smooth((t-.70)/.125))
     support_target.y-=.18*math.sin(math.pi*invert)*brace
     support_target.y-=.28*math.sin(math.pi*brace)+.18*math.sin(math.pi*smooth((t-.70)/.16))


     grip_hand('R',support_target,(1.15,-.35,1.40),weight)
    else:
     arm('R',V(arms['R'][2]).lerp(V((.72,-.52,1.18)),ready*(1-back)),(1.15,-.1,1.4),weight)
   if action in ['Quake','RockThrow']:
    ready=smooth(t/.45);strike=smooth((t-.45)/.175);follow=smooth((t-.625)/.075);back=smooth((t-.70)/.30)
    weight=smooth(t/.15)*smooth((1-t)/.13)
    def travel(side,raised,contact):
     neutral=V(arms[side][2]);return neutral.lerp(V(raised),ready).lerp(V(contact),strike).lerp(neutral,back)
    shaft_rest=(bones['hammer'][1]-bones['hammer'][0]).normalized()
    quake=action=='Quake'
    crouch((.045*ready+(.35 if quake else .09)*strike)*(1-back),(-.16*ready+(.94 if quake else .39)*strike)*(1-back),(.23*ready-.49*strike)*(1-back))
    raised=(.94,-.38,1.80) if quake else (.91,.32,1.73)
    contact=(.78,-.58,.400) if quake else (.67,-.75,1.45)
    arm('R',travel('R',raised,contact),(1.45,.25,1.12),weight)
    park=V(arms['L'][2]).lerp(V((-.90,.03,1.36)),ready*(1-back))
    shaft=shaft_rest.lerp(V((-.21,.08,.97)),ready*(1-back))
    # No independent wrist twist while the fist strikes the ground.
    arm('L',park,None,weight,shaft,(-.66,-.72,.04))
    if quake and back>0:
     hold=rig.pose.bones['upper_arm_L'];ax=rest['upper_arm_L'].to_quaternion().inverted()@V((0,1,0))
     hold.rotation_quaternion=Quaternion(ax,.28*math.sin(math.pi*back))@hold.rotation_quaternion
   if action=='Hurt':rotate('spine',(1,0,0),-.13*math.sin(math.pi*t))
   if action=='Death':rotate('root',(1,0,0),-math.pi/2*smooth(t));rig.pose.bones['root'].location.y=.35*smooth(t)
  bpy.context.view_layer.update()
  if action!='Death' or name=='stonekeeper':
   minimum=math.inf
   for part in [mesh,weapon] if name=='stonekeeper' and action!='Smash' else [mesh]:
    obj=part.evaluated_get(bpy.context.evaluated_depsgraph_get());geo=obj.to_mesh();minimum=min(minimum,min((obj.matrix_world@v.co).z for v in geo.vertices));obj.to_mesh_clear()
   if minimum<.002:
    m=rig.pose.bones['root'].matrix.copy();m.translation.z+=.002-minimum;rig.pose.bones['root'].matrix=m
  bpy.context.view_layer.update()
 frames=240 if name=='stonekeeper' else 30
 for action in clips:
  grip_targets.clear()
  rig.animation_data_clear();a=bpy.data.actions.new(action);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a
  previous_quaternions={}
  for frame in range(frames+1):
   pose(action,frame/frames)
   for pb in rig.pose.bones:
    if pb.name in previous_quaternions and pb.rotation_quaternion.dot(previous_quaternions[pb.name])<0:
     pb.rotation_quaternion.negate()
    previous_quaternions[pb.name]=pb.rotation_quaternion.copy()
    for path in ['location','rotation_quaternion','scale']:pb.keyframe_insert(path,frame=frame)
  rig.animation_data.action=None
 scene=bpy.context.scene;scene.render.fps=frames;scene.frame_start=0;scene.frame_end=frames;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/f'{name}.blend'));bpy.ops.object.select_all(action='SELECT')
 staged=ROOT/f'output/enemy-models/{name}-staged.glb';bpy.ops.export_scene.gltf(filepath=str(staged),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_tangents=True,export_morph=False)
 staged.replace(OUT/f'{name}.glb')
 report={'source':f'{name}_low.glb','vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'),'triangles':sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH'),'bones':len(bones),'clips':clips}
 (ROOT/f'output/enemy-models/{name}-rig-report.json').write_text(json.dumps(report,indent=2));print('RIGGED_NEW',name,report)
for name in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['lantern','stonekeeper']):build(name)




