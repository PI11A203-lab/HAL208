"""配布GLBを新規sceneへ再importし、寸法・構成・有限座標を確認する。"""
from pathlib import Path
from math import isfinite
import bpy
from mathutils import Vector

asset = Path(__file__).resolve().parents[2] / 'project-chrome/assets/models/mask-prototype-04.glb'
scene = bpy.data.scenes.new('Mask GLB validation')
bpy.context.window.scene = scene
bpy.ops.import_scene.gltf(filepath=str(asset))
roots = [obj for obj in scene.objects if obj.name == 'MaskRoot']
assert len(roots) == 1, 'MaskRoot is missing or duplicated'
assert all(obj.type not in {'CAMERA', 'LIGHT'} for obj in scene.objects), 'Studio leaked into GLB'
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
assert len(meshes) > 20
for side in ['Left', 'Right']:
    for suffix in ['Inner concave shell', 'Upper face armor', 'Chin vent armor', 'Buckle frame']:
        assert scene.objects.get(side + ' ' + suffix), (side, suffix)
vertices = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
assert all(isfinite(value) for point in vertices for value in point)
minimum = Vector(tuple(min(point[axis] for point in vertices) for axis in range(3)))
maximum = Vector(tuple(max(point[axis] for point in vertices) for axis in range(3)))
size = maximum - minimum
assert 2.4 < size.x < 2.8, size
assert 1.5 < size.z < 1.8, size  # importer converts glTF Y-up back to Blender Z-up
assert .5 < size.y < 1.1, 'Mask must wrap around the cheeks, not be flat'
triangles = sum(sum(len(face.vertices)-2 for face in obj.data.polygons) for obj in meshes)
print('MASK VALID:', len(meshes), 'meshes;', triangles, 'triangles; Blender Z-up size:', tuple(round(v, 3) for v in size))
