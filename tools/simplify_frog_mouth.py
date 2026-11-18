import bpy,sys,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
from frog_mouth import simplify_mouth,ensure_true_mouth
source=root/'assets-source/blender/frog.blend';digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
simplify_mouth(mesh,rig);ensure_true_mouth(mesh,rig)
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
