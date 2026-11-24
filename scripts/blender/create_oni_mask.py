"""ユーザー提供3面図を元にした鬼面。Blender 5.3、新規プロセスで実行。

生成対象はmask-oni-04のみ。既存マスクと猫耳は変更しない。
共通の曲面装甲生成・金具・材質はcreate_maskを再利用する。
"""
from pathlib import Path
from math import sin, cos, pi, sqrt, exp
import argparse
import sys
import bpy
import bmesh
from mathutils import Vector

SCRIPT = Path(__file__).resolve()
sys.path.insert(0, str(SCRIPT.parent))
import create_mask as armor

OUTPUT = SCRIPT.parents[2] / 'project-chrome/assets/models'
BLEND = OUTPUT / 'mask-oni-04.blend'
GLB = OUTPUT / 'mask-oni-04.glb'


def surface(x, z, offset=0):
    depth = .42 - .67 * (abs(x)/1.30)**2
    return Vector((x, -depth-offset, z))


def smooth_loop(points, steps=8):
    result = []
    for i, b in enumerate(points):
        a, c, d = points[i-1], points[(i+1)%len(points)], points[(i+2)%len(points)]
        for j in range(steps):
            t = j/steps
            result.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+
                (2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)
                for k in range(2)))
    return result


def mesh_object(name, vertices, faces, mat, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    armor.model.objects.link(obj)
    obj.parent = armor.root
    mesh.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = smooth
    return obj


def tube(name, points, mat, radius=.02, cyclic=False, smooth=True):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth, curve.bevel_resolution = radius, 3
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER' if smooth else 'POLY')
    if smooth:
        spline.bezier_points.add(len(points)-1)
        for point, coordinate in zip(spline.bezier_points, points):
            point.co = coordinate
            point.handle_left_type = point.handle_right_type = 'AUTO'
    else:
        spline.points.add(len(points)-1)
        for point, coordinate in zip(spline.points, points):
            point.co = (*coordinate, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    armor.model.objects.link(obj)
    obj.parent = armor.root
    curve.materials.append(mat)
    return obj


def ring(name, x, z, radius, mat, offset=.14, thickness=.014, start=0, end=2*pi):
    normal = armor.normal(x,z)
    tangent = Vector((1,0,0))
    tangent = (tangent-normal*tangent.dot(normal)).normalized()
    vertical = normal.cross(tangent).normalized()
    center = surface(x,z,offset)
    count = max(12, int(64*(end-start)/(2*pi)))
    points = [center + radius*(cos(a)*tangent + sin(a)*vertical)
              for a in [start+(end-start)*i/count for i in range(count+1)]]
    return tube(name, points, mat, thickness, end-start > 6.28, False)


def disk(name, x,z,radius,offset,thickness,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=thickness,
                                      location=surface(x,z,offset))
    obj = armor.own(bpy.context.object,name,mat)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = armor.normal(x,z).to_track_quat('Z','Y')
    armor.bevel(obj,.008,3)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def fang(name, x, z, length, radius, direction, ivory, front=.18, bend=0):
    """根元から先端へ曲がる牙。円錐primitiveではなく断面を絞った閉じたmesh。"""
    vertices, faces = [], []
    rows, sides = 18, 20
    for j in range(rows+1):
        t = j/rows
        center = surface(x + bend*t*t, z+direction*length*t, front+.10*sin(pi*t))
        r = radius * max(.008,(1-t)**.65) * (1+.13*sin(pi*t))
        for i in range(sides):
            angle = 2*pi*i/sides
            vertices.append(center+Vector((cos(angle)*r,sin(angle)*r*.82,0)))
    for j in range(rows):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple(rows*sides+i for i in range(sides))]
    obj=mesh_object(name,vertices,faces,ivory)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj


def inside(point, polygon):
    x,z=point; hit=False
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if (a[1]>z)!=(b[1]>z) and x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:
            hit=not hit
    return hit


def create():
    scene = bpy.data.scenes.new('HAL208 • ONI 04 workshop')
    bpy.context.window.scene = scene
    armor.model = bpy.data.collections.new('ONI • shell teeth grille mechanisms')
    scene.collection.children.link(armor.model)
    armor.root = bpy.data.objects.new('MaskRoot',None)
    armor.model.objects.link(armor.root)
    armor.position = surface
    shell=armor.material('MaskShell',(.022,.025,.028),.40,.50)
    bevelmat=armor.material('OniRaisedArmor',(.035,.039,.043),.42,.46)
    rubber=armor.material('OniRecess',(.003,.004,.005),.05,.72)
    hardware=armor.material('OniMachinedMetal',(.16,.18,.19),.82,.28)
    grille=armor.material('OniGrille',(.045,.052,.055),.72,.38)
    cablemat=armor.material('OniCable',(.022,.026,.029),.65,.42)
    ivory=armor.material('OniCeramicTeeth',(.71,.66,.53),.06,.27)
    led=armor.material('MaskLED',(.55,.001,.002),.0,.36,1.4)
    lens=armor.material('OniSensorLens',(.12,.004,.008),.55,.19)
    armor.hardware,armor.rubber,armor.ink=hardware,rubber,hardware
    outer=smooth_loop([(0,1.05),(.38,.80),(.84,.79),(1.15,1.08),(1.28,.68),
                      (1.26,.10),(1.13,-.48),(.70,-.99),(0,-1.12),
                      (-.70,-.99),(-1.13,-.48),(-1.26,.10),(-1.28,.68),(-1.15,1.08),(-.84,.79),(-.38,.80)])
    mouth=smooth_loop([(0,.10),(.27,.14),(.48,.27),(.70,.31),(.85,.18),
                      (.81,-.18),(.68,-.49),(.39,-.78),(0,-.69),
                      (-.39,-.78),(-.68,-.49),(-.81,-.18),(-.85,.18),(-.70,.31),(-.48,.27),(-.27,.14)])
    n=len(outer)
    # 実際の口の開口を持つ連続外殻。裏側にも厚みがあり、顔に入る空洞を残す。
    vertices=[]; faces=[]
    for t in [0,.08,.25,.5,.75,.92,1]:
        for a,b in zip(outer,mouth):
            x,z=(a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t)
            vertices.append(surface(x,z,.045+.075*sin(pi*t)))
    for j in range(6):
        for i in range(n):
            faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    obj=mesh_object('Continuous sculpted face shell',vertices,[tuple(reversed(face)) for face in faces],shell)
    solid=obj.modifiers.new('Armor wall thickness','SOLIDIFY');solid.thickness=.055
    armor.bevel(obj,.012,3)
    tube('Outer rolled armor edge',[surface(x,z,.07) for x,z in outer],bevelmat,.022,True,False)
    # 口枠は前へ盛り上がり、網と牙はそれより奥へ入る。
    tube('Mouth deep shadow gasket',[surface(x,z,.10) for x,z in mouth],rubber,.091,True,False)
    tube('Sculpted mouth rim',[surface(x,z,.18) for x,z in mouth],bevelmat,.055,True,False)
    inset=[(x*.96,-.23+(z+.23)*.92) for x,z in mouth]
    armor.plate('Dark mouth cavity back',inset,rubber,-.16,.025,9)
    # 実際の六角金網。周囲の開口へ収め、中央線も分断しない。
    radius=.073; segments=set()
    for row in range(-8,8):
        for col in range(-9,10):
            cx=sqrt(3)*radius*(col+.5*(row%2));cz=-.24+1.5*radius*row
            points=[(cx+radius*cos(pi/6+i*pi/3),cz+radius*sin(pi/6+i*pi/3)) for i in range(6)]
            for a,b in zip(points,points[1:]+points[:1]):
                if not (inside(a,mouth) and inside(b,mouth)):continue
                key=tuple(sorted((tuple(round(v,5) for v in a),tuple(round(v,5) for v in b))))
                if key in segments:continue
                segments.add(key)
                tube('Honeycomb wire %03d'%len(segments),[surface(*a,-.035),surface(*b,-.035)],grille,.0075,False,False)
    # 波形の口ひげに相当する独立装甲。黒い溝を挟んで二重の厚い稜線を作る。
    for sign,side in [(-1,'Left'),(1,'Right')]:
        def path(coords,offset):return [surface(sign*x,z,offset) for x,z in coords]
        brow=[(.02,.40),(.22,.37),(.43,.48),(.61,.44),(.76,.32),(.91,.42)]
        tube(side+' Moustache undercut',path(brow,.15),rubber,.102)
        tube(side+' Raised moustache ridge',path(brow,.235),bevelmat,.062)
        armor.plate(side+' Cheek layered armor',[(sign*x,z) for x,z in [(.84,.48),(1.19,.63),
            (1.26,.19),(1.12,-.43),(.66,-.94),(.42,-.83),(.79,-.43),(.96,-.07)]],bevelmat,.085,.045,9)
        jawpath=[(.83,-.31),(.90,-.43),(.75,-.64),(.59,-.80),(.39,-.92),(.14,-.94)]
        tube(side+' Jaw recess',path(jawpath,.13),rubber,.055)
        tube(side+' Jaw armor crest',path(jawpath,.19),bevelmat,.025)
        # 斜めの赤いスリット。ゴムの受け皿と発光面を別の厚みで配置。
        for number,coords in enumerate([
            [(.73,.67),(.99,.76),(.95,.67),(.78,.61)],
            [(.89,-.36),(.95,-.44),(.75,-.55),(.76,-.49)],
            [(.47,-.91),(.61,-.88),(.55,-.98),(.39,-1.01)]]):
            center=(sum(x for x,z in coords)/4,sum(z for x,z in coords)/4)
            expanded=[(sign*(center[0]+(x-center[0])*1.22),center[1]+(z-center[1])*1.4) for x,z in coords]
            armor.plate(side+' LED socket '+str(number),expanded,rubber,.18,.025,3)
            armor.plate(side+' Red slit '+str(number),[(sign*x,z) for x,z in coords],led,.20,.012,3)
            tube(side+' LED recessed lip '+str(number),[surface(x,z,.225) for x,z in expanded],bevelmat,.012,True,False)
        # 上・中・下の三つの円形機構。側頭側へ角度を付けた同心円の部品。
        for number,(x,z,r) in enumerate([(1.115,.66,.14),(1.045,.27,.12),(1.075,-.22,.205)]):
            x*=sign;prefix=side+' Sensor '+str(number)
            disk(prefix+' gasket',x,z,r*1.16,.15,.055,rubber)
            disk(prefix+' bezel',x,z,r,.195,.045,hardware)
            ring(prefix+' outer rim',x,z,r*.90,hardware,.225,.012)
            disk(prefix+' inset',x,z,r*.77,.23,.02,rubber)
            ring(prefix+' machined ring',x,z,r*.67,hardware,.252,.012)
            disk(prefix+' red glass',x,z,r*.50,.253,.022,lens)
            if number<2:
                disk(prefix+' emissive core',x,z,r*.19,.272,.018,led)
                ring(prefix+' core highlight',x,z,r*.31,hardware,.275,.005)
            else:
                disk(prefix+' domed hub',x,z,r*.39,.276,.045,bevelmat)
                for index in range(3):ring(prefix+' red rotor '+str(index),x,z,r*.72,led,.27,.012,index*2*pi/3+.12,index*2*pi/3+1.13)
            for j in range(8):
                angle=2*pi*j/8
                armor.bolt(prefix+' micro screw '+str(j),x+cos(angle)*r*.86,z+sin(angle)*r*.86,.234,.008)
        # 下顎ケーブル：複数の平行管、蛇腹リング、留め金を独立部品にする。
        for channel in range(2):
            coords=[(1.02,-.49),(.96,-.61),(.78,-.69),(.58,-.81),(.49,-.93)]
            coords=[(x,z-channel*.045) for x,z in coords]
            tube(side+' Braided conduit '+str(channel),path(coords,.09),cablemat,.021)
            for j in range(24):
                t=j/23; x=1.01-.50*t;z=-.51-.42*t-channel*.045
                # 溝の周期は線で実在させる。
                tube(side+' Conduit rib %d-%d'%(channel,j),path([(x-.011,z+.012),(x+.011,z-.012)],.111),hardware,.0035,False,False)
        armor.bolt(side+' Jaw fastener',sign*.67,-.92,.18,.020)
        armor.bolt(side+' Upper fastener',sign*1.12,.96,.14,.022)
        # 上端のストラップタブ。穴はBooleanで本当に貫通する。
        tab=armor.box(side+' Strap lug',surface(sign*1.25,.99,.02),(.23,.08,.18),bevelmat,.025)
        armor.apply_geometry(tab)
        cutter=armor.box('Lug hole tool',surface(sign*1.27,.99,.02),(.085,.4,.065),rubber,.027)
        armor.apply_geometry(cutter)
        bpy.context.view_layer.objects.active=tab
        mod=tab.modifiers.new('Open strap slot','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        # 大きい4本の牙は曲率を持たせ、口枠の内側から伸ばす。
        fang(side+' Upper canine',sign*.54,.29,.57,.093,-1,ivory,.07,-sign*.07)
        fang(side+' Lower canine',sign*.55,-.65,.30,.078,1,ivory,.13,-sign*.045)
    for j,x in enumerate([-.35,-.235,-.118,0,.118,.235,.35]):
        fang('Upper incisor %02d'%j,x,.10+.14*abs(x),.205+.035*(1-abs(x)),.049,-1,ivory,.09,-x*.05)
        fang('Lower incisor %02d'%j,x,-.69-.25*abs(x),.18,.044,1,ivory,.13,-x*.04)
    # 鼻のパッチ：鼻梁から丸い鼻先へ連続した曲面を作り、鼻孔を切り抜く。
    vertices=[];faces=[]
    rows,columns=30,36
    for j in range(rows+1):
        z=.23+.85*j/rows
        t=j/rows
        halfwidth=.10+.25*sin(pi*(.16+.82*t))**.9
        for i in range(columns+1):
            u=2*i/columns-1;x=u*halfwidth
            bulge=.38*(1-u*u)**.85*exp(-((z-.45)/.29)**2)
            vertices.append(surface(x,z,.065+bulge))
    for j in range(rows):
        for i in range(columns):
            a=j*(columns+1)+i;faces.append((a,a+1,a+columns+2,a+columns+1))
    nose=mesh_object('Sculpted nose bridge and tip',vertices,faces,bevelmat)
    solid=nose.modifiers.new('Nose shell thickness','SOLIDIFY');solid.thickness=.05
    armor.apply_geometry(nose)
    for sign,side in [(-1,'Left'),(1,'Right')]:
        center=surface(sign*.20,.40,.37)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=center)
        cutter=armor.own(bpy.context.object,'Nostril cutter',rubber)
        cutter.scale=(.115,.24,.073);cutter.rotation_euler.y=sign*-.30
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bpy.context.view_layer.objects.active=nose
        mod=nose.modifiers.new(side+' open nostril','BOOLEAN');mod.object=cutter;mod.operation='DIFFERENCE'
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        # 穴の奥の黒い壁。画像を貼らずに鼻孔の深さを作る。
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=surface(sign*.20,.40,.13))
        cup=armor.own(bpy.context.object,side+' Nostril interior',rubber);cup.scale=(.14,.035,.085)
    armor.bevel(nose,.006,3)
    # 中央の顎用フィルターと格子。
    armor.box('Chin filter gasket',surface(0,-.97,.13),(.34,.09,.30),rubber,.045)
    armor.box('Chin filter frame',surface(0,-.97,.18),(.28,.07,.25),hardware,.035)
    armor.box('Chin filter mesh',surface(0,-.97,.225),(.225,.025,.20),rubber,.023)
    for j in range(17):
        tube('Chin filter rib %02d'%j,[surface(-.098,-.882-j*.01,.245),surface(.098,-.882-j*.01,.245)],grille,.0025,False,False)
    for x in [-.25,.25]:armor.bolt('Chin lock screw '+str(x),x,-1.065,.13,.019)
    # 外形を既存マスクと共通の寸法・顎原点へ正規化し、同じ顔追従を利用可能にする。
    bpy.context.view_layer.update()
    corners=[obj.matrix_world @ Vector(corner) for obj in armor.model.objects if obj.type in {'MESH','CURVE'} for corner in obj.bound_box]
    minz,maxz=min(p.z for p in corners),max(p.z for p in corners)
    width=max(p.x for p in corners)-min(p.x for p in corners)
    armor.root.scale=(2.536/width,1,2.05/(maxz-minz))
    armor.root.location.z=-.856-minz*armor.root.scale.z
    armor.root['hal208_model']='ONI 04 / user reference 2026-11-23 20:23:45'
    armor.root['hal208_chin_y_after_gltf']=-.856
    setup_studio(scene)
    for obj in scene.objects:obj.select_set(obj.name in armor.model.objects)
    bpy.context.view_layer.objects.active=armor.root
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,use_active_scene=True,
                             export_yup=True,export_apply=True,export_extras=True)
    return scene


