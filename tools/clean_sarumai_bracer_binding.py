import bpy,bmesh,shutil
from pathlib import Path
root=Path.cwd();src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['Samurai_Bracer_R'];bm=bmesh.new();bm.from_mesh(o.data);layer=bm.verts.layers.deform.verify()
for v in bm.verts:v[layer].clear()
bm.to_mesh(o.data);bm.free();o.vertex_groups.clear();o.vertex_groups.new(name='forearm_R').add(list(range(len(o.data.vertices))),1,'REPLACE');print('VALIDATED',o.data.validate(verbose=True));o.data.update();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,root/'assets-source/blender/rigged/sarumai.blend')
