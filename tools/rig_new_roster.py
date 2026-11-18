"""Author the four new low-model skeletons and phase-aligned combat actions."""
import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector as V,Matrix,Quaternion as Q
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(Path(__file__).parent))
from enemy_materials import apply_enemy_materials
smooth=lambda x:(lambda t:t*t*(3-2*t))(max(0,min(1,x)))
def dist(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-9)));return (p-a-t*d).length
SPECS={'mirrorGuard':(1.65,['Idle','Walk','ShieldThrust','Parry','ParryPush','Riposte','ShieldThrow','Hurt','Death']), 'samurai':(2.25,['Idle','Walk','CrossLeft','CrossRight','Overhead','Rising','RisingLeft','RisingRight','ShortThrust','LongThrust','RoundSweep','BuriedOverhead','Extract','Hurt','Death']), 'scythemoth':(1.95,['Idle','Walk','CutLeft','CutRight','Thrust','Pounce','Hurt','Death']), 'spitter':(1.25,['Idle','Walk','Shoot','TailSweep','Retreat','Hurt','Death'])}
def build(name):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets-source/blender/{name}_low.glb'))
 mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');world=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=Matrix.Identity(4);mesh.data.transform(world)
 for o in list(bpy.context.scene.objects):
  if o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
 pts=[v.co for v in mesh.data.vertices];lo=V([min(p[k] for p in pts)for k in range(3)]);hi=V([max(p[k] for p in pts)for k in range(3)]);height,clips=SPECS[name];factor=height/(hi.z-lo.z);center=(lo+hi)/2
 for v in mesh.data.vertices:
  p=(v.co-center)*factor;p.z+=height/2
  if name=='spitter':p=V((-p.y,p.x,p.z))
  if name in ['samurai','mirrorGuard']:p.y-=.25
  v.co=p
 mesh.name=name+'_body';original_triangles=len(mesh.data.polygons);apply_enemy_materials(mesh,name)
 bones={};chains={};tools={};arms={};finger_names=[]
 def bone(n,a,b,parent=None):bones[n]=(V(a),V(b),parent)
 def chain(prefix,points,parent):
  ns=[]
  for j in range(len(points)-1):
   n=f'{prefix}_{j}';bone(n,points[j],points[j+1],parent if j==0 else ns[-1]);ns.append(n)
  chains[prefix]=ns;return ns
 bone('root',(0,0,0),(0,0,.12))
 if name in ['samurai','mirrorGuard']:
  h=height;hip=.49*h;chest=.70*h;shoulder=.75*h
  bone('pelvis',(0,0,hip),(0,0,hip+.10),'root');bone('spine',(0,0,hip+.10),(0,0,chest),'pelvis');bone('chest',(0,0,chest),(0,0,shoulder+.04),'spine');bone('neck',(0,0,shoulder+.04),(0,0,.84*h),'chest');bone('head',(0,0,.84*h),(0,0,.98*h),'neck')
  arms=({'L':[(-.30,.04,1.26),(-.43,.05,1.04),(-.45,-.04,.94),(-.47,-.12,.91)],'R':[(.30,.04,1.26),(.43,.06,1.05),(.54,-.08,.89),(.56,-.15,.86)]} if name=='mirrorGuard' else {'L':[(-.30,.04,1.68),(-.59,-.02,1.62),(-.82,-.04,1.65),(-.94,-.06,1.67)],'R':[(.31,.04,1.68),(.49,.02,1.45),(.60,-.12,1.26),(.65,-.16,1.21)]})
  for side,points in arms.items():
   bone('clavicle_'+side,(-.07 if side=='L' else .07,0,shoulder),points[0],'chest')
   for j,n in enumerate(['upper_arm','forearm','hand']):bone(n+'_'+side,points[j],points[j+1],'clavicle_'+side if j==0 else ['upper_arm','forearm'][j-1]+'_'+side)
   elbow=V(points[1]);bone('elbow_'+side,elbow,elbow+(V(points[2])-elbow).normalized()*.09,'upper_arm_'+side)
   palm=V(points[3]);forward=(palm-V(points[2])).normalized();across=V((0,0,1)) if name=='samurai' and side=='L' else V((1,0,0));curl=forward.cross(across).normalized()
   for digit in range(5):
    base=palm+across*((digit-2)*.026*h);count=2 if digit==0 else 3;points_f=[base]
    for j in range(count):points_f.append(points_f[-1]+forward*(.022*h if name=='samurai' and side=='L' else (.018 if j==0 else -.009)*h)+curl*.007*h)
    finger_names+=chain(f'finger_{side}_{digit}',points_f,'hand_'+side)
   sign=-1 if side=='L' else 1
   chain('leg_'+side,[(sign*.13*h,0,hip+.01),(sign*.15*h,-.015,.26*h),(sign*.17*h,0,.07*h),(sign*.17*h,-.14*h,.04*h)],'pelvis')
  if name=='samurai':
   bone('blade',(.645,-.16,1.22),(-.72,-.94,.57),'hand_R');bone('scabbard',(.20,0,1.20),(.76,.44,.80),'pelvis')
  else:
   bone('blade',(.55,-.12,.88),(.63,-.65,1.50),'hand_R');bone('shield',(-.46,-.10,1.0),(-.46,-.31,1.0),'hand_L')
 elif name=='spitter':
  bone('pelvis',(0,.18,.38),(0,0,.40),'root');bone('chest',(0,0,.40),(0,-.34,.42),'pelvis');chain('neck',[(0,-.34,.42),(0,-.44,.67),(0,-.43,.87)],'chest');bone('head',(0,-.43,.87),(0,-.64,.96),'neck_1');bone('jaw',(0,-.45,.89),(0,-.66,.88),'head')
  chain('tail',[(0,.25,.40),(0,.52,.45),(0,.68,.65),(0,.64,.93),(0,.41,1.15),(0,.12,1.24),(0,-.06,1.20)],'pelvis')
  for side,sign in [('L',-1),('R',1)]:
   for j,y in enumerate([-.28,.15]):chain(f'leg_{side}{j}',[(sign*.10,y,.38),(sign*.20,y-.06,.23),(sign*.18,y+.02,.08),(sign*.18,y-.14,.035)],'chest' if j==0 else 'pelvis')
 else:
  bone('thorax',(0,.05,.84),(0,-.35,1.07),'root');chain('abdomen',[(0,.05,.84),(0,.36,.81),(0,.66,.77),(0,.88,.68)],'thorax');bone('neck',(0,-.35,1.07),(0,-.70,1.62),'thorax');bone('head',(0,-.70,1.62),(0,-.79,1.76),'neck')
  for side,sign in [('L',-1),('R',1)]:
   chain('antenna_'+side,[(sign*.07,-.79,1.76),(sign*.10,-.88,1.86),(sign*.17,-1.04,1.95)],'head')
   chain('scythe_'+side,[(sign*.10,-.55,1.27),(sign*.42,-.85,1.24),(sign*.72,-1.40,1.48),(sign*.76,-1.44,1.04)],'neck')
   chain('leg_'+side+'0',[(sign*.12,-.12,.84),(sign*.61,-.43,.87),(sign*.73,-.49,.16),(sign*.86,-.63,.02)],'thorax')
   chain('leg_'+side+'1',[(sign*.12,.16,.83),(sign*.54,.80,1.10),(sign*.51,1.13,.24),(sign*.59,1.44,.02)],'thorax')
 # Components preserve genuinely independent blades/scabbards without a hand-cut seam.
 adj=[[]for v in mesh.data.vertices]
 for edge in mesh.data.edges:a,b=edge.vertices;adj[a].append(b);adj[b].append(a)
 seen=set();component_data=[]
 for start in range(len(adj)):
  if start in seen:continue
  ids=[];stack=[start];seen.add(start)
  while stack:
   i=stack.pop();ids.append(i)
   for j in adj[i]:
    if j not in seen:seen.add(j);stack.append(j)
  component_data.append({'n':len(ids),'indices':ids})
 assign_tool={} 
 for part in component_data:
  n=part['n'];tool=None
  if name=='samurai' and n==234:tool='blade'
  if name=='samurai' and n==207:tool='scabbard'
  if name=='mirrorGuard' and n==105:tool='blade'
  if tool:
   for i in part['indices']:assign_tool[i]=tool
 if name=='samurai':
  a,b=bones['blade'][:2];axis=(b-a).normalized()
  for v in mesh.data.vertices:
   offset=v.co-a;along=offset.dot(axis);distance=(offset-axis*along).length
   if v.index not in assign_tool and -.52<along<-.15 and distance<(.16 if along<-.25 else .09):assign_tool[v.index]='blade'
 if name=='mirrorGuard':
  a,b=bones['blade'][:2];axis=(b-a).normalized()
  for v in mesh.data.vertices:
   offset=v.co-a;along=offset.dot(axis);distance=(offset-axis*along).length
   if v.index not in assign_tool and -.36<along<-.08 and distance<.115:assign_tool[v.index]='blade'
  # The shield is fused to the wrist; isolate only the forward shield plate.
  for v in mesh.data.vertices:
   x,y,z=v.co
   if -.75<x<.03 and abs(.57*x+.82*y+.228)<.065 and .55<z<1.46:assign_tool[v.index]='shield'
 if name=='samurai':
  # Fit the rest skeleton to the actual low-mesh surface, excluding rigid weapons.
  from mathutils.kdtree import KDTree
  body_points=[v.co.copy()for v in mesh.data.vertices if v.index not in assign_tool]
  tree=KDTree(len(body_points))
  for i,p in enumerate(body_points):tree.insert(p,i)
  tree.balance();fitted={};fit_report=[]
  def fit_point(p,radius):
   key=tuple(round(v,5)for v in p)
   if key in fitted:return fitted[key].copy()
   samples=tree.find_range(p,radius)
   if len(samples)<6:samples=tree.find_n(p,12)
   # A local envelope centre places joints inside the limb, not on its skin.
   cloud=[v for v,i,d in samples];center=V(tuple((min(v[k]for v in cloud)+max(v[k]for v in cloud))*.5 for k in range(3)))
   delta=center-p
   if delta.length>radius*.65:delta*=radius*.65/delta.length
   result=p+delta;fitted[key]=result.copy();return result
  old_bones={n:(a.copy(),b.copy(),parent)for n,(a,b,parent)in bones.items()}
  for n,(a,b,parent)in old_bones.items():
   if n in ['root','blade','scabbard']:continue
   radius=.035 if n.startswith('finger')else .07 if n.startswith(('hand','elbow'))else .11
   aa=fit_point(a,radius);bb=fit_point(b,radius)
   if (bb-aa).length<.008:bb=aa+(b-a).normalized()*.008
   bones[n]=(aa,bb,parent);fit_report.append({'bone':n,'head':list(aa),'tail':list(bb),'shift':max((aa-a).length,(bb-b).length)})
  for side in arms:
   arms[side]=[bones['upper_arm_'+side][0],bones['forearm_'+side][0],bones['hand_'+side][0],bones['hand_'+side][1]]
  (ROOT/'output/enemy-models/samurai-bone-fit.json').write_text(json.dumps(fit_report,indent=2))
 data=bpy.data.armatures.new(name+'_skeleton');rig=bpy.data.objects.new(name+'_rig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
 for n,(a,b,parent) in bones.items():
  eb=data.edit_bones.new(n);eb.head=a;eb.tail=b
  if parent:eb.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;groups={n:mesh.vertex_groups.new(name=n)for n in bones}
 weights=[]
 for v in mesh.data.vertices:
  p=v.co;x,y,z=p;side='L' if x<0 else 'R';ax=abs(x)
  if v.index in assign_tool:candidates=[assign_tool[v.index]]
  elif name in ['samurai','mirrorGuard']:
   if z<height*.49 and ax>.05:candidates=chains['leg_'+side]+['pelvis']
   elif z>height*.83:candidates=['head','neck']
   elif ax>(.20 if name=='mirrorGuard' else .24) and z>(1.12 if name=='samurai' else .75):candidates=['clavicle_'+side,'upper_arm_'+side,'forearm_'+side,'hand_'+side]
   elif z>height*.83:candidates=['head','neck']
   else:candidates=['pelvis','spine','chest','neck']
  elif name=='spitter':
   if y>.30 or (y>-.13 and z>.62):candidates=chains['tail']
   elif y<-.30 and z>.48:candidates=chains['neck']+['head','jaw']
   elif z<.35 and ax>.07:candidates=chains[f'leg_{side}{0 if y<-.07 else 1}']
   else:candidates=['pelvis','chest']+chains['tail'][:1]+chains['neck'][:1]
  else:
   if z>1.75:candidates=chains['antenna_'+side]+['head']
   elif y<-.60 and ax>.22 and z>1.0:candidates=chains['scythe_'+side]
   elif ax>.25 or z<.50:candidates=chains[f'leg_{side}{0 if y<.20 else 1}']
   elif y<-.55:candidates=['neck','head']
   else:candidates=['thorax','neck']+chains['abdomen']
  distances=sorted([(dist(p,*bones[n][:2]),n) for n in candidates]);nearest=distances[0][1];q={nearest:1.}
  # Localized blend around joints keeps armor/limb segments from turning into rubber.
  for d,n in distances[1:3]:
   if abs(d-distances[0][0])<height*.045:q[n]=.5*(1-abs(d-distances[0][0])/(height*.045))
  total=sum(q.values());weights.append({n:w/total for n,w in q.items()})
 # A small seam-aware diffusion closes categorical boundaries without spreading wrist twist into the torso.
 neighbors=[set()for v in mesh.data.vertices]
 for edge in mesh.data.edges:a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 seam={}
 for v in mesh.data.vertices:seam.setdefault(tuple(round(c,5)for c in v.co),[]).append(v.index)
 for ids in seam.values():
  for i in ids:neighbors[i].update(j for j in ids if j!=i)
 for step in range(48 if name in ['samurai','mirrorGuard'] else 8):
  result=[]
  for i,q in enumerate(weights):
   if i in assign_tool:result.append(q);continue
   out={n:w*.5 for n,w in q.items()}
   for j in neighbors[i]:
    for n,w in weights[j].items():
     if n not in ['blade','scabbard','shield']:out[n]=out.get(n,0)+w*.5/max(1,len(neighbors[i]))
   top=sorted(out.items(),key=lambda p:-p[1])[:4];total=sum(w for n,w in top);result.append({n:w/total for n,w in top})
  weights=result
 if arms:
  for v in mesh.data.vertices:
   if v.index in assign_tool:continue
   x,y,z=v.co;gate=smooth((abs(x)-.12)/.25)*(1 if abs(x)>.36 else smooth((z-(1.05 if name=='samurai'else .74))/(.35 if name=='samurai'else .24)));q=weights[v.index];lost=0
   for n in list(q):
    if n.startswith(('upper_arm','forearm','hand','clavicle','elbow')):lost+=q[n]*(1-gate);q[n]*=gate
   anchor='chest'if z>1.40 else'spine'if z>1.16 else'pelvis';q[anchor]=q.get(anchor,0)+lost
 if arms:
  for v in mesh.data.vertices:
   if v.index in assign_tool:continue
   p=v.co;side='L'if p.x<0 else'R';palm=V(arms[side][3]);wrist=V(arms[side][2]);axis=(palm-wrist).normalized();d=(p-palm).length
   if d<height*.14:
    blend=smooth((height*.14-d)/(height*.055));fingers=[n for n in finger_names if n.startswith('finger_'+side)];near=min(fingers,key=lambda n:dist(p,*bones[n][:2]));digit=near.rsplit('_',1)[0];chain_f=[n for n in fingers if n.startswith(digit+'_')];fs={n:1/(.02+dist(p,*bones[n][:2]))**2 for n in chain_f};total=sum(fs.values());amount=.45*blend
    q={n:w*(1-blend)for n,w in weights[v.index].items()};q['hand_'+side]=q.get('hand_'+side,0)+blend-amount
    for n,w in fs.items():q[n]=q.get(n,0)+amount*w/total
    top=sorted(q.items(),key=lambda p:-p[1])[:4];total=sum(w for n,w in top);weights[v.index]={n:w/total for n,w in top}
 for i,q in enumerate(weights):
  for n,w in q.items():groups[n].add([i],w,'REPLACE')
 mesh.parent=rig;modifier=mesh.modifiers.new('Armature','ARMATURE');modifier.object=rig
 for p in mesh.data.polygons:p.use_smooth=True
 # Separate rigid components using face ownership, preserving all original triangles and UVs.
 source_mesh=mesh.data.copy()
 for tool in sorted(set(assign_tool.values())):
  ids={i for i,n in assign_tool.items()if n==tool};copy=mesh.copy();copy.data=source_mesh.copy();copy.name=name+'_'+tool;bpy.context.collection.objects.link(copy)
  bm=bmesh.new();bm.from_mesh(copy.data);bm.verts.ensure_lookup_table();remove=[f for f in bm.faces if not (any(v.index in ids for v in f.verts) if tool=='shield'else all(v.index in ids for v in f.verts))];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(copy.data);bm.free()
  copy.vertex_groups.clear();group=copy.vertex_groups.new(name=tool);group.add(list(range(len(copy.data.vertices))),1,'REPLACE');tools[tool]=copy
 bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table();remove=[f for f in bm.faces if any(assign_tool.get(v.index)=='shield'for v in f.verts) or (len({assign_tool.get(v.index)for v in f.verts})==1 and assign_tool.get(f.verts[0].index) is not None)];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(mesh.data);bm.free();bpy.data.meshes.remove(source_mesh)
 if arms:
  # Smooth only the body-side grip seam. Rigid shield and blades never share this relaxation.
  body_weights=[];adj=[set()for v in mesh.data.vertices]
  for edge in mesh.data.edges:a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
  names={g.index:g.name for g in mesh.vertex_groups}
  for v in mesh.data.vertices:
   q={names[g.group]:g.weight for g in v.groups if g.weight>1e-8}
   if 'shield'in q:q['hand_L']=q.get('hand_L',0)+q.pop('shield')
   body_weights.append(q)
  for step in range(24):
   updated=[]
   for v,q in zip(mesh.data.vertices,body_weights):
    if any((v.co-V(arms[side][3])).length<height*.065 for side in ['L','R']):updated.append(q);continue
    out={n:w*.5 for n,w in q.items()}
    for j in adj[v.index]:
     for n,w in body_weights[j].items():out[n]=out.get(n,0)+w*.5/max(1,len(adj[v.index]))
    top=sorted(out.items(),key=lambda p:-p[1])[:4];total=sum(w for n,w in top);updated.append({n:w/total for n,w in top})
   body_weights=updated
  for v,q in zip(mesh.data.vertices,body_weights):
   x,y,z=v.co;gate=smooth((abs(x)-.12)/.25)*(1 if abs(x)>.36 else smooth((z-(1.05 if name=='samurai'else .74))/(.35 if name=='samurai'else .24)));lost=0
   for n in list(q):
    if n.startswith(('upper_arm','forearm','hand','clavicle','elbow')):lost+=q[n]*(1-gate);q[n]*=gate
   anchor='chest'if z>height*.67 else'spine'if z>height*.53 else'pelvis';q[anchor]=q.get(anchor,0)+lost
  mesh.vertex_groups.clear();groups={n:mesh.vertex_groups.new(name=n)for n in bones}
  for i,q in enumerate(body_weights):
   for n,w in q.items():groups[n].add([i],w,'REPLACE')
 if name=='samurai':
  # Rebind the separated body with Blender bone heat, retaining anatomical corrections.
  corrected=[{mesh.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.data.vertices]
  mesh.vertex_groups.clear();bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
  bpy.ops.object.parent_set(type='ARMATURE_AUTO')
  automatic=[{mesh.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.data.vertices]
  groups={g.name:g for g in mesh.vertex_groups}
  for n in bones:
   if n not in groups:groups[n]=mesh.vertex_groups.new(name=n)
  for v,auto,manual in zip(mesh.data.vertices,automatic,corrected):
   hand=sum(w for n,w in manual.items()if n.startswith(('hand','finger')))
   blend=.9 if hand>.4 else .35
   weights_new={n:(1-blend)*auto.get(n,0)+blend*manual.get(n,0) for n in bones}
   top=sorted(weights_new.items(),key=lambda item:-item[1])[:4];total=sum(w for n,w in top)
   if total<1e-8:top=list(manual.items());total=sum(w for n,w in top)
   for g in mesh.vertex_groups:g.remove([v.index])
   for n,w in top:
    if w>0:groups[n].add([v.index],w/total,'REPLACE')
  modifiers=[m for m in mesh.modifiers if m.type=='ARMATURE']
  for m in modifiers[1:]:mesh.modifiers.remove(m)
 rest={n:data.bones[n].matrix_local.copy()for n in bones}
 def reset():
  for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=Q();p.location=(0,0,0);p.scale=(1,1,1)
  bpy.context.view_layer.update()
 def rotate(n,axis,angle):
  if n not in bones:return
  q=rest[n].to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted()@Q(V(axis),angle)@q;bpy.context.view_layer.update()
 def orient(n,a,b):
  rb=data.bones[n];q=(rb.tail_local-rb.head_local).rotation_difference(b-a);rig.pose.bones[n].matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@rb.matrix_local.to_3x3().to_4x4();bpy.context.view_layer.update()
 arm_normals={}
 def arm(side,grip,delta,offset=None):
  upper='upper_arm_'+side;lower='forearm_'+side;hand='hand_'+side;origin=rig.pose.bones[upper].head.copy();offset=V(offset)if offset is not None else V(arms[side][3])-V(arms[side][2]);goal=V(grip)-delta@offset;axis=(goal-origin).normalized();l1=(bones[upper][1]-bones[upper][0]).length;l2=(bones[lower][1]-bones[lower][0]).length;d=max(abs(l1-l2)+.005,min((goal-origin).length,l1+l2-.004));along=(l1*l1+d*d-l2*l2)/(2*d);pole=origin+rig.pose.bones['chest'].matrix.to_quaternion()@V(((-.48 if side=='L' else .48) if name=='samurai' else (-.28 if side=='L' else .28),-.16 if name=='samurai' else .10,-.28 if name=='samurai' else -.40));perp=pole-origin-axis*(pole-origin).dot(axis);perp.normalize();elbow=origin+axis*along+perp*math.sqrt(max(0,l1*l1-along*along));end=origin+axis*d
  source_normal=(V(arms[side][1])-V(arms[side][0])).cross(V(arms[side][2])-V(arms[side][1])).normalized();posed_normal=(elbow-origin).cross(end-elbow).normalized()
  for n,a,b in [(upper,origin,elbow),(lower,elbow,end)]:
   source_y=(bones[n][1]-bones[n][0]).normalized();target_y=(b-a).normalized();source_z=source_normal.cross(source_y).normalized();target_z=posed_normal.cross(target_y).normalized()
   stable_normal=posed_normal.copy()
   if name=='samurai' and n in arm_normals:
    prior=arm_normals[n]-target_y*arm_normals[n].dot(target_y)
    if prior.length>.01:
     prior.normalize();stable_normal=prior.lerp(stable_normal,.22).normalized()
   arm_normals[n]=stable_normal.copy();target_z=stable_normal.cross(target_y).normalized()
   source_frame=Matrix((source_normal,source_y,source_z)).transposed();target_frame=Matrix((stable_normal,target_y,target_z)).transposed();rotation=target_frame.to_quaternion()@source_frame.to_quaternion().inverted()@rest[n].to_quaternion();rig.pose.bones[n].matrix=Matrix.Translation(a)@rotation.to_matrix().to_4x4();bpy.context.view_layer.update()
  fore_axis=(end-elbow).normalized();current=rig.pose.bones[lower].matrix.to_quaternion()@V((1,0,0));target=(delta@rest[hand].to_quaternion())@V((1,0,0));current-=fore_axis*current.dot(fore_axis);target-=fore_axis*target.dot(fore_axis)
  if current.length>.001 and target.length>.001:
   strength=smooth(target.length/.20);current.normalize();target.normalize();angle=math.atan2(fore_axis.dot(current.cross(target)),current.dot(target));roll=Q(fore_axis,.65*math.sin(angle)*strength);matrix=rig.pose.bones[lower].matrix.copy();rig.pose.bones[lower].matrix=Matrix.Translation(elbow)@roll.to_matrix().to_4x4()@matrix.to_3x3().to_4x4();bpy.context.view_layer.update()
  rig.pose.bones[hand].matrix=Matrix.Translation(end)@delta.to_matrix().to_4x4()@rest[hand].to_3x3().to_4x4();bpy.context.view_layer.update();rig.pose.bones['elbow_'+side].rotation_quaternion=rig.pose.bones[lower].rotation_quaternion.copy();bpy.context.view_layer.update();return end+delta@offset
 def pose(action,t):
  reset();phase=math.tau*t;prep=smooth(t/.45);hit=smooth((t-.45)/.175);release=smooth((t-.72)/.28);weight=prep*(1-release)
  if arms:
   if action=='Walk':
    for side,sign in [('L',1),('R',-1)]:
     a=phase+(0 if sign==1 else math.pi);ns=chains['leg_'+side];rotate(ns[0],(1,0,0),.20*math.sin(a));rotate(ns[1],(1,0,0),-.25*max(0,math.sin(a)));rotate(ns[2],(1,0,0),-.10*math.sin(a))
   if name=='samurai':
    two_handed=action in ['RisingLeft','RisingRight','Overhead','BuriedOverhead','Extract']
    for side,sign in [('L',-1),('R',1)]:
     pb=rig.pose.bones['clavicle_'+side];matrix=pb.matrix.copy();matrix.translation+=V((0,0,0));pb.matrix=matrix
    bpy.context.view_layer.update()
    axis=(bones['blade'][1]-bones['blade'][0]).normalized();up=V((0,0,1));base=axis.rotation_difference(up);grip=V((0,-.25,1.43));direction=V((-.15,-.65,.74));q=axis.rotation_difference(direction)
    active=action not in ['Idle','Walk','Hurt','Death']
    torso=0
    if action in ['Overhead','BuriedOverhead','Extract']:
     ready_grip=V((0,-.04,2.02));low=V((0,-.42,1.16 if action in ['BuriedOverhead','Extract'] else 1.36));down=Q(V((1,0,0)),2.57*hit)@base
     if action=='Extract':
      pull=smooth((t-.65)/.35);prep=1;hit=1-pull;release=0;down=Q(V((1,0,0)),2.57-2.57*pull)@base
     grip=grip.lerp(ready_grip,prep).lerp(low,hit).lerp(V((0,-.25,1.43)),release);q=down if action=='Extract' else q.slerp(down,weight);torso=(-.09*prep+.22*hit)*(1-release)
    elif active:
     if action in ['CrossLeft','CrossRight','RoundSweep']:
      start=-1.35 if action!='CrossRight'else 1.35;end=1.35 if action!='CrossRight'else -1.35;a=start*(1-hit)+end*smooth((t-.625)/.075);
      if action=='RoundSweep':
       a=math.tau*hit;rotate('root',(0,0,1),a)
      direction=V((math.sin(a)*.94,-math.cos(a)*.94,.10 if action=='RoundSweep'else .20)).normalized();attack_q=Q(V((0,0,1)),a)@Q(V((1,0,0)),math.atan2(.94,.10 if action=='RoundSweep'else .20))@base;grip=grip.lerp(V((math.sin(a)*.26,-math.cos(a)*.26,1.22))if action=='RoundSweep'else V((.12 if start>0 else -.12,-.30,1.48)),weight);q=q.slerp(attack_q,weight);rotate('spine',(0,0,1),(-start*.2+(end-start)*.2*hit)*weight)
     elif action in ['Rising','RisingLeft','RisingRight']:
      angle=2.3-1.05*hit-1.45*smooth((t-.625)/.075);side=0 if action=='Rising' else (1 if action=='RisingLeft' else -1);attack_q=Q(V((0,1,0)),side*(1.05-2.1*hit))@Q(V((1,0,0)),angle)@base;grip=grip.lerp(V((side*(.30-.60*hit),-.40,1.02+.80*hit)),weight);q=q.slerp(attack_q,weight)
     else:
      grip=grip.lerp(V((.12,-.12,1.42)),prep).lerp(V((0,-.56,1.43)),hit).lerp(V((0,-.25,1.43)),release);q=q.slerp(axis.rotation_difference(V((0,-1,.03))),weight);torso=.18*hit*(1-release)
    if action=='RisingLeft' and t<.625:
     sheath_a,sheath_b=bones['scabbard'][:2];sheath_axis=(sheath_b-sheath_a).normalized()
     draw=smooth((t-.30)/.325);grip=V(sheath_a).lerp(grip,draw);q=axis.rotation_difference(sheath_axis).slerp(q,draw)
    rotate('chest',(1,0,0),torso)
    if action in ['RisingLeft','RisingRight'] and 'sword_rotation' in arm_normals:
     previous_q=arm_normals['sword_rotation'];angle=previous_q.rotation_difference(q).angle
     if angle>math.pi:angle=math.tau-angle
     q=previous_q.slerp(q,min(1,.24/max(.0001,angle)))
    arm_normals['sword_rotation']=q.copy()
    direction=q@axis
    support_y=(V((1,0,0))-axis*axis.x).normalized();support_x=support_y.cross(axis).normalized();support_frame=Matrix((support_x,support_y,axis)).transposed();support_rest=support_frame.to_quaternion()@rest['hand_L'].to_quaternion().inverted();left_q=q@support_rest
    right_offset=bones['blade'][0]-V(arms['R'][2]);left_offset=V(arms['L'][3])-V(arms['L'][2])
    right_center=rig.pose.bones['upper_arm_R'].head+q@right_offset;left_center=rig.pose.bones['upper_arm_L'].head+direction*.14+left_q@left_offset
    radii={side:sum((V(arms[side][j+1])-V(arms[side][j])).length for j in range(2))-.008 for side in ['L','R']}
    # Solve the common hilt inside both arms' reach, rather than twisting a wrist to chase it.
    forward=rig.pose.bones['chest'].matrix.to_quaternion()@V((0,-1,0))
    if not two_handed:grip.x+=.16;grip.y-=.08
    centers=[(right_center,radii['R'])]+([(left_center,radii['L'])]if two_handed else [])
    for iteration in range(20):
     for center,radius in centers:
      offset=grip-center
      if offset.length>radius:grip=center+offset.normalized()*radius
      ahead=(grip-center).dot(forward)
      if ahead<.17:grip+=forward*(.17-ahead)
    actual=arm('R',grip,q,right_offset)
    if two_handed:arm('L',actual-direction*.14,left_q)
    else:arm('L',V((-.62,-.23,1.22)),Q())
    for n in finger_names:
     if two_handed and n.startswith('finger_L'):rotate(n,V((0,0,1)),.72 if n.endswith('_0')else .95)
   else:
    r=V(arms['R'][3]);l=V(arms['L'][3]);axis=(bones['blade'][1]-bones['blade'][0]).normalized();q=Q()
    if action in ['ShieldThrust','Riposte']:
     ready=V((.32,-.06,1.12));target=V((.12,-.51,1.13));r=r.lerp(ready,prep).lerp(target,hit).lerp(V(arms['R'][3]),release)
     direction=V((.5-.9*hit,-.7,.5-.7*hit)).normalized()if action=='Riposte'else V((0,-1,.02));q=Q().slerp(axis.rotation_difference(direction),weight)
    if action in ['Parry','ShieldThrow','ParryPush']:
     l=l.lerp(V((-.18,-.34,1.12)),prep*(1-release))
    if action=='ParryPush':l=V((-.18,-.34,1.12))+V((-.04,-.12,0))*math.sin(math.pi*t)
    arm('R',r,q);arm('L',l,Q())

  elif name=='spitter':
   rotate('chest',(0,0,1),.02*math.sin(phase));rotate('head',(1,0,0),.025*math.sin(phase))
   for j,n in enumerate(chains['tail']):rotate(n,(0,0,1),(.025 if action!='TailSweep'else .55*weight)*math.sin(phase*.5+j*.25) if action!='TailSweep'else (-.75+1.5*hit)*weight*(.55 if j<3 else .25))
   if action=='TailSweep':
    for j,n in enumerate(chains['tail']):
     a=rig.pose.bones[n].head.copy();length=(bones[n][1]-bones[n][0]).length;yaw=-.60+2.50*hit+j*.17;direction=V((math.sin(yaw),math.cos(yaw),-.015)).normalized();orient(n,a,a+direction*length);pb=rig.pose.bones[n];pb.rotation_quaternion=Q().slerp(pb.rotation_quaternion,weight);pb.location=(0,0,0);bpy.context.view_layer.update()
   if action=='Shoot':
    rotate('neck_0',(1,0,0),-.10*weight+.18*hit*(1-release));rotate('head',(1,0,0),-.15*weight+.2*hit*(1-release));rotate('jaw',(1,0,0),.30*weight)
   for prefix,ns in chains.items():
    if not prefix.startswith('leg_'):continue
    a=phase+(math.pi if prefix in ['leg_L0','leg_R1']else 0);moving=action in ['Walk','Retreat'];amplitude=.22 if action=='Walk'else .30
    if moving:rotate(ns[0],(1,0,0),amplitude*math.sin(a));rotate(ns[1],(1,0,0),-.28*max(0,math.sin(a)));rotate(ns[2],(1,0,0),-.08*math.sin(a))
   if action=='Retreat':rotate('chest',(1,0,0),-.10*math.sin(math.pi*t))
  else:
   rotate('thorax',(1,0,0),.015*math.sin(phase));rotate('head',(0,0,1),.025*math.sin(phase))
   for side,sign in [('L',-1),('R',1)]:
    for j,n in enumerate(chains['antenna_'+side]):rotate(n,(0,0,1),.03*math.sin(phase+j))
    ns=chains['scythe_'+side];active=action in ['Thrust','Pounce']or action==('CutLeft'if side=='L'else'CutRight')
    if active:
     rotate(ns[0],(0,0,1),sign*(.35*prep-1.0*hit)*(1-release));rotate(ns[1],(1,0,0),(-.45*prep+.90*hit)*(1-release));rotate(ns[2],(1,0,0),(.25*prep-.50*hit)*(1-release))
    if action=='Walk':
     for j in [0,1]:
      ls=chains[f'leg_{side}{j}'];a=phase+(math.pi if (side=='L')==bool(j)else 0);rotate(ls[0],(0,0,1),.08*math.sin(a));rotate(ls[1],(1,0,0),.12*max(0,math.sin(a)));rotate(ls[2],(1,0,0),-.06*math.sin(a))
   if action=='Pounce':rotate('thorax',(1,0,0),(-.10*prep+.18*hit)*(1-release))
  if action=='Hurt':rotate('chest'if arms else 'chest'if name=='spitter'else'thorax',(1,0,0),-.12*math.sin(math.pi*t))
  if action=='Death':rotate('root',(1,0,0),1.35*smooth(t))
  bpy.context.view_layer.update()
  if action!='Death':
   minimum=1e6
   for o in ([mesh] if name=='samurai' else [mesh]+list(tools.values())):
    evaluated=o.evaluated_get(bpy.context.evaluated_depsgraph_get());geo=evaluated.to_mesh();minimum=min(minimum,min((v.co.z for v in geo.vertices),default=0));evaluated.to_mesh_clear()
   if minimum<.002:
    matrix=rig.pose.bones['root'].matrix.copy();matrix.translation.z+=.002-minimum;rig.pose.bones['root'].matrix=matrix
  bpy.context.view_layer.update()
 scene=bpy.context.scene;scene.render.fps=60;scene.frame_start=0;scene.frame_end=60;bpy.context.preferences.filepaths.save_version=0
 for action in clips:
  rig.animation_data_clear();a=bpy.data.actions.new(action);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a
  arm_normals.clear()
  for frame in range(61):
   pose(action,frame/60)
   for pb in rig.pose.bones:
    for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame)
  rig.animation_data.action=None
 rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
 edit=ROOT/'assets-source/blender/rigged';edit.mkdir(exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(edit/f'{name}.blend'));bpy.ops.object.select_all(action='SELECT')
 staged=ROOT/f'output/enemy-models/{name}-staged.glb';bpy.ops.export_scene.gltf(filepath=str(staged),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_tangents=True,export_morph=False)
 staged.replace(ROOT/f'public/models/enemies/{name}.glb')
 report={'source':name+'_low.glb','triangles':original_triangles,'bones':len(bones),'clips':clips,'height':height};(ROOT/f'output/enemy-models/{name}-rig-report.json').write_text(json.dumps(report,indent=2));(ROOT/f'assets-source/blender/rigged/{name}.json').write_text(json.dumps(report,indent=2));print('ROSTER_RIG',name,report)
for name in (sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else SPECS):build(name)
