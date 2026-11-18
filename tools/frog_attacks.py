"""Four authored FK attacks. Analytic reaches are baked, never exported as IK."""
import math
import bpy
from frog_hand_pose import hand_pose
from mathutils import Vector, Matrix, Quaternion


def build_attacks(rig, mesh, ops):
    reset, relax, rot, location, world_rotation, fist, ease, palm_frames = (
        ops[n] for n in ('reset', 'relax', 'rot', 'location', 'world_rotation', 'fist', 'ease', 'palm_frames'))
    mw = mesh.matrix_world.copy()
    rw = rig.matrix_world.copy()
    rest = {b.name: rw @ b.matrix_local for b in rig.data.bones}
    point = lambda name: rw @ rig.pose.bones[name].head
    lengths = {b.name: (rw.to_3x3() @ (b.tail_local-b.head_local)).length for b in rig.data.bones}

    def blend(a, b, t):
        return Vector(a).lerp(Vector(b), ease(t))

    def reach(upper, lower, target, pole):
        """One shared hinge plane prevents elbow/knee candy-wrapper twisting."""
        bpy.context.view_layer.update()
        a = point(upper)
        delta = target-a
        l1, l2 = lengths[upper], lengths[lower]
        d = max(abs(l1-l2)+.001, min(delta.length, l1+l2-.002))
        axis = delta.normalized()
        bend = pole-axis*pole.dot(axis)
        bend.normalize()
        along = (l1*l1-l2*l2+d*d)/(2*d)
        joint = a+axis*along+bend*math.sqrt(max(0, l1*l1-along*along))
        u, v = (joint-a).normalized(), (a+axis*d-joint).normalized()
        normal = u.cross(v).normalized()
        ru = (rw.to_3x3() @ (rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local)).normalized()
        rv = (rw.to_3x3() @ (rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).normalized()
        rn = ru.cross(rv).normalized()
        for name, direction, base in ((upper, u, ru), (lower, v, rv)):
            source = Matrix((base.cross(rn).normalized(), base, rn)).transposed()
            dest = Matrix((direction.cross(normal).normalized(), direction, normal)).transposed()
            world_rotation(name, (dest @ source.transposed() @ rest[name].to_3x3().normalized()).to_quaternion())

    def wrist(side, forward, normal, closed):
        f = Vector(forward).normalized()
        n = Vector(normal); n = (n-f*n.dot(f)).normalized()
        frame = Matrix((f.cross(n).normalized(), f, n)).transposed()
        world_rotation('hand.'+side, (frame @ palm_frames[side].transposed() @ rest['hand.'+side].to_3x3().normalized()).to_quaternion())
        if rig.get('four_segment_fingers'):
            hand_pose(rig,side,float(closed));return
        fist(side)
        for p in rig.pose.bones:
            if p.name.endswith('.'+side) and p.name.startswith(('f_', 'thumb.')):
                angle = 4 if p.name.startswith('f_') else {'01':24, '02':12, '03':8}.get(p.name.split('.')[1],0)
                opened=Quaternion((1,0,0), math.radians(angle))
                p.rotation_quaternion=opened.slerp(p.rotation_quaternion,float(closed))

    def chest_point(co):
        bone = rig.data.bones['spine.003']
        deform = rw @ rig.pose.bones[bone.name].matrix @ bone.matrix_local.inverted() @ rw.inverted()
        return deform @ mw @ Vector(co)

    def arm(side, target, forward, normal, closed=True, pole=None):
        s = 1 if side=='L' else -1
        reach('upper_arm.'+side, 'forearm.'+side, chest_point(target), mw.to_3x3() @ Vector(pole or (s*.8,.05,-1)))
        wrist(side, mw.to_3x3() @ Vector(forward), mw.to_3x3() @ Vector(normal), closed)

    def foot(side, offset, lift=0, roll=0):
        target = rest['foot.'+side].translation + mw.to_3x3() @ Vector((0,offset,lift))
        reach('thigh.'+side, 'shin.'+side, target, mw.to_3x3() @ Vector((.12 if side=='L' else -.12,-1,.05)))
        world_rotation('foot.'+side, Quaternion((1,0,0), math.radians(roll)) @ rest['foot.'+side].to_quaternion())
        for n in ['toe.'+side,'foot.'+side+'.001']:
            if n in rest: world_rotation(n,rest[n].to_quaternion())

    def peak(sec, start, hit, hold, end):
        if sec < hit: return ease((sec-start)/(hit-start))
        if sec <= hold: return 1
        return 1-ease((sec-hold)/(end-hold))

    chamber = {'L':(.273,.235,.548), 'R':(-.273,.235,.548)}
    punch = {'L':(.190,.004,.715), 'R':(-.190,.004,.715)}

    def pose(stage, t):
        duration = {1:.75, 2:23/24, 3:25/24, 4:34/24}[stage]
        sec = t*duration
        reset(); relax()
        travel=0; drop=.038; lean=0; twist=0; sidebend=0
        feet={'L':0,'R':0}; lifts={'L':0,'R':0}; rolls={'L':0,'R':0}
        hits={'L':0,'R':0}
        palm=0; charge=0
        if stage==1:
            # Advancing jab: lead-foot plant, then bring the rear foot through.
            # Horizontal motion is extracted by Three.js; retain the leg motion.
            step=ease((sec-.025)/.23)
            lead=ease((sec-.025)/.20);follow=ease((sec-.12)/.24)
            travel=.66*step
            feet={'L':-.66*lead,'R':-.66*follow}
            lifts['L']=.065*math.sin(math.pi*lead)**2
            lifts['R']=.055*math.sin(math.pi*follow)**2
            drop+=.018*math.sin(math.pi*step)
            hits['L']=peak(sec,.10,.27,.32,.62)
            twist=-9*hits['L']; lean=7*hits['L']
        elif stage==2:
            step=ease((sec-.10)/.34)
            travel=.075*step
            # A simple advancing right cross; the left fist stays at the waist.
            lifts['R']=.045*math.sin(math.pi*max(0,min(1,(sec-.10)/.34)))**2 if sec<.44 else 0
            feet['R']=-.165*step
            hits['R']=peak(sec,.12,.42,.49,.84)
            lean=3*hits['R'];twist=9*hits['R']
        elif stage==3:
            # Start exactly where stage 2 finishes; advance the left foot on
            # the first punch, keeping the planted right foot fixed in world.
            step=ease((sec-.04)/.29)
            travel=.12*step
            feet={'L':.075-.25*step,'R':-.09}
            lifts['L']=.045*math.sin(math.pi*max(0,min(1,(sec-.04)/.29)))**2 if sec<.33 else 0
            hits['L']=max(peak(sec,.06,.18,.21,.36),peak(sec,.51,.65,.68,.87))
            hits['R']=peak(sec,.29,.41,.44,.59)
            twist=9*(hits['R']-hits['L']);lean=3*max(hits.values())
        else:
            # Extend the original .20-second load by .15 seconds. A small
            # rightward turn and side bend release together into the palm.
            load=ease(sec/.35)
            drive=ease((sec-.35)/.19)
            charge=load*(1-drive)
            recover=ease((sec-1.02)/(duration-1.02))
            palm=drive*(1-recover)
            travel=.18*drive
            # Match the left step from stage 3, then step past it with the right.
            feet={'L':-.055,'R':.03+.055*load-.42*drive}
            lifts['R']=(.012*math.sin(math.pi*min(1,sec/.35))**2 if sec<.35 else
                        .045*math.sin(math.pi*max(0,min(1,(sec-.35)/.27)))**2 if sec<.62 else 0)
            drop+=.030*drive*(1-.45*recover)
            lean=-3*charge+12*palm
            twist=-12*charge+10*palm
            sidebend=-5*charge
            rolls['L']=12*palm
        if stage>=2:
            travel*=1.2
            feet={side:offset*1.2 for side,offset in feet.items()}
        rot('spine.001',lean,sidebend)
        rot('spine.003',0,0,twist)
        rot('spine.006',-lean*.5,-sidebend*.35,-twist*.35)
        location(mw.to_3x3() @ Vector((0,-travel,-drop)))
        bpy.context.view_layer.update()
        for side in ['L','R']:
            foot(side,feet[side],lifts[side],rolls[side])
        for side in ['L','R']:
            s=1 if side=='L' else -1
            hit=hits[side]
            target=blend(chamber[side],punch[side],hit)
            forward=blend((0,-.94,.34),(0,-1,0),hit)
            normal=(-s,0,0)
            closed=True
            if stage==4 and side=='R':
                target=blend(target,(-.290,.28,.575),charge)
                target=blend(target,(-.170,.003,.705),palm)
                forward=blend(forward,(0,-.35,.94),palm)
                normal=blend(normal,(0,-1,0),palm)
                closed=False
            arm(side,target,forward,normal,closed)

    ops['attack_helpers']={'arm':arm,'foot':foot,'reach':reach}
    # Exact durations use sample-aligned frames at 24 FPS (23 frames = .9167s).
    return [(f'Attack{i}', n, lambda t,i=i:pose(i,t), False)
            for i,n in [(1,19),(2,24),(3,26),(4,35)]]
