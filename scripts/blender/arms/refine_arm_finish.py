"""既存3種の原本を開き、色を保ったサテン塗装とNEONの機械装甲を追加する。

再実行時は専用追加部品だけを置換する。関節原点・指node・カスタム属性は維持。
"""
from pathlib import Path
from math import pi
import sys,argparse
import bpy,bmesh
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from arm_lib import Part,SHELL,JOINT,EMIT,T

ASSETS=Path(__file__).resolve().parents[3]/'project-chrome/assets/models'

def own(obj,parent):
    obj.parent=parent;obj.matrix_parent_inverse=Matrix.Identity(4)
    if parent.name=='Hand':obj.scale*=parent.get('handVisualScale',1.0)
    obj['hal208_detail']='satin-mechanical-2026-11-24'
    return obj

def armor_plate(parent,name,outline,depth,materials):
    # 中央に浅い稜線、広い表面、短い側壁を持つ独立した装甲。
    n=len(outline);center=Vector((sum(x for x,z in outline)/n,depth-.016,sum(z for x,z in outline)/n))
    vertices=[center]+[(x,depth,z) for x,z in outline]+[(x,depth+.022,z) for x,z in outline]
    faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
    faces += [(1+i,1+n+i,1+n+(i+1)%n,1+(i+1)%n) for i in range(n)]
    faces.append(tuple(1+n+i for i in reversed(range(n))))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.materials.append(materials[0])
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj);own(obj,parent)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    bevel=obj.modifiers.new('Soft machined edges','BEVEL');bevel.width=.004;bevel.segments=3
    return obj

def neon_details(materials):
    for obj in list(bpy.context.scene.objects):
        if obj.get('hal208_detail'):bpy.data.objects.remove(obj,do_unlink=True)
    upper=bpy.data.objects['UpperArm'];fore=bpy.data.objects['Forearm'];hand=bpy.data.objects['Hand']
    for index,(lo,hi,w) in enumerate([(.26,.48,.104),(.47,.67,.095),(.65,.82,.085)]):
        armor_plate(upper,'NEON shoulder layered plate '+str(index),[(-w,lo+.035),(-w*.7,lo),
            (w*.7,lo),(w,lo+.035),(w*.75,hi),(0,hi+.025),(-w*.75,hi)],-.151+index*.006,materials)
    armor_plate(fore,'NEON forearm central armor',[(-.072,.13),(.072,.13),(.105,.21),(.084,.48),
        (.060,.80),(0,.86),(-.060,.80),(-.084,.48),(-.105,.21)],-.151,materials)
    armor_plate(hand,'NEON backhand armor',[(-.095,.13),(.095,.13),(.106,.30),(.067,.40),
        (0,.425),(-.067,.40),(-.106,.30)],-.070,materials)
    for parent,kind in [(upper,'upper'),(fore,'fore')]:
        p=Part('NEON '+kind+' recessed mechanisms')
        # 外側の丸いセンサー：ONIのボリューム感を共有し、動物装飾は使わない。
        for z,r in [(.28,.037),(.49,.027),(.67,.024)]:
            x=.146 if kind=='upper' else .120
            p.cyl_x(r+.008,.018,JOINT,(x,0,z),segs=32)
            p.cyl_x(r,.019,SHELL,(x+.010,0,z),segs=32)
            p.torus(r*.80,.0025,EMIT,(x+.021,0,z),rot=(0,pi/2,0),segs=(32,6))
            p.cyl_x(r*.64,.009,JOINT,(x+.022,0,z),segs=24)
        # 装甲前面の細い発光スリットを暗い座の中へ沈める。
        for sign in [-1,1]:
            for z in [.24,.48,.70]:
                x=sign*(.070 if kind=='upper' else .055)
                p.box((.012,.008,.082),JOINT,(x,-.160,z),bevel=.002)
                p.box((.004,.003,.064),EMIT,(x,-.164,z),bevel=.001)
            p.tube([(sign*.085,.045,z) for z in [.18,.25,.4,.56,.72,.80]],.006,JOINT,segs=8)
        # 黒い放熱スリットと小さな締結ボルト。
        for z in [.35,.38,.41]:p.box((.055,.004,.008),JOINT,(0,-.170,z),bevel=.001)
        for x,z in [(-.073,.20),(.073,.20),(-.045,.76),(.045,.76)]:
            p.cyl(.007,.007,.005,JOINT,T((x,-.163,z),(pi/2,0,0)),segs=12)
        own(p.build(materials,bevel=.001),parent)

def render(name,directory):
    scene=bpy.context.scene
    roots=[bpy.data.objects[n] for n in ['UpperArm','Forearm','Hand']]
    down=Matrix.Rotation(pi,4,'Y');bend=Matrix.Rotation(-.65,4,'X')
    roots[0].matrix_world=Matrix.Translation((0,0,2))@down
    roots[1].matrix_world=Matrix.Translation((0,0,1))@bend@down@Matrix.Diagonal((1,1,.85,1))
    wrist=Vector((0,0,1))+(bend@down).to_3x3()@Vector((0,0,.85))
    roots[2].matrix_world=Matrix.Translation(wrist)@bend@down@Matrix.Diagonal((.7,.7,.7,1))
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=800;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Review world');scene.world.use_nodes=True
    next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.055,.07,.09,1)
    for location,power,size in [((-2,-3,4),450,3),((2,-1,2),220,2),((1,2,3),500,2)]:
        data=bpy.data.lights.new('Review softbox','AREA');data.energy=power;data.shape='DISK';data.size=size
        light=bpy.data.objects.new('Review softbox',data);scene.collection.objects.link(light);light.location=location
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Review camera');data.type='ORTHO';data.ortho_scale=2.65
    camera=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(camera);scene.camera=camera
    camera.location=(2.4,-5,2.5);camera.rotation_euler=(Vector((0,-.15,1))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(directory/(name+'-satin.png'));bpy.ops.render.render(write_still=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--render-dir',type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.render_dir:args.render_dir.mkdir(parents=True,exist_ok=True)
    for name,rough in [('arm-mk1',.38),('arm-neon',.36),('arm-titan',.44)]:
        bpy.ops.wm.open_mainfile(filepath=str(ASSETS/(name+'.blend')))
        mats=[bpy.data.materials[n] for n in ['shell','joint','emission']]
        colors=[tuple(next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value) for m in mats]
        for mat,metal,r in [(mats[0],.40,rough),(mats[1],.18,.55)]:
            node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            node.inputs['Metallic'].default_value=metal;node.inputs['Roughness'].default_value=r
            node.inputs['Coat Weight'].default_value=.10 if mat==mats[0] else 0
            node.inputs['Coat Roughness'].default_value=.34
        if name=='arm-neon':neon_details(mats)
        assert colors==[tuple(next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value) for m in mats]
        bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/(name+'.blend')),compress=True)
        bpy.ops.export_scene.gltf(filepath=str(ASSETS/(name+'.glb')),export_format='GLB',export_yup=True,
            export_apply=True,export_texcoords=False,export_cameras=False,export_lights=False,export_extras=True)
        print('SATIN SAVED / COLORS PRESERVED:',name)
        if args.render_dir:render(name,args.render_dir)

if __name__=='__main__':main()
