"""Bake original textured models onto the unposed low meshes, before rigging."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets-source/images/enemies'

def import_mesh(path):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.data.objects)-before
 mesh=next(o for o in objects if o.type=='MESH');world=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=Matrix.Identity(4);mesh.data.transform(world)
 for o in objects:
  if o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
 return mesh
def bounds(mesh):
 return [Vector([f(v.co[i] for v in mesh.data.vertices) for i in range(3)]) for f in [min,max]]

names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['raider','shellbug','lantern','stonekeeper','mirrorGuard','scythemoth','spitter','samurai']
for name in names:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 low=import_mesh(ROOT/f'assets-source/blender/{name}_low.glb');high=import_mesh(ROOT/f'assets-source/blender/reference/{name}.glb')
 low.name=name+'_bake_target';high.name=name+'_color_source'
 lo,hi=bounds(low);a,b=bounds(high);scale=(hi.z-lo.z)/(b.z-a.z);old_center=(a+b)*.5;new_center=(lo+hi)*.5
 for vertex in high.data.vertices:vertex.co=(vertex.co-old_center)*scale+new_center
 bpy.context.view_layer.objects.active=low;bpy.ops.object.select_all(action='DESELECT');low.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.008,area_weight=.2);bpy.ops.object.mode_set(mode='OBJECT')
 target_material=bpy.data.materials.new(name+'_bake');target_material.use_nodes=True;low.data.materials.clear();low.data.materials.append(target_material)
 target=target_material.node_tree.nodes.new('ShaderNodeTexImage');target_material.node_tree.nodes.active=target
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.device='CPU';scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.012;scene.render.bake.max_ray_distance=.055;scene.render.bake.margin=12;scene.render.bake.margin_type='EXTEND';scene.render.bake.use_clear=True
 bpy.ops.object.select_all(action='DESELECT');high.select_set(True);low.select_set(True);bpy.context.view_layer.objects.active=low
 source=high.data.materials[0];nodes=source.node_tree.nodes;links=source.node_tree.links;shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');original=output.inputs['Surface'].links[0].from_socket
 emitter=nodes.new('ShaderNodeEmission');emitter.inputs['Strength'].default_value=1
 folder=OUT/name;folder.mkdir(parents=True,exist_ok=True)
 for label in ['basecolor','orm','normal']:
  image=bpy.data.images.new(name+'_'+label,width=2048,height=2048,alpha=False)
  image.colorspace_settings.name='sRGB' if label=='basecolor' else 'Non-Color';target.image=image
  if label=='normal':
   links.new(original,output.inputs['Surface']);bpy.ops.object.bake(type='NORMAL')
  else:
   links.new(emitter.outputs[0],output.inputs['Surface'])
   if label=='basecolor':
    socket=shader.inputs['Base Color'];links.new(socket.links[0].from_socket,emitter.inputs['Color'])
   else:
    combine=nodes.new('ShaderNodeCombineColor');combine.inputs[0].default_value=1
    for channel,parameter in [(1,'Roughness'),(2,'Metallic')]:
     socket=shader.inputs[parameter]
     if socket.is_linked:links.new(socket.links[0].from_socket,combine.inputs[channel])
     else:combine.inputs[channel].default_value=socket.default_value
    links.new(combine.outputs[0],emitter.inputs['Color'])
   bpy.ops.object.bake(type='EMIT')
  image.filepath_raw=str(folder/f'{label}.png');image.file_format='PNG';image.save()
 links.new(original,output.inputs['Surface'])
 (folder/'uv.json').write_text(json.dumps([list(item.uv) for item in low.data.uv_layers.active.data]),encoding='utf8')
 # Render the untouched textured source in a normal pose for comparison.
 report={'source':f'{name}.glb','target':f'{name}_low.glb','resolution':2048,'alignmentScale':scale,'loops':len(low.data.loops),'textures':['basecolor','orm','normal']}
 (folder/'bake.json').write_text(json.dumps(report,indent=2),encoding='utf8')
 print('PBR_BAKED',name,json.dumps(report))
