"""Review the baked footwork together with the game's world yaw, without saving."""
import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/pivot-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
main=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
for obj in scene.objects:
    if obj.type=='MESH' and obj.data.shape_keys:
        obj.data.shape_keys.animation_data.action=None
        for key in obj.data.shape_keys.key_blocks:key.value=0
center=(rig.matrix_world@rig.data.bones['foot.L'].head_local+rig.matrix_world@rig.data.bones['foot.R'].head_local)*.5
center.z=0
assets=[o for o in scene.objects if o.type in ['MESH','ARMATURE']]
root_object=bpy.data.objects.new('Review world heading',None);scene.collection.objects.link(root_object);root_object.location=center
for obj in assets:
    if obj.parent not in assets:
        matrix=obj.matrix_world.copy();obj.parent=root_object;obj.matrix_world=matrix
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=330;scene.render.resolution_y=380;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Pivot review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.61,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
target=center+Vector((0,0,.52))
for pos in [(-1,-1.5,3),(1,-.7,2),(.2,1.5,2.7)]:
    bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=85;light.data.size=1.5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.030));floor=bpy.context.object;mat=bpy.data.materials.new('Pivot floor');mat.diffuse_color=(.30,.40,.36,1);floor.data.materials.append(mat)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.45;cam.location=target+Vector((1.2,-3,.45));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def ease(t):u=max(0,min(1,t));return u*u*(3-2*u)
for name,sign in [('PivotLeft',1),('PivotRight',-1)]:
    rig.animation_data.action=bpy.data.actions[name]
    for i in range(14):
        t=i/13;scene.frame_set(i+1)
        root_object.rotation_euler.z=sign*math.pi*(.75*ease((t-.20)/.37)+.25*ease((t-.57)/.37))
        scene.render.filepath=str(out/f'{name}-{i:02}.png');bpy.ops.render.render(write_still=True)
