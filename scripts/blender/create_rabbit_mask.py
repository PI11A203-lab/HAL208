"""ユーザー提供4面図の機械式ウサギ顔マスク。既存の耳・ONIとは別の原本。

Blender 5.3、新規プロセスから実行。編集用blendと同じ縮尺の4方向レンダーを保存する。
"""
from pathlib import Path
from math import pi,sin,cos,atan2,hypot,sqrt,exp
import argparse
import sys
import bpy
import bmesh
from mathutils import Vector,Matrix,Quaternion

SCRIPT=Path(__file__).resolve()
sys.path.insert(0,str(SCRIPT.parent))
import create_mask as armor
import create_oni_mask as parts
from refine_oni_mask import radial_loop

OUTPUT=SCRIPT.parents[2]/'project-chrome/assets/models'
BLEND=OUTPUT/'mask-rabbit-04.blend'
surface=parts.surface


def finish_materials():
    # 弱いサテン反射で頬・鼻・装甲の曲率を見せる。LEDの発光量は変えない。
    for name,roughness,coat in [('MaskShell',.36,.10),('RabbitArmor',.34,.10),
            ('RabbitIvoryCheeks',.40,.12),('RabbitIvoryTeeth',.34,.10),('RabbitNosePink',.32,.14)]:
        mat=bpy.data.materials[name]
        node=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        node.inputs['Roughness'].default_value=roughness
        node.inputs['Coat Weight'].default_value=coat
        node.inputs['Coat Roughness'].default_value=.34
        if name in {'MaskShell','RabbitArmor'}:
            node.inputs['Base Color'].default_value=(.88,.90,.92,1)


