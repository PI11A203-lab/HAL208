"""BlenderのText Editorまたは --background --python で実行する初期モデル生成。

既存のblend/GLBを上書きせず、他のsceneのobjectも削除しません。
"""
from pathlib import Path
from math import pi, sin, cos
import bpy


# Text Editorの__file__はファイル名だけになることがある。
SCRIPT = Path(__file__)
if not SCRIPT.is_absolute():
    text = bpy.data.texts.get(SCRIPT.name)
    if not text or not text.filepath:
        raise RuntimeError("Text EditorのOpenで保存済みcreate_ears.pyを開いてください。")
    SCRIPT = Path(bpy.path.abspath(text.filepath))
ROOT = SCRIPT.resolve().parents[2]
OUTPUT = ROOT / "project-chrome" / "assets" / "models"
BLEND = OUTPUT / "ears-prototype-04.blend"
GLB = OUTPUT / "ears-prototype-04.glb"


def material(name, color, metalness, roughness, glow=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    # UI言語でnode.nameが変わっても動くよう、型で検索する。
    bsdf = next((node for node in result.node_tree.nodes
                 if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = result.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        output = result.node_tree.nodes.new("ShaderNodeOutputMaterial")
        result.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metalness
    bsdf.inputs["Roughness"].default_value = roughness
    if glow:
        emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        emission.default_value = (*color, 1)
        strength = bsdf.inputs.get("Emission Strength")
        if strength:
            strength.default_value = glow
    return result


def prism(collection, parent, name, outline, depth, front, mat, bevel=0):
    # 設計はglTFの(x, y=上, z=正面)。Blenderでは(x, -z, y)で作る。
    vertices = [(x, -z, y) for z in (front - depth, front) for x, y in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count)
              for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    obj.parent = parent
    collection.objects.link(obj)
    if bevel:
        mod = obj.modifiers.new("Edge bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def cylinder(collection, parent, name, x, y, front, radius, depth, mat, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                      location=(0, 0, 0))
    obj = bpy.context.object
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.name = name
    obj.parent = parent
    obj.location = (x, -front, y)
    obj.rotation_euler.x = pi / 2
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Machined edge', 'BEVEL')
    mod.width = 0.006
    mod.segments = 2
    return obj


def cable(collection, parent, name, points, mat, radius=0.013):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for point, (x, y, z) in zip(spline.bezier_points, points):
        point.co = (x, -z, y)
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)


def detailed_ear(collection, pivot, side, mirror, mats):
    """2026-11-19の修正済み正面図をpixel座標でトレースする。

    左耳の接続点(145, 331)を追跡pivotとし、290pxを1単位とする。
    前面の透過部分は作らず、溝の背後にも密閉した外殻を残す。
    """
    shell, panel, metal, rubber, ink = mats

    def xy(point):
        x, y = point
        return (mirror * (x - 145) / 290, (331 - y) / 290)

    def plate(name, points, depth, front, mat, bevel=0.005):
        outline = [xy(point) for point in points]
        # 画像座標はYが下向きなので符号付き面積で巻き順を揃える。
        area = sum(a[0]*b[1] - b[0]*a[1]
                   for a,b in zip(outline, outline[1:] + outline[:1]))
        if area < 0:
            outline.reverse()
        return prism(collection, pivot, side+name, outline, depth, front, mat, bevel)

    def recessed_frame(outer, floor):
        # 前面を塞ぐ一枚板ではなく、上面・傾斜内壁・外壁を持つ額縁。
        # 開口の奥はInnerArmorとFrontGasketで密閉する。
        outer=[xy(p) for p in outer]
        floor=[xy(p) for p in floor]
        area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(outer,outer[1:]+outer[:1]))
        if area < 0:
            outer.reverse()
            floor.reverse()
        opening=[(0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1])
                 for a,b in zip(outer,floor)]
        rings=[(outer,-0.055),(outer,0.105),(opening,0.105),(floor,-0.020)]
        vertices=[(x,-front,y) for points,front in rings for x,y in points]
        n=len(outer)
        faces=[]
        for k in range(4):
            next_ring=(k+1)%4
            for j in range(n):
                next_j=(j+1)%n
                faces.append((k*n+j,k*n+next_j,next_ring*n+next_j,next_ring*n+j))
        mesh=bpy.data.meshes.new(side+'PanelRim')
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        obj=bpy.data.objects.new(side+'PanelRim',mesh)
        collection.objects.link(obj)
        obj.parent=pivot
        mesh.materials.append(shell)
        mod=obj.modifiers.new('Recess edge bevel','BEVEL')
        mod.width=0.0025
        mod.segments=3
        obj['recess_depth']=0.125

    def screw(name, point, front, radius=0.011):
        x,y = xy(point)
        cylinder(collection, pivot, side+name, x,y,front,radius,0.007,metal,16)
        cylinder(collection, pivot, side+name+'Socket',x,y,front+0.0045,
                 radius*0.43,0.003,rubber,6)

    def path(name, points, front, mat, radius=0.006):
        cable(collection,pivot,side+name,[(*xy(p),front) for p in points],mat,radius)

    def slot(name, center, length, height, front, mat):
        # capsule型の黒い埋込み。booleanで貫通させない。
        cx,cy = center
        r = height/2
        points=[]
        for ox, start in ((length/2-r,-pi/2),(-length/2+r,pi/2)):
            points += [(cx+ox+r*cos(start+i*pi/8),cy+r*sin(start+i*pi/8))
                       for i in range(9)]
        return plate(name,points,0.003,front,mat,0.001)

    def label(name, body, point, size, front, outline=False, angle=0):
        curve=bpy.data.curves.new(side+name,'FONT')
        curve.body=body
        curve.align_x='CENTER'
        curve.size=size
        curve.space_character=1.05
        curve.resolution_u=6
        if outline:
            curve.fill_mode='NONE'
            curve.bevel_depth=0.00065
            curve.bevel_resolution=1
        else:
            curve.extrude=0.00015
        obj=bpy.data.objects.new(side+name,curve)
        collection.objects.link(obj)
        obj.parent=pivot
        x,y=xy(point)
        obj.location=(x,-front,y)
        obj.rotation_euler=(pi/2,0,0)
        # local Z回転が文字面内の傾きになる。
        from mathutils import Quaternion
        obj.rotation_mode='QUATERNION'
        obj.rotation_quaternion = obj.rotation_euler.to_quaternion() @ Quaternion((0,0,1),angle)
        curve.materials.append(ink)

    contour=[(65,91),(81,96),(111,112),(151,139),(191,173),(230,213),
             (270,257),(303,296),(292,301),(247,285),(187,311),(152,336),
             (149,439),(112,486),(94,464),(85,519),(73,532),(62,530),
             (28,477),(19,402),(23,242),(29,204),(42,179),(48,176),(52,132)]
    # 背板は奥に配置し、凹ませた内板の手前を覆わない。
    plate('Shell',contour,0.045,-0.055,shell,0.008)
    # 背面にも独立したカバーを重ねる。
    plate('BackCover',[(75,117),(100,126),(157,165),(209,213),(267,279),
                      (240,300),(197,311),(163,346),(146,427),(111,430),
                      (79,375),(60,287),(61,193)],0.022,-0.102,panel)
    plate('BackUpperPlate',[(89,143),(113,144),(174,189),(225,239),
                           (217,273),(180,284),(156,311),(115,310),(105,285),
                           (80,271),(78,176)],0.025,-0.124,panel)
    # 前面は三角形の板で塞ぎ、その周囲に段差のある枠を重ねる。
    plate('FrontGasket',[(81,129),(105,123),(160,157),(213,211),(260,275),
                         (239,294),(163,334),(125,348),(99,331),(89,260),
                         (87,211),(72,196),(72,155)],0.016,-0.040,rubber)
    rim=[(87,135),(108,133),(161,168),(206,212),(251,274),
         (232,290),(160,330),(127,339),(104,322),(98,253),
         (96,208),(79,194),(79,157)]
    inner=[(99,157),(113,149),(155,179),(196,218),(235,269),
           (219,283),(154,319),(128,328),(112,313),(106,245),
           (104,204),(94,190),(94,165)]
    recessed_frame(rim,inner)
    plate('InnerArmor',inner,0.020,-0.018,panel,0.004)
    slot('RecessedVent',(162,250),78,11,-0.016,rubber)
    # 緩く湾曲した傾斜レールは、修正正面図の輪郭を優先。
    plate('SlopeRail',[(65,91),(81,96),(111,112),(151,139),(191,173),
                       (230,213),(270,257),(303,296),(298,301),(262,266),
                       (223,224),(184,185),(145,152),(106,125),(71,106)],
          0.18,0.125,metal,0.003)
    plate('OuterRail',[(65,97),(72,105),(61,150),(57,201),(54,298),
                       (55,385),(66,459),(59,472),(45,397),(43,301),
                       (47,203),(51,145)],0.18,0.125,metal,0.004)
    # ねじ付きの小さい外周クランプ。
    for j,(x,y) in enumerate([(106,116),(185,172),(261,253)]):
        plate('EdgeClip'+str(j),[(x+4,y-17),(x+12,y-12),(x-5,y+14),(x-13,y+8)],
              0.19,0.139,metal,0.002)
        screw('ClipBolt'+str(j),(x+3,y-8),0.145,0.009)
    for j,point in enumerate([(119,177),(219,267),(126,315)]):
        screw('PanelBolt'+str(j),point,-0.008,0.014)
    # 細い側面放熱リブ。前面に大きなLED列は置かない。
    plate('SideVentBed',[(76,220),(85,215),(87,267),(77,277)],0.019,0.040,rubber)
    for j in range(10):
        y=225+j*4.1
        plate('SideVentFin'+str(j),[(77,y),(84,y-3),(84,y-1),(77,y+2)],
              0.012,0.052,metal,0.0007)
    # 下方に伸びる装着ユニットと小型の斜めロック。
    plate('SideSpine',[(38,221),(48,203),(47,363),(59,427),(47,454),
                       (30,403),(27,283)],0.21,0.003,shell,0.006)
    plate('HingeBracket',[(21,294),(39,282),(54,304),(58,343),
                          (46,365),(25,354),(16,329)],0.19,0.048,panel)
    x,y=xy((29,325))
    for name,rad,depth,mat,offset in [('Hinge',0.078,0.12,shell,0),
                                    ('HingeCap',0.060,0.025,metal,-0.065)]:
        obj=cylinder(collection,pivot,side+name,x+mirror*offset,y,-0.018,rad,depth,mat,32)
        obj.rotation_euler=(0,pi/2,0)  # 外側へ突き出す横軸ヒンジ。
    plate('Latch',[(106,333),(126,339),(111,378),(99,387),(89,378)],
          0.047,0.092,metal,0.004)
    plate('LatchInset',[(107,344),(115,346),(105,372),(98,376),(96,372)],
          0.009,0.100,rubber,0.002)
    screw('LatchBolt0',(110,345),0.105,0.008)
    screw('LatchBolt1',(99,372),0.105,0.008)
    plate('LowerArmor',[(95,382),(128,361),(146,367),(147,438),
                        (113,486),(101,475),(87,417)],0.025,0.079,panel,0.005)
    plate('MountTab',[(42,434),(60,450),(87,493),(83,520),(73,531),
                      (63,529),(30,478),(28,463)],0.035,0.057,shell,0.004)
    slot('MountTabRecess',(58,488),27,8,0.061,rubber)
    screw('MountBolt',(71,511),0.068,0.013)
    path('LowerCable',[(54,351),(59,390),(72,425),(86,449)],0.047,rubber,0.010)
    # 画像で見える背面ネジと段付きパネル。
    for j,(x,y) in enumerate([(96,156),(87,222),(184,270),(131,315),(167,314),(116,416)]):
        screw('BackBolt'+str(j),(x,y),-0.148,0.011)
    for j in range(3):
        y=348+j*14
        plate('BackRib'+str(j),[(91+j*3,y),(138-j*3,y),(134-j*3,y+8),
                               (94+j*3,y+8)],0.012,-0.126,shell,0.003)
    if side=='Right':
        label('PrototypeMark','PROTOTYPE',(160,276),0.040,-0.012)
        label('NumberMark','04',(144,310),0.135,-0.012,True)
    label('LowerNumber','04',(118,441),0.15,0.084,True,mirror*0.48)


def create():
    if BLEND.exists() or GLB.exists():
        raise RuntimeError("出力済みです。ears-prototype-04.blendを開いて編集してください。上書きはしません。")
    if bpy.data.filepath:
        raise RuntimeError("File > New > Generalの新規ファイルで実行してください。既存作業には追加しません。")
    names = ("EarLeft", "EarRight", "EarShell", "EarInner", "EarEmission")
    if any(bpy.data.objects.get(name) or bpy.data.materials.get(name) for name in names):
        raise RuntimeError("同名のモデル/材質が存在します。新規ファイルで実行してください。")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    scene = bpy.data.scenes.new("HAL208 Ears")
    collection = bpy.data.collections.new("HAL208_Ears")
    scene.collection.children.link(collection)
    shell = material("EarShell", (0.018, 0.020, 0.022), 0.55, 0.42)
    inner = material("EarInner", (0.030, 0.032, 0.034), 0.25, 0.58)
    metal = material("EarHardware", (0.075, 0.080, 0.083), 0.7, 0.38)
    rubber = material("EarGasket", (0.004, 0.006, 0.008), 0.05, 0.65)
    emission = material("EarMarkings", (0.72, 0.74, 0.73), 0.05, 0.65)
    for side, x in (("Left", -0.58), ("Right", 0.58)):
        pivot = bpy.data.objects.new("Ear" + side, None)
        collection.objects.link(pivot)
        pivot.location.x = x  # Blenderでの比較用。ブラウザーではこの移動だけを除去。
        pivot.empty_display_size = 0.15
        pivot["hal208_height"] = 1.55
        pivot["hal208_pivot"] = 'hairline: reference pixel 145,331'
        detailed_ear(collection, pivot, side, 1 if side == 'Left' else -1,
                     (shell, inner, metal, rubber, emission))

    if bpy.context.window:
        bpy.context.window.scene = scene
    scene.world = bpy.data.worlds.new("Ear Preview World")
    scene.world.color = (0.15, 0.15, 0.15)
    # exporterは内部でsceneを切り替える。sceneのtemp_overrideを残すと
    # Blender 5.3の依存graph評価で不整合になるため実際のwindowを使う。
    if bpy.context.scene != scene:
        raise RuntimeError("生成sceneをアクティブにできませんでした。")
    for obj in scene.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = scene.objects["EarLeft"]
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB",
                              use_selection=True, use_active_scene=True, export_yup=True,
                              export_extras=True, export_apply=True)
    print("HAL208耳モデルを作成:", BLEND, GLB)


if __name__ == "__main__":
    create()
