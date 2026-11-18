"""Restore the pre-muzzle source exactly, preserving the current work in an archive."""
import bpy, hashlib, json, shutil
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'assets-source/blender/frog.blend'
backup = root / 'output/animations/_before-protruding-mouth.blend'

def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    actions = [(a.name, [(c.data_path, c.array_index, [(tuple(k.co), k.interpolation, tuple(k.handle_left), tuple(k.handle_right)) for k in c.keyframe_points]) for l in a.layers for s in l.strips for b in s.channelbags for c in b.fcurves]) for a in sorted(bpy.data.actions, key=lambda a: a.name)]
    bones = [(b.name, tuple(b.head_local), tuple(b.tail_local), tuple(b.matrix_local.to_quaternion()), b.parent.name if b.parent else None) for b in rig.data.bones]
    return hashlib.sha256(repr(actions).encode()).hexdigest(), bones, [a[0] for a in actions]

current = snapshot(source)
previous = snapshot(backup)
assert current == previous, 'The backup has different actions or rest bones; do not overwrite newer work'
archive = root / 'output' / ('face-changes-reverted-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
archive.mkdir()
files = [
    'assets-source/blender/frog.blend', 'output/frog.glb',
    'public/models/characters/frog.glb', 'src/assets.js', 'src/main.js', 'src/eye-gaze.js',
    'public/models/characters/frog-eyes.json', 'public/models/characters/frog-iris.png',
    'public/models/characters/frog-pupils.png', 'docs/动画说明.md',
]
for name in files:
    old = root / name
    if old.exists():
        target = archive / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(old, target)
shutil.copy2(backup, source)
assert source.read_bytes() == backup.read_bytes()
bpy.ops.wm.open_mainfile(filepath=str(source))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
main = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
assert not main.get('muzzle_profile_version') and not main.get('muzzle_support_version')
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
rig.animation_data.action = bpy.data.actions['Idle']
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.data.shape_keys:
        if obj.data.shape_keys.animation_data:
            obj.data.shape_keys.animation_data.action = None
        for key in obj.data.shape_keys.key_blocks:
            key.value = 0
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'), export_format='GLB', export_vertex_color='NONE', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_merge_animation='ACTION', export_frame_range=False, export_force_sampling=True, export_anim_single_armature=True, export_anim_slide_to_zero=True, export_morph=True, export_morph_animation=True)
shutil.copy2(root/'output/frog.glb', root/'public/models/characters/frog.glb')
report = {'archive': str(archive), 'restoredFrom': str(backup), 'sourceExactlyMatchesBackup': True, 'animationAndBonesUnchanged': True, 'clips': previous[2], 'boneCount': len(previous[1]), 'mainMeshVertices': len(main.data.vertices), 'mainMeshPolygons': len(main.data.polygons)}
(root/'output/animations/face-rollback-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('FACE_ROLLBACK_VERIFIED', json.dumps(report))
