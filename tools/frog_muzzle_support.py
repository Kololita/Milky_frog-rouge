"""Two small support rings across the existing mouth-to-cheek bridge."""
import bpy,bmesh,json
from mathutils import Vector

def ensure_support_rings(mesh):
    if mesh.get('muzzle_support_version'):return
    from frog_mouth import patch_positions
    assert not mesh.get('muzzle_profile_version'),'Restore the muzzle before editing its support mesh'
    ids=json.loads(mesh['mouth_vertex_ids']);controls=json.loads(mesh['mouth_controls'])
    boundary_ids=json.loads(mesh['mouth_boundary_ids']);profile=json.loads(mesh['mouth_surface_profile'])
    rim=[(i,c) for i,c in zip(ids,controls) if c[0]==4]
    assert len(rim)==len(boundary_ids)==30
    bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
    boundary=[bm.verts[i] for i in boundary_ids];inner=[bm.verts[i] for i,c in rim]
    slot=next(i for i,m in enumerate(mesh.data.materials) if m.name=='Frog mouth skin')
    bridge=[]
    for i in range(30):
        j=(i+1)%30;wanted={boundary[i],boundary[j],inner[j],inner[i]}
        matches=[f for f in boundary[i].link_faces if set(f.verts)==wanted]
        assert len(matches)==1,(i,'mouth bridge not found')
        bridge.append(matches[0])
    deform=bm.verts.layers.deform.active
    layers={name:bm.verts.layers.shape[name] for name in mesh.data.shape_keys.key_blocks.keys()}
    rings=[boundary];new=[];new_controls=[]
    for fraction in [1/3,2/3]:
        ring=[]
        for i,(index,c) in enumerate(rim):
            b,r=boundary[i],inner[i]
            group=mesh.vertex_groups['jaw'].index
            jw=b[deform].get(group,0)*(1-fraction)+r[deform].get(group,0)*fraction
            control=[9,c[1],fraction,list(b[layers['Basis']]),jw,c[4]]
            co=patch_positions([control],0,profile)[0]
            v=bm.verts.new(co)
            for name,layer in layers.items():
                delta=(b[layer]-b[layers['Basis']])*(1-fraction)+(r[layer]-r[layers['Basis']])*fraction
                v[layer]=co+delta
            for g in set(b[deform].keys())|set(r[deform].keys()):
                weight=b[deform].get(g,0)*(1-fraction)+r[deform].get(g,0)*fraction
                if weight:v[deform][g]=weight
            ring.append(v);new.append(v);new_controls.append(control)
        rings.append(ring)
    rings.append(inner)
    bmesh.ops.delete(bm,geom=bridge,context='FACES_ONLY')
    wire=[e for e in bm.edges if e.is_wire and any(v in boundary for v in e.verts) and any(v in inner for v in e.verts)]
    if wire:bmesh.ops.delete(bm,geom=wire,context='EDGES')
    faces=[]
    for outer,inside in zip(rings,rings[1:]):
        for i in range(30):
            j=(i+1)%30;f=bm.faces.new((outer[i],outer[j],inside[j],inside[i]));f.material_index=slot;f.smooth=True;faces.append(f)
            for loop in f.loops:
                for uv in bm.loops.layers.uv.values():loop[uv].uv=(.5,.5)
                for color in bm.loops.layers.float_color.values():loop[color]=(1,1,1,1)
    bmesh.ops.recalc_face_normals(bm,faces=faces)
    assert all(e.is_manifold for f in faces for e in f.edges)
    bm.verts.index_update();new_ids=[v.index for v in new]
    bm.to_mesh(mesh.data);bm.free();mesh.data.update()
    mesh['mouth_vertex_ids']=json.dumps(ids+new_ids);mesh['mouth_controls']=json.dumps(controls+new_controls)
    mesh['muzzle_support_version']=1
    assert len(mesh.data.vertices)==3338
    print('MUZZLE_SUPPORT_RINGS',len(new_ids),'vertices,',len(faces),'exterior quads')
