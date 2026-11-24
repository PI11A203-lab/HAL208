# 腕モデル「CHROME」：プロモーションイラストのような、筋肉の形に沿ったクロームの装甲板と露出した機構。
# 右腕として作る（外側＝+X、内側（体側）＝-X、前面＝-Y、背面＝+Y）。左腕では左右反転して使う。
# 装甲板は「1つの連続した筋肉の面」を隙間で切り分けて作るため、段差のない自然な継ぎ目になる。
import math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from arm_lib import *

BACK, LAT, MED = math.pi / 2, 0.0, math.pi
GAP = 0.06    # 装甲板どうしの隙間（ラジアン）
ZGAP = 0.012  # 上下の隙間


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def r_upper(a, z):   # 上腕：前に上腕二頭筋、後ろに三頭筋、外側に三角筋のふくらみ
    return (0.15 - 0.03 * z + 0.034 * bump(z, 0.52, 0.2) * lobe(a, FRONT, 3)
            + 0.026 * bump(z, 0.4, 0.22) * lobe(a, BACK, 2) + 0.016 * bump(z, 0.25, 0.2) * lobe(a, LAT, 2))


def r_shoulder(a, z):  # 肩：ドーム → 三角筋 → 上腕へ細くなる
    dome = 0.218 * math.sin(min(1.0, max(0.0, (z + 0.17) / 0.21)) * math.pi / 2) ** 0.55
    return dome - 0.052 * smooth(0.03, 0.36, z) + 0.014 * lobe(a, LAT, 2) * bump(z, 0.08, 0.2)


def r_fore(a, z):    # 前腕：肘側の外側（腕橈骨筋）がふくらみ、手首へ細くなる
    return (0.128 - 0.038 * z + 0.026 * bump(z, 0.22, 0.2) * lobe(a, -0.6, 2)
            + 0.014 * bump(z, 0.3, 0.25) * lobe(a, BACK, 2))


def on(rfn, a, z, off=0.0, sx=1.0, sy=1.0):
    r = rfn(a, z) + off
    return (math.cos(a) * r * sx, math.sin(a) * r * sy, z)


def seam(p, rfn, a, z0, z1, mi=EMIT, r=0.0042, n=14, sx=1, sy=1, off=0.004):
    """装甲の表面に沿った細い線（発光または溝）"""
    p.tube([on(rfn, a, z0 + (z1 - z0) * i / n, off, sx, sy) for i in range(n + 1)], r, mi, segs=6)


def ring_seam(p, rfn, z, a0, a1, mi=EMIT, r=0.004, n=28, off=0.0, sx=1, sy=1):
    p.tube([on(rfn, a0 + (a1 - a0) * i / n, z, off, sx, sy) for i in range(n + 1)], r, mi, segs=6)


def rivets(p, rfn, pts, off=0.006, r=0.0075, sx=1, sy=1):
    for a, z in pts:
        p.sphere(r, JOINT, on(rfn, a, z, off, sx, sy), segs=(10, 6))


