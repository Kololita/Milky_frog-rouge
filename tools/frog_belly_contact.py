"""Fit the actual palm skin onto the posed abdomen, baked into ordinary FK."""
import bpy
import numpy as np
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree


def build_belly_fit(rig,mesh,ops):
    rw,mw=rig.matrix_world.copy(),mesh.matrix_world.copy()
    names={g.index:g.name for g in mesh.vertex_groups}
    arm=lambda n:n.startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))
    arm_weights=[sum(g.weight for g in v.groups if arm(names[g.group])) for v in mesh.data.vertices]
    body_faces=[tuple(p.vertices) for p in mesh.data.polygons if max(arm_weights[i] for i in p.vertices)<.05]
    patches={};hands={}
    for side in ['L','R']:
        normal=ops['palm_frames'][side].col[2]
        ids=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if names[g.group]=='hand.'+side)>.5]
        patches[side]=[i for i in ids if (mw.to_3x3()@mesh.data.vertices[i].normal).normalized().dot(normal)>.55]
        hands[side]=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if names[g.group].endswith('.'+side) and names[g.group].startswith(('hand','f_','thumb')))>.5]
        assert len(patches[side])>=4

    def positions():
        bpy.context.view_layer.update()
        ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh()
        verts=[ev.matrix_world@v.co for v in data.vertices];ev.to_mesh_clear()
        return verts

    def fit(u):
        if u<1e-5:return
        verts=positions();tree=BVHTree.FromPolygons(verts,body_faces)
        for side,s in [('L',1),('R',-1)]:
            hand='hand.'+side;upper='upper_arm.'+side;lower='forearm.'+side
            original=(rw@rig.pose.bones[hand].matrix).to_quaternion()
            for iteration in range(5):
                verts=positions()
                center=sum((verts[i] for i in patches[side]),Vector())/len(patches[side])
                hit,normal,_,_=tree.find_nearest(center)
                inward=-normal
                points=np.array([tuple(verts[i]-center) for i in patches[side]])
                _,axes=np.linalg.eigh(points.T@points)
                skin_normal=Vector(axes[:,0]).normalized()
                if skin_normal.dot(inward)<0:skin_normal.negate()
                # The painted palm surface differs from the bone-defined plane.
                # Align the actual skin instead of assuming the rest roll is exact.
                current=(rw@rig.pose.bones[hand].matrix).to_quaternion()
                desired=skin_normal.rotation_difference(inward)@current
                desired=original.slerp(desired,u)
                ops['world_rotation'](hand,desired)
                ops['hand_pose'](rig,side,0)
                verts=positions()
                gaps=[]
                for i in patches[side]:
                    p,n,_,_=tree.find_nearest(verts[i]);gaps.append((verts[i]-p).dot(n))
                shift=normal*(.0012-min(gaps))*u
                wrist=rw@rig.pose.bones[hand].head
                ops['attack_helpers']['reach'](upper,lower,wrist+shift,mw.to_3x3()@Vector((s,.0,-.35)))
                ops['world_rotation'](hand,desired)
                ops['hand_pose'](rig,side,0)
            # Fingers and palm heel must remain outside the abdominal surface.
            verts=positions();minimum=1;outward=normal
            for i in hands[side]:
                p,n,_,_=tree.find_nearest(verts[i]);gap=(verts[i]-p).dot(n)
                if gap<minimum:minimum=gap;outward=n
            if minimum<.0005:
                wrist=rw@rig.pose.bones[hand].head
                ops['attack_helpers']['reach'](upper,lower,wrist+outward*(.0005-minimum)*u,mw.to_3x3()@Vector((s,.0,-.35)))
                ops['world_rotation'](hand,desired);ops['hand_pose'](rig,side,0)
    return fit
