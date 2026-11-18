import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V
R=Path.cwd();bpy.ops.wm.open_mainfile(filepath=str(R/'assets-source/blender/rigged/mirrorGuard.blend'));bpy.context.preferences.filepaths.save_version=0
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update()
for o in list(bpy.data.objects):
 if o.name.startswith('MirrorFacet_'):bpy.data.objects.remove(o,do_unlink=True)
for m in bpy.data.materials:
 if not m.name.startswith('MirrorGuard_'):continue
 m.diffuse_color=(.72,.8,.86,1)
 if m.use_nodes:
  p=m.node_tree.nodes.get('Principled BSDF')
  if p:p.inputs['Base Color'].default_value=(.72,.8,.86,1);p.inputs['Metallic'].default_value=.85;p.inputs['Roughness'].default_value=.18
n=V((-.5340766,-.8423528,.0721385));u=V((.837306,-.538817,-.092711));v=n.cross(u).normalized();center=V((-.367025,-.022812,.932995));plate=bpy.data.objects['mirrorGuard_shield'];dist=sorted((plate.matrix_world@p.co-center).dot(n)for p in plate.data.vertices);depth=dist[int(len(dist)*.88)]+.003
verts=[];faces=[]
for i in range(8):
 a=i*math.tau/8;b=(i+1)*math.tau/8;start=len(verts)
 for r,t in [(.23,a),(1.0,a),(1.0,b),(.23,b)]:verts.append(center+n*depth+u*(math.cos(t)*.32*r)+v*(math.sin(t)*.37*r))
 faces.append(tuple(range(start,start+4)))
mesh=bpy.data.meshes.new('ContinuousShieldMirror');mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials['MirrorGuard_Mirror']);o=bpy.data.objects.new('MirrorFacet_Surface',mesh);bpy.context.collection.objects.link(o);mod=o.modifiers.new('ShieldRig','ARMATURE');mod.object=rig;o.vertex_groups.new(name='shield').add(list(range(len(verts))),1,'REPLACE')
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'assets-source/blender/rigged/mirrorGuard.blend'))
bpy.ops.export_scene.gltf(filepath=str(R/'public/models/enemies/mirrorGuard.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True)
for dest in ['docs/mirrorGuard.glb','assets-source/blender/mirrorGuard.glb']:shutil.copy2(R/'public/models/enemies/mirrorGuard.glb',R/dest)
