"""Continuous exterior normals with a smooth facial transition and split oral walls."""
import json,math
from mathutils import Vector

def smooth_skin_normals(obj):
 data=obj.data
 data.normals_split_custom_set([(0,0,0)]*len(data.loops));data.update()
 interior={i for i,m in enumerate(data.materials) if m.name in ['Frog oral lining','Frog oral depth']}
 skin=next(i for i,m in enumerate(data.materials) if m.name=='Frog mouth skin')
 profile=json.loads(obj['mouth_surface_profile']);boundary=set(json.loads(obj['mouth_boundary_ids']))
 from frog_muzzle import original_basis,deform_normal
 unmodified=original_basis(obj)
 sums=[Vector((0,0,0)) for _ in data.vertices]
 for p in data.polygons:
  if p.material_index in interior:continue
  for i in p.vertices:sums[i]+=p.normal*p.area
 for n in sums:
  if n.length:n.normalize()
 def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
 normals=[tuple(n.vector) for n in data.corner_normals]
 for p in data.polygons:
  if p.material_index in interior:continue
  for li in p.loop_indices:
   i=data.loops[li].vertex_index;v=data.vertices[i].co;n=sums[i].copy()
   if not obj.get('muzzle_support_version') and v.y<.27 and .849<v.z<.959:
    q=max(abs(v.x-.001)/.084,abs(v.z-.904)/.055);w=smooth((1-q)/.35)
    w*=1-smooth((abs(v.x)-.037)/.015)*smooth((v.z-.934)/.014)
    if p.material_index==skin or i in boundary:w=1
    if w:
     x=(v.x-.001)/.072;z=(v.z-.890)/.05
     dx=(profile[1]+2*profile[3]*x+profile[4]*z)/.072
     dz=(profile[2]+profile[4]*x+2*profile[5]*z)/.05
     face=Vector((dx,-1,dz)).normalized()
     if i in unmodified:face=deform_normal(unmodified[i],face)
     n=n.lerp(face,w).normalized()
   normals[li]=n[:]
 data.normals_split_custom_set(normals)


def bake_hand_gradient(obj):
 import bpy
 material=bpy.data.materials.get('Frog smooth hand colors')
 if not material:return
 attr=obj.data.color_attributes.get('HandColor')
 if not attr:return
 gold=tuple(bpy.data.materials['Frog unified gold'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)
 brown=tuple(bpy.data.materials['Frog brown hands'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)
 image=bpy.data.images.get('Frog smooth cuff ramp') or bpy.data.images.new('Frog smooth cuff ramp',width=256,height=4,alpha=False)
 pixels=[]
 def srgb(c):return 12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055
 for y in range(4):
  for x in range(256):
   w=x/255;pixels.extend([srgb(gold[j]*(1-w)+brown[j]*w) for j in range(3)]+[1])
 image.pixels.foreach_set(pixels);image.pack()
 uv=obj.data.uv_layers.get('HandUV') or obj.data.uv_layers.new(name='HandUV')
 slot=list(obj.data.materials).index(material)
 for p in obj.data.polygons:
  if p.material_index!=slot:continue
  for li in p.loop_indices:
   value=attr.data[li].color[0];w=max(0,min(1,(gold[0]-value)/(gold[0]-brown[0])))
   uv.data[li].uv=((.5+255*w)/256,.5)
 nodes=material.node_tree.nodes;nodes.clear();shader=nodes.new('ShaderNodeBsdfPrincipled');out=nodes.new('ShaderNodeOutputMaterial');texture=nodes.new('ShaderNodeTexImage');texture.image=image;texture.extension='EXTEND';texture.interpolation='Linear';coords=nodes.new('ShaderNodeUVMap');coords.uv_map='HandUV'
 material.node_tree.links.new(coords.outputs['UV'],texture.inputs['Vector']);material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color']);material.node_tree.links.new(shader.outputs['BSDF'],out.inputs['Surface']);shader.inputs['Roughness'].default_value=.8;shader.inputs['Specular IOR Level'].default_value=.15
