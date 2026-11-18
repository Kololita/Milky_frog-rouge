"""Foundry hero props. Blender source is retained; GLBs are game-ready in meters."""
import bpy, math, os
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/environment'; SOURCE=ROOT/'assets-source/blender/environment'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=.7,rough=.35):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
bronze=mat('Foundry_Bronze',(.32,.19,.085),.75,.3);steel=mat('Foundry_Iron',(.13,.15,.16),.82,.32);edge=mat('Foundry_Machined',(.34,.35,.33),.8,.26);red=mat('Foundry_EnamelRed',(.3,.028,.016),.5,.3);black=mat('Foundry_Recess',(.025,.029,.032),.4,.6);stone=mat('Foundry_Firebrick',(.18,.115,.075),.12,.9);gold=mat('Foundry_SafetyGold',(.48,.27,.035),.65,.42)
parent=None

def finish(o,name,m,bevel=0,smooth=True):
 o.name=name;o.data.materials.append(m);o.parent=parent
 if bevel:
  mod=o.modifiers.new('Machined edge radius','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 if smooth:
  for p in o.data.polygons:p.use_smooth=True
  mod=o.modifiers.new('Area weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
 return o

def cube(name,p,size,m,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,bevel)
def cyl(name,p,r,depth,m,vertices=48,rot=None,bevel=.006):
 bpy.ops.mesh.primitive_cylinder_add(vertices=min(vertices,24 if r<.2 else 36),radius=r,depth=depth,location=p);o=bpy.context.object
 if rot:o.rotation_euler=rot
 return finish(o,name,m,bevel)
def torus(name,p,r,t,m,rot=None):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=32,minor_segments=6,location=p);o=bpy.context.object
 if rot:o.rotation_euler=rot
 return finish(o,name,m)
def lathe(name,profile,m,n=64):
 n=min(n,64 if max(r for r,z in profile)>1 else 32)
 vs=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z)for r,z in profile for i in range(n)];fs=[]
 for j in range(len(profile)-1):
  for i in range(n):k=j*n+i;kk=j*n+(i+1)%n;fs.append((k,kk,kk+n,k+n))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,m)
def tube(name,points,r,m):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=16;curve.bevel_depth=r;curve.bevel_resolution=2;curve.resolution_u=16
 sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
 for v,p in zip(sp.points,points):v.co=(*p,1)
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,m)
def group(name):
 global parent
 parent=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(parent);return parent

def bolt(p,r=.035,length=.07,rotation=None):
 cyl('Hex bolt',p,r,length,edge,6,rotation,.003)

def pack_group(g):
 # Merge by material, preserving state groups while avoiding hundreds of draw calls.
 for m in [bronze,steel,edge,red,black,stone,gold]:
  objects=[o for o in list(g.children) if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:
   o.select_set(True);bpy.context.view_layer.objects.active=o
   for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=g.name+'_'+m.name
  # UVs for weathering maps, no material-generated nodes lost on GLB export.
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')

def export(name,groups):
 for g in groups:pack_group(g)
 bpy.ops.object.select_all(action='DESELECT')
 for g in groups:
  g.select_set(True)
  for o in g.children:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)

# Water valve with true hollow fracture, broad flange, cast housing and a spoked wheel.
static=group('ValveStatic')
cube('Plinth',(0,0,.065),(.7,.64,.13),steel,.035)
for x in [-.265,.265]:
 for y in [-.23,.23]:
  cyl('Anchor washer',(x,y,.14),.062,.017,steel);bolt((x,y,.17),.045,.065)
lathe('Foot flange',[(.17,.13),(.26,.13),(.285,.16),(.285,.21),(.255,.24),(.204,.255),(.185,.31),(.185,.62),(.193,.65),(.193,.68),(.163,.68),(.163,.3),(.17,.13)],bronze)
for i in range(8):a=i*math.tau/8;bolt((.245*math.cos(a),.245*math.sin(a),.245),.028,.05)
for z in [.31,.60]:torus('Cast seam',(0,0,z),.187,.013,edge)
# Wheel axle projects toward viewer (-Y in Blender, +Z in game).
cyl('Side gate housing',(0,-.18,.46),.115,.14,bronze,48,(math.pi/2,0,0))
cyl('Wheel threaded spindle',(0,-.29,.46),.032,.2,edge,32,(math.pi/2,0,0))
for j in range(6):torus('Spindle thread',(0,-.24-j*.017,.46),.034,.008,edge,(math.pi/2,0,0))
torus('Enamel hand wheel',(0,-.4,.46),.255,.032,red,(math.pi/2,0,0))
for i in range(5):
 a=i*math.tau/5
 tube('Curved wheel spoke',[(.045*math.cos(a),-.4,.46+.045*math.sin(a)),(.13*math.cos(a+.14),-.39,.46+.13*math.sin(a+.14)),(.23*math.cos(a+.08),-.4,.46+.23*math.sin(a+.08))],.018,red)
