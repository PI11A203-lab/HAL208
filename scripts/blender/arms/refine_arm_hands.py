"""MK-I/NEONの指幅と厚みを改善し、NEONを赤LED・強めのサテン反射にする。"""
from pathlib import Path
import sys,argparse
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from refine_arm_finish import render

ASSETS=Path(__file__).resolve().parents[3]/'project-chrome/assets/models'
parser=argparse.ArgumentParser();parser.add_argument('--render-dir',type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if args.render_dir:args.render_dir.mkdir(parents=True,exist_ok=True)
for name in ['arm-mk1','arm-neon']:
    bpy.ops.wm.open_mainfile(filepath=str(ASSETS/(name+'.blend')))
    hand=bpy.data.objects['Hand'];count=0
    for obj in hand.children:
        if 'baseLength' not in obj or 'baseRadius' not in obj:continue
        # 各節のローカルZ（長さ）と関節位置を保持。再実行で太り続けない。
        old_x=obj.get('fingerWidthScale',1.0);old_y=obj.get('fingerDepthScale',1.0)
        for vertex in obj.data.vertices:
            vertex.co.x*=1.25/old_x;vertex.co.y*=1.55/old_y
        obj['baseRadius']*=1.25/old_x
        obj['fingerWidthScale']=1.25;obj['fingerDepthScale']=1.55
        obj.data.update();count+=1
    assert count==15,(name,count)
    if name=='arm-neon':
        # 手首を中心に手のひら・指・甲の部品を10%拡大。追従基準の長さは維持する。
        factor=1.10/hand.get('handVisualScale',1.0)
        for obj in [hand,*hand.children_recursive]:
            if obj.type=='MESH':
                for vertex in obj.data.vertices:vertex.co*=factor
                obj.data.update()
            if obj!=hand:obj.location*=factor
        hand['handVisualScale']=1.10
        shell=bpy.data.materials['shell']
        node=next(n for n in shell.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        node.inputs['Roughness'].default_value=.32
        node.inputs['Coat Weight'].default_value=.25
        node.inputs['Coat Roughness'].default_value=.25
        emission=bpy.data.materials['emission']
        node=next(n for n in emission.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        node.inputs['Base Color'].default_value=(.55,.001,.002,1)
        node.inputs['Emission Color'].default_value=(.55,.001,.002,1)
        node.inputs['Emission Strength'].default_value=1.4
        node.inputs['Roughness'].default_value=.36
        node.inputs['Specular IOR Level'].default_value=.5
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/(name+'.blend')),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ASSETS/(name+'.glb')),export_format='GLB',export_yup=True,
        export_apply=True,export_texcoords=False,export_cameras=False,export_lights=False,export_extras=True)
    print('THICK FINGERS SAVED:',name,count)
    if args.render_dir:render(name,args.render_dir)