def upper_arm():
    p = Part("UpperArm")
    p.sphere(0.128, JOINT, (0, 0, 0))                                          # 肩関節（球）
    p.cyl(0.08, 0.068, 0.86, JOINT, T((0, 0, 0.05)), segs=20)                   # 内部フレーム
    for z in (0.34, 0.5, 0.66):
        p.torus(0.082, 0.009, JOINT, (0, 0, z), segs=(24, 6))

    # 肩の装甲：連続した面を3段に切り分ける（前→外側→後ろ。体側は開ける）
    a0, a1 = FRONT - 0.55, BACK + 0.6
    bands = [(-0.17, 0.06, 0.006), (0.06 + ZGAP, 0.2, 0.003), (0.2 + ZGAP, 0.35, 0.0)]
    for z0, z1, off in bands:
        p.surface(lambda a, z, off=off: r_shoulder(a, z) + off, z0, z1, a0, a1, 0.016, SHELL,
                  nu=36, nv=12 if z0 < 0 else 6, lip=0.004)
    ring_seam(p, r_shoulder, 0.066, a0 + 0.1, a1 - 0.1, off=-0.004)             # 段の奥の発光
    ring_seam(p, r_shoulder, 0.206, a0 + 0.1, a1 - 0.1, off=-0.006)
    seam(p, r_shoulder, LAT, -0.1, 0.05, JOINT, r=0.004, off=0.007)            # 外側の稜線（溝）
    rivets(p, r_shoulder, [(FRONT - 0.4, 0.13), (LAT, 0.13), (BACK + 0.45, 0.13)], off=0.006)

    # 上腕の装甲：二頭筋（前）・外側・三頭筋（後ろ）を隙間で分割
    p.surface(r_upper, 0.3, 0.8, FRONT - 0.95, FRONT + 0.95, 0.015, SHELL, nu=28, nv=18, lip=0.004)
    p.surface(r_upper, 0.34, 0.76, FRONT + 0.95 + GAP, LAT + 0.85, 0.014, SHELL, nu=20, nv=14, lip=0.004)
    p.surface(r_upper, 0.32, 0.78, LAT + 0.85 + GAP, BACK + 0.55, 0.014, SHELL, nu=20, nv=16, lip=0.004)
    seam(p, r_upper, FRONT, 0.36, 0.5)                                          # 二頭筋の中央の発光
    seam(p, r_upper, FRONT, 0.56, 0.74)
    ring_seam(p, r_upper, 0.53, FRONT - 0.9, FRONT + 0.9, JOINT, r=0.0035, off=0.001)   # パネルの溝
    for g in (FRONT + 0.95 + GAP / 2, LAT + 0.85 + GAP / 2):                    # 板の隙間の奥の発光
        seam(p, r_upper, g, 0.38, 0.72, off=-0.006)
    rivets(p, r_upper, [(FRONT - 0.82, 0.34), (FRONT + 0.82, 0.34), (FRONT - 0.82, 0.76), (FRONT + 0.82, 0.76),
                        (LAT + 0.3, 0.38), (LAT + 0.3, 0.72)])

    # 肘の上のバンド（前〜外側）
    band = lambda a, z: 0.14 - 0.02 * (z - 0.82)
    p.surface(band, 0.82, 0.93, FRONT - 2.2, FRONT + 2.2, 0.013, SHELL, nu=32, nv=3, lip=0.003)
    ring_seam(p, band, 0.818, FRONT - 1.6, FRONT + 1.6, off=-0.004)

    # 体側に露出した油圧ピストンとケーブル
    for da in (0.72, 1.12):
        a = BACK + da
        x, y = math.cos(a) * 0.118, math.sin(a) * 0.118
        p.piston((x, y, 0.15), (x * 0.92, y * 0.92, 0.86), 0.021, 0.012)
    for a, rr, wob in ((MED - 0.3, 0.1, 0.012), (MED + 0.02, 0.103, -0.01), (MED - 0.55, 0.098, 0.009)):
        p.tube([(math.cos(a) * (rr + wob * math.sin(z * 6)), math.sin(a) * (rr + wob * math.sin(z * 6)), z)
                for z in [0.08 + 0.085 * i for i in range(11)]], 0.009, JOINT, segs=8)
        for z in (0.3, 0.62):                                                  # ケーブルの留め具
            p.torus(0.0125, 0.004, SHELL, (math.cos(a) * rr, math.sin(a) * rr, z), segs=(12, 4))

    # 肘のフォークとベアリング
    for s in (-1, 1):
        p.box((0.03, 0.15, 0.17), SHELL, (s * 0.118, 0.0, 0.93), bevel=0.012)
        p.cyl_x(0.071, 0.026, SHELL, (s * 0.137, 0, 1.0))
        p.cyl_x(0.05, 0.03, JOINT, (s * 0.139, 0, 1.0))
        p.torus(0.06, 0.0035, EMIT, (s * 0.151, 0, 1.0), rot=(0, math.pi / 2, 0), segs=(32, 6))
        p.bolts((s * 0.152, 0, 1.0), 0.04, 6, 0.006, axis="X", depth=0.008)
        p.cyl_x(0.018, 0.012, SHELL, (s * 0.157, 0, 1.0))
    return p


