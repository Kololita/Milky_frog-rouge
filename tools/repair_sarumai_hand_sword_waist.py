import bpy,bmesh,math,shutil,json
from pathlib import Path
from mathutils import Vector as V,Matrix,Quaternion
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';backup=ROOT/'assets-source/blender/reference/sarumai-before-hand-sword-separation.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=bpy.data.objects['samurai_body'];sword=bpy.data.objects['samurai_blade'];rig.data.pose_position='POSE'
# Retain every existing action and the approved left-hand pose.
actions=list(bpy.data.actions);poses={}
for a in actions:
 rig.animation_data.action=a
 if a.slots:rig.animation_data.action_slot=a.slots[0]
 frames=[]
 for f in range(61):
  bpy.context.scene.frame_set(f);frames.append({b.name:b.matrix.copy()for b in rig.pose.bones})
 poses[a.name]=frames
rig.animation_data_clear();rig.data.pose_position='REST';rest={b.name:b.matrix_local.copy()for b in rig.data.bones}
# Finish the mirror below the old horizontal cut, including winding and leg weights.
bm=bmesh.new();bm.from_mesh(body.data);deform=bm.verts.layers.deform.verify();names={g.index:g.name for g in body.vertex_groups};groups={g.name:g.index for g in body.vertex_groups}
for face in bm.faces:
 if any(v.co.z<1.10 for v in face.verts):face.normal_flip()
for v in bm.verts:
 if v.co.z<1.10:
  v.co.x=-v.co.x;weights=dict(v[deform]);v[deform].clear()
  for i,w in weights.items():
   name=names[i];other=name.replace('leg_L','leg_R')if 'leg_L'in name else name.replace('leg_R','leg_L')if 'leg_R'in name else name
   v[deform][groups.get(other,i)]=w
# Copy the accepted left hand, including UVs, into the right wrist frame.
left_faces=[f for f in bm.faces if all(v.co.x>.735 for v in f.verts)]
left_verts=set(v for f in left_faces for v in f.verts)
transform=rest['hand_R']@Matrix.Diagonal((-1,1,1,1))@rest['hand_L'].inverted()
clone=bmesh.ops.duplicate(bm,geom=list(left_verts)+list(set(e for f in left_faces for e in f.edges))+left_faces)
newverts=[v for v in clone['geom']if isinstance(v,bmesh.types.BMVert)];newfaces=[f for f in clone['geom']if isinstance(f,bmesh.types.BMFace)]
def distance(p,a,b):
 d=b-a;return (p-a-d*max(0,min(1,(p-a).dot(d)/d.length_squared))).length
for v in newverts:
 p=v.co.copy();v.co=transform@p;v[deform].clear()
 nearest_thumb=min(distance(p,b.head_local,b.tail_local)for b in rig.data.bones if b.name.startswith('finger_L_0'))
 palm=max(0,min(1,(.835-p.x)/.04))
 if nearest_thumb<.028:palm=min(palm,.12)
 if palm>0:v[deform][groups['hand_R']]=palm
 if palm<1:
  candidates=sorted((distance(p,b.head_local,b.tail_local),b.name.replace('_L','_R'))for b in rig.data.bones if b.name.startswith('finger_L'))[:2]
  weights=[1/(d+.002)**4 for d,n in candidates];total=sum(weights)
  for (_,n),w in zip(candidates,weights):v[deform][groups[n]]=w/total*(1-palm)
for f in newfaces:f.normal_flip()
# Remove the fused old hand/hilt surface, keeping the wrist cuff and sleeve.
wrist=rig.data.bones['hand_R'].head_local;forward=(rig.data.bones['hand_R'].tail_local-wrist).normalized()
old=[v for v in bm.verts if v not in newverts and v.co.x<-.48 and (v.co-wrist).dot(forward)>-.015 and (v.co-wrist-forward*(v.co-wrist).dot(forward)).length<.27]
bmesh.ops.delete(bm,geom=old,context='VERTS')
# Sleeve and forearm may never inherit finger bending.
for v in bm.verts:
 if v not in newverts and v.co.x<-.38 and 1.25<v.co.z<1.72:
  candidates=[rig.data.bones['upper_arm_R'],rig.data.bones['forearm_R']]
  ws=[1/(distance(v.co,b.head_local,b.tail_local)+.02)**4 for b in candidates];v[deform].clear()
  for b,w in zip(candidates,ws):v[deform][groups[b.name]]=w/sum(ws)
# Fill the wrist beneath the cuff with a continuous, softly weighted skin surface.
skin=bpy.data.materials.new('Samurai_Wrist_Skin');skin.diffuse_color=(.51,.285,.19,1);skin.use_nodes=True;skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=skin.diffuse_color;skin.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.72;body.data.materials.append(skin)
wu=forward.cross(V((0,1,0))).normalized();wv=forward.cross(wu).normalized();rings=[]
for t,radius in [(-.10,.043),(-.06,.039),(-.02,.032),(.015,.03),(.035,.035)]:
 ring=[]
 for j in range(16):
  theta=math.tau*j/16;v=bm.verts.new(wrist+forward*t+radius*(wu*math.cos(theta)+wv*math.sin(theta)));weight=max(0,min(1,(t+.06)/.075));v[deform][groups['hand_R']]=weight;v[deform][groups['forearm_R']]=1-weight;ring.append(v)
 rings.append(ring)
