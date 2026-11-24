# 腕モデル用の共通ヘルパー（Blender bpy / bmesh）
# 座標の約束（Blender側）：部品の原点＝関節、+Z＝次の関節（長さ1.0）、前面＝-Y、X は glTF と同じ。
# glTF へ書き出すと +Z→+Y、-Y→+Z になり、プログラム側の規格（+Y＝次の関節、+Z＝前面）と一致する。
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler

SHELL, JOINT, EMIT = 0, 1, 2
FRONT = -math.pi / 2  # 前面（-Y）の角度


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_materials(shell_color=(0.85, 0.87, 0.9), shell_rough=0.1, joint_color=(0.025, 0.028, 0.032),
                   emit_color=(0.0, 0.85, 1.0), emit_strength=6.0):
    def mat(name, color, metal, rough, emit=None, strength=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*color, 1)
        b.inputs["Metallic"].default_value = metal
        b.inputs["Roughness"].default_value = rough
        if emit:
            b.inputs["Emission Color"].default_value = (*emit, 1)
            b.inputs["Emission Strength"].default_value = strength
        return m
    return [mat("shell", shell_color, 1.0, shell_rough),
            mat("joint", joint_color, 0.85, 0.38),
            mat("emission", emit_color, 0.0, 0.3, emit_color, emit_strength)]


def T(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return Matrix.Translation(Vector(loc)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))


