import bpy,bmesh,numpy as np
from pathlib import Path
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));bm=bmesh.new();bm.from_mesh(m.data);print('TOPOLOGY',len([e for e in bm.edges if e.is_boundary]),len([e for e in bm.edges if not e.is_manifold]));im=bpy.data.images['Frog_Low_CleanColor_2048'];im.save_render(str(r/'output/animations/texture-audit.png'));print('TEXTURE',im.size[:])