def forearm():
    p = Part("Forearm")
    SX, SY = 1.08, 0.92
    kw = dict(sx=SX, sy=SY)
    p.cyl_x(0.06, 0.2, JOINT, (0, 0, 0))                                        # 肘のヒンジ
    p.surface(lambda a, z: 0.072, -0.03, 0.08, BACK - 1.0, BACK + 1.0, 0.012, SHELL, nu=16, nv=4, lip=0.005)  # 肘頭
    p.sphere(0.058, JOINT, (0, 0.045, 0.02), scale=(1, 0.8, 1))
    for s in (-1, 1):                                                           # 橈骨・尺骨
        p.cyl(0.027, 0.023, 0.86, JOINT, T((s * 0.042, 0.015, 0.05)), segs=14)
    p.cyl(0.066, 0.056, 0.1, JOINT, T((0, 0, 0.04)), segs=20)
    # 装甲：前面2枚（境目に発光）、外側1枚、体側の細い板。背面は機構を見せる
    p.surface(r_fore, 0.1, 0.5, FRONT - 0.9, FRONT + 0.75, 0.014, SHELL, nu=24, nv=14, lip=0.004, **kw)
    p.surface(r_fore, 0.5 + ZGAP, 0.86, FRONT - 0.85, FRONT + 0.75, 0.013, SHELL, nu=24, nv=12, lip=0.004, **kw)
    p.surface(r_fore, 0.12, 0.72, FRONT + 0.75 + GAP, LAT + 0.75, 0.013, SHELL, nu=18, nv=14, lip=0.004, **kw)
    p.surface(r_fore, 0.16, 0.64, MED - 0.55, MED + 0.12, 0.012, SHELL, nu=12, nv=10, lip=0.003, **kw)
    seam(p, r_fore, FRONT - 0.08, 0.16, 0.46, **kw)
    seam(p, r_fore, FRONT - 0.08, 0.56, 0.82, **kw)
    ring_seam(p, r_fore, 0.5 + ZGAP / 2, FRONT - 0.8, FRONT + 0.7, off=-0.005, **kw)
    seam(p, r_fore, FRONT + 0.75 + GAP / 2, 0.18, 0.66, off=-0.006, **kw)
    rivets(p, r_fore, [(FRONT - 0.78, 0.14), (FRONT + 0.62, 0.14), (FRONT - 0.72, 0.82), (FRONT + 0.62, 0.82)], **kw)
    for i in range(6):                                                          # 外側の放熱スリット
        z = 0.22 + i * 0.05
        a = LAT - 0.2
        x, y, _ = on(r_fore, a, z, 0.002, SX, SY)
        p.box((0.007, 0.075, 0.016), JOINT, (x, y, z), rot=(0, 0, a))
    # 背面の機構
    for s in (-1, 1):
        a = BACK + s * 0.55
        x, y = math.cos(a) * 0.1, math.sin(a) * 0.1
        p.piston((x, y, 0.1), (x * 0.85, y * 0.85, 0.82), 0.018, 0.01)
    for a, wob in ((BACK, 0.01), (BACK + 0.25, -0.008)):
        p.tube([(math.cos(a) * (0.085 + wob * math.sin(z * 7)), math.sin(a) * (0.085 + wob * math.sin(z * 7)), z)
                for z in [0.08 + 0.085 * i for i in range(11)]], 0.008, JOINT, segs=8)
    # 手首：重なるリング
    p.cyl(0.098, 0.094, 0.05, JOINT, T((0, 0, 0.87)), segs=28)
    p.torus(0.098, 0.009, SHELL, (0, 0, 0.88), segs=(32, 8))
    p.torus(0.095, 0.004, EMIT, (0, 0, 0.92), segs=(32, 6))
    p.torus(0.092, 0.009, SHELL, (0, 0, 0.96), segs=(32, 8))
    return p


def phalanx(p, w, l, shell=True):
    """指の1節（ローカル：+Z へ長さ l）。芯（暗色）＋手の甲側を包むクロームの殻"""
    p.cyl(w * 0.29, w * 0.26, l, JOINT, segs=12)
    p.box((w * 0.62, w * 0.32, l * 0.7), JOINT, (0, w * 0.14, l * 0.5), bevel=w * 0.12)       # 腹側のパッド
    if shell:
        p.surface(lambda a, z: w * 0.5 - 0.06 * w * (z / max(l, 1e-3)), l * 0.06, l * 0.9,
                  FRONT - 1.45, FRONT + 1.45, w * 0.13, SHELL, nu=12, nv=3, lip=w * 0.04)


