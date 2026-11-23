"""HAL208 #30: 曲面装甲ハーフマスク。Blender 5.3 --background --python で実行。

既存ファイルの再生成は -- --replace を明示する。生成対象以外は変更しない。
Blender: X=横 / Z=上 / -Y=正面、glTF: X=横 / Y=上 / Z=正面。
"""
from pathlib import Path
from math import exp, pi, sin, cos
import argparse
import sys
import bpy
import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

SCRIPT = Path(__file__).resolve()
sys.path.insert(0, str(SCRIPT.parent))
from create_ears import material

ROOT = SCRIPT.parents[2]
OUTPUT = ROOT / 'project-chrome/assets/models'
BLEND = OUTPUT / 'mask-prototype-04.blend'
GLB = OUTPUT / 'mask-prototype-04.glb'


def depth(x, z):
    """中央の鼻・口元から頬の後方へ回り込む基準面。"""
    return .43 - .64 * (abs(x) / 1.25) ** 2 + .075 * exp(-(x / .30) ** 2) * (z + .9)


def position(x, z, offset=0):
    return Vector((x, -depth(x, z) - offset, z))


def normal(x, z):
    epsilon = .0001
    dx = (position(x + epsilon, z) - position(x - epsilon, z)).normalized()
    dz = (position(x, z + epsilon) - position(x, z - epsilon)).normalized()
    return dx.cross(dz).normalized()


def own(obj, name, mat):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    model.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width=.012, segments=3):
    mod = obj.modifiers.new('Machined edge radius', 'BEVEL')
    mod.width, mod.segments = width, segments
    return mod


def plate(name, outline, mat, offset=0, thickness=.035, divisions=9):
    """2D輪郭を分割して曲面へ投影。厚みは内側に付き、内面も実在する。"""
    vertices, faces = [], []
    polygon = [Vector((x, z, 0)) for x, z in outline]
    triangles = tessellate_polygon([polygon])
    for triangle in triangles:
        a, b, c = [polygon[v] if isinstance(v, int) else v for v in triangle]
        indices = {}
        for i in range(divisions + 1):
            for j in range(divisions + 1 - i):
                point = a + (b - a) * i / divisions + (c - a) * j / divisions
                indices[i, j] = len(vertices)
                vertices.append(position(point.x, point.y, offset))
        for i in range(divisions):
            for j in range(divisions - i):
                faces.append((indices[i, j], indices[i + 1, j], indices[i, j + 1]))
                if j < divisions - i - 1:
                    faces.append((indices[i + 1, j], indices[i + 1, j + 1], indices[i, j + 1]))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    # 上面を必ず正面へ向け、Solidifyが空洞側へ伸びるようにする。
    for face in bm.faces:
        if face.normal.y > 0:
            face.normal_flip()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    model.objects.link(obj)
    obj.parent = root
    mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    solid = obj.modifiers.new('Real armor thickness', 'SOLIDIFY')
    solid.thickness, solid.offset = thickness, -1
    bevel(obj, .009)
    return obj


def box(name, center, scale, mat, rounding=.015, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = own(bpy.context.object, name, mat)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = rotation
    if rounding:
        bevel(obj, rounding)
    return obj


def bolt(name, x, z, offset=.07, radius=.022):
    n = normal(x, z)
    center = position(x, z, offset)
    for suffix, radius_part, height, mat, advance, count in [
        ('Washer', radius * 1.3, .010, hardware, 0, 24),
        ('Head', radius, .015, hardware, .009, 24),
        ('Hex socket', radius * .44, .0015, rubber, .017, 6),
    ]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=count, radius=radius_part,
                                          depth=height, location=center + n * advance)
        obj = own(bpy.context.object, name + suffix, mat)
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = n.to_track_quat('Z', 'Y')
        bevel(obj, .002, 2)