def closed_normals(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()


def open_path(points,steps=8):
    result=[]
    for i in range(len(points)-1):
        a,b,c,d=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for j in range(steps):
            t=j/steps
            result.append(tuple(.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+
                (-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(2)))
    return result+[points[-1]]


def ribbon_outline(path,width):
    left=[];right=[]
    for i,p in enumerate(path):
        a=Vector(path[max(0,i-1)]);b=Vector(path[min(len(path)-1,i+1)])
        tangent=(b-a).normalized();n=Vector((-tangent.y,tangent.x))*width/2
        left.append((p[0]+n.x,p[1]+n.y));right.append((p[0]-n.x,p[1]-n.y))
    return left+list(reversed(right))


def cut_y(target,outline,name,front=.7,back=-.5):
    n=len(outline)
    vertices=[surface(x,z,offset) for offset in [front,back] for x,z in outline]
    faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    tool=parts.mesh_object(name+' tool',vertices,faces,rubber,False);closed_normals(tool)
    armor.apply_geometry(target)
    bpy.context.view_layer.objects.active=target
    mod=target.modifiers.new(name,'BOOLEAN');mod.operation='DIFFERENCE';mod.object=tool
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(tool,do_unlink=True)


def side_plate(name,sign,outline,x,mat,thickness=.055):
    n=len(outline)
    vertices=[(sign*(x+layer),y,z) for layer in [-thickness/2,thickness/2] for y,z in outline]
    faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=parts.mesh_object(name,vertices,faces,mat,False);closed_normals(obj)
    armor.bevel(obj,.018,3)
    return obj


CHEEK_CENTER=(.575,.045)
CHEEK_OUTLINE=parts.smooth_loop([(.005,.29),(.22,.50),(.54,.60),(.86,.48),(1.055,.23),
    (1.07,-.045),(.95,-.29),(.73,-.48),(.48,-.49),(.25,-.34),(.025,-.13),(.005,.06)],10)


def boundary_radius(dx,dz):
    distance=hypot(dx,dz)
    if distance<1e-8:return 1
    direction=Vector((dx/distance,dz/distance));center=Vector(CHEEK_CENTER);hits=[]
    for aa,bb in zip(CHEEK_OUTLINE,CHEEK_OUTLINE[1:]+CHEEK_OUTLINE[:1]):
        a=Vector(aa)-center;b=Vector(bb)-center;edge=b-a
        determinant=direction.x*edge.y-direction.y*edge.x
        if abs(determinant)<1e-9:continue
        t=(a.x*edge.y-a.y*edge.x)/determinant
        u=(a.x*direction.y-a.y*direction.x)/determinant
        if t>0 and -1e-6<=u<=1+1e-6:hits.append(t)
    return min(hits) if hits else distance


def cheek_depth(x,z):
    x=abs(x);cx,cz=CHEEK_CENTER
    r=hypot(x-cx,z-cz)/boundary_radius(x-cx,z-cz)
    return -surface(x,z).y+.145+.295*max(0,1-r*r)**.68


def cheek(name,sign):
    count=len(CHEEK_OUTLINE);rows=20
    cx,cz=CHEEK_CENTER
    vertices=[Vector((sign*cx,-cheek_depth(cx,cz),cz))];faces=[]
    for row in range(1,rows+1):
        r=row/rows
        for ox,oz in CHEEK_OUTLINE:
            x=cx+(ox-cx)*r;z=cz+(oz-cz)*r
            depth=-surface(x,z).y+.145+.295*max(0,1-r*r)**.68
            vertices.append(Vector((sign*x,-depth,z)))
    for j in range(count):faces.append((0,1+j,1+(j+1)%count))
    for row in range(rows-1):
        start=1+row*count
        for j in range(count):faces.append((start+j,start+(j+1)%count,start+(j+1)%count+count,start+j+count))
    back_start=len(vertices)
    for x,z in CHEEK_OUTLINE:vertices.append(surface(sign*x,z,.045))
    back_center=len(vertices);vertices.append(surface(sign*cx,cz,.045))
    edge=1+(rows-1)*count
    for j in range(count):
        k=(j+1)%count
        faces.append((edge+j,edge+k,back_start+k,back_start+j))
        faces.append((back_center,back_start+k,back_start+j))
    obj=parts.mesh_object(name,vertices,faces,ivory);closed_normals(obj)
    # 3本の短い楕円溝。面の法線に合わせた工具で表層だけを切り取る。
    for index,(x,z,angle) in enumerate([(.79,.13,-.20),(.82,-.015,0),(.79,-.16,.45)]):
        x*=sign
        epsilon=.0001
        dx=Vector((2*epsilon,-cheek_depth(x+epsilon,z)+cheek_depth(x-epsilon,z),0)).normalized()
        up=Vector((0,-cheek_depth(x,z+epsilon)+cheek_depth(x,z-epsilon),2*epsilon)).normalized()
        normal=dx.cross(up).normalized()
        tangent=Quaternion(normal,sign*angle)@dx
        vertical=tangent.cross(normal).normalized()
        center=Vector((x,-cheek_depth(x,z),z))+normal*.010
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=center)
        tool=armor.own(bpy.context.object,name+' whisker cutter',ivory)
        tool.scale=(.078,.025,.018)
        tool.rotation_mode='QUATERNION';tool.rotation_quaternion=Matrix((tangent,normal,vertical)).transposed().to_quaternion()
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bpy.context.view_layer.objects.active=obj
        cut=obj.modifiers.new('Shallow whisker groove '+str(index),'BOOLEAN');cut.operation='DIFFERENCE';cut.object=tool
        bpy.ops.object.modifier_apply(modifier=cut.name);bpy.data.objects.remove(tool,do_unlink=True)
    obj['part']='separate domed ivory cheek with three shallow cuts'
    return obj


def curved_light(name,path,sign,target):
    path=open_path(path,7)
    outside=ribbon_outline(path,.095);inside=ribbon_outline(path,.043);n=len(outside)
    layers=[(outside,.038),(outside,.105),(inside,.105),(inside,.008)]
    vertices=[surface(sign*x,z,offset) for loop,offset in layers for x,z in loop]
    faces=[]
    for layer in range(4):
        for j in range(n):faces.append((layer*n+j,layer*n+(j+1)%n,((layer+1)%4)*n+(j+1)%n,((layer+1)%4)*n+j))
    housing=parts.mesh_object(name+' recessed channel',vertices,faces,raised,False);closed_normals(housing)
    armor.bevel(housing,.005,3)
    cut_y(target,[(sign*x,z) for x,z in inside],name+' opening')
    floor=armor.plate(name+' pastel LED',[(sign*x,z) for x,z in inside],led,.030,.013,3)
    floor['part']='LED below channel lip, not on top of armor'


def small_light(name,sign,x,z,w=.16):
    outer=[(sign*(x-w*.62),z-.037),(sign*(x+w*.62),z-.037),
           (sign*(x+w*.62),z+.037),(sign*(x-w*.62),z+.037)]
    inner=[(sign*(x-w*.5),z-.014),(sign*(x+w*.5),z-.014),
           (sign*(x+w*.5),z+.014),(sign*(x-w*.5),z+.014)]
    armor.plate(name+' socket',outer,rubber,.17,.02,3)
    armor.plate(name+' pink indicator',inner,led,.177,.009,3)


def create():
    global ivory,rubber,raised,led
    scene=bpy.data.scenes.new('HAL208 • Rabbit facial armor')
    bpy.context.window.scene=scene
    armor.model=bpy.data.collections.new('RABBIT • cheeks nose teeth frame hinges LED')
    scene.collection.children.link(armor.model)
    armor.root=bpy.data.objects.new('MaskRoot',None);armor.model.objects.link(armor.root)
    armor.position=surface
    shell=armor.material('MaskShell',(.026,.029,.032),.38,.52)
    raised=armor.material('RabbitArmor',(.040,.043,.047),.42,.47)
    rubber=armor.material('RabbitRecess',(.005,.006,.008),.02,.80)
    metal=armor.material('RabbitHardware',(.18,.18,.18),.72,.34)
    ivory=armor.material('RabbitIvoryCheeks',(.72,.66,.57),.02,.61)
    enamel=armor.material('RabbitIvoryTeeth',(.79,.73,.64),.02,.50)
    pink=armor.material('RabbitNosePink',(.70,.32,.34),.02,.46)
    led=armor.material('RabbitPastelLED',(.95,.31,.42),0,.50,.65)
    finish_materials()
    armor.hardware=metal;armor.rubber=rubber
    # 微細な塗装粒子はBlender原本のみに保持する。
    for mat in [shell,raised]:
        bsdf=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        noise=mat.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=340
        bump=mat.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.0012
        mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    outer=radial_loop([(0,.91),(.40,.92),(.81,.94),(1.19,1.03),(1.36,.81),(1.38,.30),
        (1.25,-.29),(.87,-.74),(.35,-.94),(0,-.97),(-.35,-.94),(-.87,-.74),
        (-1.25,-.29),(-1.38,.30),(-1.36,.81),(-1.19,1.03),(-.81,.94),(-.40,.92)],160)
    # 丸い顎の左右を直線の面取りに置換。中央の短い顎先は残す。
    clipped=[]
    for x,z in outer:
        if z<.90*abs(x)-1.35:
            # 内周と同じ放射方向を維持し、面取りで帯のquadが交差しないようにする。
            t=1.15/(.90*abs(x)-z-.20)
            x,z=x*t,-.20+(z+.20)*t
        clipped.append((x,z))
    outer=clipped
    opening=radial_loop([(0,.47),(.40,.55),(.82,.48),(1.11,.18),(1.05,-.17),(.82,-.44),
        (.47,-.60),(0,-.65),(-.47,-.60),(-.82,-.44),(-1.05,-.17),(-1.11,.18),(-.82,.48),(-.40,.55)],160)
    n=len(outer);vertices=[];faces=[]
    for t in [0,.15,.4,.7,1]:
        for a,b in zip(outer,opening):
            x,z=a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t
            vertices.append(surface(x,z,.04+.035*sin(pi*t)))
    for row in range(4):
        for j in range(n):faces.append((row*n+j,(row+1)*n+j,(row+1)*n+(j+1)%n,row*n+(j+1)%n))
    frame=parts.mesh_object('Charcoal continuous facial frame',vertices,faces,shell)
    solid=frame.modifiers.new('Real frame wall','SOLIDIFY');solid.thickness=.045
    armor.bevel(frame,.012,3)
    # 暗い内殻。頬の後ろと中央の隙間を閉じ、顔が入る後方は開けておく。
    armor.plate('Inner face backing',[(x*1.015,z) for x,z in opening],rubber,-.10,.025,8)
    cheek('Left ivory cheek',-1);cheek('Right ivory cheek',1)
    gum=armor.box('Ivory central gum bridge',(0,-.53,-.105),(.30,.09,.12),ivory,.045)
    for sign,side in [(-1,'Left'),(1,'Right')]:
        tooth=armor.box(side+' short front tooth',(sign*.083,-.605,-.255),(.151,.10,.24),enamel,.042)
        armor.apply_geometry(tooth)
        # 根元を奥に引き、頬曲面に寄せる。下端も前へ突き出しすぎない。
        for vertex in tooth.data.vertices:
            upper=(vertex.co.z+.12)/.24
            vertex.co.y+=.045*max(0,min(1,upper))
        for polygon in tooth.data.polygons:polygon.use_smooth=True
        tooth['part']='independent rounded incisor, root inside ivory gum'
        # 耳方向へ伸びる薄い二重フレーム。開口は部品間の実空間。
        upper=[(.025,.37),(.18,.66),(.83,.80),(.99,.94),(1.055,.90),(.99,.64),(.41,.48),(.20,.17)]
        lower=[(.02,-.15),(.58,.03),(.99,.26),(1.015,.42),(.57,.22),(.06,.025)]
        side_plate(side+' upper side underlay',sign,upper,1.175,rubber,.07)
        rail=side_plate(side+' upper side armor',sign,upper,1.225,raised,.045)
        side_plate(side+' lower side armor',sign,lower,1.235,raised,.055)
        side_plate(side+' rear mounting post',sign,[(.94,.28),(1.025,.31),(1.065,.90),(.99,.92)],1.19,shell,.06)
        side_plate(side+' inner diagonal brace',sign,[(.20,.10),(.34,.07),(.84,.62),(.72,.67)],1.18,shell,.055)
        # 後方の小さな実スロット。
        armor.apply_geometry(rail)
        bpy.ops.mesh.primitive_cube_add(size=1,location=(sign*1.225,.94,.785))
        tool=armor.own(bpy.context.object,'Side slot cutter',rubber);tool.scale=(.5,.115,.065)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        armor.bevel(tool,.020,3);armor.apply_geometry(tool)
        bpy.context.view_layer.objects.active=rail
        cut=rail.modifiers.new('Rear rectangular mounting slot','BOOLEAN');cut.operation='DIFFERENCE';cut.object=tool
        bpy.ops.object.modifier_apply(modifier=cut.name);bpy.data.objects.remove(tool,do_unlink=True)
        # 正面から見える上部装甲と短いピンク表示灯。
        armor.plate(side+' front upper armor',[(sign*x,z) for x,z in [(1.0,.48),(.83,.65),(1.02,.91),(1.32,.95),(1.32,.68),(1.19,.42)]],raised,.12,.048,7)
        small_light(side+' upper marker',sign,1.14,.76,.16)
        # 頬に一部埋まるヒンジ。独立した金属・ゴム・細いピンクリング。
        x=sign*1.155;z=.095
        parts.disk(side+' Hinge seat',x,z,.190,.055,.055,rubber)
        parts.disk(side+' Hinge metal bezel',x,z,.165,.098,.04,metal)
        parts.ring(side+' Hinge fine pink ring',x,z,.145,led,.126,.008)
        parts.disk(side+' Hinge inset',x,z,.128,.133,.025,rubber)
        parts.disk(side+' Hinge cap',x,z,.107,.153,.027,raised)
        parts.ring(side+' Hinge inner bevel',x,z,.111,metal,.17,.005)
        curved_light(side+' cheek light',[(1.16,.015),(1.115,-.19),(.975,-.395),(.79,-.555),(.60,-.64)],sign,frame)
        # 下端の別装甲を重ね、LED溝の端を挟む。
        armor.plate(side+' lower armor cap',[(sign*x,z) for x,z in [(.48,-.62),(.68,-.63),(.80,-.61),(.63,-.78),(.49,-.85),(.35,-.76)]],raised,.13,.05,3)
        small_light(side+' lower marker',sign,.60,-.76,.105)
        for index,(x,z,offset) in enumerate([(.92,.49,.19),(.62,-.62,.16),(1.075,.82,.20)]):
            armor.bolt(side+' Frame screw '+str(index),sign*x,z,offset,.018)
        # 頬の上端の小さい止めねじ。アイボリ面に直交させる。
        for index,(x,z) in enumerate([(.80,.47),(.90,.40)]):
            armor.bolt(side+' Cheek screw '+str(index),sign*x,z,cheek_depth(x,z)+.012+surface(x,z).y,.015)
    # 鼻：丸い逆三角形の閉じた立体。後部を頬へ埋め、前だけを柔らかく膨らませる。
    nose_outline=parts.smooth_loop([(-.20,.36),(-.16,.405),(.16,.405),(.20,.36),(.13,.245),(0,.155),(-.13,.245)],10)
    vertices=[(0,-.765,.32)];faces=[];n=len(nose_outline)
    for scale,front in [(.72,.752),(1,.695),(.94,.615)]:
        for x,z in nose_outline:vertices.append((x*scale,-front,.31+(z-.31)*scale))
    for j in range(n):faces.append((0,1+j,1+(j+1)%n))
    for row in range(2):
        a=1+row*n
        for j in range(n):faces.append((a+j,a+(j+1)%n,a+(j+1)%n+n,a+j+n))
    faces.append(tuple(1+2*n+j for j in range(n)))
    nose=parts.mesh_object('Soft pink triangular nose',vertices,faces,pink);closed_normals(nose)
    armor.bevel(nose,.005,3)
    smooth=nose.modifiers.new('Soft molded nose','SUBSURF');smooth.levels=2;smooth.render_levels=2
    # 鼻下の短い線と、頬に沿うW字の口線。
    stem=[(0,.16),(0,.09),(0,.02),(0,-.025)]
    parts.tube('Short nose-to-mouth line',[Vector((x,-(.585+.115*(z+.025)/.185),z)) for x,z in stem],rubber,.010)
    for sign,side in [(-1,'Left'),(1,'Right')]:
        path=open_path([(0,-.025),(.07,-.12),(.17,-.145),(.27,-.12),(.31,-.065)],10)
        parts.tube(side+' W smile line',[Vector((sign*x,-max(.585,cheek_depth(x,z)+.007),z)) for x,z in path],rubber,.0105,False,False)
    # 短く丸い顎の通気口。黒い裏板を残して実際の開口を作る。
    chin=armor.plate('Rounded chin armor',[(-.46,-.54),(.46,-.54),(.36,-.83),(.20,-.91),(-.20,-.91),(-.36,-.83)],raised,.11,.05,8)
    for index,(z,w) in enumerate([(-.65,.31),(-.715,.29)]):
        cut_y(chin,[(-w/2,z-.012),(w/2,z-.012),(w/2,z+.012),(-w/2,z+.012)],'Chin vent '+str(index))
    small_light('Central chin marker',1,0,-.835,.18)
    # 小さな内側の縦スリット。
    for sign in [-1,1]:
        armor.plate('Chin side recess '+str(sign),[(sign*.27,-.55),(sign*.30,-.54),(sign*.34,-.63),(sign*.31,-.64)],rubber,.13,.014,3)
    root=armor.root;root['hal208_model']='RABBIT 04 / separate editable facial mask'
    root['fixedArmorColor']='#ffffff'
    root['reference']='User supplied 2026-11-24 00:38:36, front expression and 45deg cheek volume'
    # 正面パネルを鼻中心で柔らかく折り、頬の外側は顔の側面へ後退させる。
    # 部品全体を同じ連続変形に通し、LEDと溝・前歯と頬の相対位置を保つ。
    for obj in list(root.children_recursive):
        if obj.type not in {'MESH','CURVE'}:continue
        for other in bpy.context.selected_objects:other.select_set(False)
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        if obj.type=='CURVE':bpy.ops.object.convert(target='MESH')
        armor.apply_geometry(obj)
        matrix=obj.matrix_world.copy();inverse=matrix.inverted()
        for vertex in obj.data.vertices:
            p=matrix@vertex.co
            p.y+=.32*(sqrt(p.x*p.x+.12*.12)-.12)-.14*exp(-(p.x/.38)**2)
            vertex.co=inverse@p
        closed_normals(obj);obj.data.update()
    root['facial_wrap']='soft central V: outer cheeks recede, nose projects forward'
    bpy.context.view_layer.update()
    corners=[obj.matrix_world@Vector(v) for obj in root.children_recursive if obj.type in {'MESH','CURVE'} for v in obj.bound_box]
    width=max(p.x for p in corners)-min(p.x for p in corners);minz=min(p.z for p in corners);maxz=max(p.z for p in corners)
    root.scale=(2.758/width,1,1.95/(maxz-minz));root.location.z=-.856-minz*root.scale.z
    root['chin_y_after_gltf']=-.856
    parts.setup_studio(scene)
    scene.render.resolution_x=1500;scene.render.resolution_y=1300;scene.cycles.samples=48
    scene.camera.data.ortho_scale=3.9
    for obj in scene.objects:obj.select_set(False)
    root.select_set(True);bpy.context.view_layer.objects.active=root
    target=Vector((0,.08,.12));scene.camera.location=(0,-7,.12)
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_distance=4.6;area.spaces.active.region_3d.view_location=target
                area.spaces.active.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
    bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    return scene


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--replace',action='store_true');parser.add_argument('--render-dir',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if bpy.data.filepath:raise RuntimeError('新規Blenderから実行してください。')
    if BLEND.exists() and not args.replace:raise RuntimeError('既存の兔マスク原本を上書きする場合は--replaceを明示してください。')
    scene=create();args.render_dir.mkdir(parents=True,exist_ok=True)
    target=Vector((0,.08,.12))
    for name,position in [('front',(0,-7,.12)),('left',(-7,.08,.12)),('right',(7,.08,.12)),('45deg',(5,-5,.12))]:
        scene.camera.location=position;scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(args.render_dir/('rabbit-mask-'+name+'.png'));bpy.ops.render.render(write_still=True)
    print('RABBIT FACE MASK SAVED:',BLEND)
