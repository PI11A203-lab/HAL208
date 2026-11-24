# 腕モデルの初期形状を数式で組み立て、.blend（原本）と GLB を新しく作るスクリプト。
# 使い方（Blender 5.x）：
#   blender --background --python scripts/blender/arms/create_arms.py -- <variant> <出力フォルダー> [render]
#   variant：chrome（MK-I → arm-mk1）、neon（NEON EDGE → arm-neon）、titan（TITAN FRAME → arm-titan）
# 出力フォルダーに同じ名前のファイルがある時は上書きせずに止まる（同梱の原本・GLBを守るため）。
# 同梱の arm-*.blend はこのスクリプトで作った形をGLBから取り込んだもの。普段の修正は .blend を開いて行い、
# blend_to_glb.py で書き出す。このスクリプトは形を最初から作り直す時だけ使う。
import sys, os, math, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
from arm_lib import reset, make_materials, T

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
variant, out = args[0], args[1]
do_render = len(args) > 2
OUT_NAME = {"chrome": "arm-mk1", "neon": "arm-neon", "titan": "arm-titan"}[variant]
mod = importlib.import_module("arm_" + variant)
os.makedirs(out, exist_ok=True)
for ext in (".blend", ".glb"):
    if os.path.exists(os.path.join(out, OUT_NAME + ext)):
        sys.exit(f"{OUT_NAME}{ext} がすでにあるため止めました。別の出力フォルダーを指定してください。")

reset()
mats = getattr(mod, "materials", make_materials)()
parts = mod.build(mats)
for i, o in enumerate(parts):          # ファイル内では横に並べる（アプリは各ノードの原点だけを使う）
    o.location.x = i * 0.7

# ---- GLB 書き出し（+Y up：Blender の +Z → glTF の +Y、-Y → +Z）----
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    for x in [o, *o.children_recursive]:
        x.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, OUT_NAME + ".blend"), compress=True)   # 編集用の原本
glb = os.path.join(out, OUT_NAME + ".glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                          export_yup=True, export_texcoords=False, export_normals=True,
                          export_materials="EXPORT", export_cameras=False, export_lights=False,
                          export_extras=True)
print("GLB", glb, os.path.getsize(glb))
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in [x for q in parts for x in (q, *q.children_recursive)]:
    m = o.evaluated_get(dg).to_mesh()
    m.calc_loop_triangles()
    tris += len(m.loop_triangles)
    o.evaluated_get(dg).to_mesh_clear()
print("triangles", tris)

if not do_render:
    sys.exit(0)

# ---- 確認用レンダリング：腕を組み立てて、少し肘を曲げたポーズ ----
def posed(obj, matrix, scale=(1, 1, 1)):
    c = obj.copy()
    bpy.context.scene.collection.objects.link(c)
    c.matrix_world = matrix @ Matrix.Diagonal((*scale, 1))
    for child in obj.children:                      # 指の節も一緒に複製する
        cc = child.copy()
        bpy.context.scene.collection.objects.link(cc)
        cc.parent = c
        cc.matrix_parent_inverse = child.matrix_parent_inverse.copy()
        cc.matrix_basis = child.matrix_basis.copy()
    return c

down = Matrix.Rotation(math.pi, 4, "Y")                       # +Z を下向きに（前面 -Y はそのまま）
sh = Vector((0, 0, 2.0))
up_len, fo_len = 1.0, 0.85
bend = Matrix.Rotation(-0.75, 4, "X")                          # 肘を前（カメラ側）へ曲げる
posed(parts[0], Matrix.Translation(sh) @ down)
el = sh + Vector((0, 0, -up_len))
fo_m = Matrix.Translation(el) @ bend @ down
posed(parts[1], fo_m, (1, 1, fo_len))
wr = el + (bend @ down).to_3x3() @ Vector((0, 0, fo_len))
posed(parts[2], Matrix.Translation(wr) @ Matrix.Rotation(-0.25, 4, "X") @ bend @ down, (0.7, 0.7, 0.7))

for o in parts:                                                 # 元の（横並びの）部品はレンダリングしない
    for x in [o, *o.children_recursive]:
        x.hide_render = True
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
try:
    scene.cycles.use_denoising = True
except Exception:
    pass
scene.render.resolution_x, scene.render.resolution_y = 900, 1100
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"

world = bpy.data.worlds.new("World"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.035, 0.045, 0.06, 1)

def area(name, loc, rot, size, power, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, "AREA"); l.size = size; l.energy = power; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; o.rotation_euler = rot
    scene.collection.objects.link(o)

def softbox(name, loc, rot, size, strength, color=(1, 1, 1)):  # 金属に映り込む大きな光源
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = (*size, 1)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = (*color, 1); em.inputs[1].default_value = strength
    outn = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(em.outputs[0], outn.inputs[0])
    o.data.materials.append(m)
    o.visible_camera = False

area("Key", (-2.2, -2.5, 3.0), (math.radians(55), 0, math.radians(-40)), 2.0, 900)
area("Fill", (2.5, -2.0, 1.4), (math.radians(70), 0, math.radians(50)), 2.5, 250)
area("Rim", (1.0, 2.4, 2.4), (math.radians(-60), 0, math.radians(160)), 1.2, 700, (0.3, 0.85, 1.0))
softbox("BoxL", (-3, -0.5, 1.5), (0, math.radians(90), 0), (4, 1.6), 7.0)
softbox("BoxR", (3, -0.8, 1.2), (0, math.radians(-90), 0), (4, 1.0), 4.0)
softbox("BoxFront", (0, -4, 2.2), (math.radians(80), 0, 0), (2.5, 0.6), 5.0)
softbox("BoxRim", (-1.5, 3, 1.5), (math.radians(-90), 0, 0), (0.4, 3), 6.0, (0.3, 0.85, 1.0))
softbox("BoxTop", (0, -0.5, 4), (math.pi, 0, 0), (3, 3), 3.0)
softbox("Floor", (0, -0.5, -1.2), (0, 0, 0), (6, 6), 0.25, (0.6, 0.75, 0.9))

cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 50
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam

def look(cam, loc, target):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

for name, loc in (("front", (0.0, -5.2, 1.05)), ("three_quarter", (3.0, -4.3, 1.5)), ("back", (-2.2, 4.8, 1.3))):
    look(cam, loc, (0, -0.25, 0.95))
    scene.render.filepath = os.path.join(out, f"{variant}_{name}.png")
    bpy.ops.render.render(write_still=True)
    print("render", scene.render.filepath)
