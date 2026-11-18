import bpy,sys
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parents[1];stage='after' if '--after' in sys.argv else 'before';out=r/'output/animations/surface-review'/stage;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
rig.animation_data.action=bpy.data.actions['Idle']
for o in scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  if o.data.shape_keys.animation_data:o.data.shape_keys.animation_data.action=None
  for k in o.data.shape_keys.key_blocks:k.value=0
scene.frame_set(1);bpy.context.view_layer.update();scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=540;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Surface inspection');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.13,.14,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
T=m.matrix_world;lights=[]
for pos,energy,size in [((-1,-1.5,2),65,1.5),((1,-.7,1),40,1.3),((.2,1.5,1.7),35,1.5)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(T@Vector((0,.2,.6))-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def joint(name):return rig.matrix_world@rig.pose.bones[name].head
views=[('full',T@Vector((0,.23,.54)),(0,-2.5,.25),1.25),('face-left-light',T@Vector((0,.19,.96)),(0,-2,.03),.34),('face-right-light',T@Vector((0,.19,.96)),(0,-2,.03),.34)]
for side,sg in [('R',-1),('L',1)]:
 views.append(('shoulder-'+side,joint('upper_arm.'+side).lerp(joint('forearm.'+side),.35),(sg*.8,-2,.2),.40))
 views.append(('hand-'+side,joint('hand.'+side).lerp(joint('f_index.01.'+side),.45),(sg*.4,-2,.25),.20))
for name,target,offset,scale in views:
 lights[0].location.x=1 if name=='face-right-light' else -1;lights[0].rotation_euler=(target-lights[0].location).to_track_quat('-Z','Y').to_euler()
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
 scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