def line(name, coords, mat, radius=.012, offset=.06, closed=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 4
    curve.bevel_depth, curve.bevel_resolution = radius, 3
    curve.use_fill_caps = True
    spline = curve.splines.new('POLY')
    spline.points.add(len(coords) - 1)
    for point, (x, z) in zip(spline.points, coords):
        point.co = (*position(x, z, offset), 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, curve)
    model.objects.link(obj)
    obj.parent = root
    curve.materials.append(mat)
    return obj


def text(name, value, x, z, size, offset=.075, angle=0):
    font = bpy.data.curves.new(name, 'FONT')
    font.body, font.size, font.space_line = value, size, 1.12
    font.extrude = .00015
    obj = bpy.data.objects.new(name, font)
    model.objects.link(obj)
    obj.parent = root
    obj.location = position(x, z, offset)
    obj.rotation_mode = 'QUATERNION'
    from mathutils import Quaternion
    obj.rotation_quaternion = normal(x, z).to_track_quat('Z', 'Y') @ Quaternion((0, 0, 1), angle)
    font.materials.append(ink)


def apply_geometry(obj):
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def create():
    global model, root, hardware, rubber, ink
    scene = bpy.data.scenes.new('HAL208 Mask Workshop')
    bpy.context.window.scene = scene
    model = bpy.data.collections.new('MASK • editable armor and hardware')
    scene.collection.children.link(model)
    root = bpy.data.objects.new('MaskRoot', None)
    model.objects.link(root)
    root['hal208_front'] = '+Z after glTF export'
    root['hal208_anchor'] = 'center seam, mid-height; fit width 2.5 units'
    root['hal208_issue'] = 30
    shell = material('MaskShell', (.035, .039, .043), .48, .40)
    lower = material('MaskLowerArmor', (.024, .027, .030), .5, .43)
    cheek = material('MaskCheekMechanism', (.07, .076, .082), .65, .32)
    hardware = material('MaskHardware', (.19, .20, .21), .8, .30)
    rubber = material('MaskGasket', (.004, .005, .006), .05, .8)
    strap = material('MaskWovenStrap', (.012, .014, .016), 0, .95)
    ink = material('MaskMarkings', (.66, .69, .70), .05, .62)
    upper_shape = [(.018, .61), (.08, .65), (.35, .54), (.83, .45),
                   (.91, .15), (.70, -.09), (.08, -.19), (.018, -.15)]
    lower_shape = [(.018, -.20), (.13, -.24), (.70, -.13), (.88, -.25),
                   (.72, -.65), (.30, -.88), (.04, -.94), (.018, -.90)]
    side_shape = [(.82, .43), (1.17, .64), (1.27, .49), (1.25, -.29),
                  (1.05, -.61), (.72, -.66), (.87, -.22), (.99, .10)]
    backing = [(.014, .58), (.35, .50), (.83, .41), (1.17, .60),
               (1.24, .44), (1.22, -.32), (1.02, -.64), (.28, -.90), (.014, -.91)]
    for side, sign in [('Left', -1), ('Right', 1)]:
        def mirrored(points):
            return [(sign * x, z) for x, z in points]
        plate(side + ' Inner concave shell', mirrored(backing), rubber, -.037, .035)
        plate(side + ' Upper face armor', mirrored(upper_shape), shell, .028, .035)
        chin = plate(side + ' Chin vent armor', mirrored(lower_shape), lower, .04, .038)
        plate(side + ' Wraparound cheek shell', mirrored(side_shape), lower, -.012, .045)
        plate(side + ' Cheek floating cover', mirrored([
            (.86, .15), (1.20, .38), (1.24, .25), (1.20, -.31),
            (1.03, -.52), (.83, -.45), (.79, -.13)]), shell, .065, .045)
        # 二段の通気スリット。装甲を実際に切り抜き、奥の黒い内殻を見せる。
        apply_geometry(chin)
        for index, (x, z, length) in enumerate([(.39, -.59, .30), (.47, -.69, .25), (.64, -.49, .14)]):
            x *= sign
            cutter = box(side + ' vent tool', position(x, z, .03), (length, .5, .033), rubber, .016)
            cutter.rotation_euler.y = sign * -.42
            apply_geometry(cutter)
            bpy.context.view_layer.objects.active = chin
            cut = chin.modifiers.new('Open ventilation slot', 'BOOLEAN')
            cut.operation, cut.object = 'DIFFERENCE', cutter
            bpy.ops.object.modifier_apply(modifier=cut.name)
            bpy.data.objects.remove(cutter, do_unlink=True)
        bevel(chin, .003, 2)
        # 頬の関節リンク：底板と角を落とした太い独立パーツを重ねる。
        rail = [(.88, .38), (.98, .34), (1.02, .22), (.93, .08),
                (.85, .02), (.88, -.08), (.80, -.15)]
        line(side + ' Mechanism gasket', mirrored(rail), rubber, .070, .09)
        line(side + ' Raised cheek linkage', mirrored(rail), cheek, .045, .14)
        plate(side + ' Linkage shield', mirrored([
            (.84, .06), (1.09, .10), (1.14, -.05), (1.08, -.20),
            (.87, -.27), (.76, -.17)]), cheek, .17, .042)
        # 織りベルトは面と独立した繊維の稜線で表現し、textureを不要にする。
        plate(side + ' Strap', mirrored([(.82, -.02), (1.02, -.01),
              (1.02, -.42), (.82, -.43)]), strap, .218, .022, 3)
        frame = [(.80, .01), (1.055, .025), (1.055, -.45), (.80, -.465)]
        line(side + ' Buckle frame', mirrored(frame), cheek, .026, .24, True)
        for row in range(41):
            z = -.027 - row * .0093
            line(side + ' Woven rib %02d' % row, mirrored([(.835, z), (1.01, z + .008)]),
                 strap, .0028, .245)
        for index, (x, z, offset) in enumerate([
            (.10, .48, .07), (.65, .30, .07), (.68, -.035, .07),
            (.14, -.79, .09), (1.15, .43, .06), (1.19, -.24, .11),
            (1.04, -.48, .11), (.86, .31, .20), (.84, -.14, .235)]):
            bolt(side + ' Fastener %02d ' % index, sign*x, z, offset)
        for index, (x, z) in enumerate([(.75, .38), (.57, -.12), (.28, -.22)]):
            line(side + ' Panel clasp %d' % index,
                 mirrored([(x-.045, z+.025), (x+.025, z-.065)]), cheek, .016, .085)
            bolt(side + ' Clasp screw %d ' % index, sign*(x-.045), z+.025, .10, .012)
    for index, z in enumerate([.48, -.25, -.83]):
        line('Center hinge strap %d' % index, [(-.075, z), (-.024, z+.004),
             (.024, z+.004), (.075, z)], cheek, .015, .085)
        for x in [-.074, .074]:
            bolt('Center rivet %d %s ' % (index, x), x, z, .103, .013)
    line('Warning outline', [(-.59,.23),(-.51,.40),(-.43,.23)], ink, .003, .073, True)
    text('Warning symbol', '!', -.532, .254, .11)
    text('Technical label', 'HIGH-ENERGY\nMECH SYSTEM\nVT-21A  ///', -.65, .11, .036)
    text('Prototype label', 'PROTOTYPE-04', -.32, -.32, .044, .09, -pi/2)
    text('Serial label', 'UNIT: 21\nSERIAL 208\nHAL / 04', .41, -.38, .031, .09)
    text('Cheek identifier', '21', 1.07, -.11, .14, .23)
    # Editable source stays live; only the export receives evaluated modifiers.
    world = bpy.data.worlds.new('Neutral studio')
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs[0].default_value = (.30,.33,.38,1)
    background.inputs[1].default_value = .5
    scene.world = world
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1250, 1000
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    stage = bpy.data.collections.new('STUDIO • not exported')
    scene.collection.children.link(stage)
    for name, loc, power, size in [('Key',(-3,-4,5),650,4), ('Fill',(4,-2,1),420,3), ('Rim',(1,3,4),850,3)]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.shape, data.size = power, 'DISK', size
        obj = bpy.data.objects.new(name, data)
        stage.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data = bpy.data.cameras.new('Product camera')
    camera = bpy.data.objects.new('Product camera', camera_data)
    stage.objects.link(camera)
    scene.camera = camera
    camera_data.type, camera_data.ortho_scale = 'ORTHO', 3.3
    camera.location = (3,-5,2.1)
    camera.rotation_euler = (Vector((0,0,-.12))-camera.location).to_track_quat('-Z','Y').to_euler()
    for obj in scene.objects:
        obj.select_set(obj.name in model.objects)
    bpy.context.view_layer.objects.active = root
    # 保存時もモデルを見渡せるsolid/material表示を用意。
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_distance = 4.5
                area.spaces.active.region_3d.view_location = (0,0,-.1)
                area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
                area.spaces.active.shading.color_type = 'MATERIAL'
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True,
                             use_active_scene=True, export_yup=True, export_extras=True, export_apply=True)
    return scene


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--replace', action='store_true')
    parser.add_argument('--preview-dir', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if bpy.data.filepath:
        raise RuntimeError('既存の作業ファイルではなく新規Blenderから実行してください。')
    if (BLEND.exists() or GLB.exists()) and not args.replace:
        raise RuntimeError('出力は存在します。退避するか --replace を明示してください。')
    scene = create()
    if args.preview_dir:
        args.preview_dir.mkdir(parents=True, exist_ok=True)
        for name, location in [('front',(0,-6,.6)), ('three-quarter',(3,-5,1.7)),
                               ('inner',(2.6,5,2))]:
            scene.camera.location = location
            scene.camera.rotation_euler = (Vector((0,0,-.12))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath = str(args.preview_dir / ('mask-' + name + '.png'))
            bpy.ops.render.render(write_still=True)
    print('HAL208 mask saved:', BLEND, GLB)
