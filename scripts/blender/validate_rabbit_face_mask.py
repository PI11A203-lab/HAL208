"""編集用ウサギ顔マスクの閉曲面・部品分離・奥行きをBlenderで検証。"""
from pathlib import Path
from math import isfinite
import bpy
import bmesh
from mathutils import Vector

asset=Path(__file__).resolve().parents[2]/'project-chrome/assets/models/mask-rabbit-04.blend'
bpy.ops.wm.open_mainfile(filepath=str(asset))
scene=bpy.context.scene;root=scene.objects['MaskRoot']
bpy.context.view_layer.update()

def points(obj):
    return [obj.matrix_world@v.co for v in obj.data.vertices]

for side in ['Left','Right']:
    cheek=scene.objects[side+' ivory cheek']
    bm=bmesh.new();bm.from_mesh(cheek.data)
    assert all(edge.is_manifold for edge in bm.edges),side+' cheek is not closed'
    assert bm.calc_volume(signed=True)>0,side+' cheek has inverted normals'
    bm.free()
    assert len(cheek.data.vertices)>2400,'Missing dome detail / whisker cuts'
    tooth=scene.objects[side+' short front tooth']
    assert tooth.type=='MESH' and tooth.data!=cheek.data,'Parts must be independent'
    assert scene.objects.get(side+' upper side armor')
    assert scene.objects.get(side+' Hinge cap')
    light=scene.objects[side+' cheek light pastel LED']
    channel=scene.objects[side+' cheek light recessed channel']
    # Compare the surface offsets (remove the curved face base depth).
    def offsets(obj):
        return [-v.co.y-(.42-.67*(abs(v.co.x)/1.30)**2) for v in obj.data.vertices]
    assert max(offsets(channel))>max(offsets(light))+.04,'LED is not behind its channel lip'

left=points(scene.objects['Left short front tooth'])
right=points(scene.objects['Right short front tooth'])
assert min(p.x for p in right)-max(p.x for p in left)>.005,'Front teeth have no gap'
assert scene.objects['Soft pink triangular nose'].type=='MESH'
assert scene.objects.get('Rounded chin armor')
corners=[obj.matrix_world@Vector(v) for obj in root.children_recursive
         if obj.type in {'MESH','CURVE'} for v in obj.bound_box]
assert all(isfinite(v) for p in corners for v in p)
dimensions=tuple(max(p[i] for p in corners)-min(p[i] for p in corners) for i in range(3))
assert abs(dimensions[0]-2.758)<.01 and abs(dimensions[2]-1.95)<.01,dimensions
assert dimensions[1]>1.4,'Side rails / cheek depth are missing'
print('RABBIT VALID: closed domed cheeks; separate teeth with gap; inset LED; side rails; finite dimensions')
print('DIMENSIONS X/Y/Z:',tuple(round(v,3) for v in dimensions))