def hand():
    p = Part("Hand")   # 右手：手の甲＝-Y、親指＝体側（-X）
    p.sphere(0.06, JOINT, (0, 0, 0))
    # 手根部：曲面の板
    p.surface(lambda a, z: 0.16, 0.035, 0.12, FRONT - 0.62, FRONT + 0.62, 0.02, SHELL, nu=16, nv=3, lip=0.004,
              m=T((0, 0.12, 0)))
    p.box((0.21, 0.07, 0.1), JOINT, (0, 0.01, 0.08), bevel=0.025)
    # 手のひらの芯と手の甲の曲面装甲
    p.box((0.29, 0.07, 0.33), JOINT, (0, 0.01, 0.27), bevel=0.03)
    back = lambda a, z: 0.38
    p.surface(back, 0.13, 0.42, FRONT - 0.42, FRONT + 0.42, 0.022, SHELL, nu=20, nv=8, lip=0.004, m=T((0, 0.34, 0)))
    for x in (-0.067, 0.0, 0.066):                                             # 中手骨の間の溝
        a = FRONT + math.asin(x / 0.38)
        p.tube([(math.cos(a) * 0.381, 0.34 + math.sin(a) * 0.381, z) for z in (0.15, 0.28, 0.4)], 0.0035, JOINT, segs=6)
    p.tube([(math.cos(FRONT + t) * 0.383, 0.34 + math.sin(FRONT + t) * 0.383, 0.405)
            for t in [-0.36 + 0.072 * i for i in range(11)]], 0.0045, EMIT, segs=6)  # ナックル上の発光
    p.box((0.25, 0.03, 0.22), JOINT, (0, 0.05, 0.27), bevel=0.012)            # 手のひらのパッド

    fingers = [(-0.1, 0.44, 0.068, -4), (-0.033, 0.48, 0.07, -1), (0.033, 0.45, 0.066, 2), (0.097, 0.36, 0.058, 6)]
    for x, L, w, splay in fingers:
        cur = T((x, 0.0, 0.44), (0, math.radians(splay), 0))
        placed(p, cur, lambda w=w: (p.cyl_x(w * 0.4, w * 0.95, JOINT, (0, 0, 0)),
                                    p.sphere(w * 0.36, SHELL, (0, -w * 0.18, 0), scale=(1.15, 0.7, 0.9), segs=(14, 8))))  # ナックル
        for seg, bend in zip((0.45, 0.31, 0.24), (-10, -18, -14)):
            cur = cur @ T(rot=(math.radians(bend), 0, 0))
            l = L * seg
            placed(p, cur, lambda l=l, w=w: phalanx(p, w, l))
            cur = cur @ T((0, 0, l))
            placed(p, cur, lambda w=w: p.cyl_x(w * 0.31, w * 0.86, JOINT, (0, 0, 0)))
        placed(p, cur, lambda w=w: p.sphere(w * 0.42, SHELL, (0, -w * 0.05, 0.006), scale=(1.1, 0.85, 1.0), segs=(16, 10)))
    # 親指（体側・手のひら側へ向ける）
    cur = T((-0.13, 0.02, 0.09), (math.radians(-48), math.radians(-30), math.radians(10)))
    p.sphere(0.045, JOINT, tuple(cur @ Vector((0, 0, 0))))
    for l, bend, w in ((0.16, 0, 0.082), (0.13, -12, 0.074), (0.1, -16, 0.07)):
        cur = cur @ T(rot=(math.radians(bend), 0, 0))
        placed(p, cur, lambda l=l, w=w: phalanx(p, w, l))
        cur = cur @ T((0, 0, l))
        placed(p, cur, lambda w=w: p.cyl_x(w * 0.31, w * 0.8, JOINT, (0, 0, 0)))
    placed(p, cur, lambda: p.sphere(0.03, SHELL, (0, -0.004, 0.006), scale=(1.1, 0.85, 1.0), segs=(16, 10)))
    return p


def placed(p, matrix, add):
    """add() で追加した形状だけを matrix で移動する（それ以前の頂点は動かさない）。
    bmesh は削除した頂点の領域を再利用するため、番号ではなく印（int レイヤー）で新しい頂点を見分ける"""
    bm = p.bm
    mark = bm.verts.layers.int.get("old") or bm.verts.layers.int.new("old")
    for v in bm.verts:
        v[mark] = 1
    add()
    bmesh.ops.transform(bm, matrix=matrix, verts=[v for v in bm.verts if v[mark] == 0])


