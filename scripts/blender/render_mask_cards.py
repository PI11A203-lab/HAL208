"""最新の編集原本から選択カード用の透過PNGを生成。原本へ保存しない。"""
from pathlib import Path
import sys
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from create_oni_mask import setup_studio

ROOT=Path(__file__).resolve().parents[2]
for key,filename in [('prototype','mask-prototype-04'),('oni','mask-oni-04-fit'),('rabbit','mask-rabbit-04')]:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'project-chrome/assets/models'/(filename+'.blend')))
    scene=bpy.context.scene
    for obj in list(scene.objects):
        if obj.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(obj,do_unlink=True)
    setup_studio(scene)
    scene.render.resolution_x=512;scene.render.resolution_y=384;scene.render.resolution_percentage=100
    scene.cycles.samples=24;scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.camera.data.ortho_scale=3.75
    target=Vector((0,0,.12));scene.camera.location=(1.35,-7,.65)
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/'project-chrome/assets/shop'/('mask-'+key+'.png'))
    bpy.ops.render.render(write_still=True)
