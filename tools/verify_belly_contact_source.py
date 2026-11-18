"""Check contact and penetration using the interpolated, actually skinned mesh."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));mw=mesh.matrix_world
groups={g.index:g.name for g in mesh.vertex_groups}
arm=lambda n:n.startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))
weights=[sum(g.weight for g in v.groups if arm(groups[g.group])) for v in mesh.data.vertices]
faces=[tuple(p.vertices) for p in mesh.data.polygons if max(weights[i] for i in p.vertices)<.05]
patches={};hands={};pads={};distal={}
for side in ['L','R']:
 wrist=rig.matrix_world@rig.data.bones['hand.'+side].head_local;index=rig.matrix_world@rig.data.bones['f_index.01.'+side].head_local;outer=rig.matrix_world@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
 forward=((index+outer)*.5-wrist).normalized();normal=forward.cross(outer-index).normalized()*(-1 if side=='L' else 1)
 ids=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if groups[g.group]=='hand.'+side)>.5]
 patches[side]=[i for i in ids if (mw.to_3x3()@mesh.data.vertices[i].normal).normalized().dot(normal)>.55]
 length=((index+outer)*.5-wrist).length
 distal[side]=[i for i in ids if (mw.to_3x3()@mesh.data.vertices[i].normal).normalized().dot(normal)>.35 and (mw@mesh.data.vertices[i].co-wrist).dot(forward)>.42*length]
 pads[side]=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if groups[g.group].endswith('.'+side) and groups[g.group].startswith('f_'))>.6 and (mw.to_3x3()@v.normal).normalized().dot(normal)>.35]
 hands[side]=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if groups[g.group].endswith('.'+side) and groups[g.group].startswith(('hand','f_','thumb')))>.5]
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  o.data.shape_keys.animation_data.action=None
  for key in o.data.shape_keys.key_blocks:key.value=0
rig.animation_data.action=bpy.data.actions['Laugh']
report={side:{'nearestPalmGapRange':[1,-1],'meanPalmGapRange':[1,-1],'minimumHandAndFingerClearance':1,'maximumMeanDistalPalmGap':0,'maximumMeanFingerPadGap':0,'maximumP90FingerPadGap':0} for side in ['L','R']}
for k in range(157):
 frame=15.5+k*.5;bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh();verts=[ev.matrix_world@v.co for v in data.vertices];ev.to_mesh_clear();tree=BVHTree.FromPolygons(verts,faces)
 for side in ['L','R']:
  def gaps(ids):
   result=[]
   for i in ids:
    p,n,_,_=tree.find_nearest(verts[i]);result.append((verts[i]-p).dot(n))
   return result
  palm=gaps(patches[side]);finger=gaps(hands[side]);r=report[side]
  r['nearestPalmGapRange']=[min(r['nearestPalmGapRange'][0],min(palm)),max(r['nearestPalmGapRange'][1],min(palm))]
  mean=sum(palm)/len(palm);r['meanPalmGapRange']=[min(r['meanPalmGapRange'][0],mean),max(r['meanPalmGapRange'][1],mean)]
  r['minimumHandAndFingerClearance']=min(r['minimumHandAndFingerClearance'],min(finger))
  pad=sorted(gaps(pads[side]));dp=gaps(distal[side])
  r['maximumMeanDistalPalmGap']=max(r['maximumMeanDistalPalmGap'],sum(dp)/len(dp))
  r['maximumMeanFingerPadGap']=max(r['maximumMeanFingerPadGap'],sum(pad)/len(pad))
  r['maximumP90FingerPadGap']=max(r['maximumP90FingerPadGap'],pad[int(.9*(len(pad)-1))])
report['interpolatedSamples']=157
(root/'output/animations/belly-contact-verification.json').write_text(json.dumps(report,indent=2))
print('BELLY_CONTACT_VERIFIED',json.dumps(report))
for side in ['L','R']:
 r=report[side]
 assert r['minimumHandAndFingerClearance']>-.003,(side,'penetration',r)
 assert r['maximumMeanFingerPadGap']<.028,(side,'finger pads floating',r)
 assert r['maximumP90FingerPadGap']<.038,(side,'finger tips flared',r)
 assert r['maximumMeanDistalPalmGap']<.021,(side,'palm tilts outward',r)
