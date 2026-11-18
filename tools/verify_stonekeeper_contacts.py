import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree

root = Path.cwd()
tag = sys.argv[-1] if '--' in sys.argv else 'before'
output = root / 'output/enemy-models'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/('public/models/enemies' if tag=='before' else 'output/enemy-models/stonekeeper-stage')/'stonekeeper.glb'))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
body = next(o for o in scene.objects if o.name == 'stonekeeper_body')
weapon = next(o for o in scene.objects if o.name == 'stonekeeper_hammer')
for track in rig.animation_data.nla_tracks:
    track.mute = True

groups = [g.name for g in body.vertex_groups]
def weight(i, predicate):
    return sum(g.weight for g in body.data.vertices[i].groups if predicate(groups[g.group]))
torso = []
hands = {'L':[], 'R':[]}
for f in body.data.polygons:
    if all(weight(i, lambda n: n in {'pelvis','spine','chest','head'} or n.startswith(('thigh','shin','foot'))) > .7 for i in f.vertices):
        torso.append(tuple(f.vertices))
    for side in hands:
        if all(weight(i, lambda n: n == 'hand_'+side or n.startswith('finger_'+side)) > .51 for i in f.vertices):
            hands[side].append(tuple(f.vertices))
blade = [tuple(f.vertices) for f in weapon.data.polygons]
print('FACE COUNTS',len(torso),{k:len(v) for k,v in hands.items()},len(blade),flush=True)

def bind(action, phase):
    rig.animation_data.action = action
    if hasattr(action,'slots'):
        rig.animation_data.action_slot = action.slots[0]
    frame = action.frame_range.x + phase * (action.frame_range.y - action.frame_range.x)
    scene.frame_set(int(frame), subframe=frame % 1)

def positions(o):
    evaluated = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    geo = evaluated.to_mesh()
    pts = [evaluated.matrix_world @ v.co for v in geo.vertices]
    evaluated.to_mesh_clear()
    return pts

def probe(n):
    return rig.matrix_world @ rig.pose.bones[n].head

def read_metrics(detailed=False):
    body_pts = positions(body)
    weapon_pts = positions(weapon)
    tree = BVHTree.FromPolygons(body_pts,torso,all_triangles=True)
    hand_trees = {side:BVHTree.FromPolygons(body_pts,faces,all_triangles=True) for side,faces in hands.items()}
    body_contacts = {side:len(tree.overlap(hand)) for side,hand in hand_trees.items()}
    hammer_tree = BVHTree.FromPolygons(weapon_pts,blade,all_triangles=True)
    support_contacts=hammer_tree.overlap(hand_trees['R'])
    body_contacts['hammerToRightHand'] = len(support_contacts)
    # A bracing fist is allowed to contact the handle, never the stone head.
    body_contacts['headToRightHand']=sum(1 for f,_ in support_contacts if any(weapon.data.vertices[i].co.y>.385 for i in blade[f]))
    body_contacts['hands'] = len(hand_trees['L'].overlap(hand_trees['R']))
    contacts = tree.overlap(hammer_tree)
    body_contacts['hammer'] = len(contacts)
    if detailed and contacts:
        locations = [sum((weapon_pts[i] for i in blade[j]), V())/3 for _,j in contacts]
        avg = sum(locations,V())/len(locations)
        print('Hammer contact center',tuple(round(x,3) for x in avg),'arm',tuple(round(x,3) for x in probe('hand_L')),flush=True)
    angles = {}
    for side in hands:
        wrist = probe('hand_'+side)
        axis = wrist - probe('forearm_'+side)
        angles[side] = round(max(math.degrees(axis.angle(probe(f'finger_{side}_{digit}_{1 if digit == 0 else 2}')-wrist)) for digit in range(5)),1)
    return {'contact':body_contacts,'angle':angles,'fistMinZ':round(min(body_pts[i].z for f in hands['R'] for i in f),3),
            'hammerMinZ':round(min(p.z for p in weapon_pts),3),
            'wristL':[round(i,3) for i in probe('hand_L')],'wristR':[round(i,3) for i in probe('hand_R')]}

actions = {a.name.split('_stonekeeper')[0]:a for a in bpy.data.actions}
print('Imported actions:',list(actions),flush=True)
bind(actions['Idle'],0)
wp = positions(weapon)
bt = BVHTree.FromPolygons(positions(body),torso,all_triangles=True)
intersecting = {j for _,j in bt.overlap(BVHTree.FromPolygons(wp,blade,all_triangles=True))}
print('Idle hammer / body overlaps:',[[round(x,2) for x in sum((wp[i] for i in blade[j]),V())/3] for j in sorted(intersecting)],flush=True)
report = {}
for name in ['Idle','Walk','Smash','Sweep','Quake','RockThrow','ShoulderRush','Stomp','Uppercut','Hurt','Death']:
    samples = []
    for i in range(121):
        phase = i/120
        bind(actions[name],phase)
        samples.append({'phase':phase,**read_metrics()})
    report[name] = samples
    worst = {k:max((p['contact'][k],p['phase']) for p in samples) for k in samples[0]['contact']}
    max_angles = {k:max((p['angle'][k],p['phase']) for p in samples) for k in ['L','R']}
    bind(actions[name],.625)
    print(name,worst,max_angles,'IMPACT',read_metrics(),flush=True)
    if worst['hammer'][0]:
        bind(actions[name],worst['hammer'][1]);read_metrics(detailed=True)
(output/f'stonekeeper-{tag}-audit.json').write_text(json.dumps(report,indent=2))
for action,samples in report.items():
    for sample in samples:
        for name in ['L','R','hands','hammer','headToRightHand']:
            assert sample['contact'][name]==0,(action,sample['phase'],name,sample['contact'][name])
        assert max(sample['angle'].values())<=60,(action,sample['phase'],sample['angle'])
print('CONTACT_AUDIT_PASSED: 121 samples per clip, body/hand/head clearance and wrist angles')

if 'render' in sys.argv:
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.studiolight_rotate_z=.3
    scene.display.shading.color_type='TEXTURE'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.background_type='WORLD'
    scene.world=bpy.data.worlds.new('Studio background')
    scene.world.color=(.12,.13,.16)
    scene.render.resolution_x=370
    scene.render.resolution_y=380
    scene.render.resolution_percentage=100
    bpy.ops.object.camera_add()
    camera=bpy.context.object
    camera.data.type='ORTHO'
    camera.data.ortho_scale=3.65
    scene.camera=camera
    for name in ['Idle','Smash','Sweep','Quake','RockThrow','Death']:
        for phase in ([0] if name=='Idle' else [1] if name=='Death' else [.45,.625]):
            bind(actions[name],phase)
            center=V((0,-.15,1.3))
            for view,offset in [('front',(2.1,-5,1.1)),('hammer',(-4,-2,1.15))]:
                camera.location=center+V(offset)
                camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
                scene.render.filepath=str(output/f'stonekeeper-{tag}-{name}-{phase}-{view}.png')
                bpy.ops.render.render(write_still=True)
