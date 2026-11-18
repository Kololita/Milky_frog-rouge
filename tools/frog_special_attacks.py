"""Two-hand sprint palm and airborne slam / stationary backflip recovery."""
import math
import bpy
from mathutils import Vector,Matrix


def build_special_attacks(rig, mesh, ops):
    ease=ops['ease']; arm=ops['attack_helpers']['arm'];foot=ops['attack_helpers']['foot']
    baselines={}

    def baseline(name):
        if name not in baselines:
            current=rig.animation_data.action;scene=bpy.context.scene;frame=scene.frame_current
            rig.animation_data.action=bpy.data.actions[name];scene.frame_set(int(bpy.data.actions[name].frame_range[1]));bpy.context.view_layer.update()
            baselines[name]={p.name:(p.rotation_quaternion.copy(),p.location.copy()) for p in rig.pose.bones}
            rig.animation_data.action=current;scene.frame_set(frame)
        return baselines[name]

    def finish_pose(name,u):
        for p in rig.pose.bones:
            q,loc=baselines[name][p.name]
            p.rotation_quaternion=p.rotation_quaternion.slerp(q,u)
            p.location=p.location.lerp(loc,u)

    def correct_floor():
        clearance=ops['floor']-float(ops['coordinates']()[:,2].min())+.001
        if clearance>0:
            frame=(rig.matrix_world@rig.data.bones['spine'].matrix_local).to_3x3()
            ops['location'](frame@rig.pose.bones['spine'].location+Vector((0,0,clearance)))

    def sprint(t):
        baseline('Attack2');ops['reset']();ops['relax']()
        sec=t*.75;drive=ease((sec-.055)/.15);recover=ease((sec-.34)/.34)
        push=drive*(1-recover);step=ease((sec-.045)/.22)
        ops['rot']('spine.001',27*push);ops['rot']('spine.003',7*push);ops['rot']('spine.006',-22*push)
        ops['location'](mesh.matrix_world.to_3x3()@Vector((0,-.28*step,-.065)))
        foot('L',-.06*step);foot('R',-.39*step,.055*math.sin(math.pi*max(0,min(1,(sec-.045)/.22)))**2 if sec<.265 else 0)
        for side,s in [('L',1),('R',-1)]:
            start=Vector((s*.273,.235,.548));end=Vector((s*.205,-.075,.700))
            arm(side,start.lerp(end,push),Vector((0,-.2,.98)),Vector((0,-1,0)),False)
        settle=ease((sec-.49)/.26)
        finish_pose('Attack2',settle)
        # Keep the gained ground while matching Attack2's local ending pose.
        frame=(rig.matrix_world@rig.data.bones['spine'].matrix_local).to_3x3()
        ops['location'](frame@rig.pose.bones['spine'].location+mesh.matrix_world.to_3x3()@Vector((0,-.205*settle,0)))
        correct_floor()

    def air(t):
        baseline('Idle');ops['reset']();ops['relax']()
        sec=t*1.75;rise=ease(sec/.22);slam=ease((sec-.22)/.28)
        gather=ease((sec-.50)/.20)
        flight=max(0,min(1,(sec-.70)/.78))
        tuck=math.sin(math.pi*flight)**.7
        recover=ease((sec-1.48)/.27)
        lean=12*slam*(1-gather)+8*tuck
        ops['rot']('spine.001',lean);ops['rot']('spine.006',-lean*.4)
        for side,s in [('L',1),('R',-1)]:
            hip=(62+22*rise)*(1-gather)+(-26-34*tuck)*gather*(1-recover)
            knee=6*(1-gather)+(58+62*tuck)*gather*(1-recover)
            ops['direction']('thigh.'+side,ops['limb_direction'](side,hip,20))
            ops['direction']('shin.'+side,ops['limb_direction'](side,hip-knee,8))
            ops['planted_foot'](side,3)
            prepared=Vector((s*.30,.18,.64));raised=Vector((s*.34,.20,.98));impact=Vector((s*.27,.075,.20))
            target=prepared.lerp(raised,rise).lerp(impact,slam*(1-ease((sec-.53)/.17)))
            arm(side,target,(0,0,1),(-s,0,0),True)
        ops['ground'](whole=True)
        root_frame=(rig.matrix_world@rig.data.bones['spine'].matrix_local).to_3x3()
        base=root_frame@rig.pose.bones['spine'].location
        pivot=(rig.matrix_world@rig.data.bones['spine'].matrix_local).translation
        center=mesh.matrix_world@Vector((0,.30,.49))
        angle=-360*ease(flight)
        rotation=Matrix.Rotation(math.radians(angle),3,'X')
        compensation=center-pivot-rotation@(center-pivot)
        ops['rot']('spine',angle)
        ops['location'](base+compensation+Vector((0,0,.32*math.sin(math.pi*flight))))
        finish_pose('Idle',ease((sec-1.52)/.23));correct_floor()

    return [('RunAttack',19,sprint,False),('AirAttack',43,air,False)]
