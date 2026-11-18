import bpy,bmesh,shutil,math,json
from pathlib import Path
from mathutils import Matrix,Vector as V
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';backup=ROOT/'assets-source/blender/reference/sarumai-before-bracer-web-fix.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=bpy.data.objects['samurai_body'];rig.data.pose_position='POSE';rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.view_layer.update();evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());posed_mesh=evaluated.to_mesh();posed=[v.co.copy()for v in posed_mesh.vertices];left_pose=rig.pose.bones['forearm_L'].matrix.copy();left_end=rig.pose.bones['hand_L'].head.copy();evaluated.to_mesh_clear();rig.data.pose_position='REST'
def segment(p,a,b):d=b-a;return (p-a-d*max(0,min(1,(p-a).dot(d)/d.length_squared))).length
# Copy the original left forearm guard, with its texture and UV seams intact.
bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table();L=rig.data.bones['forearm_L'];R=rig.data.bones['forearm_R'];transform=R.matrix_local@Matrix.Diagonal((-1,R.length/L.length,1,1))@left_pose.inverted()
def armor_vertex(v):
 p=posed[v.index];d=left_end-left_pose.translation;t=(p-left_pose.translation).dot(d)/d.length_squared
 return -.05<t<1.18 and segment(p,left_pose.translation,left_end)<.08
faces=[f for f in bm.faces if all(armor_vertex(v)for v in f.verts)]
assert len(faces)>15,len(faces)
posed_layer=bm.verts.layers.float_vector.new('source_posed_position')
for v in bm.verts:v[posed_layer]=posed[v.index]
copy=bm.copy();copy.faces.ensure_lookup_table();keep={f.index for f in faces};bmesh.ops.delete(copy,geom=[f for f in copy.faces if f.index not in keep],context='FACES');loose=[v for v in copy.verts if not v.link_faces];bmesh.ops.delete(copy,geom=loose,context='VERTS')
copied_pose=copy.verts.layers.float_vector.get('source_posed_position')
for v in copy.verts:v.co=transform@v[copied_pose]
for f in copy.faces:f.normal_flip();f.smooth=True
mesh=bpy.data.meshes.new('Samurai_Matched_Bracer_R');copy.to_mesh(mesh);copy.free();guard=bpy.data.objects.new('Samurai_Bracer_R',mesh);bpy.context.collection.objects.link(guard)
for m in body.data.materials:mesh.materials.append(m)
guard.vertex_groups.new(name='forearm_R').add(list(range(len(mesh.vertices))),1,'REPLACE');mod=guard.modifiers.new('Armature','ARMATURE');mod.object=rig;guard.parent=rig
# Remove old narrow shards under the copied armor; preserve all palm/finger geometry.
deform=bm.verts.layers.deform.verify();names={g.index:g.name for g in body.vertex_groups};removed=[]
for f in bm.faces:
 center=f.calc_center_median();d=R.tail_local-R.head_local;t=(center-R.head_local).dot(d)/d.length_squared
 skin=any(any(names.get(i,'').startswith('finger_R')and w>.15 for i,w in v[deform].items())for v in f.verts)
 if not skin and .15<t<.94 and segment(center,R.head_local,R.tail_local)<.115:removed.append(f)
bmesh.ops.delete(bm,geom=removed,context='FACES')
# A single subdivision pass in the thumb web, not across the entire hand.
thumb=rig.data.bones['finger_L_0_0'];index=rig.data.bones['finger_L_1_0'];web=(thumb.tail_local+index.head_local)*.5
edges=[e for e in bm.edges if all(.748<v.co.x<.84 and (v.co-web).length<.065 for v in e.verts)and e.calc_length()>.018]
result=bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True);new=[v for v in result['geom_inner']if isinstance(v,bmesh.types.BMVert)]
for _ in range(2):
 positions={v:v.co.lerp(sum((e.other_vert(v).co for e in v.link_edges),V())/len(v.link_edges),.10)for v in new if v.link_edges}
 for v,p in positions.items():v.co=p
# Keep the web attached to the palm and blend only the rounded thumb side to thumb bones.
groups={g.name:g.index for g in body.vertex_groups}
for v in bm.verts:
 if not(.745<v.co.x<.825 and 1.69<v.co.z<1.79 and -.10<v.co.y<.02):continue
 ds=[segment(v.co,rig.data.bones[n].head_local,rig.data.bones[n].tail_local)for n in ['finger_L_0_0','finger_L_0_1']];dist=min(ds)
 if dist<.035:
  amount=max(0,min(.95,(.035-dist)/.018));v[deform].clear();v[deform][groups['hand_L']]=1-amount
  ws=[1/(d+.008)**3 for d in ds]
  for n,w in zip(['finger_L_0_0','finger_L_0_1'],ws):v[deform][groups[n]]=amount*w/sum(ws)
# Replace only the malformed thumb cap/web fan with a small rounded digit.
a=thumb.head_local.copy();joint=thumb.tail_local.copy();tip=rig.data.bones['finger_L_0_1'].tail_local.copy()
old_thumb=[f for f in bm.faces if all(v.co.x<.816 and v.co.z>1.704 and segment(v.co,a,tip)<.029 for v in f.verts)]
bmesh.ops.delete(bm,geom=old_thumb,context='FACES')
uv=bm.loops.layers.uv.active
sample_uv=next((loop[uv].uv.copy()for f in bm.faces for loop in f.loops if (loop.vert.co-joint).length<.05),None)
rings=[];axis=(tip-a).normalized();u=axis.cross(V((0,1,0))).normalized();v=axis.cross(u).normalized()
for t,radius in [(0,.020),(.18,.021),(.42,.0185),(.62,.017),(.82,.0145),(.95,.010),(1.03,.002)]:
 center=a.lerp(joint,t/.48)if t<.48 else joint.lerp(tip,(t-.48)/.52);ring=[]
 for k in range(10):
  angle=math.tau*k/10;q=bm.verts.new(center+radius*(math.cos(angle)*u+math.sin(angle)*v));blend=max(0,min(1,(t-.35)/.45));q[deform][groups['finger_L_0_0']]=1-blend;q[deform][groups['finger_L_0_1']]=blend;ring.append(q)
 rings.append(ring)
for a_ring,b_ring in zip(rings,rings[1:]):
 for k in range(10):
  f=bm.faces.new((a_ring[k],a_ring[(k+1)%10],b_ring[(k+1)%10],b_ring[k]));f.material_index=0;f.smooth=True
  if sample_uv is not None:
   for loop in f.loops:loop[uv].uv=sample_uv
cap=bm.faces.new(tuple(reversed(rings[-1])));cap.smooth=True
if sample_uv is not None:
 for loop in cap.loops:loop[uv].uv=sample_uv
# Remove unused vertices left by face deletion and recalculate local normals.
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free();body.data.update()
rig.data.pose_position='POSE';rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));print('BRACER_FACES',len(faces),'REMOVED',len(removed),'WEB_ADDED_VERTS',len(new))