cyl('Wheel hub',(0,-.4,.46),.057,.065,red,32,(math.pi/2,0,0));bolt((0,-.44,.46),.03,.025,(math.pi/2,0,0))
cube('Cast label',(0,.186,.43),(.19,.025,.095),edge,.009)
for x in [-.07,.07]:bolt((x,.205,.43),.012,.018,(math.pi/2,0,0))
intact=group('ValveIntact')
lathe('Upper pipe',[(.193,.68),(.193,.89),(.2,.92),(.18,.95),(.16,.95),(.16,.68),(.193,.68)],bronze)
# Smooth 90-degree cast elbow, closed by a bolted service cap in normal state.
points=[(.20*(1-math.cos(i*math.pi/2/24)),0,.91+.20*math.sin(i*math.pi/2/24))for i in range(25)]
tube('Cast elbow',points,.185,bronze)
cyl('Service cap',(.24,0,1.11),.22,.075,steel,48,(0,math.pi/2,0))
for i in range(8):a=i*math.tau/8;bolt((.285,.18*math.cos(a),1.11+.18*math.sin(a)),.025,.06,(0,math.pi/2,0))
broken=group('ValveBroken')
# Irregular open rim with inner wall, intentionally not a flat torus.
n=64;profile=[];vs=[]
for row in range(4):
 for i in range(n):
  a=i*math.tau/n;r=.193 if row<2 else .158;z=.655 if row in [0,3] else .735+.035*math.sin(a*7)+.025*math.cos(a*11)
  vs.append((r*math.cos(a),r*math.sin(a),z))
fs=[]
for row in range(3):
 for i in range(n):fs.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
me=bpy.data.meshes.new('Torn pipe');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Jagged bronze fracture',me);bpy.context.collection.objects.link(o);finish(o,'Jagged bronze fracture',bronze,.001)
# The broken cap remains alongside the base, rather than disappearing.
cyl('Dislodged service cap',(.28,.19,.24),.22,.075,steel,48,(0,.6,.2))
for i in range(5):a=i*math.tau/5;bolt((.28+.17*math.cos(a),.19+.17*math.sin(a),.29),.026,.05)
export('foundry-valve',[static,intact,broken])
# Reservoir shell, modular refractory blocks, rolled steel cap, safety rails and a real bent feed.
reservoir=group('Reservoir')
R=2.35
lathe('Reservoir footing',[(R-.13,0),(R+.18,0),(R+.21,.09),(R+.17,.15),(R-.13,.15),(R-.13,0)],steel,128)
for row in range(3):
 for i in range(32):
  a=(i+.5*(row%2))*math.tau/32
  o=cube('Refractory block',(R*math.cos(a),R*math.sin(a),.22+row*.19),(.45,.25,.18),stone,.018);o.rotation_euler.z=a+math.pi/2
lathe('Rolled rim',[(2.17,.65),(2.16,.75),(2.2,.79),(2.48,.79),(2.52,.75),(2.52,.67),(2.48,.64),(2.2,.64),(2.17,.65)],steel,128)
for i in range(48):a=i*math.tau/48;bolt((2.39*math.cos(a),2.39*math.sin(a),.8),.027,.03)
for i in range(12):
 a=i*math.tau/12;o=cube('Iron buttress',(2.45*math.cos(a),2.45*math.sin(a),.42),(.17,.2,.72),steel,.025);o.rotation_euler.z=a
 for z in [.15,.7]:cyl('Rib rivet',(2.57*math.cos(a),2.57*math.sin(a),z),.035,.025,edge,12,(0,math.pi/2,a))
