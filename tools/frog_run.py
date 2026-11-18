"""A faster run: grounded drive, heel recovery and an opposite-arm swing."""
import math
import bpy
from mathutils import Vector, Matrix


def build_run(rig, mesh, ops):
    reset, rot, location, ease, world_rotation = (
        ops[n] for n in ('reset', 'rot', 'location', 'ease', 'world_rotation'))
    rw, mw = rig.matrix_world.copy(), mesh.matrix_world.copy()
    rest = {b.name: rw @ b.matrix_local for b in rig.data.bones}
    lengths = {b.name: (rw.to_3x3() @ (b.tail_local-b.head_local)).length for b in rig.data.bones}
    balls = {}
    for side in ['L', 'R']:
        ankle = rest['foot.'+side].translation
        toes = [rest[n].translation for n in ['toe.'+side, 'foot.'+side+'.001'] if n in rest]
        contact = sum(toes, Vector())/len(toes)
        contact.z = ops['floor']
        balls[side] = contact-ankle

    def reach(side, target):
        """Use a shared hinge plane for the thigh and shin, baked to FK."""
        upper, lower = 'thigh.'+side, 'shin.'+side
        bpy.context.view_layer.update()
        hip = rw @ rig.pose.bones[upper].head
        delta = target-hip
        l1, l2 = lengths[upper], lengths[lower]
        distance = max(abs(l1-l2)+.001, min(delta.length, l1+l2-.002))
        axis = delta.normalized()
        pole = Vector((.12 if side == 'L' else -.12, -1, .04))
        bend = (pole-axis*pole.dot(axis)).normalized()
        along = (l1*l1-l2*l2+distance*distance)/(2*distance)
        knee = hip+axis*along+bend*math.sqrt(max(0, l1*l1-along*along))
        u, v = (knee-hip).normalized(), (hip+axis*distance-knee).normalized()
        normal = u.cross(v).normalized()
        ru = (rw.to_3x3() @ (rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local)).normalized()
        rv = (rw.to_3x3() @ (rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).normalized()
        rn = ru.cross(rv).normalized()
        for name, direction, base in ((upper, u, ru), (lower, v, rv)):
            source = Matrix((base.cross(rn).normalized(), base, rn)).transposed()
            dest = Matrix((direction.cross(normal).normalized(), direction, normal)).transposed()
            world_rotation(name, (dest @ source.transposed() @ rest[name].to_3x3().normalized()).to_quaternion())

    def foot_path(phase):
        if phase < .30:
            # Planted forefoot travels backwards under the moving pelvis.
            u = phase/.30
            return -.145+.308*u, 0, 6+28*ease((phase-.12)/.18)
        if phase < .55:
            # Finish pushing back first; then fold the knee and lift the heel.
            u = (phase-.30)/.25
            return .163+.022*math.sin(math.pi*u)**2, .100*ease(u), 34-22*ease(u)
        if phase < .84:
            # The knee leads the recovering foot back to the front.
            u = ease((phase-.55)/.29)
            return .163-.263*u, .100-.050*u, 12-5*u
        # Extend for contact instead of carrying a bent knee into the floor.
        u = ease((phase-.84)/.16)
        return -.100-.045*u, .050*(1-u), 7-u

    def run(t):
        reset()
        p = math.tau*t
        rot('spine', 7, 1.5*math.sin(p), 2.0*math.sin(p))
        rot('spine.003', 2, 0, -2.5*math.sin(p))
        rot('spine.006', -5, 0, -.8*math.sin(p))
        location((0, 0, -.015-.010*math.cos(2*p-.32*math.pi)))
        for side, offset in [('L', 0), ('R', .5)]:
            phase = (t+offset)%1
            y, lift, heel = foot_path(phase)
            rotation = Matrix.Rotation(math.radians(heel), 3, 'X')
            # Roll about the ball, raising the heel while leaving the toe low.
            ankle = rest['foot.'+side].translation + mw.to_3x3() @ Vector((0, y, lift))
            ankle += balls[side]-rotation @ balls[side]
            reach(side, ankle)
            ops['planted_foot'](side, heel)
            q = math.tau*phase
            shoulder = 14-44*math.cos(q)
            elbow = 90+8*math.cos(q-.3)
            splay = 37+1.5*math.sin(q-.4)
            inward = -18+.8*math.sin(q-.2)
            ops['direction']('upper_arm.'+side, ops['limb_direction'](side, shoulder, splay))
            ops['direction']('forearm.'+side, ops['limb_direction'](side, shoulder+elbow, inward))
            ops['inward_wrist'](side, ops['limb_direction'](side, shoulder+elbow-3, inward))
            ops['fist'](side)
        clearance = ops['floor']-float(ops['coordinates']()[:, 2].min())+.001
        if clearance > 0:
            basis = (rw @ rig.data.bones['spine'].matrix_local).to_3x3()
            location(basis @ rig.pose.bones['spine'].location+Vector((0, 0, clearance)))

    # .625 seconds per full cycle, versus .75 previously (20% faster).
    return ('Run', 16, run, True)
