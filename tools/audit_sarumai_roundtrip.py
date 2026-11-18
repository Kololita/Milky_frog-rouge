import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def record():
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 return {b.name:{'rest':list(rig.matrix_world@b.head_local),'pose':list(rig.matrix_world@rig.pose.bones[b.name].head),'tail':list(rig.matrix_world@b.tail_local),'parent':b.parent.name if b.parent else None}for b in rig.data.bones}
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/sarumai.blend'));a=record()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'public/models/enemies/sarumai.glb'));b=record()
report=[]
for n,x in a.items():
 if n not in b:continue
 y=b[n];d=lambda k,j:sum((x[k][i]-y[j][i])**2 for i in range(3))**.5
 report.append({'bone':n,'rest_error':d('rest','rest'),'pose_to_export_rest':d('pose','rest'),'tail_error':d('tail','tail')})
(root/'output/sarumai-roundtrip-audit.json').write_text(json.dumps({'blend':a,'glb':b,'comparison':report},indent=2))
for r in sorted(report,key=lambda r:-r['rest_error'])[:12]:print(r)