class Part:
    """1つの部品（UpperArm など）を bmesh で組み立て、最後に1オブジェクトにする"""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()

    def _tag(self, verts, mi, smooth):
        faces = set()
        for v in verts:
            faces.update(v.link_faces)
        for f in faces:
            f.material_index = mi
            f.smooth = smooth
        return faces

    # ---- 基本形状 ----
    def cyl(self, r0, r1, length, mi, m=None, segs=32, caps=True, smooth=True):
        """+Z 方向へ伸びる円柱（底面が原点）。r0：底、r1：先端"""
        m = (m or Matrix()) @ T((0, 0, length / 2))
        res = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=segs,
                                    radius1=r0, radius2=r1, depth=length, matrix=m)
        faces = self._tag(res["verts"], mi, smooth)
        if caps:  # 端面は平らに見せる
            for f in faces:
                if abs(f.normal.dot(Vector((0, 0, 1)))) > 0.99 and len(f.verts) > 4:
                    f.smooth = False
        return faces

    def cyl_x(self, r, length, mi, loc, segs=28):
        """X 軸方向の円柱（ヒンジ・ボルト用）。loc は中心"""
        return self.cyl(r, r, length, mi, T(loc, (0, math.pi / 2, 0)) @ T((0, 0, -length / 2)), segs)

    def sphere(self, r, mi, loc=(0, 0, 0), scale=(1, 1, 1), segs=(28, 16)):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=segs[0], v_segments=segs[1], radius=r,
                                        matrix=T(loc, scale=scale))
        return self._tag(res["verts"], mi, True)

    def box(self, size, mi, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0):
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=T(loc, rot, size))
        verts = res["verts"]
        faces = self._tag(verts, mi, False)
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            out = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=3,
                                  affect="EDGES", profile=0.5, clamp_overlap=True)
            for f in out["faces"]:
                f.material_index = mi
                f.smooth = True
        return faces

    def torus(self, R, r, mi, loc=(0, 0, 0), rot=(0, 0, 0), segs=(48, 8), arc=(0, 2 * math.pi)):
        """Z 軸まわりのリング（arc で一部だけ）"""
        bm = self.bm
        a0, a1 = arc
        full = abs(a1 - a0 - 2 * math.pi) < 1e-6
        n = segs[0] if full else segs[0] + 1
        m = T(loc, rot)
        rings = []
        for i in range(n):
            a = a0 + (a1 - a0) * i / segs[0]
            c = Vector((math.cos(a) * R, math.sin(a) * R, 0))
            out = Vector((math.cos(a), math.sin(a), 0))
            ring = []
            for j in range(segs[1]):
                b = 2 * math.pi * j / segs[1]
                p = c + out * (math.cos(b) * r) + Vector((0, 0, math.sin(b) * r))
                ring.append(bm.verts.new(m @ p))
            rings.append(ring)
        faces = []
        for i in range(n if full else n - 1):
            A, B = rings[i], rings[(i + 1) % n]
            for j in range(segs[1]):
                faces.append(bm.faces.new((A[j], B[j], B[(j + 1) % segs[1]], A[(j + 1) % segs[1]])))
        for f in faces:
            f.material_index = mi
            f.smooth = True
        return faces

    def plate(self, z0, z1, r0, r1, span, t, mi, center=FRONT, segs=28, lip=0.0, m=None):
        """円筒の一部を厚みのある装甲板にする。span：覆う角度、center：中心の角度（前面＝-Y）、lip：端の反り"""
        bm = self.bm
        m = m or Matrix()
        rows = []
        for k, (z, r) in enumerate(((z0, r0), (z1, r1))):
            outer, inner = [], []
            for i in range(segs + 1):
                a = center - span / 2 + span * i / segs
                edge = abs(i / segs - 0.5) * 2  # 0：中央、1：端
                rr = r + lip * edge ** 4
                d = Vector((math.cos(a), math.sin(a), 0))
                outer.append(bm.verts.new(m @ (d * rr + Vector((0, 0, z)))))
                inner.append(bm.verts.new(m @ (d * (rr - t) + Vector((0, 0, z)))))
            rows.append((outer, inner))
        (o0, i0), (o1, i1) = rows
        faces = []
        for i in range(segs):
            faces.append(bm.faces.new((o0[i], o0[i + 1], o1[i + 1], o1[i])))          # 外面
            faces.append(bm.faces.new((i0[i + 1], i0[i], i1[i], i1[i + 1])))          # 内面
            faces.append(bm.faces.new((o0[i + 1], o0[i], i0[i], i0[i + 1])))          # 下端
            faces.append(bm.faces.new((o1[i], o1[i + 1], i1[i + 1], i1[i])))          # 上端
        faces.append(bm.faces.new((o0[0], o1[0], i1[0], i0[0])))                      # 側端
        faces.append(bm.faces.new((o0[-1], i0[-1], i1[-1], o1[-1])))
        for f in faces:
            f.material_index = mi
            f.smooth = True
        return faces

    def tube(self, points, r, mi, segs=10):
        """点列に沿ったケーブル"""
        bm = self.bm
        pts = [Vector(p) for p in points]
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
            u = t.cross(ref).normalized()
            v = t.cross(u).normalized()
            rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * j / segs) + v * math.sin(2 * math.pi * j / segs)) * r)
                          for j in range(segs)])
        faces = []
        for A, B in zip(rings, rings[1:]):
            for j in range(segs):
                faces.append(bm.faces.new((A[j], A[(j + 1) % segs], B[(j + 1) % segs], B[j])))
        for ring in (rings[0], rings[-1][::-1]):
            faces.append(bm.faces.new(ring[::-1] if ring is rings[0] else ring))
        for f in faces:
            f.material_index = mi
            f.smooth = True
        return faces

    def piston(self, p0, p1, r_house, r_rod, ratio=0.55):
        """油圧ピストン：p0 側が外筒（暗色）、p1 側がロッド（クローム）"""
        a, b = Vector(p0), Vector(p1)
        d = b - a
        L = d.length
        q = d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        base = Matrix.Translation(a) @ q
        self.cyl(r_house, r_house, L * ratio, JOINT, base, segs=20)
        self.cyl(r_house * 1.25, r_house * 1.25, L * 0.06, SHELL, base, segs=20)               # 根元のカラー
        self.cyl(r_house * 1.15, r_house * 1.15, L * 0.04, SHELL, base @ T((0, 0, L * ratio - L * 0.04)), segs=20)
        self.cyl(r_rod, r_rod, L * (1 - ratio) + L * 0.05, SHELL, base @ T((0, 0, L * ratio - L * 0.05)), segs=16)
        self.sphere(r_house * 0.9, JOINT, tuple(a), segs=(14, 8))
        self.sphere(r_rod * 1.6, JOINT, tuple(b), segs=(14, 8))

    def bolts(self, center, radius, count, r, mi=SHELL, axis="X", depth=0.02):
        c = Vector(center)
        for i in range(count):
            a = 2 * math.pi * i / count
            if axis == "X":
                p = c + Vector((0, math.cos(a) * radius, math.sin(a) * radius))
                self.cyl(r, r, depth, mi, T(tuple(p), (0, math.pi / 2, 0)) @ T((0, 0, -depth / 2)), segs=10)

    # ---- 仕上げ ----
    def build(self, materials, bevel=0.004):
        for layer in list(self.bm.verts.layers.int):   # 作業用の印は書き出さない
            self.bm.verts.layers.int.remove(layer)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in materials:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if bevel:
            mod = obj.modifiers.new("Bevel", "BEVEL")
            mod.width = bevel
            mod.segments = 1
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(35)
            mod.harden_normals = True
        return obj


