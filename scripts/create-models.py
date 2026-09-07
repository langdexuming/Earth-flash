"""Build the original Frontier RTS models in Blender. Run: blender -b --python scripts/create-models.py"""
import bpy, math, random, os
from mathutils import Vector
random.seed(18)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'art'), exist_ok=True)

def material(name, color, metallic=0, rough=.65, glow=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=rough
    if glow: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=glow
    return m
BLUE=material('Alliance / ceramic blue',(.12,.27,.43),.55,.38)
GOLD=material('Outpost / desert brass',(.49,.29,.105),.55,.46)
ARMOR=material('Titanium bevels',(.36,.43,.44),.65,.38)
DARK=material('Graphite tracks',(.055,.073,.075),.45,.55)
CYAN=material('Ion cyan',(.12,.74,1),.25,.28,2.5)
AMBER=material('Amber reactor',(1,.40,.055),.35,.24,2)
GLASS=material('Holographic blue',(.055,.38,.50),.6,.24,.4)
DIRT=material('Packed earth',(.34,.29,.18),0,.95)
PAD=material('Concrete foundation',(.24,.28,.27),.15,.9)
LEAF=[material('Pine '+str(i),c) for i,c in enumerate([(.075,.17,.115),(.105,.225,.13),(.15,.26,.14)])]
BARK=material('Bark',(.16,.105,.065)); ROCK=material('Granite',(.38,.39,.34),0,.95)
GRASS=[material('Meadow '+str(i),c) for i,c in enumerate([(.145,.205,.075),(.16,.22,.085),(.17,.23,.09),(.15,.21,.08)])]
WATER=material('Glacial water',(.025,.36,.39),.55,.23)

def clean():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def finish(obj, name, mat, bevel=0):
    obj.name=name; obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Manufactured edge', 'BEVEL'); mod.width=bevel;mod.segments=2
        obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj
def box(name,pos,size,mat,bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)
def cylinder(name,pos,r,depth,mat,vertices=12,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=pos)
    return finish(bpy.context.object,name,mat,.035)
def sphere(name,pos,scale,mat,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=pos);o=bpy.context.object;o.scale=scale
    return finish(o,name,mat)
def beam(name,a,b,r,mat,vertices=8):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,mat,vertices)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def ring(name,pos,r,mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,location=pos,major_radius=r,minor_radius=.045)
    return finish(bpy.context.object,name,mat)
def export(name):
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',export_apply=True,export_cameras=False,export_lights=False)
def tank(color=BLUE):
    for x in [-1.05,1.05]:
        box('Track assembly',(x,0,.43),(.65,2.8,.75),DARK,.15)
        for y in [-1,-.5,0,.5,1]:
            o=cylinder('Road wheel',(x+(-.33 if x<0 else .33),y,.42),.27,.10,ARMOR);o.rotation_euler[1]=math.pi/2
        box('Track fender',(x,0,.88),(.72,2.95,.18),color)
    box('Sloped hull',(0,0,.88),(1.8,2.5,.65),color,.22)
    box('Forward armor',(0,-1.05,1.1),(1.6,.55,.35),ARMOR,.12)
    cylinder('Turret collar',(0,.20,1.35),.7,.18,DARK)
    box('Turret',(0,.15,1.63),(1.48,1.35,.6),color,.18)
    beam('Main barrel',(0,-.45,1.65),(0,-2.1,1.65),.11,ARMOR)
    box('Muzzle',(0,-2.12,1.65),(.28,.36,.26),DARK)
    cylinder('Commander hatch',(.32,.28,1.98),.24,.07,ARMOR)
    beam('Antenna',(-.6,.62,1.8),(-.6,.62,2.6),.025,DARK)
    for x in [-.68,.68]:box('Headlamp',(x,-1.3,1.02),(.18,.04,.12),CYAN if color==BLUE else AMBER,.01)
    for y in [.55,.75,.95]:box('Engine vent',(0,y,1.25),(.8,.08,.08),DARK,.01)
def harvester():
    for x in [-.88,.88]:box('Crawler',(x,0,.35),(.55,2.25,.63),DARK,.12)
    box('Rover chassis',(0,0,.75),(1.65,2.25,.62),BLUE,.15)
    box('Cargo bin',(0,.55,1.25),(1.5,1,.7),ARMOR,.1)
    box('Pilot module',(0,-.5,1.25),(1.35,.85,.7),BLUE,.15)
    box('Cab windshield',(0,-.94,1.34),(.95,.035,.26),GLASS,.01)
    for x in [-.6,.6]:beam('Mining arm',(x,-.7,.8),(x,-1.7,.4),.13,ARMOR)
    o=cylinder('Cutter drum',(0,-1.7,.35),.32,1.55,DARK);o.rotation_euler[1]=math.pi/2
    for x in [-.45,0,.45]:sphere('Cargo crystal',(x,.55,1.7),(.2,.24,.36),AMBER)
