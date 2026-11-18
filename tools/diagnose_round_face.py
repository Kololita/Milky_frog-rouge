import bpy,json,hashlib,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];result={}
for name,path in [('current','assets-source/blender/frog.blend'),('beforeHands','output/animations/_before-palm-wrap.blend'),('beforeSurface','output/animations/_before-surface-polish.blend')]:
 bpy.ops.wm.open_mainfile(filepath=str(root/path));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');basis=m.data.shape_keys.key_blocks['Basis'];head=[(i,tuple(v.co)) for i,v in enumerate(basis.data) if v.co.z>.82]
 result[name]={'vertices':len(m.data.vertices),'headHash':hashlib.sha256(repr(head).encode()).hexdigest(),'shapeKeys':[(k.name,round(max(((v.co-b.co).length for v,b in zip(k.data,basis.data)),default=0),5)) for k in m.data.shape_keys.key_blocks],'materials':{mat.name:list(next((n.inputs['Base Color'].default_value for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),[])) for mat in m.data.materials}}
 if name=='current':
  baseline=json.loads(rig.get('laugh_baseline_rotations','{}'));result[name]['baselineFaceAngles']={n:round(__import__('math').degrees(__import__('mathutils').Quaternion(q).angle),2) for n,q in baseline.items() if n.startswith(('face','nose','cheek','jaw','lip','brow','lid','eye','spine.006'))}
  rig.animation_data.action=bpy.data.actions['Laugh'];bpy.context.scene.frame_set(76);result[name]['poseFaceAngles']={p.name:round(__import__('math').degrees(p.rotation_quaternion.angle),2) for p in rig.pose.bones if p.name.startswith(('face','nose','cheek','jaw','lip','brow','lid','eye'))}
(root/'output/animations/round-face-diagnosis.json').write_text(json.dumps(result,indent=2));print('FACE_AUDIT',json.dumps(result))
