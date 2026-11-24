"""改修版を保全し、頬・ストラップ側の幅と装甲の反射だけを調整する。"""
from pathlib import Path
from math import copysign
import argparse
import hashlib
import sys
import bpy
from mathutils import Vector, Matrix

ASSETS=Path(__file__).resolve().parents[2]/'project-chrome/assets/models'
SOURCE=ASSETS/'mask-oni-04-refined.blend'
OUTPUT=ASSETS/'mask-oni-04-fit.blend'

def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

def widened(point):
    result=point.copy()
    shift=.12*smooth((abs(point.x)-.62)/.65)*smooth((point.z+.55)/.65)
    result.x+=copysign(shift,point.x)
    return result

parser=argparse.ArgumentParser();parser.add_argument('--preview-dir',type=Path,required=True)
parser.add_argument('--replace',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if OUTPUT.exists() and not args.replace:raise RuntimeError('既存の調整版を再作成する場合は--replaceが必要。')
original_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
root=bpy.data.objects['MaskRoot'];scene=bpy.context.scene
bpy.context.view_layer.update()
nodes=list(root.children_recursive)
modules=[obj for obj in nodes if 'Recessed module' in obj.name and obj.type=='EMPTY']
rigid=[]
for obj in nodes:
    if obj.type not in {'MESH','CURVE'}:continue
    if any(parent in modules for parent in [obj.parent,obj.parent.parent if obj.parent else None]):continue
    if 'Strap lug' in obj.name or 'fastener' in obj.name.lower():
        rigid.append(obj);continue
    if obj.data.users>1:obj.data=obj.data.copy()
    matrix=obj.matrix_world.copy();inverse=matrix.inverted()
    if obj.type=='MESH':
        for vertex in obj.data.vertices:vertex.co=inverse@widened(matrix@vertex.co)
        obj.data.update()
    else:
        for spline in obj.data.splines:
            for point in spline.points:
                result=inverse@widened(matrix@Vector(point.co[:3]));point.co=(*result,point.co.w)
            for point in spline.bezier_points:
                point.co=inverse@widened(matrix@point.co)
                point.handle_left=inverse@widened(matrix@point.handle_left)
                point.handle_right=inverse@widened(matrix@point.handle_right)
# 円形モジュールと金具は変形せず、丸い断面のまま外側へ移動する。
for obj in modules+rigid:
    matrix=obj.matrix_world.copy();center=matrix.translation
    obj.matrix_world=Matrix.Translation(widened(center)-center)@matrix
for name,roughness in [('MaskShell',.46),('OniRaisedArmor',.43)]:
    material=bpy.data.materials[name]
    bsdf=next(node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Coat Weight'].default_value=.08
    bsdf.inputs['Coat Roughness'].default_value=.30
root['cheek_adjustment']='outer cheeks / lugs +0.12 max each side; center mouth unchanged'
scene.name='ONI 04 • wider cheeks and soft highlights'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT))
args.preview_dir.mkdir(parents=True,exist_ok=True)
target=Vector((0,0,.24))
for name,position in [('front',(0,-7,.24)),('45deg',(5,-5,.24))]:
    scene.camera.location=position
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(args.preview_dir/('oni-cheeks-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==original_hash
print('CHEEK FIT SAVED:',OUTPUT,'source unchanged')
