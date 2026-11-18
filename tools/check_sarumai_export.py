import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];data={}
for name,file in [('blend','assets-source/blender/sarumai.blend'),('glb','public/models/enemies/samurai.glb')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if name=='blend':bpy.ops.wm.open_mainfile(filepath=str(root/file))
 else:bpy.ops.import_scene.gltf(filepath=str(root/file))
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 data[name]={b.name:[list(b.head_local),list(b.tail_local)]for b in rig.data.bones}
for n,b in data['blend'].items():
 g=data['glb'].get(n)
 if not g:print('MISSING',n);continue
 delta=max(abs(b[k][i]-g[k][i])for k in (0,1)for i in range(3))
 if delta>.01:print('DIFF',n,delta)
print('COUNT',len(data['blend']),len(data['glb']))