def _surface(self, rfn, z0, z1, a0, a1, t, mi, nu=24, nv=10, lip=0.0, sx=1.0, sy=1.0, m=None):
    """半径関数 rfn(a, z) に沿った厚みのある装甲板（筋肉のふくらみを表現できる）。
    a0..a1：覆う角度、z0..z1：高さ、lip：板の縁を外側へ反らせる量、sx/sy：断面の楕円率"""
    bm = self.bm
    m = m or Matrix()
    def P(i, j, off):
        u, v = i / nu, j / nv
        a = a0 + (a1 - a0) * u
        z = z0 + (z1 - z0) * v
        e = max(abs(u - 0.5), abs(v - 0.5)) * 2
        r = rfn(a, z) + lip * e ** 6 - off
        return m @ Vector((math.cos(a) * r * sx, math.sin(a) * r * sy, z))
    outer = [[bm.verts.new(P(i, j, 0)) for j in range(nv + 1)] for i in range(nu + 1)]
    inner = [[bm.verts.new(P(i, j, t)) for j in range(nv + 1)] for i in range(nu + 1)]
    faces = []
    for i in range(nu):
        for j in range(nv):
            faces.append(bm.faces.new((outer[i][j], outer[i + 1][j], outer[i + 1][j + 1], outer[i][j + 1])))
            faces.append(bm.faces.new((inner[i][j + 1], inner[i + 1][j + 1], inner[i + 1][j], inner[i][j])))
    for i in range(nu):   # 上下の縁
        faces.append(bm.faces.new((outer[i + 1][0], outer[i][0], inner[i][0], inner[i + 1][0])))
        faces.append(bm.faces.new((outer[i][nv], outer[i + 1][nv], inner[i + 1][nv], inner[i][nv])))
    for j in range(nv):   # 左右の縁
        faces.append(bm.faces.new((outer[0][j], outer[0][j + 1], inner[0][j + 1], inner[0][j])))
        faces.append(bm.faces.new((outer[nu][j + 1], outer[nu][j], inner[nu][j], inner[nu][j + 1])))
    for f in faces:
        f.material_index = mi
        f.smooth = True
    return faces


Part.surface = _surface


def bump(x, c, w):
    return math.exp(-((x - c) / w) ** 2)


def lobe(a, center, power=2):
    return max(0.0, math.cos(a - center)) ** power


# ---- 指の関節ごとに分けた手（指の追跡用）----
class Bone:
    """指の1節。matrix：手（Hand）の座標での節の付け根の姿勢（+Z＝次の関節）。length/radius：基準寸法"""
    def __init__(self, name, matrix, length, radius, geometry):
        self.name, self.matrix, self.length, self.radius, self.geometry = name, matrix.copy(), length, radius, geometry


def build_hand(materials, palm, bones, track_length, track_radius, bevel=0.004):
    """手のひら（Hand）と、その子として指の節を作る。節の基準寸法は glTF の extras に書き出す"""
    hand = palm.build(materials, bevel=bevel)
    hand["trackLength"] = track_length   # 手首→中指の付け根の長さ（指を追跡する時の手のひらの基準長）
    hand["trackRadius"] = track_radius   # 手のひらの幅の半分
    for b in bones:
        part = Part(b.name)
        b.geometry(part)
        o = part.build(materials, bevel=bevel)
        o.parent = hand
        o.matrix_parent_inverse = Matrix()
        o.matrix_basis = b.matrix
        o["baseLength"] = b.length
        o["baseRadius"] = b.radius
    return hand
