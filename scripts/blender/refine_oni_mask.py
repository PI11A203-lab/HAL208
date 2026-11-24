"""既存ONI .blendを開いて部品meshを改修し、別名の原本と4方向レンダーを保存。

新規生成ではなく、既存の外殻・鼻・歯・頬パネルのdataを置換し、機構を再配置する。
元ファイルはsaveしない。--replaceはこのスクリプトの出力だけを再作成する。
"""
from pathlib import Path
from math import sin, cos, pi, exp
import argparse
import hashlib
import sys
import bpy
import bmesh
from mathutils import Vector, Matrix

SCRIPT=Path(__file__).resolve()
sys.path.insert(0,str(SCRIPT.parent))
import create_oni_mask as oni
import create_mask as armor

ASSETS=SCRIPT.parents[2]/'project-chrome/assets/models'
SOURCE=ASSETS/'mask-oni-04.blend'
DESTINATION=ASSETS/'mask-oni-04-refined.blend'


def surface(x,z,offset=0):
    # 鼻脇の落ち込みと頬骨の隆起。輪郭を曲げるだけでなく正面からも陰影を作る。
    depth=.43-.77*(abs(x)/1.25)**2
    depth+=.105*exp(-((abs(x)-.79)/.22)**2-((z-.32)/.29)**2)
    depth-=.065*exp(-((abs(x)-.43)/.18)**2-((z-.43)/.20)**2)
    return Vector((x,-depth-offset,z))


def remove(obj):
    if obj:bpy.data.objects.remove(obj,do_unlink=True)


def replace_data(name, created):
    original=bpy.data.objects.get(name)
    if original is None:
        created.name=name
        return created
    original.data=created.data
    # 新しい輪郭に合わせた厚みを使い、適用済みの古いBooleanは引き継がない。
    original.modifiers.clear()
    for mod in created.modifiers:
        copied=original.modifiers.new(mod.name,mod.type)
        for prop in mod.bl_rna.properties:
            if prop.is_readonly or prop.identifier in {'name','type','rna_type'}:continue
            try:setattr(copied,prop.identifier,getattr(mod,prop.identifier))
            except (AttributeError,TypeError):pass
    remove(created)
    return original


