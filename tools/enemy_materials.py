"""Apply baked high-to-low PBR textures without changing vertices or skin weights."""
import bpy,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TEXTURES=ROOT/'assets-source/images/enemies'

def apply_enemy_materials(mesh,name):
 folder=TEXTURES/name
 uv=json.loads((folder/'uv.json').read_text(encoding='utf8'))
 if len(uv)!=len(mesh.data.loops):raise RuntimeError(f'{name}: UV topology mismatch')
 for previous in list(mesh.data.uv_layers):mesh.data.uv_layers.remove(previous)
 layer=mesh.data.uv_layers.new(name='UVMap')
 for item,coord in zip(layer.data,uv):item.uv=coord
 mesh.data.materials.clear()
 for attribute in list(mesh.data.color_attributes):mesh.data.color_attributes.remove(attribute)
 material=bpy.data.materials.new(name+'_source_PBR');material.use_nodes=True
 nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
 def image(label,color_space):
  data=bpy.data.images.load(str(folder/f'{label}.png'),check_existing=False);data.colorspace_settings.name=color_space;data.pack()
  node=nodes.new('ShaderNodeTexImage');node.image=data;node.label=label;return node
 base=image('basecolor','sRGB');links.new(base.outputs['Color'],shader.inputs['Base Color'])
 orm=image('orm','Non-Color');separate=nodes.new('ShaderNodeSeparateColor');links.new(orm.outputs['Color'],separate.inputs[0]);links.new(separate.outputs['Green'],shader.inputs['Roughness']);links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
 normal=image('normal','Non-Color');normalmap=nodes.new('ShaderNodeNormalMap');links.new(normal.outputs['Color'],normalmap.inputs['Color']);links.new(normalmap.outputs['Normal'],shader.inputs['Normal'])
 mesh.data.materials.append(material)
 for polygon in mesh.data.polygons:polygon.material_index=0

