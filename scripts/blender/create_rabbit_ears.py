"""新規Blenderから実行。既存猫耳・既存原本を上書きしない。"""
from pathlib import Path
import sys
import bpy
from math import pi

SCRIPT = Path(__file__)
if not SCRIPT.is_absolute():
    text = bpy.data.texts.get(SCRIPT.name)
    if not text or not text.filepath:
        raise RuntimeError('Text EditorのOpenで保存済みcreate_rabbit_ears.pyを開いてください。')
    SCRIPT = Path(bpy.path.abspath(text.filepath))
SCRIPT = SCRIPT.resolve()
sys.path.insert(0, str(SCRIPT.parent))
from create_ears import material, prism, cylinder, cable

OUTPUT = SCRIPT.parents[2] / 'project-chrome' / 'assets' / 'models'
BLEND = OUTPUT / 'ears-rabbit-led.blend'
GLB = OUTPUT / 'ears-rabbit-led.glb'


def bezier(a, b, c, d, count=20):
    return [tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]
                  for k in range(2)) for t in [i/count for i in range(count)]]


def create():
    if BLEND.exists() or GLB.exists() or bpy.data.filepath:
        raise RuntimeError('新規ファイルで実行し、既存の出力は編集・退避してください。上書きしません。')
    scene = bpy.data.scenes.new('HAL208 Rabbit LED')
    bpy.context.window.scene = scene
    collection = bpy.data.collections.new('HAL208_Rabbit')
    scene.collection.children.link(collection)
    shell = material('EarShell', (0.018, 0.020, 0.024), .50, .38)
    inner = material('EarInner', (.032, .027, .033), .12, .72)
    metal = material('EarHardware', (.13, .14, .15), .75, .32)
    rubber = material('EarGasket', (.005, .006, .009), .05, .75)
    # 色はlinear値。Three側はsRGBのカラーピッカーから設定する。
    led = material('EarLED', (1, .347, .584), .0, .40, 1.25)
    ink = material('EarMarkings', (.65, .68, .69), .05, .65)
    outline = []
    # 葉のような尖端を避け、丸い先端と幅のある長い耳へ変更。
    for points in [((0,.28),(-.30,.65),(-.90,1.65),(-.85,2.68)),
                   ((-.85,2.68),(-.96,3.39),(-.13,3.48),(.11,2.91)),
                   ((.11,2.91),(.53,2.12),(.43,.95),(.12,.47)),
                   ((.12,.47),(.08,.32),(.04,.28),(0,.28))]:
        outline += bezier(*points)
    # 対応する閉曲線を段階縮小して、内壁を持つ連続したくぼみを作る。
    def inset(points, sx, sy):
        return [(-.18+(x+.18)*sx, 1.65+(y-1.65)*sy) for x,y in points]
    opening = inset(outline, .86, .94)
    floor = inset(outline, .68, .86)
    led_path = inset(outline, .72, .88)
    for side, mirror in [('Left', 1), ('Right', -1)]:
        pivot = bpy.data.objects.new('Ear'+side, None)
        collection.objects.link(pivot)
        pivot.location.x = -.65 if side == 'Left' else .65
        pivot['hal208_recess_depth'] = .18
        pivot['hal208_pivot'] = 'root hinge, +Y tip, +Z front after glTF export'
        def points(values):
            result = [(mirror*x,y) for x,y in values]
            area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(result,result[1:]+result[:1]))
            return result if area > 0 else list(reversed(result))
        def plate(name, values, depth, front, mat, bevel=.006):
            return prism(collection,pivot,side+name,points(values),depth,front,mat,bevel)
        plate('ClosedBack',outline,.055,-.10,shell)
        plate('BackCover',inset(outline,.87,.95),.028,-.16,inner)
        plate('RecessFloor',inset(outline,.74,.89),.035,-.01,inner)
        rings = [(outline,-.10),(outline,.17),(opening,.17),(floor,-.01)]
        vertices = [(x,-z,y) for values,z in rings for x,y in points(values)]
        n=len(outline)
        faces=[]
        for k in range(4):
            for j in range(n):
                faces.append((k*n+j,k*n+(j+1)%n,((k+1)%4)*n+(j+1)%n,((k+1)%4)*n+j))
        mesh=bpy.data.meshes.new(side+'RecessFrame')
        mesh.from_pydata(vertices,[],faces)
        mesh.materials.append(shell)
        mesh.update()
        obj=bpy.data.objects.new(side+'RecessFrame',mesh)
        obj.parent=pivot
        collection.objects.link(obj)
        mod=obj.modifiers.new('Rim edge highlight','BEVEL'); mod.width=.008; mod.segments=3
        # LEDは前縁より0.135奥。実際の内壁に沿い、底より僅かに手前。
        path=[(mirror*x,y,.035) for x,y in led_path]
        cable(collection,pivot,side+'InnerLED',path+[path[0]],led,.012)
        cable(collection,pivot,side+'OuterSeam',[(mirror*x,y,.178) for x,y in inset(outline,.97,.99)]+[(mirror*inset(outline,.97,.99)[0][0],inset(outline,.97,.99)[0][1],.178)],metal,.007)
        plate('Mount', [(-.15,.47),(.14,.47),(.17,.14),(.04,-.26),(-.07,-.28),(-.19,.12)],.18,.11,shell)
        plate('MountArmor',[(-.13,.42),(.12,.42),(.10,.10),(-.02,-.10),(-.12,.09)],.022,.145,inner)
        hinge=cylinder(collection,pivot,side+'Hinge',mirror*(-.17),.16,0,.112,.12,metal,32)
        hinge.rotation_euler=(0,pi/2,0)
        for j,(x,y,z) in enumerate([(-.40,3.23,.18),(-.04,-.17,.14),(-.49,2.68,-.20),(.12,1.18,-.20)]):
            cylinder(collection,pivot,side+'Bolt'+str(j),mirror*x,y,z,.026,.012,metal,16)
            cylinder(collection,pivot,side+'Socket'+str(j),mirror*x,y,z+(.008 if z>0 else -.008),.011,.006,rubber,6)
        for j,idx in enumerate([15,30,55,66]):
            x,y=outline[idx]
            cylinder(collection,pivot,side+'EdgePin'+str(j),mirror*x,y,.02,.023,.31,metal,12)
        curve=bpy.data.curves.new(side+'Number','FONT'); curve.body='04'; curve.align_x='CENTER'; curve.size=.13; curve.extrude=.0005
        label=bpy.data.objects.new(side+'Number',curve); collection.objects.link(label); label.parent=pivot
        label.location=(0,-.171,.20); label.rotation_euler=(pi/2,0,0); curve.materials.append(ink)
    scene.world=bpy.data.worlds.new('Rabbit Preview'); scene.world.color=(.18,.18,.18)
    for obj in scene.objects:
        # 80点で輪郭を採っているため、区間ごとの過剰な再分割を避ける。
        if obj.type == 'CURVE':
            obj.data.resolution_u = 2
        obj.select_set(True)
    bpy.context.view_layer.objects.active=scene.objects['EarLeft']
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_apply=True)
    print('HAL208 rabbit LED:',BLEND,GLB)


if __name__ == '__main__':
    create()
