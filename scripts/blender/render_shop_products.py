"""既存の原本を変更せず、ショップ用の商品写真をCyclesで出力する。"""
from pathlib import Path
from math import pi
import sys
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'project-chrome/assets/shop'
OUT.mkdir(parents=True, exist_ok=True)
MODELS = ROOT / 'project-chrome/assets/models'
items = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['mk1', 'neon', 'titan', 'cat', 'rabbit']

for item in items:
    name = {'mk1':'arm-mk1', 'neon':'arm-neon', 'titan':'arm-titan',
            'cat':'ears-prototype-04', 'rabbit':'ears-rabbit-led'}[item]
    # .blendの未commit編集を商品画像へ混ぜず、配布中GLBを正本にする。
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(MODELS / (name + '.glb')))
    scene = bpy.context.scene
    if item in ['mk1','neon','titan']:
        down = Matrix.Rotation(pi,4,'Y')
        bend = Matrix.Rotation(-.72,4,'X')
        wrist = Vector((0,0,1)) + (bend @ down).to_3x3() @ Vector((0,0,.85))
        placements = [Matrix.Translation((0,0,2)) @ down,
                      Matrix.Translation((0,0,1)) @ bend @ down @ Matrix.Diagonal((1,1,.85,1)),
                      Matrix.Translation(wrist) @ Matrix.Rotation(-.18,4,'X') @ bend @ down @ Matrix.Diagonal((.7,.7,.7,1))]
        for node, pose in zip(['UpperArm','Forearm','Hand'],placements):
            obj = bpy.data.objects[node]
            local = obj.matrix_world.copy(); local.translation = Vector((0,0,0))
            obj.matrix_world = pose @ local
        target = Vector((0,-.3,.95))
        location = (2.3,-6,2.4)
        ortho = 3.3
    else:
        target = Vector((0,0,1.35 if item=='rabbit' else .1))
        location = (1.7,-7,target.z+.8)
        ortho = 4.1 if item=='rabbit' else 2.8
    scene.render.engine='CYCLES'; scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.film_transparent=True
    scene.render.resolution_x=900; scene.render.resolution_y=1100
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX'
    world=bpy.data.worlds.new('Product studio'); scene.world=world; world.use_nodes=True
    next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.38,.40,.43,1)
    for loc,power,size,color in [((-3,-4,5),1100,5,(.92,.96,1)),((4,-1,3),800,3,(1,1,1)),((1,3,4),1300,3,(.8,.9,1))]:
        data=bpy.data.lights.new('Softbox','AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        obj=bpy.data.objects.new('Softbox',data);scene.collection.objects.link(obj);obj.location=loc
        obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    # 大きい面光源を金属に映し、細部が黒く潰れないようにする。
    for x in [-3,3]:
        bpy.ops.mesh.primitive_plane_add(size=1,location=(x,-1,1.5),rotation=(0,pi/2,0))
        box=bpy.context.object;box.scale=(4,2,1);box.visible_camera=False
        mat=bpy.data.materials.new('Studio reflector');mat.use_nodes=True
        bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value=(1,1,1,1)
        bsdf.inputs['Emission Color'].default_value=(1,1,1,1);bsdf.inputs['Emission Strength'].default_value=3
        box.data.materials.append(mat)
    bpy.ops.object.camera_add(location=location)
    cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=ortho;scene.camera=cam
    scene.render.filepath=str(OUT/(item+'.png'))
    bpy.ops.render.render(write_still=True)
    print('SHOP PRODUCT',item,flush=True)