# A short guarded service segment, not a ring blocking the molten view.
for a in [math.pi*.8,math.pi*.95,math.pi*1.1]:
 cyl('Guard stanchion',(2.75*math.cos(a),2.75*math.sin(a),.5),.035,1,gold,16)
for z in [.5,.95]:tube('Curved guard rail',[(2.75*math.cos(math.pi*(.8+.3*i/24)),2.75*math.sin(math.pi*(.8+.3*i/24)),z)for i in range(25)],.032,gold)
export('foundry-reservoir',[reservoir])
feed=group('FeedPipe')
points=[(-4,0,5.75),(-2,0,5.75),(-.65,0,5.75)]+[(-.65+.65*math.sin(i*math.pi/2/32),0,5.1+.65*math.cos(i*math.pi/2/32))for i in range(1,33)]+[(0,0,3.6)]
tube('Cast feed bend',points,.27,steel)
# Exit is hollow, the hot interior sits inside and stream starts below the flange.
lathe('Outlet rim',[(.27,3.61),(.38,3.61),(.39,3.65),(.39,3.78),(.29,3.78),(.245,3.76),(.245,3.61),(.27,3.61)],bronze)
for i in range(10):a=i*math.tau/10;bolt((.33*math.cos(a),.33*math.sin(a),3.7),.03,.22)
for x in [-1.3,-3.3]:
 cyl('Feed flange',(x,0,5.75),.37,.12,steel,64,(0,math.pi/2,0))
 for i in range(10):a=i*math.tau/10;bolt((x,.32*math.cos(a),5.75+.32*math.sin(a)),.027,.2,(0,math.pi/2,0))
for x in [-1.7,-3.5]:
 torus('Feed suspension clamp',(x,0,5.75),.3,.025,bronze,(0,math.pi/2,0))
 for y in [-.23,.23]:tube('Feed hanger',[(x,y,5.92),(x,y,6.5)],.017,steel)
 cube('Hanger fixing plate',(x,0,6.5),(.18,.6,.06),steel,.01)
export('foundry-feed',[feed])
# Hero pendant, rolled hood, frosted dome, articulated cage and riveted collar.
lamp=group('Pendant')
lathe('Bell housing',[(.31,.86),(.36,.84),(.38,.73),(.48,.68),(.64,.57),(.82,.45),(.98,.25),(1.02,.18),(1.02,.12),(.95,.12),(.91,.24),(.76,.4),(.59,.51),(.43,.6),(.31,.68),(.31,.86)],steel,96)
for r,z in [(.34,.84),(.42,.65),(.82,.4),(1.02,.18)]:torus('Rolled housing seam',(0,0,z),r,.028,edge)
lathe('Suspension collar',[(0,.88),(.19,.88),(.24,.93),(.24,1.02),(.18,1.07),(.13,1.3),(0,1.3)],bronze)
for i in range(12):
 a=i*math.tau/12
 bolt((.95*math.cos(a),.95*math.sin(a),.27),.035,.07)
 for z in [.95,1.02]:bolt((.21*math.cos(a),.21*math.sin(a),z),.02,.06)
glass=mat('Foundry_LampGlass',(.9,.78,.55),.05,.25)
bsdf=glass.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Emission Color'].default_value=(1,.7,.32,1);bsdf.inputs['Emission Strength'].default_value=2
lathe('Frosted glass dome',[(0,-.12),(.35,-.1),(.62,-.04),(.82,.04),(.92,.14),(.92,.18),(0,.18)],glass,96)
for i in range(8):
 a=i*math.tau/8
 tube('Curved safety cage',[(math.cos(a)*r,math.sin(a)*r,z)for r,z in [(1.04,.25),(1.04,.02),(.84,-.13),(.5,-.23),(0,-.25)]],.023,steel)
torus('Dome protection ring',(0,0,-.1),.86,.023,steel)
export('foundry-pendant',[lamp])
# Chamfered window surround with a true opening, bolts, grille and projecting sill.
window=group('WallWindow')
def outline(w,h,c):return [(-w+c,-h),(w-c,-h),(w,-h+c),(w,h-c),(w-c,h),(-w+c,h),(-w,h-c),(-w,-h+c)]
outer=outline(.76,1.58,.16);inner=outline(.565,1.4,.07);verts=[]
for y in [-.06,.12]:
 for ring in [outer,inner]:verts.extend([(x,y,z)for x,z in ring])
