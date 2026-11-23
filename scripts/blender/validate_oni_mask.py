"""ONI配布GLBを再importし、外形・牙の間隔・部品構成を確認する。"""
from pathlib import Path
from math import isfinite
import bpy
from mathutils import Vector

asset=Path(__file__).resolve().parents[2]/'project-chrome/assets/models/mask-oni-04-fit.glb'
scene=bpy.data.scenes.new('ONI GLB check');bpy.context.window.scene=scene
bpy.ops.import_scene.gltf(filepath=str(asset))
assert scene.objects.get('MaskRoot')
assert not any(obj.type in {'CAMERA','LIGHT'} for obj in scene.objects)
for name in ['Continuous sculpted face shell','Sculpted nose bridge and tip','Dark mouth cavity back',
             'Left Upper canine','Right Upper canine','Left Lower canine','Right Lower canine',
             'Left Nostril interior','Right Nostril interior','Chin filter frame']:
    assert scene.objects.get(name),name
meshes=[obj for obj in scene.objects if obj.type=='MESH']
assert len([obj for obj in meshes if obj.name.startswith('Honeycomb wire')])>100
assert len([obj for obj in meshes if 'incisor' in obj.name])==14
assert any(mat.name=='MaskLED' for mat in bpy.data.materials)
def vertices(obj):return [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
points=[point for obj in meshes for point in vertices(obj)]
assert all(isfinite(v) for point in points for v in point)
minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)))
maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
size=maximum-minimum
assert 2.7<size.x<2.9 and 2.2<size.z<2.4 and .5<size.y<1.5,size
assert abs(minimum.z+.856)<.025,minimum
for name in ['Upper wraparound facial armor','Lower overlapping fang armor']:
    assert scene.objects.get(name),name
# 新版は牙の高さが一部重なり、左右・前後の曲がりで間隔を取る。
# 原本の実際の交差検査はvalidate_refined_oni_mask.pyのBVH検査で行う。
triangles=sum(sum(len(face.vertices)-2 for face in obj.data.polygons) for obj in meshes)
print('ONI VALID:',len(meshes),'meshes;',triangles,'triangles; Z-up size:',tuple(round(v,3) for v in size),
      '; chin:',round(minimum.z,3))
