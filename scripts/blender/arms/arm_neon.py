# 腕モデル「NEON EDGE」：細身で角のある黒いクロームの装甲と、板の縁に沿った多数の発光ライン。
# 右腕として作る（外側＝+X、体側＝-X、前面＝-Y）。部品・マテリアル名は CHROME と同じ規格。
import math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from arm_lib import *
from arm_chrome import BACK, LAT, MED, on, seam, ring_seam, placed, smooth

GAP = 0.09


def materials():
    return make_materials(shell_color=(0.02, 0.022, 0.026), shell_rough=0.07,
                          joint_color=(0.05, 0.055, 0.065), emit_color=(0.0, 0.9, 1.0), emit_strength=9.0)


def flat(faces):
    for f in faces:
        f.smooth = False
    return faces


def r_up(a, z):     # 細身：前は鋭い稜線、横は平ら
    return (0.128 - 0.024 * z + 0.022 * bump(z, 0.5, 0.22) * lobe(a, FRONT, 6)
            + 0.016 * bump(z, 0.42, 0.22) * lobe(a, BACK, 4))


def r_sh(a, z):
    dome = 0.19 * math.sin(min(1.0, max(0.0, (z + 0.15) / 0.2)) * math.pi / 2) ** 0.5
    return dome - 0.05 * smooth(0.02, 0.3, z) + 0.03 * lobe(a, LAT, 8) * bump(z, 0.02, 0.12)  # 外側へ突き出た鋭いフィン


def r_fo(a, z):
    return 0.112 - 0.034 * z + 0.02 * bump(z, 0.22, 0.2) * lobe(a, -0.6, 4)


def upper_arm():
    p = Part("UpperArm")
    p.sphere(0.11, JOINT, (0, 0, 0), segs=(20, 12))
    p.cyl(0.07, 0.06, 0.86, JOINT, T((0, 0, 0.05)), segs=12)
    a0, a1 = FRONT - 0.5, BACK + 0.5
    for z0, z1, off in ((-0.15, 0.08, 0.004), (0.08 + 0.014, 0.3, 0.0)):
        flat(p.surface(lambda a, z, off=off: r_sh(a, z) + off, z0, z1, a0, a1, 0.012, SHELL, nu=14, nv=6, lip=0.0))
    ring_seam(p, r_sh, 0.087, a0 + 0.05, a1 - 0.05, off=-0.003, r=0.0035)
    # 細い装甲：前・外・後ろの3枚。縁に沿って発光させる
    plates = [(FRONT - 0.8, FRONT + 0.8, 0.27, 0.8), (FRONT + 0.8 + GAP, LAT + 0.8, 0.3, 0.76), (LAT + 0.8 + GAP, BACK + 0.6, 0.29, 0.79)]
    for b0, b1, z0, z1 in plates:
        flat(p.surface(r_up, z0, z1, b0, b1, 0.011, SHELL, nu=10, nv=8, lip=0.0))
        for b in (b0 + 0.04, b1 - 0.04):
            seam(p, r_up, b, z0 + 0.03, z1 - 0.03, r=0.0032, off=0.002)
        ring_seam(p, r_up, z1 - 0.02, b0 + 0.04, b1 - 0.04, r=0.0032, off=0.002, n=10)
    # 体側：細いケーブルの束
    for i, a in enumerate((MED - 0.35, MED - 0.15, MED + 0.05, MED + 0.25)):
        rr = 0.085 + 0.005 * (i % 2)
        p.tube([(math.cos(a) * (rr + 0.006 * math.sin(z * 9 + i)), math.sin(a) * (rr + 0.006 * math.sin(z * 9 + i)), z)
                for z in [0.08 + 0.085 * k for k in range(11)]], 0.006, JOINT if i % 2 else EMIT, segs=6)
    # 肘：細いフォーク
    for s in (-1, 1):
        p.box((0.022, 0.12, 0.16), SHELL, (s * 0.1, 0.0, 0.93), bevel=0.006)
        p.cyl_x(0.056, 0.02, SHELL, (s * 0.115, 0, 1.0), segs=6)                    # 六角形のハブ
        p.torus(0.045, 0.003, EMIT, (s * 0.127, 0, 1.0), rot=(0, math.pi / 2, 0), segs=(6, 4))
    return p