def infantry():
    for x,y in [(-.55,.28),(.55,.28),(0,-.55)]:
        for dx in [-.16,.16]:
            box('Armored boot',(x+dx,y-.08,.13),(.23,.38,.24),DARK,.04)
            beam('Leg',(x+dx,y,.23),(x+dx,y,.8),.115,ARMOR)
        box('Body armor',(x,y,1.02),(.55,.35,.57),BLUE,.1)
        sphere('Helmet',(x,y,1.47),(.25,.23,.24),ARMOR,2)
        box('Visor',(x,y-.20,1.48),(.34,.08,.095),CYAN,.02)
        beam('Rifle',(x+.27,y-.12,1.06),(x+.27,y-.75,1.06),.07,DARK)
        beam('Arm',(x+.29,y,1.2),(x+.27,y-.3,1.0),.09,BLUE)
def headquarters(x,y,color,light):
    cylinder('HQ landing pad',(x,y,.12),6.8,.26,PAD,8)
    cylinder('HQ armored base',(x,y,1.15),5.7,2.05,color,8,r2=5.1)
    cylinder('Reactor deck',(x,y,2.50),4.6,.65,ARMOR,8,r2=4.4)
    cylinder('Reactor dish',(x,y,2.88),3.8,.13,DARK,32)
    for r in [2.6,3.4]:ring('Reactor light ring',(x,y,3.0),r,light)
    for i in range(8):
        a=i*math.pi/4;xx=x+5*math.cos(a);yy=y+5*math.sin(a)
        o=box('Buttress',(xx,yy,1.3),(1.2,1.8,2.6),ARMOR,.13);o.rotation_euler[2]=a
        o=box('Status panel',(x+5.35*math.cos(a),y+5.35*math.sin(a),1.45),(.12,.9,.3),light,.02);o.rotation_euler[2]=a
    sphere('Reactor core',(x,y,4.15),(1.2,1.2,1.2),light,2)
    for z,r in [(3.3,1.3),(4.15,1.65),(4.9,1.3)]:ring('Holographic orbit',(x,y,z),r,light)
    box('Main gate',(x,y-5.15,.95),(2.3,.3,1.8),DARK)
def hangar(x,y,color):
    box('Hangar foundation',(x,y,.14),(8,6.5,.28),PAD,.2)
    box('Hangar hull',(x,y,1.65),(6.7,5.3,3),color,.45)
    box('Roof plating',(x,y,3.22),(5.7,4.3,.25),ARMOR,.18)
    box('Hangar door',(x,y-2.7,1.25),(3.5,.08,2.3),DARK,.1)
    for i in [-2,-1,0,1,2]:box('Door seam',(x+i*.6,y-2.76,1.25),(.05,.02,2.1),ARMOR,.01)
    for dx in [-2.4,2.4]:box('Corner light',(x+dx,y-2.72,2.25),(.2,.1,.45),CYAN if color==BLUE else AMBER)
    for dy in [-1,0,1]:box('Roof rib',(x,y+dy,3.45),(4,.15,.12),DARK,.02)
def factory(x,y):
    box('Factory slab',(x,y,.13),(10,7,.25),PAD)
    for dx in [-4,4]:box('Gantry tower',(x+dx,y,2.8),(.7,.8,5.4),BLUE)
    box('Gantry beam',(x,y,5.6),(8.6,1,.6),ARMOR)
    box('Hoist',(x+1,y,5.1),(1.3,1.2,.6),GOLD)
    beam('Hoist cable',(x+1,y,4.8),(x+1,y,2.4),.035,DARK)
    for dx in [-2,0,2]:box('Supply container',(x+dx,y+1,.85),(1.7,2.6,1.4),BLUE,.09)
def tree(x,y,s):
    cylinder('Pine trunk',(x,y,s*1.1),.12*s,s*2.2,BARK,6)
    for z,r in [(1.7,1.1),(2.35,.85),(2.9,.6)]:cylinder('Pine canopy',(x,y,z*s),r*s,1.7*s,random.choice(LEAF),7,r2=0)
