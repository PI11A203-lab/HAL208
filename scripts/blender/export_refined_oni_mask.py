"""改修原本を保存せずに読み、Web向けGLBを別ファイルへexportする。"""
from pathlib import Path
import bpy

ASSETS=Path(__file__).resolve().parents[2]/'project-chrome/assets/models'
bpy.ops.wm.open_mainfile(filepath=str(ASSETS/'mask-oni-04-fit.blend'))
root=bpy.data.objects['MaskRoot']
for obj in bpy.context.scene.objects:obj.select_set(False)
root.select_set(True)
for obj in root.children_recursive:obj.select_set(True)
bpy.context.view_layer.objects.active=root
# 手続きBumpはglTFへ直接変換できない。元のblendは保存せず、export時だけ外す。
# 微細な粒子を除くbase color / metalness / roughness / LEDは維持される。
for name in ['MaskShell','OniRaisedArmor']:
    material=bpy.data.materials[name]
    bsdf=next(node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    for link in list(bsdf.inputs['Normal'].links):material.node_tree.links.remove(link)
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'mask-oni-04-fit.glb'),export_format='GLB',
    use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_extras=True)
print('REFINED WEB GLB EXPORTED')
