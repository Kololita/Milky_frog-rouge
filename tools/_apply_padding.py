import bpy,numpy as np,runpy
from pathlib import Path
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));im=bpy.data.images['Frog_Low_CleanColor_2048'];im.pixels.foreach_set(np.load(r/'output/animations/_texture_padded.npy').ravel());im.pack();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));runpy.run_path(str(r/'tools/refine_frog_mouth.py'),run_name='__main__')