def setup_studio(scene):
    world=bpy.data.worlds.new('Oni neutral studio');world.use_nodes=True
    bg=next(node for node in world.node_tree.nodes if node.type=='BACKGROUND')
    bg.inputs[0].default_value=(.30,.32,.35,1);bg.inputs[1].default_value=.45;scene.world=world
    stage=bpy.data.collections.new('STUDIO • excluded from GLB');scene.collection.children.link(stage)
    for name,loc,energy,size in [('Key',(-3,-4,5),650,3.5),('Fill',(4,-3,2),430,3),('Rim',(0,3,4),850,3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);stage.objects.link(obj);obj.location=loc
        obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Oni product camera');camera=bpy.data.objects.new('Oni product camera',data)
    stage.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=3.9
    camera.location=(0,-6,.3);camera.rotation_euler=(Vector((0,0,-.05))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
    scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_distance=4.5
                area.spaces.active.region_3d.view_location=(0,0,-.1)
                area.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
                area.spaces.active.shading.color_type='MATERIAL'


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--replace',action='store_true');parser.add_argument('--preview-dir',type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if bpy.data.filepath:raise RuntimeError('新規Blenderから実行してください。')
    if (BLEND.exists() or GLB.exists()) and not args.replace:raise RuntimeError('既存出力を上書きする場合は--replaceが必要です。')
    scene=create()
    if args.preview_dir:
        args.preview_dir.mkdir(parents=True,exist_ok=True)
        for name,loc in [('front',(0,-6,.15)),('three-quarter',(3,-5,1.2)),('side',(5,-1.7,.6))]:
            scene.camera.location=loc;scene.camera.rotation_euler=(Vector((0,0,-.08))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(args.preview_dir/('oni-'+name+'.png'));bpy.ops.render.render(write_still=True)
    print('ONI MODEL SAVED:',BLEND,GLB)
