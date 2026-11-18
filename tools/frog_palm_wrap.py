"""Fit heel, distal palm and finger pads together, rather than just the wrist."""
import bpy,math
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
from frog_arm_skin import arm_skin_predictor

def build_palm_wrap(rig,mesh,ops):
    rw,mw=rig.matrix_world.copy(),mesh.matrix_world.copy()
    names={g.index:g.name for g in mesh.vertex_groups}
    arm=lambda n:n.startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))
    weights=[sum(g.weight for g in v.groups if arm(names[g.group])) for v in mesh.data.vertices]
    body_faces=[tuple(p.vertices) for p in mesh.data.polygons if max(weights[i] for i in p.vertices)<.05]
    parts={}
    for side in ['L','R']:
        wrist=rw@rig.data.bones['hand.'+side].head_local
        index=rw@rig.data.bones['f_index.01.'+side].head_local
        outer=rw@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
        length=((index+outer)*.5-wrist).length
        forward,normal=ops['palm_frames'][side].col[1],ops['palm_frames'][side].col[2]
        palm=[];heel=[];fingers=[];all_hand=[]
        for v in mesh.data.vertices:
            hw=sum(g.weight for g in v.groups if names[g.group]=='hand.'+side)
            fw=sum(g.weight for g in v.groups if names[g.group].endswith('.'+side) and names[g.group].startswith('f_'))
            total=sum(g.weight for g in v.groups if names[g.group].endswith('.'+side) and names[g.group].startswith(('hand','f_','thumb')))
            if total>.8:all_hand.append(v.index)
            if (mw.to_3x3()@v.normal).normalized().dot(normal)<.35:continue
            along=(mw@v.co-wrist).dot(forward)
            if hw>.5:
                (palm if along>.42*length else heel).append(v.index)
            if fw>.6:fingers.append(v.index)
        assert palm and heel and fingers
        parts[side]={'palm':palm,'heel':heel,'fingers':fingers,'all':all_hand,'rest':(rw@rig.data.bones['hand.'+side].matrix_local).to_quaternion()}

    def positions():
        bpy.context.view_layer.update();ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh()
        pts=[ev.matrix_world@v.co for v in data.vertices];ev.to_mesh_clear();return pts

    def distances(tree,points):
        values=[]
        for p in points:
            hit,n,_,_=tree.find_nearest(p);values.append((p-hit).dot(n))
        return values

    def mean(values):return sum(values)/len(values)

    def fit(u):
        if u<1e-5:return
        fit.last_report={}
        verts=positions();tree=BVHTree.FromPolygons(verts,body_faces)
        for side,s in [('L',1),('R',-1)]:
            part=parts[side];hand='hand.'+side;lower='forearm.'+side
            curl=0
            ops['hand_pose'](rig,side,curl);verts=positions()
            before={name:mean(distances(tree,[verts[i] for i in part[name]])) for name in ['palm','heel','fingers']}
            wrist=rw@rig.pose.bones[hand].head;original=(rw@rig.pose.bones[hand].matrix).to_quaternion()
            deform=original@part['rest'].inverted()
            forward=(deform@ops['palm_frames'][side].col[1]).normalized()
            center=sum((verts[i] for i in part['palm']),Vector())/len(part['palm'])
            _,outward,_,_=tree.find_nearest(center);axis=forward.cross(-outward).normalized()
            ids=sorted(set(part['palm']+part['heel']+part['fingers']+part['all']))
            id_map={v:i for i,v in enumerate(ids)}
            regions={name:[id_map[i] for i in part[name]] for name in ['palm','heel','fingers','all']}
            predict=arm_skin_predictor(rig,mesh,side,ids)
            a=rw@rig.pose.bones['upper_arm.'+side].head
            lower_length=(rw.to_3x3()@(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).length
            def skin(q,shift):
                target=wrist+outward*shift
                hand_forward=(q@part['rest'].inverted())@ops['palm_frames'][side].col[1]
                pole=target-hand_forward*lower_length-a
                return predict(target,q,pole)
            best=None
            for pitch in range(0,31,5):
                for roll in [-10,0,10]:
                    q=Quaternion(axis,math.radians(pitch))@Quaternion(forward,math.radians(roll))
                    shift=0
                    for _ in range(2):
                        points=skin(q@original,shift)
                        minimum=1;support=outward
                        for i in regions['all']:
                            p=points[i];hit,n,_,_=tree.find_nearest(p);gap=(p-hit).dot(n)
                            if gap<minimum:minimum=gap;support=n
                        shift+=(.001-minimum)/max(.45,support.dot(outward))
                    if abs(shift)>.10:continue
                    points=skin(q@original,shift)
                    gaps={name:distances(tree,[points[i] for i in regions[name]]) for name in ['palm','heel','fingers']}
                    score=mean(gaps['palm'])*1.5+mean(gaps['fingers'])*.7+mean(gaps['heel'])*.25+abs(pitch)*.000005+abs(roll)*.000003
                    if best is None or score<best[0]:best=(score,q,shift,pitch,roll)
            if best is None:continue
            _,rotation,shift,_,_=best
            desired=original.slerp(rotation@original,u)
            target=wrist+outward*shift*u
            hand_forward=(desired@part['rest'].inverted())@ops['palm_frames'][side].col[1]
            # Put the elbow behind the palm direction, keeping wrist and forearm aligned.
            a=rw@rig.pose.bones['upper_arm.'+side].head
            lower_length=(rw.to_3x3()@(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).length
            pole=target-hand_forward*lower_length-a
            ops['attack_helpers']['reach']('upper_arm.'+side,lower,target,pole)
            ops['world_rotation'](hand,desired);ops['hand_pose'](rig,side,curl)
            check=positions();predicted=skin(desired,shift*u)
            prediction_error=max((check[i]-predicted[j]).length for j,i in enumerate(ids))
            # Correct mixed wrist weights and the small FK reach clamp against real skin.
            for _ in range(3):
                verts=positions();gaps=distances(tree,[verts[i] for i in part['all']])
                correction=.001-min(gaps)
                if abs(correction)<.00015:break
                target=(rw@rig.pose.bones[hand].head)+outward*correction*u
                ops['attack_helpers']['reach']('upper_arm.'+side,lower,target,pole)
                ops['world_rotation'](hand,desired);ops['hand_pose'](rig,side,curl)
            # Follow the convex abdomen with each phalanx, keeping the palm open.
            prefixes=['f_index','f_ring','f_pinky'] if side=='L' else ['f_index','f_middle','f_ring']
            original_axes={};original_rotations={}
            for prefix in prefixes+['thumb']:
                for segment in range(1,5):
                    n=f'{prefix}.{segment:02}.{side}'
                    if n not in rig.pose.bones:continue
                    p=rig.pose.bones[n]
                    original_axes[n]=(rw.to_3x3()@(p.tail-p.head)).normalized()
                    original_rotations[n]=(rw@p.matrix).to_quaternion()
            for prefix in prefixes+['thumb']:
                for segment in range(1 if prefix!='thumb' else 2,5):
                    n=f'{prefix}.{segment:02}.{side}'
                    if n not in rig.pose.bones:continue
                    p=rig.pose.bones[n];b=rig.data.bones[n]
                    head=rw@p.head;length=(rw.to_3x3()@(b.tail_local-b.head_local)).length
                    initial=original_axes[n]
                    radii=[]
                    rest_head=rw@b.head_local;rest_axis=(rw.to_3x3()@(b.tail_local-b.head_local)).normalized()
                    for v in mesh.data.vertices:
                        if sum(g.weight for g in v.groups if names[g.group]==n)<.4:continue
                        offset=mw@v.co-rest_head;offset-=rest_axis*offset.dot(rest_axis)
                        r=offset.dot(ops['palm_frames'][side].col[2])
                        if r>0:radii.append(r)
                    radii.sort();radius=(radii[int((len(radii)-1)*.85)] if radii else .008)+.0015
                    direction=initial
                    for _ in range(3):
                        end=head+direction*length
                        hit,normal,_,_=tree.find_nearest(end)
                        target=hit+normal*radius
                        direction=(target-head).normalized()
                        if direction.dot(initial)<.35:
                            direction=initial.lerp(direction,.55).normalized()
                    goal=original_rotations[n].slerp(initial.rotation_difference(direction)@original_rotations[n],u)
                    ops['world_rotation'](n,goal)
            # Resolve finger tips against actual blended skin, not bone tails alone.
            # Rotate the responsible joint outward; never pull the palm away to
            # hide a fingertip collision.
            for prefix in prefixes+['thumb']:
                digit_ids=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if names[g.group].startswith(prefix+'.') and names[g.group].endswith('.'+side))>.5]
                for iteration in range(14):
                    verts=positions();values=distances(tree,[verts[i] for i in digit_ids])
                    gap=min(values)
                    if gap>=.0003:break
                    vertex=verts[digit_ids[values.index(gap)]]
                    _,normal,_,_=tree.find_nearest(vertex)
                    candidates=[]
                    for segment in range(1 if prefix!='thumb' else 2,5):
                        n=f'{prefix}.{segment:02}.{side}'
                        if n not in rig.pose.bones:continue
                        head=rw@rig.pose.bones[n].head;lever=vertex-head
                        axis=lever.cross(normal)
                        if axis.length>.003:candidates.append((axis.length,n,axis.normalized()))
                    if not candidates:break
                    lever,n,axis=max(candidates)
                    angle=min(.12,(.0008-gap)/lever)
                    q=(rw@rig.pose.bones[n].matrix).to_quaternion()
                    ops['world_rotation'](n,Quaternion(axis,angle)@q)
            verts=positions()
            final_forward=((rw@rig.pose.bones[hand].matrix).to_quaternion()@part['rest'].inverted())@ops['palm_frames'][side].col[1]
            arm_forward=(rw.to_3x3()@(rig.pose.bones[lower].tail-rig.pose.bones[lower].head)).normalized()
            fit.last_report[side]={'pitch':best[3],'roll':best[4],'wristBendDegrees':math.degrees(final_forward.angle(arm_forward)),'predictionError':prediction_error,'before':before,'after':{name:mean(distances(tree,[verts[i] for i in part[name]])) for name in ['palm','heel','fingers']}}
    fit.parts=parts
    return fit
