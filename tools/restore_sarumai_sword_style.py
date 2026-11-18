import bpy,bmesh,math
from pathlib import Path
from mathutils import Vector as V
root=Path(__file__).resolve().parents[1];src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');blade=next(o for o in bpy.data.objects if o.type=='MESH' and 'blade'in o.name)
# Restore the original mesh, UVs and textured materials, not a replacement sword.
reference=root/'assets-source/blender/reference/sarumai-before-ready-idle.blend'
with bpy.data.libraries.load(str(reference),link=False) as (a,b):b.objects=[n for n in a.objects if 'blade'in n]
original=next(o for o in b.objects if o and o.type=='MESH');blade.data=original.data.copy();bpy.data.objects.remove(original,do_unlink=True)
axis=V((1.365,-.78,-.65)).normalized();origin=rig.data.bones['blade'].head_local.copy()
# Translate transverse cross-section centres onto the same handle/blade axis.
coordinates=[v.co.copy()for v in blade.data.vertices]
for v in blade.data.vertices:
 t=(v.co-origin).dot(axis)
 nearby=[p for p in coordinates if abs((p-origin).dot(axis)-t)<.045]
 if len(nearby)<4:continue
 center=sum(nearby,V())/len(nearby);offset=center-origin-axis*(center-origin).dot(axis)
 # Keep a little original blade curvature, while fully centering the grip.
 v.co-=offset*(1 if t<.16 else .8)
blade.vertex_groups.clear();g=blade.vertex_groups.new(name='blade');g.add(list(range(len(blade.data.vertices))),1,'REPLACE')
# Refine only the right-hand surface, preserving UVs, materials and the accepted left hand.
for body in [o for o in bpy.data.objects if o.type=='MESH' and o!=blade and 'scabbard'not in o.name]:
 bm=bmesh.new();bm.from_mesh(body.data)
 def hand(p):return -.78<p.x<-.55 and -.255<p.y<-.09 and 1.13<p.z<1.36
 edges=[e for e in bm.edges if all(hand(v.co)for v in e.verts)]
 if edges:bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
 selected=[v for v in bm.verts if hand(v.co)]
 for repeat in range(2):
  values={v:v.co.lerp(sum((e.other_vert(v).co for e in v.link_edges),V())/max(1,len(v.link_edges)),.16)for v in selected if v.link_edges}
  for v,p in values.items():v.co=p
 bm.to_mesh(body.data);bm.free();body.data.update()
 for p in body.data.polygons:p.use_smooth=True
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));print('ORIGINAL_TEXTURED_SWORD_RESTORED; RIGHT_HAND_LOCAL_TOPOLOGY_REFINED')