def forearm():
    p = Part("Forearm")
    p.cyl_x(0.05, 0.17, JOINT, (0, 0, 0), segs=6)
    p.cyl(0.05, 0.04, 0.9, JOINT, T((0, 0.01, 0.04)), segs=10)
    plates = [(FRONT - 0.85, FRONT + 0.7, 0.08, 0.46), (FRONT - 0.8, FRONT + 0.7, 0.475, 0.87), (FRONT + 0.7 + GAP, LAT + 0.9, 0.1, 0.74),
              (LAT + 0.9 + GAP, BACK + 0.4, 0.14, 0.66)]
    for b0, b1, z0, z1 in plates:
        flat(p.surface(r_fo, z0, z1, b0, b1, 0.01, SHELL, nu=10, nv=8, lip=0.0))
        for b in (b0 + 0.04, b1 - 0.04):
            seam(p, r_fo, b, z0 + 0.03, z1 - 0.03, r=0.003, off=0.002)
    # 外側の刃のようなフィン
    for z in (0.2, 0.3, 0.4):
        x, y, _ = on(r_fo, LAT + 0.2, z, 0.0)
        flat(p.box((0.05, 0.008, 0.07), SHELL, (x + 0.02, y, z), rot=(0, 0.5, LAT + 0.2)))
    for i, a in enumerate((BACK + 0.6, BACK + 0.9, MED + 0.3)):
        p.tube([(math.cos(a) * 0.075, math.sin(a) * 0.075, z) for z in [0.06 + 0.09 * k for k in range(10)]], 0.006,
               EMIT if i == 1 else JOINT, segs=6)
    p.cyl(0.085, 0.078, 0.11, JOINT, T((0, 0, 0.88)), segs=8)
    p.torus(0.086, 0.004, EMIT, (0, 0, 0.92), segs=(8, 4))
    p.sphere(0.055, JOINT, (0, 0, 1.0), segs=(16, 10))                                # 手首の受け
    return p


def hand():
    p = Part("Hand")
    p.sphere(0.05, JOINT, (0, 0, 0), segs=(16, 10))
    p.box((0.24, 0.06, 0.32), JOINT, (0, 0.01, 0.26), bevel=0.02)
    flat(p.surface(lambda a, z: 0.36, 0.12, 0.42, FRONT - 0.36, FRONT + 0.36, 0.016, SHELL, nu=8, nv=4, m=T((0, 0.32, 0))))
    p.tube([(math.cos(FRONT + t) * 0.363, 0.32 + math.sin(FRONT + t) * 0.363, z) for t, z in
            [(-0.3, 0.14), (0.0, 0.3), (0.3, 0.14)]], 0.004, EMIT, segs=6)            # 甲の V 字の発光
    for x, L, w, splay in [(-0.085, 0.46, 0.054, -4), (-0.028, 0.5, 0.056, -1), (0.028, 0.47, 0.053, 2), (0.083, 0.38, 0.047, 6)]:
        cur = T((x, 0.0, 0.43), (0, math.radians(splay), 0))
        placed(p, cur, lambda w=w: p.cyl_x(w * 0.34, w * 0.9, JOINT, (0, 0, 0), segs=6))
        for seg, bend in zip((0.44, 0.3, 0.26), (-8, -14, -10)):
            cur = cur @ T(rot=(math.radians(bend), 0, 0))
            l = L * seg
            placed(p, cur, lambda l=l, w=w: (p.cyl(w * 0.24, w * 0.2, l, JOINT, segs=6),
                                             flat(p.box((w * 0.9, w * 0.3, l * 0.82), SHELL, (0, -w * 0.18, l * 0.5)))))
            cur = cur @ T((0, 0, l))
        placed(p, cur, lambda w=w: p.cyl(w * 0.22, 0.0, w * 0.9, SHELL, segs=4))         # 鋭い指先
    cur = T((-0.115, 0.02, 0.09), (math.radians(-48), math.radians(-30), math.radians(10)))
    for l, bend in ((0.15, 0), (0.12, -12), (0.09, -14)):
        cur = cur @ T(rot=(math.radians(bend), 0, 0))
        placed(p, cur, lambda l=l: (p.cyl(0.016, 0.013, l, JOINT, segs=6),
                                    flat(p.box((0.058, 0.02, l * 0.82), SHELL, (0, -0.012, l * 0.5)))))
        cur = cur @ T((0, 0, l))
    placed(p, cur, lambda: p.cyl(0.014, 0.0, 0.05, SHELL, segs=4))
    return p