faces=[]
for i in range(8):
 j=(i+1)%8
 faces.extend([(i,j,8+j,8+i),(16+i,24+i,24+j,16+j),(i,16+i,16+j,j),(8+i,8+j,24+j,24+i)])
me=bpy.data.meshes.new('Chamfered window surround');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Window cast frame',me);bpy.context.collection.objects.link(o);finish(o,'Window cast frame',steel,.012)
for x in [-.66,.66]:
 for z in [-1.25,-.7,0,.7,1.25]:bolt((x,.15,z),.028,.065,(math.pi/2,0,0))
for z in [-1.49,1.49]:
 for x in [-.4,0,.4]:bolt((x,.15,z),.028,.065,(math.pi/2,0,0))
for x in [-.22,.22]:tube('Window grille',[(x,.02,-1.4),(x,.02,1.4)],.018,steel)
for z in [-.55,.55]:tube('Grille crossbar',[(-.56,.02,z),(.56,.02,z)],.017,steel)
cube('Window sill',(0,.12,-1.54),(1.58,.44,.13),steel,.025)
export('foundry-window',[window])
# Bulkhead lantern, matching the ceiling pendant rather than a luminous rectangle.
lantern=group('WallLantern')
cube('Mounting plate',(0,-.15,0),(.32,.05,.78),steel,.035)
for z in [-.31,.31]:bolt((0,-.1,z),.027,.06,(math.pi/2,0,0))
lathe('Lantern cap',[(0,.23),(.19,.23),(.21,.26),(.21,.29),(.15,.36),(.07,.4),(0,.4)],steel)
lathe('Lantern base',[(0,-.34),(.11,-.34),(.2,-.28),(.2,-.24),(0,-.24)],steel)
cyl('Frosted wall lamp',(0,0,0),.132,.47,glass,48)
for i in range(8):a=i*math.tau/8;tube('Lantern cage',[(.17*math.cos(a),.17*math.sin(a),-.25),(.18*math.cos(a),.18*math.sin(a),.23)],.011,steel)
for z in [-.22,0,.22]:torus('Lantern cage ring',(0,0,z),.175,.012,steel)
export('foundry-wall-lantern',[lantern])
# Analog regulator cabinet. Gauge marks are actual geometry, not unreadable labels.
cabinet=group('ControlCabinet')
cube('Cabinet shell',(0,0,.63),(.94,.45,1.26),steel,.055)
cube('Inset cabinet door',(0,.242,.63),(.82,.035,1.1),bronze,.025)
for x in [-.4,.4]:
 for z in [.16,1.1]:bolt((x,.28,z),.027,.04,(math.pi/2,0,0))
cream=mat('Foundry_GaugePaper',(.63,.57,.43),0,.9)
for x in [-.22,.22]:
 cyl('Gauge body',(x,.30,.94),.177,.11,black,64,(math.pi/2,0,0))
 cyl('Gauge face',(x,.366,.94),.146,.008,cream,64,(math.pi/2,0,0),.001)
 torus('Gauge bezel',(x,.37,.94),.163,.014,edge,(math.pi/2,0,0))
 for j in range(25):
  a=-math.pi*.8+j*math.pi*1.6/24;length=.035 if j%4==0 else .017
  o=cube('Dial graduation',(x+math.sin(a)*.122,.375,.94+math.cos(a)*.122),(.008,.008,length),black,.001);o.rotation_euler.y=a
 o=cube('Gauge needle',(x+.022,.384,.98),(.009,.009,.125),red,.001);o.rotation_euler.y=.5
 cyl('Gauge spindle',(x,.39,.94),.017,.014,edge,16,(math.pi/2,0,0),.001)
for z in [.29,.34,.39,.44]:cube('Vent slot',(-.16,.27,z),(.29,.018,.014),black,.005)
cube('Door handle',(.25,.3,.43),(.035,.08,.19),edge,.012)
for x in [-.34,.34]:cube('Cabinet foot',(x,0,.045),(.16,.56,.09),steel,.015)
export('foundry-control',[cabinet])
# Preserve all editable source geometry and material names.
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'foundry-props.blend'))
print('FOUNDRY_EXPORT_OK')
