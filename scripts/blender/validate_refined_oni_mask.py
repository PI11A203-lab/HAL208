"""別名保存した改修原本の形状・歯根・グリル深さを検証し寸法を出力する。"""
from pathlib import Path
from math import isfinite
import hashlib
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ASSETS=Path(__file__).resolve().parents[2]/'project-chrome/assets/models'
source=ASSETS/'mask-oni-04.blend'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='246dea43fc2bc56e2c63958fa27f85144814048ca8f9df706efa34734d3cf558'
bpy.ops.wm.open_mainfile(filepath=str(ASSETS/'mask-oni-04-refined.blend'))
root=bpy.data.objects['MaskRoot'];scene=bpy.context.scene
bpy.context.view_layer.update()
for name in ['Upper wraparound facial armor','Lower overlapping fang armor',
             'Sculpted nose bridge and tip','Dark mouth cavity back','Chin filter frame']:
    assert scene.objects.get(name),name
assert not scene.objects.get('Sculpted mouth rim'),'Old round mouth tube was not removed'
def points(obj):return [obj.matrix_world@v.co for v in obj.data.vertices]
grille=[]
for obj in root.children_recursive:
    if obj.name.startswith('Honeycomb wire'):
        for spline in obj.data.splines:
            grille.extend(obj.matrix_world@Vector(point.co[:3]) for point in spline.points)
grille_front=max(-p.y for p in grille)
trees={}
for side in ['Left','Right']:
    for kind in ['Upper','Lower']:
        name=side+' '+kind+' canine';obj=scene.objects[name]
        bm=bmesh.new();bm.from_mesh(obj.data)
        assert all(edge.is_manifold for edge in bm.edges),name+' is not a closed mesh'
        assert bm.calc_volume(signed=True)>0,name+' has inverted normals'
        bm.transform(obj.matrix_world);trees[name]=BVHTree.FromBMesh(bm);bm.free()
        tooth_points=points(obj)
        assert min(-p.y for p in tooth_points)>grille_front+.03,'Grille is too close to '+name
        plate=scene.objects['Upper wraparound facial armor' if kind=='Upper' else 'Lower overlapping fang armor']
        base=tooth_points[:24];center=sum(base,Vector())/24
        nearby=[p for p in points(plate) if abs(p.x-center.x)<.10 and abs(p.z-center.z)<.16]
        assert nearby,name+' root is outside armor span'
        assert max(-p.y for p in nearby)>max(-p.y for p in base)+.025,name+' root protrudes beyond armor'
    assert not trees[side+' Upper canine'].overlap(trees[side+' Lower canine']),side+' canines intersect'
corners=[obj.matrix_world@Vector(corner) for obj in root.children_recursive
         if obj.type in {'MESH','CURVE'} for corner in obj.bound_box]
assert all(isfinite(v) for p in corners for v in p)
dimensions=[max(p[i] for p in corners)-min(p[i] for p in corners) for i in range(3)]
upper=scene.objects['Upper wraparound facial armor'];lower=scene.objects['Lower overlapping fang armor']
opening_top=max(p.z for p in [upper.matrix_world@v.co for v in list(upper.data.vertices)[::6]] if abs(p.x)<.85)
opening_bottom=min(p.z for p in [lower.matrix_world@v.co for v in list(lower.data.vertices)[::6]] if abs(p.x)<.85)
ratio=(opening_top-opening_bottom)/dimensions[2]
assert .30<ratio<.43,ratio
assert any(node.type=='BUMP' for node in bpy.data.materials['MaskShell'].node_tree.nodes)
print('REFINED VALID: closed individual canines; roots behind armor; recessed grille; no canine intersections')
print('DIMENSIONS X/Y/Z:',tuple(round(v,3) for v in dimensions),'; mouth opening / full height:',round(ratio,3))
print('SOURCE SHA256 UNCHANGED:',hashlib.sha256(source.read_bytes()).hexdigest())