def build(materials):
    return [fn().build(materials, bevel=0.002) for fn in (upper_arm, forearm, hand)]


def hand_rig():
    p = Part("Hand")
    p.sphere(0.05, JOINT, (0, 0, 0), segs=(16, 10))
    p.box((0.24, 0.06, 0.32), JOINT, (0, 0.01, 0.26), bevel=0.02)
    flat(p.surface(lambda a, z: 0.36, 0.12, 0.42, FRONT - 0.36, FRONT + 0.36, 0.016, SHELL, nu=8, nv=4, m=T((0, 0.32, 0))))
    p.tube([(math.cos(FRONT + t) * 0.363, 0.32 + math.sin(FRONT + t) * 0.363, z) for t, z in
            [(-0.3, 0.14), (0.0, 0.3), (0.3, 0.14)]], 0.004, EMIT, segs=6)
    bones = []
    fingers = [(-0.085, 0.46, 0.054, -4), (-0.028, 0.5, 0.056, -1), (0.028, 0.47, 0.053, 2), (0.083, 0.38, 0.047, 6)]
    for name, (x, L, w, splay) in zip(("Index", "Middle", "Ring", "Pinky"), fingers):
        cur = T((x, 0.0, 0.43), (0, math.radians(splay), 0))
        for k, (seg, bend) in enumerate(zip((0.44, 0.3, 0.26), (-8, -14, -10))):
            cur = cur @ T(rot=(math.radians(bend), 0, 0))
            l = L * seg
            def geo(q, l=l, w=w, k=k):
                q.cyl_x(w * (0.34 if k == 0 else 0.26), w * 0.9, JOINT, (0, 0, 0), segs=6)
                q.cyl(w * 0.24, w * 0.2, l, JOINT, segs=6)
                flat(q.box((w * 0.9, w * 0.3, l * 0.82), SHELL, (0, -w * 0.18, l * 0.5)))
                if k == 2:
                    q.cyl(w * 0.22, 0.0, w * 0.9, SHELL, T((0, 0, l)), segs=4)          # 鋭い指先
            bones.append(Bone(f"{name}{k + 1}", cur, l, w * 0.5, geo))
            cur = cur @ T((0, 0, l))
    cur = T((-0.115, 0.02, 0.09), (math.radians(-48), math.radians(-30), math.radians(10)))
    for k, (l, bend) in enumerate(((0.15, 0), (0.12, -12), (0.09, -14))):
        cur = cur @ T(rot=(math.radians(bend), 0, 0))
        def geo(q, l=l, k=k):
            q.cyl(0.016, 0.013, l, JOINT, segs=6)
            flat(q.box((0.058, 0.02, l * 0.82), SHELL, (0, -0.012, l * 0.5)))
            if k == 2:
                q.cyl(0.014, 0.0, 0.05, SHELL, T((0, 0, l)), segs=4)
        bones.append(Bone(f"Thumb{k + 1}", cur, l, 0.029, geo))
        cur = cur @ T((0, 0, l))
    return p, bones


def build(materials):
    palm, bones = hand_rig()
    return [upper_arm().build(materials, bevel=0.002), forearm().build(materials, bevel=0.002),
            build_hand(materials, palm, bones, track_length=0.43, track_radius=0.12, bevel=0.002)]
