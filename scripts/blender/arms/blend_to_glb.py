# .blend の腕モデルを、アプリで使う GLB へ書き出す（create_arms.py と同じ設定）。
# 使い方（Blender 5.x）：
#   blender --background --python scripts/blender/arms/blend_to_glb.py -- <入力.blend> <出力.glb> [--force]
# 出力先にファイルがある時は、--force を付けない限り上書きしない。
# ノード名（UpperArm / Forearm / Hand / 指の15節）、各節のカスタムプロパティ（baseLength など）、
# マテリアル名（shell / joint / emission）は変えないこと（assets/models/README.md の規格）。
import os, sys, bpy
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, dst = args[0], args[1]
if os.path.exists(dst) and "--force" not in args:
    sys.exit(f"{dst} がすでにあります。上書きする時は --force を付けてください。")
bpy.ops.wm.open_mainfile(filepath=src)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials="EXPORT",
                          export_cameras=False, export_lights=False, export_extras=True)
print("exported", dst)
