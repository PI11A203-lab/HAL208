"""編集用ウサギ顔マスクの閉曲面・部品分離・奥行きをBlenderで検証。"""
from pathlib import Path
from math import isfinite,sqrt,exp
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
        coords=[obj.matrix_local@v.co for v in obj.data.vertices]
        return [-p.y-(.42-.67*(abs(p.x)/1.30)**2)+
                .32*(sqrt(p.x*p.x+.12*.12)-.12)-.14*exp(-(p.x/.38)**2) for p in coords]
    assert max(offsets(channel))>max(offsets(light))+.04,'LED is not behind its channel lip'

left=points(scene.objects['Left short front tooth'])
right=points(scene.objects['Right short front tooth'])
assert min(p.x for p in right)-max(p.x for p in left)>.005,'Front teeth have no gap'
assert scene.objects['Soft pink triangular nose'].type=='MESH'
assert scene.objects.get('Rounded chin armor')
assert root.get('facial_wrap'),'Missing nose-centered facial wrap'
assert root.get('fixedArmorColor')=='#ffffff'
frame=points(scene.objects['Charcoal continuous facial frame'])
assert max(p.z for p in frame if abs(p.x)<.08)>.94,'Central nose bridge is too low'
nose_front=max(-p.y for p in points(scene.objects['Soft pink triangular nose']))
hinge_front=max(-p.y for p in points(scene.objects['Right Hinge cap']))
assert nose_front-hinge_front>.85,'Nose and outer cheeks are too flat'
corners=[obj.matrix_world@Vector(v) for obj in root.children_recursive
         if obj.type in {'MESH','CURVE'} for v in obj.bound_box]
assert all(isfinite(v) for p in corners for v in p)
dimensions=tuple(max(p[i] for p in corners)-min(p[i] for p in corners) for i in range(3))
assert abs(dimensions[0]-2.758)<.01 and abs(dimensions[2]-1.95)<.01,dimensions
assert dimensions[1]>1.4,'Side rails / cheek depth are missing'
print('RABBIT VALID: closed domed cheeks; separate teeth with gap; inset LED; side rails; finite dimensions')
print('DIMENSIONS X/Y/Z:',tuple(round(v,3) for v in dimensions))
