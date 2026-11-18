import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'assets-source/blender/frog_low.glb'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));pts=[m.matrix_world@v.co for v in m.data.vertices]
print('LOW_BOUNDS',len(pts),[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)],'matrix',list(m.matrix_world))
# Imported GLB source uses the same pre-authoring local mesh coordinates.
print('LOCAL_BOUNDS',[min(v.co[i] for v in m.data.vertices) for i in range(3)],[max(v.co[i] for v in m.data.vertices) for i in range(3)])

from mathutils.kdtree import KDTree
original=[v.co.copy() for v in m.data.vertices];tree=KDTree(len(original))
for i,p in enumerate(original):tree.insert(p,i)
tree.balance()
print('ORIGINAL_FACE',[(round(z,2),min((v.y for v in original if abs(v.z-z)<.01),default=None),max((v.y for v in original if abs(v.z-z)<.01),default=None)) for z in [.86,.90,.94,.98,1.02]])
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));points=[v.co.copy() for v in m.data.shape_keys.key_blocks['Basis'].data]
print('CURRENT_FACE',[(round(z,2),min((v.y for v in points if abs(v.z-z)<.01),default=None),max((v.y for v in points if abs(v.z-z)<.01),default=None)) for z in [.86,.90,.94,.98,1.02]])
print('HEAD_NEAREST', sorted([(tree.find(v)[2],i,list(v),list(tree.find(v)[0])) for i,v in enumerate(points) if v.z>.84],reverse=True)[:8])
