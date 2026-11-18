"""Stable belly-relative grip anchors, baked to the original FK rig for glTF."""
import bpy,json
from pathlib import Path
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree

def build_laugh_grip(rig,mesh,ops):
    anchors=json.loads(Path(__file__).with_name('frog_laugh_grip.json').read_text())
    names={g.index:g.name for g in mesh.vertex_groups}
    weights=[sum(g.weight for g in v.groups if names[g.group].startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))) for v in mesh.data.vertices]
    faces=[tuple(p.vertices) for p in mesh.data.polygons if max(weights[i] for i in p.vertices)<.05]
    hands={side:[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if names[g.group].endswith('.'+side) and names[g.group].startswith(('hand','f_','thumb')))>.5] for side in ['L','R']}
    def positions():
        bpy.context.view_layer.update();ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh()
        pts=[ev.matrix_world@v.co for v in data.vertices];ev.to_mesh_clear();return pts
    raw={side:{} for side in hands};profile=None
    def fit(u,t):
        if u<1e-5:return
        # Only this continuous, authored transition changes the grasp. The laugh
        # beats move the abdomen and the hands together, without re-solving fingers.
        w=ops['ease']((t-.43)/.14)
        bpy.context.view_layer.update()
        rw=rig.matrix_world;body=rw@rig.pose.bones['spine.001'].matrix
        tree=BVHTree.FromPolygons(positions(),faces)
        for side in ['L','R']:
            lo,hi=anchors['down'][side],anchors['up'][side]
            hand='hand.'+side;upper='upper_arm.'+side;lower='forearm.'+side
            original=(rw@rig.pose.bones[hand].matrix).to_quaternion()
            target=body@Vector(lo['wrist']).lerp(Vector(hi['wrist']),w)
            wrist=rw@rig.pose.bones[hand].head
            desired=body.to_quaternion()@Quaternion(lo['rotation']).slerp(Quaternion(hi['rotation']),.65+.35*w)
            a=rw@rig.pose.bones[upper].head;elbow=rw@rig.pose.bones[lower].head
            pole=body.to_3x3()@Vector(lo['pole']).lerp(Vector(hi['pole']),w)
            pole=(elbow-a).lerp(pole,u)
            ops['attack_helpers']['reach'](upper,lower,wrist.lerp(target,u),pole)
            ops['world_rotation'](hand,original.slerp(desired,u))
            for name,q in lo['fingers'].items():
                p=rig.pose.bones[name]
                p.rotation_quaternion=p.rotation_quaternion.slerp(Quaternion(q).slerp(Quaternion(hi['fingers'][name]),w),u)
            # Correct only a scalar contact depth along a stable belly normal.
            # Fingers, palm orientation and elbow pole remain continuous.
            outward=(body.to_3x3()@Vector(lo['outward']).lerp(Vector(hi['outward']),w)).normalized()
            hand_rotation=(rw@rig.pose.bones[hand].matrix).to_quaternion()
            initial_wrist=rw@rig.pose.bones[hand].head
            if profile is not None:
                shift=profile[side][round(t*103)]
                ops['attack_helpers']['reach'](upper,lower,initial_wrist+outward*shift,pole)
                ops['world_rotation'](hand,hand_rotation)
                continue
            for iteration in range(4):
                pts=positions();minimum=1;support=outward
                for i in hands[side]:
                    hit,normal,_,_=tree.find_nearest(pts[i]);gap=(pts[i]-hit).dot(normal)
                    if gap<minimum:minimum=gap;support=normal
                correction=(.0008-minimum)/max(.5,support.dot(outward))*u
                if abs(correction)<.0001:break
                target=(rw@rig.pose.bones[hand].head)+outward*correction
                ops['attack_helpers']['reach'](upper,lower,target,pole)
                ops['world_rotation'](hand,hand_rotation)
            raw[side][round(t*103)]=(rw@rig.pose.bones[hand].head-initial_wrist).dot(outward)
            bpy.context.view_layer.update()
    def freeze():
        nonlocal profile
        profile={}
        for side,values in raw.items():
            v=[values.get(i,0) for i in range(104)]
            profile[side]=[(v[max(0,i-1)]+2*v[i]+v[min(103,i+1)])/4+.00025*ops['pulse'](i/103,.14,.90) for i in range(104)]
    fit.freeze=freeze
    return fit