def recalc(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()


def interpolate(points,x):
    """単調なX制御点間の滑らかな補間。左右を同じ関数で作る。"""
    x=abs(x)
    for index,((a,za),(b,zb)) in enumerate(zip(points,points[1:])):
        if x<=b:
            t=max(0,min(1,(x-a)/(b-a)))
            previous=points[max(0,index-1)];following=points[min(len(points)-1,index+2)]
            ma=0 if index==0 else (zb-previous[1])/(b-previous[0])
            mb=(following[1]-za)/(following[0]-a)
            return (2*t**3-3*t*t+1)*za+(t**3-2*t*t+t)*(b-a)*ma+(-2*t**3+3*t*t)*zb+(t**3-t*t)*(b-a)*mb
    return points[-1][1]


def armor_ribbon(name,inner,outer,mat,lower=False):
    # 断面は丸管ではなく、広い表面・短い内壁・裏面を持つ閉じた装甲。
    vertices=[];faces=[];count=145
    for i in range(count):
        x=-1.0+2.0*i/(count-1)
        zi=interpolate(inner,x);zo=interpolate(outer,x)
        # 口側の壁は急角度、広い外面は緩い勾配にする。
        profile=[(zi,.105),(zi,.275),(zi+(zo-zi)*.12,.283),
                 (zi+(zo-zi)*.72,.250),(zo,.205),(zo,.105)]
        for z,offset in profile:
            offset+=.025*exp(-(x/.55)**2)
            vertices.append(surface(x,z,offset))
    sides=6
    for i in range(count-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple((count-1)*sides+j for j in range(sides))]
    obj=oni.mesh_object(name,vertices,faces,mat)
    recalc(obj)
    bevel=armor.bevel(obj,.006,3);bevel.angle_limit=.4
    obj['cross_section']='broad armor face / steep inner return / closed underside'
    obj['role']='lower layered jaw plate' if lower else 'upper cheek curl armor'
    return obj


def tooth(name,start,control1,control2,end,radius,mat):
    """軸自体を3次元Bezierで曲げ、接線に垂直な太い断面から先端へ絞る。"""
    controls=[Vector(p) for p in [start,control1,control2,end]]
    a,b,c,d=controls;verts=[];faces=[];rows=28;sides=24
    for j in range(rows+1):
        t=j/rows
        center=(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
        tangent=(3*(1-t)**2*(b-a)+6*(1-t)*t*(c-b)+3*t*t*(d-c)).normalized()
        axis=Vector((0,1,0))
        right=tangent.cross(axis).normalized();forward=right.cross(tangent).normalized()
        r=radius*max(.003,(1-t)**.69)*(1+.10*sin(pi*t))
        for i in range(sides):
            angle=2*pi*i/sides
            verts.append(center+right*cos(angle)*r+forward*sin(angle)*r*.84)
    for j in range(rows):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple(rows*sides+i for i in range(sides))]
    obj=oni.mesh_object('New '+name,verts,faces,mat);recalc(obj)
    obj=replace_data(name,obj)
    obj['root_partially_buried']=True
    obj['curved_axis']=True
    return obj


def radial_loop(points,count=240):
    outline=oni.smooth_loop(points,10);center=Vector((0,-.20))
    result=[]
    for i in range(count):
        angle=pi/2-2*pi*i/count;direction=Vector((cos(angle),sin(angle)))
        hits=[]
        for aa,bb in zip(outline,outline[1:]+outline[:1]):
            a=Vector(aa)-center;b=Vector(bb)-center;edge=b-a
            determinant=direction.x*edge.y-direction.y*edge.x
            if abs(determinant)<1e-9:continue
            t=(a.x*edge.y-a.y*edge.x)/determinant
            u=(a.x*direction.y-a.y*direction.x)/determinant
            if t>0 and 0<=u<=1:hits.append(t)
        if not hits:raise RuntimeError('輪郭の放射線交差に失敗')
        point=center+direction*min(hits);result.append(tuple(point))
    return result


def refine():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene=bpy.context.scene
    root=bpy.data.objects['MaskRoot'];root.scale=(1,1,1);root.location=(0,0,0)
    model=next(collection for collection in root.users_collection if collection.name.startswith('ONI'))
    armor.model=model;armor.root=root;armor.position=surface
    shell=bpy.data.materials['MaskShell'];raised=bpy.data.materials['OniRaisedArmor']
    rubber=bpy.data.materials['OniRecess'];ivory=bpy.data.materials['OniCeramicTeeth']
    metal=bpy.data.materials['OniMachinedMetal'];red=bpy.data.materials['MaskLED']
    armor.hardware=metal;armor.rubber=rubber
    # 広い装甲面にだけ微細な凹凸を加える。輪郭や歯の面をノイズで崩さない。
    for mat in [shell,raised]:
        bsdf=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        bsdf.inputs['Roughness'].default_value=.52
        noise=mat.node_tree.nodes.new('ShaderNodeTexNoise');noise.name='Fine charcoal micrograin'
        noise.inputs['Scale'].default_value=310;noise.inputs['Detail'].default_value=2.5
        bump=mat.node_tree.nodes.new('ShaderNodeBump');bump.name='Subtle coating grain'
        bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.0013
        mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    # 太い円形チューブと浮いたLEDプレートを除く。機構の円形ベゼルは残す。
    for obj in list(model.objects):
        if any(fragment in obj.name for fragment in [
            'Mouth deep shadow gasket','Sculpted mouth rim','Moustache undercut',
            'Raised moustache ridge','Jaw armor crest','Jaw recess','Outer rolled armor edge',
            'LED socket','Red slit','LED recessed lip']):remove(obj)
    upper_inner=[(0,.035),(.20,.055),(.40,.14),(.54,.225),(.70,.17),(.83,.045),(1.0,.35)]
    upper_outer=[(0,.27),(.20,.30),(.40,.39),(.54,.39),(.70,.29),(.83,.29),(1.0,.50)]
    lower_inner=[(0,-.43),(.20,-.48),(.40,-.585),(.54,-.60),(.72,-.37),(.83,-.12),(1.0,.12)]
    lower_outer=[(0,-.62),(.20,-.70),(.40,-.82),(.54,-.80),(.72,-.60),(.83,-.38),(1.0,-.05)]
    armor_ribbon('Upper wraparound facial armor',upper_inner,upper_outer,raised)
    armor_ribbon('Lower overlapping fang armor',lower_inner,lower_outer,raised,True)
    # 下顎をV形へ。口は縦寸法を約30%縮め、装甲と牙を主役にする。
    outer=radial_loop([(0,1.05),(.30,.80),(.76,.82),(1.12,1.08),(1.25,.65),(1.23,.12),
        (1.08,-.40),(.70,-.87),(.34,-1.06),(0,-1.10),(-.34,-1.06),(-.70,-.87),
        (-1.08,-.40),(-1.23,.12),(-1.25,.65),(-1.12,1.08),(-.76,.82),(-.30,.80)])
    mouth=radial_loop([(0,.035),(.20,.055),(.40,.14),(.54,.225),(.70,.17),(.83,.045),
        (.79,-.20),(.63,-.48),(.44,-.595),(.20,-.48),(0,-.43),(-.20,-.48),
        (-.44,-.595),(-.63,-.48),(-.79,-.20),(-.83,.045),(-.70,.17),(-.54,.225),(-.40,.14),(-.20,.055)])
    vertices=[];faces=[];n=len(outer)
    for t in [0,.08,.25,.5,.75,.92,1]:
        for a,b in zip(outer,mouth):
            x,z=a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t
            vertices.append(surface(x,z,.035+.060*sin(pi*t)))
    for j in range(6):
        for i in range(n):
            faces.append((j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n))
    fresh=oni.mesh_object('New face shell',vertices,faces,shell)
    solid=fresh.modifiers.new('Continuous shell wall','SOLIDIFY');solid.thickness=.052
    armor.bevel(fresh,.009,3)
    replace_data('Continuous sculpted face shell',fresh)
    # 黒い口腔壁と金網は別の奥行き。実際のmesh/curveの位置を変更する。
    fresh=armor.plate('New cavity',[(x*1.03,-.22+(z+.22)*1.03) for x,z in mouth],rubber,-.31,.028,8)
    replace_data('Dark mouth cavity back',fresh)
    for obj in list(model.objects):
        if obj.name.startswith('Honeycomb wire'):
            for spline in obj.data.splines:
                for point in spline.points:
                    point.co.z=-.19+(point.co.z+.19)*.64
            obj.location.y+=.205
            obj['behind_teeth']=True
    for sign,side in [(-1,'Left'),(1,'Right')]:
        def p(x,z,offset):return surface(sign*x,z,offset)
        tooth(side+' Upper canine',p(.50,.265,.08),p(.535,.09,.29),p(.49,-.13,.34),p(.44,-.29,.23),.105,ivory)
        tooth(side+' Lower canine',p(.43,-.68,.08),p(.47,-.51,.29),p(.43,-.29,.34),p(.375,-.205,.24),.096,ivory)
        outline=[(.72,.47),(1.13,.60),(1.21,.29),(1.12,-.23),(.69,-.83),
                 (.45,-.79),(.68,-.54),(.87,-.23),(.91,.03),(.77,.19)]
        fresh=armor.plate('New cheek',[(sign*x,z) for x,z in outline],shell,.13,.052,10)
        replace_data(side+' Cheek layered armor',fresh)
        # 厚い顎装甲は下口枠の下に重なる。中央filterの脇で段をつける。
        outline=[(.17,-.66),(.27,-.70),(.44,-.77),(.62,-.83),(.34,-1.015),(.17,-1.04)]
        armor.plate(side+' Layered chin armor',[(sign*x,z) for x,z in outline],raised,.15,.055,8)
        # 既存の3連機構をグループ化し、部品一式を外向きに回す。下段は深く埋める。
        for number,(x,z,r) in enumerate([(1.115,.66,.14),(1.045,.27,.12),(1.075,-.22,.205)]):
            x*=sign;prefix=side+' Sensor '+str(number)
            components=[obj for obj in list(model.objects) if obj.name.startswith(prefix)]
            oldcenter=oni.surface(x,z,.15)
            oldnormal=Vector((1.34*x/(1.3**2),-1,0)).normalized()
            outward=Vector((sign*.89,-.455,0)).normalized()
            rotation=oldnormal.rotation_difference(outward)
            pivot=bpy.data.objects.new(side+' Recessed module '+str(number),None);model.objects.link(pivot);pivot.parent=root
            pivot.location=surface(x,z,.035 if number==2 else .095)
            pivot.rotation_mode='QUATERNION';pivot.rotation_quaternion=rotation
            for obj in components:
                local=obj.matrix_local.copy();obj.parent=pivot
                obj.matrix_local=Matrix.Translation(-oldcenter)@local
        # 細い赤色発光面を、厚い口枠と同じ閉じた断面の小さな溝へ収める。
        for index,coords in enumerate([
            [(.78,.69),(.99,.75),(.96,.706),(.80,.658)],
            [(.86,-.36),(.91,-.405),(.75,-.49),(.76,-.445)],
            [(.43,-.91),(.59,-.88),(.53,-.925),(.39,-.953)]]):
            center=(sum(x for x,z in coords)/4,sum(z for x,z in coords)/4)
            outside=[(center[0]+(x-center[0])*1.12,center[1]+(z-center[1])*1.6) for x,z in coords]
            face_offset=[.085,.13,.15][index]
            layers=[(outside,face_offset+.008),(outside,face_offset+.028),
                    (coords,face_offset+.028),(coords,face_offset-.10)]
            verts=[surface(sign*x,z,offset) for loop,offset in layers for x,z in loop]
            quads=[]
            for layer in range(4):
                for j in range(4):quads.append((layer*4+j,layer*4+(j+1)%4,((layer+1)%4)*4+(j+1)%4,((layer+1)%4)*4+j))
            socket=oni.mesh_object(side+' Recessed light well '+str(index),verts,quads,raised,False)
            recalc(socket);armor.bevel(socket,.006,3)
            # 本体にも開口を切り、LEDを表面より奥へ置く。表面に箱を載せない。
            # Solidifyの法線方向ではなくY方向へ貫通させ、斜めの頬でも開口の輪郭をずらさない。
            cutter_vertices=[surface(sign*x,z,offset) for offset in [.60,-.55] for x,z in coords]
            cutter_faces=[(3,2,1,0),(4,5,6,7)]+[(j,(j+1)%4,(j+1)%4+4,j+4) for j in range(4)]
            cutter=oni.mesh_object('Temporary recessed light cutter',cutter_vertices,cutter_faces,rubber,False)
            recalc(cutter)
            targets=['Continuous sculpted face shell',side+' Cheek layered armor'] if index<2 else ['Continuous sculpted face shell',side+' Layered chin armor']
            for target_name in targets:
                target=bpy.data.objects[target_name]
                armor.apply_geometry(target)
                bpy.context.view_layer.objects.active=target
                cut=target.modifiers.new('Recessed LED aperture','BOOLEAN');cut.operation='DIFFERENCE';cut.object=cutter
                bpy.ops.object.modifier_apply(modifier=cut.name)
            remove(cutter)
            armor.plate(side+' Deep red slit '+str(index),[(sign*x,z) for x,z in coords],red,face_offset-.03,.009,3)
        # ケーブルを装甲の下端側へ沿わせる。露出は狭い隙間に限定する。
        for obj in list(model.objects):
            if obj.name.startswith(side+' Braided conduit') or obj.name.startswith(side+' Conduit rib'):
                obj.location.y+=.08
                obj.location.z+=.02
    # 小さい歯列は狭くなった開口の上下へ合わせる。
    for j,x in enumerate([-.35,-.235,-.118,0,.118,.235,.35]):
        z=.065+.18*abs(x)
        tooth('Upper incisor %02d'%j,surface(x,z,.18),surface(x,z-.06,.27),surface(x*.97,z-.15,.28),surface(x*.94,z-.215,.22),.048,ivory)
        x*=.77;z=-.45-.20*abs(x)
        tooth('Lower incisor %02d'%j,surface(x,z,.17),surface(x,z+.04,.25),surface(x*.96,z+.13,.27),surface(x*.95,z+.185,.22),.044,ivory)
    # 新しい鼻先・鼻梁を既存のnose objectへ入れる。鼻孔は斜めに外へ広がる穴。
    verts=[];faces=[];rows=42;columns=48
    for j in range(rows+1):
        z=.235+.79*j/rows
        width=interpolate([(0,.0),(.235,.16),(.30,.29),(.41,.365),(.58,.30),(.82,.19),(1.025,.012)],z)
        for i in range(columns+1):
            u=2*i/columns-1;x=u*width
            bulge=.43*exp(-((z-.405)/.31)**2)*max(0,1-u*u)**.75
            wing=.055*exp(-((abs(x)-.265)/.10)**2-((z-.35)/.10)**2)
            verts.append(surface(x,z,.045*exp(-((z-.60)/.50)**2)+bulge+wing))
    for j in range(rows):
        for i in range(columns):
            a=j*(columns+1)+i;faces.append((a,a+1,a+columns+2,a+columns+1))
    fresh=oni.mesh_object('New sculpted nose',verts,faces,raised)
    solid=fresh.modifiers.new('Nose wall','SOLIDIFY');solid.thickness=.055
    armor.apply_geometry(fresh)
    nose=replace_data('Sculpted nose bridge and tip',fresh)
    for sign,side in [(-1,'Left'),(1,'Right')]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=surface(sign*.22,.345,.35))
        cutter=armor.own(bpy.context.object,'Refine nostril tool',rubber);cutter.scale=(.143,.30,.080)
        cutter.rotation_euler.y=-sign*.40
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bpy.context.view_layer.objects.active=nose
        mod=nose.modifiers.new(side+' deep flared nostril','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);remove(cutter)
        cup_vertices=[];cup_faces=[];segments=48
        for radius,offset in [(1,.11),(.72,-.045)]:
            for j in range(segments):
                a=2*pi*j/segments
                dx=.132*radius*cos(a);dz=.071*radius*sin(a)+sign*.38*dx
                cup_vertices.append(surface(sign*.22+dx,.345+dz,offset))
        for j in range(segments):cup_faces.append((j,(j+1)%segments,(j+1)%segments+segments,j+segments))
        cup_faces.append(tuple(segments+j for j in range(segments)))
        fresh=oni.mesh_object('New nostril cavity',cup_vertices,cup_faces,rubber)
        cup=replace_data(side+' Nostril interior',fresh);cup.matrix_local=Matrix.Identity(4)
    # 真横から鼻孔の向こうへ背景が抜けないよう、鼻内部の暗い閉じた空間を作る。
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=(0,-.48,.345))
    nasal=armor.own(bpy.context.object,'Enclosed internal nasal chamber',rubber)
    nasal.scale=(.23,.36,.14)
    for face in nasal.data.polygons:face.use_smooth=True
    armor.bevel(nose,.007,3)
    # 既存フィルター全体を顎装甲へ埋め、浮いた箱をなくす。
    for obj in list(model.objects):
        if obj.name.startswith('Chin filter'):
            obj.location.y+=.10;obj.location.z+=.06
    # 残した外殻下端の金具をV字の内側へ寄せる。
    for obj in list(model.objects):
        if 'Jaw fastener' in obj.name:obj.location.x*=.82
    bpy.context.view_layer.update()
    # 比較用の正規化。幅と高さの比率は目標正面の約1.12へ合わせる。
    allobjects=[obj for obj in root.children_recursive if obj.type in {'MESH','CURVE'}]
    corners=[obj.matrix_world@Vector(v) for obj in allobjects for v in obj.bound_box]
    minz,maxz=min(p.z for p in corners),max(p.z for p in corners)
    width=max(p.x for p in corners)-min(p.x for p in corners)
    root.scale=(2.536/width,1,2.26/(maxz-minz));root.location.z=-.856-minz*root.scale.z
    root['revision']='broad layered mouth armor / curved canines / recessed grille'
    scene.name='ONI 04 • refined armor study'
    scene.camera.data.ortho_scale=3.9
    scene.render.resolution_x=1600;scene.render.resolution_y=1400
    scene.cycles.samples=48
    scene.camera.location=(0,-7,.25)
    target=Vector((0,0,.24))
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_distance=4.5
                area.spaces.active.region_3d.view_location=target
                area.spaces.active.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
    bpy.context.view_layer.update()
    for obj in scene.objects:obj.select_set(False)
    root.select_set(True);bpy.context.view_layer.objects.active=root
    bpy.ops.wm.save_as_mainfile(filepath=str(DESTINATION))
    print('REFINED BLEND SAVED:',DESTINATION)
    return scene


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--replace',action='store_true')
    parser.add_argument('--render-dir',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if DESTINATION.exists() and not args.replace:raise RuntimeError('出力が存在します。必要なら--replaceを指定。')
    source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    scene=refine()
    args.render_dir.mkdir(parents=True,exist_ok=True)
    target=Vector((0,0,.24))
    for name,location in [('front',(0,-7,.24)),('left',(-7,0,.24)),('right',(7,0,.24)),('45deg',(5,-5,.24))]:
        scene.camera.location=location
        scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(args.render_dir/('oni-refined-'+name+'.png'))
        bpy.ops.render.render(write_still=True)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash,'元のblendが変更された'
    print('SOURCE PRESERVED SHA256:',source_hash)