def build(materials):
    return [fn().build(materials) for fn in (upper_arm, forearm, hand)]


# ---- 指を関節ごとに分けた手（指の追跡用）----
FINGER_NAMES = ("Index", "Middle", "Ring", "Pinky")


def hand_rig():
    p = Part("Hand")   # 右手：手の甲＝-Y、親指＝体側（-X）
    p.sphere(0.06, JOINT, (0, 0, 0))
    p.surface(lambda a, z: 0.16, 0.035, 0.12, FRONT - 0.62, FRONT + 0.62, 0.02, SHELL, nu=16, nv=3, lip=0.004,
              m=T((0, 0.12, 0)))
    p.box((0.21, 0.07, 0.1), JOINT, (0, 0.01, 0.08), bevel=0.025)
    p.box((0.29, 0.07, 0.33), JOINT, (0, 0.01, 0.27), bevel=0.03)
    p.surface(lambda a, z: 0.38, 0.13, 0.42, FRONT - 0.42, FRONT + 0.42, 0.022, SHELL, nu=20, nv=8, lip=0.004, m=T((0, 0.34, 0)))
    for x in (-0.067, 0.0, 0.066):
        a = FRONT + math.asin(x / 0.38)
        p.tube([(math.cos(a) * 0.381, 0.34 + math.sin(a) * 0.381, z) for z in (0.15, 0.28, 0.4)], 0.0035, JOINT, segs=6)
    p.tube([(math.cos(FRONT + t) * 0.383, 0.34 + math.sin(FRONT + t) * 0.383, 0.405)
            for t in [-0.36 + 0.072 * i for i in range(11)]], 0.0045, EMIT, segs=6)
    p.box((0.25, 0.03, 0.22), JOINT, (0, 0.05, 0.27), bevel=0.012)
    bones = []
    fingers = [(-0.1, 0.44, 0.068, -4), (-0.033, 0.48, 0.07, -1), (0.033, 0.45, 0.066, 2), (0.097, 0.36, 0.058, 6)]
    for name, (x, L, w, splay) in zip(FINGER_NAMES, fingers):
        cur = T((x, 0.0, 0.44), (0, math.radians(splay), 0))
        placed(p, cur, lambda w=w: p.sphere(w * 0.36, SHELL, (0, -w * 0.18, 0), scale=(1.15, 0.7, 0.9), segs=(14, 8)))
        for k, (seg, bend) in enumerate(zip((0.45, 0.31, 0.24), (-10, -18, -14))):
            cur = cur @ T(rot=(math.radians(bend), 0, 0))
            l = L * seg
            def geo(q, l=l, w=w, k=k):
                q.cyl_x(w * (0.4 if k == 0 else 0.31), w * (0.95 if k == 0 else 0.86), JOINT, (0, 0, 0))
                phalanx(q, w, l)
                if k == 2:
                    q.sphere(w * 0.42, SHELL, (0, -w * 0.05, l + 0.006), scale=(1.1, 0.85, 1.0), segs=(16, 10))
            bones.append(Bone(f"{name}{k + 1}", cur, l, w * 0.5, geo))
            cur = cur @ T((0, 0, l))
    cur = T((-0.13, 0.02, 0.09), (math.radians(-48), math.radians(-30), math.radians(10)))
    for k, (l, bend, w) in enumerate(((0.16, 0, 0.082), (0.13, -12, 0.074), (0.1, -16, 0.07))):
        cur = cur @ T(rot=(math.radians(bend), 0, 0))
        def geo(q, l=l, w=w, k=k):
            if k == 0:
                q.sphere(0.045, JOINT, (0, 0, 0))
            else:
                q.cyl_x(w * 0.31, w * 0.8, JOINT, (0, 0, 0))
            phalanx(q, w, l)
            if k == 2:
                q.sphere(0.03, SHELL, (0, -0.004, l + 0.006), scale=(1.1, 0.85, 1.0), segs=(16, 10))
        bones.append(Bone(f"Thumb{k + 1}", cur, l, w * 0.5, geo))
        cur = cur @ T((0, 0, l))
    return p, bones


def build(materials):
    palm, bones = hand_rig()
    return [upper_arm().build(materials), forearm().build(materials),
            build_hand(materials, palm, bones, track_length=0.44, track_radius=0.145)]