def terrain():
    # A depressed northwestern lake basin cut into the terrain, with a sandy shoreline.
    verts=[]; faces=[]; nx,ny=88,60
    for j in range(ny+1):
        y=-40+j*80/ny
        for i in range(nx+1):
            x=-70+i*140/nx
            lake=((x+56)/35)**2+((y-39)/27)**2
            h=-.55 if lake<.91 else -.2 if lake<1 else .05
            if lake>1.05:h+=.12*math.sin(x*.21)*math.cos(y*.3)
            verts.append((x,y,h))
    for j in range(ny):
        for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    mesh=bpy.data.meshes.new('Ground topology');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Meadow and shore',mesh);bpy.context.collection.objects.link(o)
    for m in GRASS+[DIRT]:mesh.materials.append(m)
    for p in mesh.polygons:
        x,y,_=p.center;lake=((x+56)/35)**2+((y-39)/27)**2
        p.material_index=4 if .93<lake<1.12 else random.choices([0,1,2,3],[6,1,1,2])[0]
    box('Landmass',(0,0,-1.65),(140,80,2),DIRT,.5)
    box('Lake water',(-47,32,-.20),(45,16,.05),WATER,0)
    # Lake polygon follows the inset shoreline instead of extending over the meadow.
    bpy.data.objects.remove(bpy.data.objects['Lake water'],do_unlink=True)
    v=[(-56,39,-.19)]+[(-56+34*math.cos(a*2*math.pi/64),39+26*math.sin(a*2*math.pi/64),-.19) for a in range(64)]
    v=[(max(-69.7,min(69.7,x)),max(-39.7,min(39.7,y)),z) for x,y,z in v]
    me=bpy.data.meshes.new('Water surface');me.from_pydata(v,[],[(0,i+1,(i+1)%64+1) for i in range(64)]);me.materials.append(WATER)
    ob=bpy.data.objects.new('Lake',me);bpy.context.collection.objects.link(ob)
    # Broad diagonal supply road.
    pts=[(-60,-36),(-40,-24),(-21,-13),(0,-1),(20,10),(43,26),(64,30)]
    vs=[]
    for x,y in pts:vs.extend([(x,y-1.7,.23),(x,y+1.7,.23)])
    me=bpy.data.meshes.new('Road ribbon');me.from_pydata(vs,[],[(i*2,i*2+2,i*2+3,i*2+1) for i in range(len(pts)-1)]);me.materials.append(DIRT)
    ob=bpy.data.objects.new('Supply road',me);bpy.context.collection.objects.link(ob)
    for i in range(900):
        x=random.uniform(-67,67);y=random.uniform(-37,37)
        lake=((x+56)/35)**2+((y-39)/27)**2
        edge=abs(x)>54 or y>31 or y<-32 or (x<-43 and y>0)
        if edge and lake>1.16 and not(x>40 and y>16):tree(x,y,random.uniform(.8,1.65))
    for i in range(52):
        x=random.uniform(-65,65);y=random.uniform(-37,37)
        if ((x+56)/35)**2+((y-39)/27)**2<1.1:continue
        if abs(x)<48 and abs(y)<27:continue
        s=random.uniform(.45,1.65);sphere('Granite outcrop',(x,y,s*.4),(s,s*.8,s*.8),ROCK,1)
    headquarters(-44.6,-23.2,BLUE,CYAN);headquarters(47.5,25,GOLD,AMBER)
    hangar(-54,-8,BLUE);hangar(-43,0,BLUE);hangar(60,11,GOLD);hangar(34,32,GOLD)
    factory(-27,-29)
    for x in [17,18.7,20,16.7,19.5]:
        y=2+random.uniform(-1.1,1.1);h=random.uniform(1.7,3.8)
        ob=cylinder('Amber crystal',(x,y,h/2),.64,h,AMBER,5,r2=.1);ob.rotation_euler[1]=random.uniform(-.3,.3)
    cylinder('Mining site',(18.3,2,.12),3.5,.15,ROCK,9)
    box('Landing apron',(-7,-31,.14),(17,10,.2),PAD,.15)
    for x in [-14,-.5]:
        for y in [-34,-32,-30,-28]:box('Landing stripe',(x,y,.27),(.13,1,.03),ARMOR,0)

clean();tank();export('tank')
clean();tank(GOLD);export('enemy')
clean();harvester();export('harvester')
clean();infantry();export('infantry')
clean();terrain();export('environment')
# The editable Blender source contains the full set staged in the scene.
for type,x,y in [('tank',-15,0),('tank',-10,-6),('infantry',2,-8),('harvester',-22,-12)]:
    before=set(bpy.data.objects)
    {'tank':tank,'infantry':infantry,'harvester':harvester}[type]()
    for ob in set(bpy.data.objects)-before:ob.location.x+=x;ob.location.y+=y
bpy.ops.object.light_add(type='SUN',location=(0,0,30));bpy.context.object.rotation_euler=(.45,-.5,-.5);bpy.context.object.data.energy=3
bpy.ops.object.camera_add(location=(85,-110,105));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=154;bpy.context.scene.camera=cam
bpy.context.scene.world.color=(.28,.32,.38)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','frontier-rts.blend'))
print('FRONTIER_MODELS_COMPLETE')
