"""Anatomical palm-relative finger curls, independent of asymmetric rest rolls."""
import math
from mathutils import Vector, Matrix


def hand_pose(rig, side, closed):
    """closed=0 gives an extended palm; closed=1 wraps fingers into a fist."""
    rw=rig.matrix_world
    wrist=rw@rig.data.bones['hand.'+side].head_local
    index=rw@rig.data.bones['f_index.01.'+side].head_local
    outer=rw@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
    forward=((index+outer)*.5-wrist).normalized()
    normal=forward.cross(outer-index).normalized()*(-1 if side=='L' else 1)
    across=forward.cross(normal).normalized()
    rest_hand=(rw@rig.data.bones['hand.'+side].matrix_local).to_quaternion()
    posed_hand=(rw@rig.pose.bones['hand.'+side].matrix).to_quaternion()
    deform=posed_hand@rest_hand.inverted()
    prefixes=['f_index','f_ring','f_pinky'] if side=='L' else ['f_index','f_middle','f_ring']
    for digit_index,prefix in enumerate(prefixes+['thumb']):
        is_thumb=prefix=='thumb'
        if is_thumb:
            base=rw@rig.data.bones['thumb.01.'+side].head_local
            outside=base-(index+outer)*.5
            outside=(outside-forward*outside.dot(forward)-normal*outside.dot(normal)).normalized()
            # Oppose the thumb across the curled fingers, rather than driving
            # it straight through the palm with the same hinge as the digits.
            opened=(forward*.65+outside*.75).normalized()
            thumb_axes=[None,(-outside*.60+forward*.30-normal*.74).normalized(),
                        (outside*.15+forward*.15+normal*.98).normalized(),
                        (outside*.30-forward*.20+normal*.93).normalized()]
            digit_forward=forward
        else:
            spread=math.radians((digit_index-1)*5*(1-closed))
            digit_forward=(forward*math.cos(spread)+across*math.sin(spread)).normalized()
            angles_open=[0,3,6,8]
            angles_closed=[65,145,200,210]
        hinge=digit_forward.cross(normal).normalized()
        for segment in range(1,5):
            name=f'{prefix}.{segment:02}.{side}'
            if name not in rig.pose.bones:continue
            if is_thumb:
                # The first thumb bone spans the web/metacarpal. Keep that
                # support in place; opposition occurs in the remaining joints.
                b=rig.data.bones[name]
                base=(rw.to_3x3()@(b.tail_local-b.head_local)).normalized()
                axis=base if segment==1 else opened.lerp(thumb_axes[segment-1],closed).normalized()
                rest=(rw@b.matrix_local).to_quaternion()
                desired=(deform @ base.rotation_difference(axis) @ rest).to_matrix()
            else:
                angle=math.radians(angles_open[segment-1]*(1-closed)+angles_closed[segment-1]*closed)
                axis=(digit_forward*math.cos(angle)+normal*math.sin(angle)).normalized()
                frame=Matrix((hinge,axis,hinge.cross(axis).normalized())).transposed()
                desired=deform.to_matrix()@frame
            # Bone Y follows the phalanx; a shared hinge avoids axial twisting.
            bone=rig.data.bones[name]
            relative=bone.parent.matrix_local.inverted()@bone.matrix_local
            parent=rw@rig.pose.bones[bone.parent.name].matrix@relative
            rig.pose.bones[name].rotation_quaternion=parent.to_quaternion().inverted()@desired.to_quaternion()
            # Update parents before solving the next phalanx.
            import bpy
            bpy.context.view_layer.update()
