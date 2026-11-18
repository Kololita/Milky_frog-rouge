import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from enemy_materials import apply_enemy_materials
OUT=ROOT/'public/models/enemies';OUT.mkdir(parents=True,exist_ok=True)
EDIT=ROOT/'assets-source/blender/rigged';EDIT.mkdir(exist_ok=True)
REPORT={}
def V(p):return Vector(p)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def segment(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-8)));return (p-a-t*d).length,t

def build(name):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets-source/blender/{name}_low.glb'))
 mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');mesh.parent=None;mesh.matrix_world=Matrix.Identity(4);mesh.name=name+'_body';mesh.data.name=name+'_low_mesh'
 for o in list(bpy.context.scene.objects):
  if o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
 if name=='shellbug':
  for v in mesh.data.vertices:x,y,z=v.co;v.co=(-x,-z,-y)
 points=[v.co.copy() for v in mesh.data.vertices];scale=1.55/(max(p.z for p in points)-min(p.z for p in points)) if name=='raider' else 1.4/(max(p.y for p in points)-min(p.y for p in points));base=min(p.z for p in points)
 for v in mesh.data.vertices:v.co*=scale;v.co.z-=base*scale
 bones={}
 def bone(n,a,b,parent=None):bones[n]=(V(a),V(b),parent)
 bone('root',(0,0,0),(0,0,.15))
 if name=='raider':
  bone('pelvis',(0,.01,.72),(0,.01,.83),'root');bone('spine',(0,.01,.83),(0,.015,1.0),'pelvis');bone('chest',(0,.015,1.0),(0,.01,1.20),'spine');bone('neck',(0,.01,1.20),(0,-.015,1.28),'chest');bone('head',(0,-.015,1.28),(0,-.015,1.52),'neck')
  for side in [-1,1]:
   s='L' if side>0 else 'R';bone('clavicle_'+s,(side*.04,0,1.15),(side*.275,0,1.15),'chest');bone('upper_arm_'+s,(side*.275,0,1.15),(side*.393,-.025,.955),'clavicle_'+s);bone('forearm_'+s,(side*.393,-.025,.955),(side*.50,-.045,.78),'upper_arm_'+s);bone('hand_'+s,(side*.50,-.045,.78),(side*.535,-.065,.65),'forearm_'+s)
   bone('thigh_'+s,(side*.16,.02,.735),(side*.235,.005,.405),'pelvis');bone('shin_'+s,(side*.235,.005,.405),(side*.29,-.005,.12),'thigh_'+s);bone('foot_'+s,(side*.29,-.005,.12),(side*.29,-.18,.075),'shin_'+s)
 else:
  bone('body',(0,0,.17),(0,.36,.2),'root');bone('head',(0,-.23,.17),(0,-.49,.17),'body');bone('horn_L',(.075,-.49,.14),(.10,-.68,.14),'head');bone('horn_R',(-.075,-.49,.14),(-.10,-.68,.14),'head')
  for side in [-1,1]:
   for i,(a,b,c,d) in enumerate([((.265,-.235,.13),(.37,-.27,.12),(.455,-.48,.10),(.59,-.65,.11)),((.30,-.10,.13),(.43,-.05,.12),(.575,.145,.10),(.64,.34,.11)),((.26,.17,.14),(.39,.21,.13),(.458,.49,.18),(.454,.66,.28))]):
    s=('L' if side>0 else 'R')+str(i+1);a,b,c,d=[(side*p[0],p[1],p[2]) for p in [a,b,c,d]];bone('leg_'+s,a,b,'body');bone('shin_'+s,b,c,'leg_'+s);bone('claw_'+s,c,d,'shin_'+s)
 data=bpy.data.armatures.new(name+'_skeleton');rig=bpy.data.objects.new(name+'_rig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
 for n,(a,b,parent) in bones.items():
  q=data.edit_bones.new(n);q.head=a;q.tail=b
  if parent:q.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
 groups={n:mesh.vertex_groups.new(name=n) for n in bones}
 def assign(index,n,weight=1):
  if weight>1e-6:groups[n].add([index],weight,'REPLACE')
 def chain_weights(index,p,names,width):
  nearest=min(range(len(names)),key=lambda j:segment(p,*bones[names[j]][:2])[0]);n=names[nearest];weights={n:1.0}
  for j in [nearest-1,nearest+1]:
   if 0<=j<len(names):
    pivot=bones[names[max(j,nearest)]][0];dist=(p-pivot).length
    if dist<width:
     w=.5*(1-dist/width);weights[n]=1-w;weights[names[j]]=w;break
  for n,w in weights.items():assign(index,n,w)
 for v in mesh.data.vertices:
  p=v.co;x,y,z=p;ax=abs(x);s='L' if x>0 else 'R'
  if name=='raider':
   boundary=.255 if z>1.08 else .29 if z>.93 else .335 if z>.78 else .31
   if ax>boundary and z>.48:chain_weights(v.index,p,['clavicle_'+s,'upper_arm_'+s,'forearm_'+s,'hand_'+s],.075)
   elif z<.74 and ax>.07:chain_weights(v.index,p,['thigh_'+s,'shin_'+s,'foot_'+s],.065)
   elif z>1.245:assign(v.index,'head')
   elif z>1.19:chain_weights(v.index,p,['chest','neck','head'],.055)
   elif z>.99:assign(v.index,'chest')
   elif z>.84:chain_weights(v.index,p,['pelvis','spine','chest'],.06)
   else:assign(v.index,'pelvis')
  else:
   side='L' if x>0 else 'R';candidate=min(range(1,4),key=lambda j:min(segment(p,*bones[n+'_'+side+str(j)][:2])[0] for n in ['leg','shin','claw']));names=[n+'_'+side+str(candidate) for n in ['leg','shin','claw']]
   # Outer limbs get localized rigid weights; carapace never follows distant feet.
   body_edge=.265 if y<-.26 else .325
   if ax>body_edge and (z<.23 or ax>.34):chain_weights(v.index,p,names,.05)
   elif y<-.49 and ax<.16:assign(v.index,'horn_'+side)
   elif y<-.265:assign(v.index,'head')
   else:assign(v.index,'body')
 # Smooth only neighboring weight seams; this avoids rigid-region tears in the single mesh.
 neighbors=[set() for _ in mesh.data.vertices]
 for edge in mesh.data.edges:
  a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 weights=[{g.group:g.weight for g in v.groups} for v in mesh.data.vertices]
 for iteration in range(8):
  updated=[]
  for i,current in enumerate(weights):
   if not neighbors[i]:updated.append(current);continue
   result={k:v*.5 for k,v in current.items()}
   for j in neighbors[i]:
    for k,v in weights[j].items():result[k]=result.get(k,0)+v*.5/len(neighbors[i])
   keep=sorted(result.items(),key=lambda p:-p[1])[:4];total=sum(v for _,v in keep);updated.append({k:v/total for k,v in keep})
  weights=updated
 for v in mesh.data.vertices:
  for g in list(v.groups):mesh.vertex_groups[g.group].remove([v.index])
  for k,w in weights[v.index].items():mesh.vertex_groups[k].add([v.index],w,'REPLACE')
 mesh.parent=rig;mod=mesh.modifiers.new('Armature','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
 for p in mesh.data.polygons:p.use_smooth=True
 # Transfer original high-version PBR appearance onto the same low topology.
 apply_enemy_materials(mesh,name)
 def reset():
  for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.scale=(1,1,1)
  bpy.context.view_layer.update()
 def set_dir(n,a,b):
  a,b=V(a),V(b);rb=data.bones[n];q=(rb.tail_local-rb.head_local).rotation_difference(b-a);rig.pose.bones[n].matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@rb.matrix_local.to_3x3().to_4x4();bpy.context.view_layer.update()
 def ik(n1,n2,n3,root,goal,pole,footdir=None):
  root,goal,pole=V(root),V(goal),V(pole);l1=(bones[n1][1]-bones[n1][0]).length;l2=(bones[n2][1]-bones[n2][0]).length;axis=goal-root;d=min(axis.length,l1+l2-.001);axis.normalize();perp=pole-root-axis*(pole-root).dot(axis)
  if perp.length<1e-5:perp=axis.cross(V((0,0,1)))
  perp.normalize();along=(l1*l1+d*d-l2*l2)/(2*max(d,.001));h=math.sqrt(max(0,l1*l1-along*along));elbow=root+axis*along+perp*h;end=root+axis*d
  set_dir(n1,root,elbow);set_dir(n2,elbow,end)
  if n3:set_dir(n3,end,end+V(footdir if footdir is not None else bones[n3][1]-bones[n3][0]))
 def raider_pose(action,t):
  reset();phase=t*math.tau;walking=action=='Walk';u=t if action in ['Jab','Hook','Hurt','Death'] else 0
  prep=smooth(u/.45);hit=smooth((u-.45)/.25);returning=1-smooth((u-.7)/.3);attack=action in ['Jab','Hook'];pulse=math.sin(math.pi*min(1,u/.7)) if u<.7 else 0
  torso=Quaternion(V((0,0,1)),(-.22*prep+.5*hit)*returning if attack else 0)
  lean=(.10*prep-.18*hit)*returning if attack else .045 if walking else .008*math.sin(phase)
  torso=torso@Quaternion(V((1,0,0)),lean)
  origin=V((0,0,.72));shift=V((0,0, -.035+.012*math.cos(phase*2) if walking else -.018*pulse if attack else 0))
  if action=='Hurt':shift.y=.035*math.sin(math.pi*t);torso=Quaternion(V((1,0,0)),-.12*math.sin(math.pi*t))
  if action=='Death':torso=Quaternion(V((1,0,0)),-math.pi*.5*smooth(t));shift=V((0,.15*smooth(t),-.52*smooth(t)))
  def tr(p):return origin+torso@(V(p)-origin)+shift
  for n in ['pelvis','spine','chest','neck','head']:
   a,b,_=bones[n];set_dir(n,tr(a),tr(b))
  for side in [-1,1]:
   s='L' if side>0 else 'R';a,b,_=bones['clavicle_'+s];set_dir('clavicle_'+s,tr(a),tr(b));shoulder=tr(b)
   hand=V((side*.40,-.11,.85));elbow=V((side*.50,.015,.98));handdir=V((side*.015,-.10,-.03))
   if walking:hand.y+=.11*math.sin(phase+(0 if side>0 else math.pi));hand.z+=.025*math.cos(phase)
   active=attack and side==(1 if action=='Jab' else -1)
   if active:
    ready=V((side*.37,-.08,1.04));extended=V((side*(.18 if action=='Jab' else -.10),-.47,1.04));hand=hand.lerp(ready,prep*returning).lerp(extended,hit*returning);elbow=V((side*.55,.025,1.02));handdir=V((0,-.125,0))
   elif attack:hand=V((side*.32,-.13,.88));handdir=V((0,-.1,.015))
   if action=='Death':hand=tr((side*.45,0,.78));elbow=tr((side*.5,0,1.0));handdir=torso@handdir
   ik('upper_arm_'+s,'forearm_'+s,'hand_'+s,shoulder,hand,elbow,handdir)
   hip=tr(bones['thigh_'+s][0]);foot=V((side*.29,-.005,.12));fdir=V((0,-.175,-.045));pole=V((side*.24,-.5,.4))
   if walking:
    swing=math.sin(phase+(math.pi if side>0 else 0));foot.y+=.18*swing;foot.z+=.08*max(0,swing)
   if attack:foot.y+=(-.06 if side>0 else .035)*hit*returning
   if action=='Death':foot=tr(foot);pole=tr(pole);fdir=torso@fdir
   ik('thigh_'+s,'shin_'+s,'foot_'+s,hip,foot,pole,fdir)
 def shell_pose(action,t):
  if action=='Death':
   shell_pose('Idle',0);u=smooth(t);pivot=V((0,0,.28));q=Quaternion(V((0,1,0)),math.pi*u)
   rig.pose.bones['root'].matrix=Matrix.Translation(pivot+V((0,0,.02*u+.3*math.sin(math.pi*u))))@q.to_matrix().to_4x4()@Matrix.Translation(-pivot)@data.bones['root'].matrix_local
   bpy.context.view_layer.update();return
  reset();phase=t*math.tau;walking=action in ['Walk','Charge'];u=t if action in ['Charge','Spikes','Hurt','Death'] else 0
  prep=smooth(u/.45);hit=smooth((u-.45)/.25);w=1-smooth((u-.7)/.3);spikes=action=='Spikes'
  bob=.008*math.cos(phase*2) if walking else .004*math.sin(phase)
  shift=V((0,0,.15+bob-(.035*prep*w if spikes else 0)));tilt=Quaternion(V((1,0,0)),(.08*prep-.12*hit)*w if action=='Charge' else 0)
  if action=='Hurt':tilt=Quaternion(V((0,1,0)),.08*math.sin(math.pi*t))
  def tr(p):return V((0,0,.2))+tilt@(V(p)-V((0,0,.2)))+shift
  for n in ['body','head','horn_L','horn_R']:a,b,_=bones[n];set_dir(n,tr(a),tr(b))
  for side in [-1,1]:
   for i in range(1,4):
    s=('L' if side>0 else 'R')+str(i);root=bones['leg_'+s][0];end=bones['shin_'+s][1];foot=V((side*(.50 if i!=2 else .56),end.y*.80,.115));pole=V((side*.55,root.y,.28));fdir=bones['claw_'+s][1]-end;fdir.z=0;fdir.normalize();fdir*=.13
    if walking:
     step=math.sin(phase+(math.pi if (i+(side>0))%2 else 0));foot.y+=.055*step;foot.z+=.055*max(0,step)
    if spikes:foot.x+=side*.04*prep*w
    ik('leg_'+s,'shin_'+s,'claw_'+s,tr(root),foot,pole,fdir)
 # Bake the grounded stance into rest geometry and rest bones, then animate from it.
 pose=raider_pose if name=='raider' else shell_pose;pose('Idle',0)
 dg=bpy.context.evaluated_depsgraph_get();evaluated=mesh.evaluated_get(dg).to_mesh();stretched=[]
 for edge in mesh.data.edges:
  a,b=edge.vertices;old=(mesh.data.vertices[a].co-mesh.data.vertices[b].co).length;new=(evaluated.vertices[a].co-evaluated.vertices[b].co).length
  if old>.005 and new/old>3:stretched.append((new/old,a,b))
 print(name,'BIND STRETCH',len(stretched))
 for ratio,a,b in sorted(stretched,reverse=True)[:8]:print(round(ratio,1),[(tuple(round(c,3) for c in mesh.data.vertices[i].co),[(mesh.vertex_groups[g.group].name,round(g.weight,2)) for g in mesh.data.vertices[i].groups]) for i in [a,b]])
 bpy.context.view_layer.objects.active=mesh;mesh.select_set(True);rig.select_set(False);bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
 mod=mesh.modifiers.new('Armature','ARMATURE');mod.object=rig
 # Animation solver uses the original segment lengths; applied rest matrices are updated automatically.
 actions=['Idle','Walk','Jab','Hook','Hurt','Death'] if name=='raider' else ['Idle','Walk','Charge','Spikes','Hurt','Death']
 for action in actions:
  rig.animation_data_clear();clip=bpy.data.actions.new(action);clip.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=clip
  for frame in range(0,31):
   pose(action,frame/30)
   for pb in rig.pose.bones:
    pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('scale',frame=frame)
  track=rig.animation_data.nla_tracks.new();track.name=action;track.strips.new(action,0,clip)
  # Keep each authored clip as its own NLA track for GLB animation names.
  rig.animation_data.action=None
  track.mute=True
 # Export unmuted one-track-at-a-time via actions mode; Blender exporter finds all armature actions.
 for track in rig.animation_data.nla_tracks:track.mute=False
 bpy.context.scene.render.fps=30;bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=30
 rig.animation_data.action=None
 for track in rig.animation_data.nla_tracks:track.mute=True
 pose('Idle',0)
 rig.animation_data.action=bpy.data.actions.get('Idle');bpy.context.scene.frame_set(0)
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/f'{name}.blend'))
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_tangents=True,export_morph=False,export_yup=True)
 sums=[sum(g.weight for g in v.groups) for v in mesh.data.vertices]
 REPORT[name]={'source':f'{name}_low.glb','vertices':len(mesh.data.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':len(bones),'clips':actions,'weightRange':[min(sums),max(sums)]}
for name in ['raider','shellbug']:build(name)
(ROOT/'output/enemy-models/rig-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding='utf8')
