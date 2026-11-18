"""A reversible, compact muzzle deformation shared by skin and oral parts."""
import json
from mathutils import Vector

AMPLITUDE = .026
JAW_TRAVEL = .012
BACKUP = 'muzzle_unmodified_keys_v1'

def smooth(t):
    t=max(0.,min(1.,t))
    return t*t*(3-2*t)

def projection(p):
    x,y,z=p
    lateral=1-smooth(((x-.001)/.108)**2)
    t=(z-.903)/.039 if z>=.903 else (.903-z)/.072
    vertical=1-smooth(t*t)
    depth=1-smooth((y-.270)/.055)
    return AMPLITUDE*lateral*vertical*depth

def deform_normal(point,normal):
    eps=1e-5;gradient=[]
    for axis in range(3):
        a,b=point.copy(),point.copy();a[axis]+=eps;b[axis]-=eps
        gradient.append((projection(a)-projection(b))/(2*eps))
    x,y,z=gradient;ny=normal.y/(1-y)
    return Vector((normal.x+x*ny,ny,normal.z+z*ny)).normalized()

def original_basis(obj):
    if BACKUP not in obj:return {}
    return {int(row[0]):Vector(row[1:]) for row in json.loads(obj[BACKUP])['keys'].get('Basis',[])}

def restore(objects):
    for obj in objects:
        if BACKUP not in obj:continue
        stored=json.loads(obj[BACKUP]);keys=obj.data.shape_keys.key_blocks
        for name,rows in stored['keys'].items():
            for i,x,y,z in rows:keys[name].data[i].co=(x,y,z)
        for v,k in zip(obj.data.vertices,keys['Basis'].data):v.co=k.co
        del obj[BACKUP]
        if 'muzzle_profile_version' in obj:del obj['muzzle_profile_version']

def apply(objects):
    report={}
    for obj in objects:
        assert BACKUP not in obj,'Restore the unmodified coordinates before fitting again'
        # Keep each vertex's offset identical in every expression. This preserves
        # the authored morph displacements exactly instead of bending the smile
        # differently at each key. Dental arches translate with the closed seam.
        offsets=[]
        for v in obj.data.shape_keys.key_blocks['Basis'].data:
            p=v.co.copy()
            if obj.name in ['Frog laugh teeth','Frog laugh tongue']:p.z=.904
            offsets.append(projection(p))
        stored={};maximum=0
        for key in obj.data.shape_keys.key_blocks:
            rows=[]
            for i,v in enumerate(key.data):
                offset=offsets[i]
                if offset<1e-10:continue
                rows.append([i,*v.co]);v.co.y-=offset;maximum=max(maximum,offset)
            stored[key.name]=rows
        if not any(stored.values()):continue
        obj[BACKUP]=json.dumps({'keys':stored},separators=(',',':'))
        obj['muzzle_profile_version']=1
        for v,k in zip(obj.data.vertices,obj.data.shape_keys.key_blocks['Basis'].data):v.co=k.co
        obj.data.update()
        report[obj.name]={'affected_basis_vertices':len(stored['Basis']),'maximum_forward_offset':maximum}
    # A convex muzzle must hide the full dental crown at rest, including its
    # upper corners. Recess each crown as one solid, then keep the same offset
    # throughout its existing laugh targets.
    from mathutils.bvhtree import BVHTree
    skin=objects[0];teeth=next(o for o in objects if o.name=='Frog laugh teeth')
    tongue=next(o for o in objects if o.name=='Frog laugh tongue')
    faces=[tuple(p.vertices) for p in skin.data.polygons]
    keys=skin.data.shape_keys.key_blocks
    base=[v.co.copy() for v in keys['Basis'].data]
    opened=[v.co.copy() for v in keys['LaughOpen'].data]
    groups={g.index:g.name for g in skin.vertex_groups}
    jaw=[sum(g.weight for g in v.groups if groups[g.group]=='jaw') for v in skin.data.vertices]
    rim=[i for i,c in zip(json.loads(skin['mouth_vertex_ids']),json.loads(skin['mouth_controls'])) if c[0]==4]
    def inside(p,poly):
        result=False
        for a,b in zip(poly,poly[1:]+poly[:1]):
            if (a.z>p.z)!=(b.z>p.z) and p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x:result=not result
        return result
    recessed=[0.]*20
    for step in range(65):
        u=step/64;posed=[p.lerp(q,u)-Vector((0,0,JAW_TRAVEL*u*w)) for p,q,w in zip(base,opened,jaw)]
        tree=BVHTree.FromPolygons(posed,faces);aperture=[posed[i] for i in rim]
        lo=min(7,int(u*8));f=u*8-lo
        a=teeth.data.shape_keys.key_blocks['Basis' if lo==0 else f'Laugh_{lo/8:.3f}']
        b=teeth.data.shape_keys.key_blocks[f'Laugh_{(lo+1)/8:.3f}']
        for i,(va,vb) in enumerate(zip(a.data,b.data)):
            p=va.co.lerp(vb.co,f)
            if i>=160:p.z-=JAW_TRAVEL*u
            if u>0 and inside(p,aperture):continue
            hit=tree.ray_cast(Vector((p.x,-1,p.z)),Vector((0,1,0)),2)[0]
            if hit is not None:recessed[i//16]=max(recessed[i//16],hit.y+.002-p.y)
    for tooth,shift in enumerate(recessed):
        start=tooth*16
        for key in teeth.data.shape_keys.key_blocks:
            for v in key.data[start:start+16]:v.co.y+=shift
    # Place the tongue behind the back of both arches in every target, while
    # retaining its volume and existing motion.
    shift=0
    for key in tongue.data.shape_keys.key_blocks:
        dental=teeth.data.shape_keys.key_blocks.get(key.name)
        if dental is None:continue
        tip=min(v.co.y for v in key.data)
        crowns=[v.co.y for v in dental.data if abs(v.co.x-.001)<.027]
        shift=max(shift,max(crowns)+.0045-tip)
    for key in tongue.data.shape_keys.key_blocks:
        for v in key.data:v.co.y+=shift
    for obj in [teeth,tongue]:
        for v,k in zip(obj.data.vertices,obj.data.shape_keys.key_blocks['Basis'].data):v.co=k.co
        obj.data.update()
    report['oral_clearance']={'maximum_crown_recess':max(recessed),'tongue_recess':shift}
    return report
