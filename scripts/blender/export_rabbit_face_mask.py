"""保存済みウサギ顔マスクを原本に触れずWeb用GLBへ書き出す。"""
from pathlib import Path
import bpy

ASSETS=Path(__file__).resolve().parents[2]/'project-chrome/assets/models'
bpy.ops.wm.open_mainfile(filepath=str(ASSETS/'mask-rabbit-04.blend'))
root=bpy.context.scene.objects['MaskRoot']
for obj in bpy.context.scene.objects:obj.select_set(False)
for obj in list(root.children_recursive):
    if obj.type!='CURVE':continue
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');obj.select_set(False)
root.select_set(True)
for obj in root.children_recursive:obj.select_set(True)
bpy.context.view_layer.objects.active=root
# 手続き微細Bumpは原本だけに保持。Webでは材質色と反射を使用する。
for name in ['MaskShell','RabbitArmor']:
    material=bpy.data.materials[name]
    bsdf=next(node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    for link in list(bsdf.inputs['Normal'].links):material.node_tree.links.remove(link)
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'mask-rabbit-04.glb'),export_format='GLB',
    use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_extras=True,
    export_cameras=False,export_lights=False)
