import bpy,shutil,json
from pathlib import Path
root=Path.cwd();src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src))
if bpy.context.scene.render.fps!=60:
 factor=60/bpy.context.scene.render.fps
 for action in bpy.data.actions:
  for layer in action.layers:
   for strip in layer.strips:
    for slot in action.slots:
     bag=strip.channelbag(slot)
     if bag:
      for curve in bag.fcurves:
       for k in curve.keyframe_points:k.co.x*=factor;k.handle_left.x*=factor;k.handle_right.x*=factor
 bpy.context.scene.frame_end=round(bpy.context.scene.frame_end*factor);bpy.context.scene.render.fps=60
bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,root/'assets-source/blender/rigged/sarumai.blend');print('FINAL_60FPS_EXPORT_SOURCE')
