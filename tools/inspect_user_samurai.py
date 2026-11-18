import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
result={}
for key,file in [('user','assets-source/blender/sarumai.blend'),('old','assets-source/blender/rigged/samurai.blend')]:
 bpy.ops.wm.open_mainfile(filepath=str(root/file))
 result[key]={o.name:{b.name:{'head':list(b.head_local),'tail':list(b.tail_local)}for b in o.data.bones}for o in bpy.data.objects if o.type=='ARMATURE'}
(root/'output/samurai-user-bones.json').write_text(json.dumps(result))
for arm,bones in result['user'].items():
 for name,b in bones.items():
  old=result['old'].get(arm,{}).get(name)
  if old!=b:print('EDITED',name,b)