for a,b in zip(rings,rings[1:]):
 for j in range(16):f=bm.faces.new((a[j],a[(j+1)%16],b[(j+1)%16],b[j]));f.material_index=len(body.data.materials)-1;f.smooth=True
bmesh.ops.remove_doubles(bm,verts=newverts,dist=.00002)
bm.to_mesh(body.data);bm.free();body.data.update()
# Mirror anatomical finger joints from the source hand; do not approximate their placement.
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:
 if b.name.startswith('finger_R'):
  source=rig.data.edit_bones[b.name.replace('_R','_L')];b.use_connect=False;b.head=transform@source.head;b.tail=transform@source.tail;b.align_roll(transform.to_3x3()@source.z_axis)
bpy.ops.object.mode_set(mode='OBJECT')
# Sword remains a separate rigid object. Remove skin fragments around the grip;
# retain the original blade, guard, pommel, UVs, and textured material.
axis=V((1.365,-.78,-.65)).normalized();origin=rig.data.bones['blade'].head_local.copy()
bm=bmesh.new();bm.from_mesh(sword.data)
remove=[]
for f in bm.faces:
 t=sum((v.co-origin).dot(axis)for v in f.verts)/len(f.verts)
 if -.13<t<.065:remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES')
bm.to_mesh(sword.data);bm.free()
# Continuous grip connects to the original blade axis, with original handle UV shading.
bm=bmesh.new();bm.from_mesh(sword.data);uv=bm.loops.layers.uv.verify();u=axis.cross(V((0,0,1))).normalized();v=axis.cross(u).normalized();rings=[]
for t in [-.39,-.36,-.29,-.22,-.15,-.08,0,.07]:
 ring=[]
 for j in range(16):
  theta=math.tau*j/16;ring.append(bm.verts.new(origin+axis*t+.023*(u*math.cos(theta)+v*math.sin(theta))))
 rings.append(ring)
# Use a dark grip material, only for the hidden missing core (original wrap retained outside).
mat=bpy.data.materials.new('Samurai_Grip_Core');mat.diffuse_color=(.055,.065,.075,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color;mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;sword.data.materials.append(mat);mi=len(sword.data.materials)-1
for a,b in zip(rings,rings[1:]):
 for j in range(16):f=bm.faces.new((a[j],a[(j+1)%16],b[(j+1)%16],b[j]));f.material_index=mi
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(sword.data);bm.free();sword.vertex_groups.clear();sword.vertex_groups.new(name='blade').add(list(range(len(sword.data.vertices))),1,'REPLACE')
# Derive wrap positions around the handle. All fingers deform from the copied left-hand mesh.
newrest={b.name:b.matrix_local.copy()for b in rig.data.bones};grasp={}
for digit in range(5):
 count=2 if digit==0 else 3;rootbone=rig.data.bones[f'finger_R_{digit}_0'];p=rootbone.head_local.copy();center=origin+axis*(p-origin).dot(axis);radial=p-center
 if radial.length<.001:radial=u*.04
 radial.normalize();tangent=axis.cross(radial).normalized();sign=1 if tangent.dot(V((0,-1,0)))>0 else -1
 if digit==0:sign=-sign
 points=[p]
 for j in range(count):
  angle=math.radians((j+1)*(48 if digit else 55))*sign;d=Quaternion(axis,angle)@radial;points.append(center+d*(.03 if j==0 else .027))
 start=p.copy()
 for j in range(count):
  n=f'finger_R_{digit}_{j}';b=rig.data.bones[n];direction=(points[j+1]-start).normalized();q=(b.tail_local-b.head_local).rotation_difference(direction);grasp[n]=Matrix.Translation(start)@q.to_matrix().to_4x4()@newrest[n].to_3x3().to_4x4();start+=direction*b.length
rig.data.pose_position='POSE'
for a in actions:bpy.data.actions.remove(a)
for name,frames in poses.items():
 a=bpy.data.actions.new(name);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a
 for f,mats in enumerate(frames):
  for b in rig.pose.bones:
   if b.name.startswith('finger_R'):continue
   b.rotation_mode='QUATERNION';b.matrix=mats[b.name];bpy.context.view_layer.update()
  delta=rig.pose.bones['hand_R'].matrix@rest['hand_R'].inverted()
  for n,m in grasp.items():rig.pose.bones[n].matrix=delta@m;bpy.context.view_layer.update()
  for b in rig.pose.bones:
   for prop in ('location','rotation_quaternion','scale'):b.keyframe_insert(data_path=prop,frame=f,group=b.name)
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o.name not in [body.name,sword.name] and 'scabbard'not in o.name:bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));print('REPAIRED_SWORD_HAND_WAIST',len(newverts),len(old))
