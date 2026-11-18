"""Brake, step around, then gather the trailing foot. World yaw is applied by the game."""
import math
import bpy
from mathutils import Vector, Matrix, Quaternion


def build_pivots(rig, mesh, ops):
    rw = rig.matrix_world.copy()
    rest = {b.name: rw @ b.matrix_local for b in rig.data.bones}
    length = {b.name: (rw.to_3x3() @ (b.tail_local-b.head_local)).length for b in rig.data.bones}
    center = (rest['foot.L'].translation+rest['foot.R'].translation)*.5
    ease = ops['ease']

    def yaw(angle): return Matrix.Rotation(angle, 3, 'Z')

    def reach(side, target, foot_angle):
        upper, lower = 'thigh.'+side, 'shin.'+side
        bpy.context.view_layer.update()
        hip = rw @ rig.pose.bones[upper].head
        delta = target-hip
        a, b = length[upper], length[lower]
        d = max(abs(a-b)+.001, min(delta.length, a+b-.002))
        axis = delta.normalized()
        pole = yaw(foot_angle) @ Vector((.14 if side == 'L' else -.14, -1, .02))
        bend = (pole-axis*pole.dot(axis)).normalized()
        along = (a*a-b*b+d*d)/(2*d)
        knee = hip+axis*along+bend*math.sqrt(max(0, a*a-along*along))
        u, v = (knee-hip).normalized(), (hip+axis*d-knee).normalized()
        normal = u.cross(v).normalized()
        ru = (rw.to_3x3() @ (rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local)).normalized()
        rv = (rw.to_3x3() @ (rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).normalized()
        rn = ru.cross(rv).normalized()
        for name, direction, base in ((upper, u, ru), (lower, v, rv)):
            src = Matrix((base.cross(rn).normalized(), base, rn)).transposed()
            dst = Matrix((direction.cross(normal).normalized(), direction, normal)).transposed()
            ops['world_rotation'](name, (dst @ src.transposed() @ rest[name].to_3x3().normalized()).to_quaternion())

    def pose(t, sign):
        ops['reset']()
        brake = math.sin(math.pi*min(t/.35, 1))
        settle = math.sin(math.pi*t)
        ops['rot']('spine', -7*brake+2*settle)
        ops['rot']('spine.003', 3*brake, 0, -sign*4*settle)
        ops['rot']('spine.006', 3*brake)
        ops['location']((0, 0, -.020-.010*settle))
        body_angle = sign*math.pi*(.75*ease((t-.20)/.37)+.25*ease((t-.57)/.37))
        first = 'R' if sign > 0 else 'L'
        for side in ['L', 'R']:
            if side == first:
                u = max(0, min(1, (t-.20)/.37))
                v = max(0, min(1, (t-.74)/.26))
                foot_angle = sign*math.pi*(.75*ease(u)+.25*ease(v))
                lift = .038*math.sin(math.pi*u)+.018*math.sin(math.pi*v)
            else:
                u = max(0, min(1, (t-.57)/.37))
                foot_angle = sign*math.pi*ease(u)
                lift = .045*math.sin(math.pi*u)
            foot = 'foot.'+side
            world_ankle = center+yaw(foot_angle) @ (rest[foot].translation-center)
            local_ankle = center+yaw(-body_angle) @ (world_ankle-center)+Vector((0, 0, lift))
            relative = foot_angle-body_angle
            reach(side, local_ankle, relative)
            ops['world_rotation'](foot, (yaw(relative) @ rest[foot].to_3x3().normalized()).to_quaternion())
            for toe in ['toe.'+side, 'foot.'+side+'.001']:
                if toe in rest:
                    ops['world_rotation'](toe, (yaw(relative) @ rest[toe].to_3x3().normalized()).to_quaternion())
            shoulder = 8+10*brake+(5 if side == first else -5)*settle
            elbow = 72+8*brake
            ops['direction']('upper_arm.'+side, ops['limb_direction'](side, shoulder, 35))
            ops['direction']('forearm.'+side, ops['limb_direction'](side, shoulder+elbow, -16))
            ops['inward_wrist'](side, ops['limb_direction'](side, shoulder+elbow-3, -16))
            ops['fist'](side)
        clearance = ops['floor']-float(ops['coordinates']()[:, 2].min())+.001
        if clearance > 0:
            basis = (rw @ rig.data.bones['spine'].matrix_local).to_3x3()
            ops['location'](basis @ rig.pose.bones['spine'].location+Vector((0, 0, clearance)))

    return [('PivotLeft', 14, lambda t:pose(t, 1), False),
            ('PivotRight', 14, lambda t:pose(t, -1), False)]
