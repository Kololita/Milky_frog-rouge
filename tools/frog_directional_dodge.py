"""Directional dodges baked onto the existing exportable FK skeleton."""
import math
import bpy
from mathutils import Vector, Matrix


def build_dodges(rig, mesh, ops):
    reset, relax, rot, ground, location, ease, coordinates, world_rotation = (
        ops[n] for n in ('reset', 'relax', 'rot', 'ground', 'location', 'ease', 'coordinates', 'world_rotation'))
    rw, mw = rig.matrix_world.copy(), mesh.matrix_world.copy()
    rest = {b.name: rw @ b.matrix_local for b in rig.data.bones}
    lengths = {b.name: (rw.to_3x3() @ (b.tail_local-b.head_local)).length for b in rig.data.bones}
    pivot = rest['spine'].translation
    center = mw @ Vector((0, .30, .49))
    root_frame = rest['spine'].to_3x3()
    reset()
    neutral = coordinates()
    body_height = float(neutral[:, 2].max()-neutral[:, 2].min())

    def somersault(t, backward):
        reset(); relax()
        flight = max(0, min(1, (t-.14)/.70))
        tuck = math.sin(math.pi*flight)**.7
        load = ease(t/.14) if t < .14 else ease((1-t)/.16) if t > .84 else 1
        crouch = .5*load+.5*tuck
        rot('spine.001', (8 if backward else 24)*crouch+(0 if backward else 30)*tuck)
        rot('spine.006', (-5 if backward else 14)*crouch)
        for side in ['L', 'R']:
            rot('thigh.'+side, -24*load-(35 if backward else 52)*tuck)
            rot('shin.'+side, 48*load+(65 if backward else 82)*tuck)
            rot('foot.'+side, -24*load-30*tuck)
            ops['direction']('upper_arm.'+side, ops['limb_direction'](side, 18+12*tuck+(30*tuck if not backward else 0), 27))
            ops['direction']('forearm.'+side, ops['limb_direction'](side, 92+15*tuck, -12))
            ops['inward_wrist'](side, ops['limb_direction'](side, 90+15*tuck, -12))
            ops['fist'](side)
        ground()
        base = root_frame @ rig.pose.bones['spine'].location
        angle = (-360 if backward else 360)*ease(flight)
        rotation = Matrix.Rotation(math.radians(angle), 3, 'X')
        compensation = center-pivot-rotation @ (center-pivot)
        height = .65*math.sin(math.pi*flight) if backward else 0
        rot('spine', angle)
        delta = base+compensation+Vector((0, 0, height))
        location(delta)
        clearance = ops['floor']-float(coordinates()[:, 2].min())+.001
        if backward:
            if clearance > 0: location(delta+Vector((0, 0, clearance)))
        else:
            # The rounded silhouette's support point changes within a 24 FPS
            # sample. A small tuck-only allowance also clears interpolated poses.
            support_allowance = .016*ease((t-.25)/.07)*ease((.59-t)/.07)
            location(delta+Vector((0, 0, clearance+support_allowance)))

    def reach(upper, lower, target, pole):
        """Solve a shared knee plane, then store ordinary FK rotations."""
        bpy.context.view_layer.update()
        a = rw @ rig.pose.bones[upper].head
        delta = target-a
        l1, l2 = lengths[upper], lengths[lower]
        distance = max(abs(l1-l2)+.001, min(delta.length, l1+l2-.002))
        axis = delta.normalized()
        bend = (pole-axis*pole.dot(axis)).normalized()
        along = (l1*l1-l2*l2+distance*distance)/(2*distance)
        joint = a+axis*along+bend*math.sqrt(max(0, l1*l1-along*along))
        u, v = (joint-a).normalized(), (a+axis*distance-joint).normalized()
        normal = u.cross(v).normalized()
        ru = (rw.to_3x3() @ (rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local)).normalized()
        rv = (rw.to_3x3() @ (rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).normalized()
        rn = ru.cross(rv).normalized()
        for name, direction, base in ((upper, u, ru), (lower, v, rv)):
            source = Matrix((base.cross(rn).normalized(), base, rn)).transposed()
            dest = Matrix((direction.cross(normal).normalized(), direction, normal)).transposed()
            world_rotation(name, (dest @ source.transposed() @ rest[name].to_3x3().normalized()).to_quaternion())

    def side_step(t, leading):
        reset(); relax()
        s = 1 if leading == 'L' else -1
        u = max(0, min(1, (t-.10)/.48))
        progress = ease(u)
        # Settle onto the leading foot (.55), lean over that support, then
        # straighten as the trailing foot finishes its later landing (.82).
        sway = ease((t-.23)/.32)*ease((.98-t)/.30)
        drop = .045*math.sin(math.pi*t)**2
        location((s*body_height*progress, 0, -drop))
        rot('spine.001', 3*sway, s*10*sway)
        rot('spine.003', 0, s*5*sway)
        rot('spine.006', 0, -s*6*sway)
        for side in ['L', 'R']:
            lead = side == leading
            foot_progress = max(0, min(1, progress+(.065 if lead else -.065)*math.sin(math.pi*u)))
            start, end = (.04, .55) if lead else (.16, .82)
            phase = max(0, min(1, (t-start)/(end-start)))
            lift = (.045 if lead else .032)*math.sin(math.pi*phase)**2
            target = rest['foot.'+side].translation+Vector((s*body_height*foot_progress, 0, lift))
            reach('thigh.'+side, 'shin.'+side, target, Vector((.18 if side == 'L' else -.18, -1, 0)))
            world_rotation('foot.'+side, rest['foot.'+side].to_quaternion())
            for name in ['toe.'+side, 'foot.'+side+'.001']:
                if name in rest: world_rotation(name, rest[name].to_quaternion())
            angle = 15+(12 if lead else -4)*sway
            ops['direction']('upper_arm.'+side, ops['limb_direction'](side, angle, 35+(9 if lead else 0)*sway))
            ops['direction']('forearm.'+side, ops['limb_direction'](side, angle+65, -10))
            ops['inward_wrist'](side, ops['limb_direction'](side, angle+62, -10))
            ops['fingers'](side, 24)
        clearance = ops['floor']-float(coordinates()[:, 2].min())+.001
        if clearance > 0:
            delta = root_frame @ rig.pose.bones['spine'].location
            location(delta+Vector((0, 0, clearance)))

    return [('DodgeRoll', 29, lambda t: somersault(t, False), False),
            ('DodgeBackflip', 29, lambda t: somersault(t, True), False),
            ('DodgeSideL', 25, lambda t: side_step(t, 'L'), False),
            ('DodgeSideR', 25, lambda t: side_step(t, 'R'), False)]
