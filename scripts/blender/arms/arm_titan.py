# 腕モデル「TITAN FRAME」：重作業用の外骨格。厚い装甲ブロック、外側の太い支持フレーム、大型ピストン、琥珀色の表示灯。
# 右腕として作る（外側＝+X、体側＝-X、前面＝-Y）。部品・マテリアル名は CHROME と同じ規格。
import math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from arm_lib import *
from arm_chrome import BACK, LAT, MED, on, seam, ring_seam, rivets, placed, smooth, phalanx

GAP = 0.08


def materials():
    return make_materials(shell_color=(0.3, 0.31, 0.33), shell_rough=0.42,
                          joint_color=(0.035, 0.035, 0.04), emit_color=(1.0, 0.55, 0.0), emit_strength=7.0)


def r_up(a, z):
    return (0.175 - 0.03 * z + 0.03 * bump(z, 0.5, 0.25) * lobe(a, FRONT, 2)
            + 0.025 * bump(z, 0.4, 0.25) * lobe(a, BACK, 2) + 0.02 * lobe(a, LAT, 2))


def r_sh(a, z):
    dome = 0.25 * math.sin(min(1.0, max(0.0, (z + 0.18) / 0.22)) * math.pi / 2) ** 0.45
    return dome - 0.05 * smooth(0.05, 0.36, z) + 0.02 * lobe(a, LAT, 2)


def r_fo(a, z):
    return 0.16 - 0.02 * z + 0.02 * bump(z, 0.3, 0.3) * lobe(a, -0.4, 2)


def upper_arm():
    p = Part("UpperArm")
    p.sphere(0.14, JOINT, (0, 0, 0))
    p.cyl(0.095, 0.085, 0.86, JOINT, T((0, 0, 0.05)), segs=20)
    # 大きな肩当て（2段、厚い）
    a0, a1 = FRONT - 0.6, BACK + 0.65
    p.surface(r_sh, -0.18, 0.12, a0, a1, 0.03, SHELL, nu=30, nv=10, lip=0.012)
    p.surface(lambda a, z: r_sh(a, z) - 0.01, 0.13, 0.33, a0 + 0.1, a1 - 0.1, 0.026, SHELL, nu=26, nv=5, lip=0.01)
    for a in (FRONT - 0.3, FRONT + 0.3, LAT, BACK + 0.4):                         # 肩当ての表示灯
        x, y, z = on(r_sh, a, 0.0, 0.012)
        p.box((0.03, 0.01, 0.012), EMIT, (x, y, z), rot=(0, 0, a + math.pi / 2))
    rivets(p, r_sh, [(FRONT - 0.45 + 0.3 * i, 0.07) for i in range(7)], off=0.012, r=0.01)
    # 厚い装甲ブロック
    for b0, b1, z0, z1 in [(FRONT - 0.9, FRONT + 0.9, 0.34, 0.8), (FRONT + 0.9 + GAP, LAT + 0.95, 0.36, 0.78),
                           (LAT + 0.95 + GAP, BACK + 0.55, 0.34, 0.8)]:
        p.surface(r_up, z0, z1, b0, b1, 0.026, SHELL, nu=20, nv=12, lip=0.01)
    ring_seam(p, r_up, 0.57, FRONT - 0.85, FRONT + 0.85, JOINT, r=0.005, off=0.001)
    seam(p, r_up, FRONT, 0.4, 0.52, r=0.005, off=0.005)                           # 前面の表示灯
    # 外側の支持フレーム（外骨格）：肩から肘までの2本のバー
    for dz in (-0.03, 0.03):
        x0 = r_up(LAT, 0.3) + 0.04
        p.box((0.03, 0.05, 0.72), JOINT, (x0, dz * 2, 0.6), bevel=0.008)
    p.cyl_x(0.03, 0.06, SHELL, (r_up(LAT, 0.3) + 0.04, 0, 0.27))
    # 前面の大型ピストン（2本）
    for s in (-1, 1):
        a = FRONT + s * 0.5
        x, y, _ = on(r_up, a, 0.3, 0.04)
        x2, y2, _ = on(r_up, a, 0.85, 0.02)
        p.piston((x, y, 0.3), (x2, y2, 0.9), 0.03, 0.017)
    for a in (MED - 0.3, MED + 0.1):
        p.tube([(math.cos(a) * 0.11, math.sin(a) * 0.11, z) for z in [0.1 + 0.08 * k for k in range(11)]], 0.016, JOINT, segs=10)
    # 肘：歯車状のハブ
    for s in (-1, 1):
        p.box((0.04, 0.2, 0.2), SHELL, (s * 0.14, 0.0, 0.92), bevel=0.014)
        p.cyl_x(0.095, 0.04, SHELL, (s * 0.17, 0, 1.0))
        for k in range(12):
            ang = 2 * math.pi * k / 12
            p.box((0.034, 0.02, 0.026), JOINT, (s * 0.17, math.cos(ang) * 0.105, 1.0 + math.sin(ang) * 0.105), rot=(-ang, 0, 0))
        p.torus(0.07, 0.005, EMIT, (s * 0.192, 0, 1.0), rot=(0, math.pi / 2, 0), segs=(32, 6))
        p.cyl_x(0.03, 0.02, JOINT, (s * 0.195, 0, 1.0))
    return p


def forearm():
    p = Part("Forearm")
    p.cyl_x(0.08, 0.24, JOINT, (0, 0, 0))
    for s in (-1, 1):
        p.cyl(0.036, 0.032, 0.86, JOINT, T((s * 0.055, 0.02, 0.05)), segs=14)
    # 重い籠手：前面・外側・後ろの厚い板
    for b0, b1, z0, z1 in [(FRONT - 1.0, FRONT + 0.85, 0.1, 0.5), (FRONT - 1.0, FRONT + 0.85, 0.51, 0.86),
                           (FRONT + 0.85 + GAP, LAT + 1.0, 0.1, 0.84), (LAT + 1.0 + GAP, BACK + 0.6, 0.12, 0.7)]:
        p.surface(r_fo, z0, z1, b0, b1, 0.026, SHELL, nu=20, nv=10, lip=0.01)
    for i in range(4):                                                              # 警告灯の帯
        z = 0.6 + 0.05 * i
        x, y, _ = on(r_fo, FRONT + 0.3, z, 0.004)
        p.box((0.05, 0.008, 0.018), EMIT, (x, y, z), rot=(0.4, 0, FRONT + 0.3 + math.pi / 2))
    rivets(p, r_fo, [(FRONT - 0.85 + 0.35 * i, 0.15) for i in range(6)] + [(FRONT - 0.85 + 0.35 * i, 0.8) for i in range(6)],
           off=0.012, r=0.009)
    # 外側の支持フレームと背面の大型ピストン
    xo = r_fo(LAT, 0.3) + 0.035
    p.box((0.03, 0.05, 0.75), JOINT, (xo, 0, 0.45), bevel=0.008)
    for s in (-1, 1):
        a = BACK + s * 0.5
        x, y = math.cos(a) * 0.15, math.sin(a) * 0.15
        p.piston((x, y, 0.08), (x * 0.85, y * 0.85, 0.85), 0.028, 0.016)
    # 手首のロック機構
    p.cyl(0.13, 0.125, 0.08, JOINT, T((0, 0, 0.87)), segs=12)
    for k in range(6):
        ang = 2 * math.pi * k / 6
        p.box((0.03, 0.03, 0.08), SHELL, (math.cos(ang) * 0.13, math.sin(ang) * 0.13, 0.91), rot=(0, 0, ang), bevel=0.006)
    p.torus(0.12, 0.006, EMIT, (0, 0, 0.955), segs=(32, 6))
    return p


def hand():
    p = Part("Hand")   # 太い指の作業用ハンド
    p.sphere(0.075, JOINT, (0, 0, 0))
    p.box((0.34, 0.1, 0.36), JOINT, (0, 0.01, 0.27), bevel=0.035)
    p.surface(lambda a, z: 0.4, 0.1, 0.44, FRONT - 0.46, FRONT + 0.46, 0.035, SHELL, nu=16, nv=6, lip=0.008, m=T((0, 0.34, 0)))
    for i in range(3):
        p.box((0.05, 0.01, 0.016), EMIT, (-0.08 + 0.08 * i, -0.075, 0.2))
    for x, L, w, splay in [(-0.115, 0.42, 0.085, -3), (-0.04, 0.45, 0.088, -1), (0.04, 0.43, 0.084, 1), (0.115, 0.36, 0.078, 4)]:
        cur = T((x, 0.0, 0.45), (0, math.radians(splay), 0))
        placed(p, cur, lambda w=w: p.cyl_x(w * 0.45, w * 0.98, JOINT, (0, 0, 0)))
        for seg, bend in zip((0.45, 0.32, 0.23), (-12, -20, -16)):
            cur = cur @ T(rot=(math.radians(bend), 0, 0))
            l = L * seg
            placed(p, cur, lambda l=l, w=w: (phalanx(p, w, l),
                                             p.box((w * 0.9, w * 0.2, l * 0.5), SHELL, (0, -w * 0.52, l * 0.5), bevel=w * 0.08)))
            cur = cur @ T((0, 0, l))
            placed(p, cur, lambda w=w: p.cyl_x(w * 0.34, w * 0.9, JOINT, (0, 0, 0)))
        placed(p, cur, lambda w=w: p.box((w * 0.9, w * 0.7, w * 0.4), SHELL, (0, 0, w * 0.12), bevel=w * 0.15))
    cur = T((-0.16, 0.03, 0.1), (math.radians(-45), math.radians(-30), math.radians(10)))
    for l, bend, w in ((0.17, 0, 0.1), (0.13, -14, 0.092), (0.1, -16, 0.088)):
        cur = cur @ T(rot=(math.radians(bend), 0, 0))
        placed(p, cur, lambda l=l, w=w: phalanx(p, w, l))
        cur = cur @ T((0, 0, l))
    placed(p, cur, lambda: p.box((0.08, 0.06, 0.035), SHELL, (0, 0, 0.012), bevel=0.012))
    return p


def build(materials):
    return [fn().build(materials, bevel=0.005) for fn in (upper_arm, forearm, hand)]


def hand_rig():
    p = Part("Hand")
    p.sphere(0.075, JOINT, (0, 0, 0))
    p.box((0.34, 0.1, 0.36), JOINT, (0, 0.01, 0.27), bevel=0.035)
    p.surface(lambda a, z: 0.4, 0.1, 0.44, FRONT - 0.46, FRONT + 0.46, 0.035, SHELL, nu=16, nv=6, lip=0.008, m=T((0, 0.34, 0)))
    for i in range(3):
        p.box((0.05, 0.01, 0.016), EMIT, (-0.08 + 0.08 * i, -0.075, 0.2))
    bones = []
    fingers = [(-0.115, 0.42, 0.085, -3), (-0.04, 0.45, 0.088, -1), (0.04, 0.43, 0.084, 1), (0.115, 0.36, 0.078, 4)]
    for name, (x, L, w, splay) in zip(("Index", "Middle", "Ring", "Pinky"), fingers):
        cur = T((x, 0.0, 0.45), (0, math.radians(splay), 0))
        for k, (seg, bend) in enumerate(zip((0.45, 0.32, 0.23), (-12, -20, -16))):
            cur = cur @ T(rot=(math.radians(bend), 0, 0))
            l = L * seg
            def geo(q, l=l, w=w, k=k):
                q.cyl_x(w * (0.45 if k == 0 else 0.34), w * (0.98 if k == 0 else 0.9), JOINT, (0, 0, 0))
                phalanx(q, w, l)
                q.box((w * 0.9, w * 0.2, l * 0.5), SHELL, (0, -w * 0.52, l * 0.5), bevel=w * 0.08)
                if k == 2:
                    q.box((w * 0.9, w * 0.7, w * 0.4), SHELL, (0, 0, l + w * 0.12), bevel=w * 0.15)
            bones.append(Bone(f"{name}{k + 1}", cur, l, w * 0.5, geo))
            cur = cur @ T((0, 0, l))
    cur = T((-0.16, 0.03, 0.1), (math.radians(-45), math.radians(-30), math.radians(10)))
    for k, (l, bend, w) in enumerate(((0.17, 0, 0.1), (0.13, -14, 0.092), (0.1, -16, 0.088))):
        cur = cur @ T(rot=(math.radians(bend), 0, 0))
        def geo(q, l=l, w=w, k=k):
            phalanx(q, w, l)
            if k == 2:
                q.box((0.08, 0.06, 0.035), SHELL, (0, 0, l + 0.012), bevel=0.012)
        bones.append(Bone(f"Thumb{k + 1}", cur, l, w * 0.5, geo))
        cur = cur @ T((0, 0, l))
    return p, bones


def build(materials):
    palm, bones = hand_rig()
    return [upper_arm().build(materials, bevel=0.005), forearm().build(materials, bevel=0.005),
            build_hand(materials, palm, bones, track_length=0.45, track_radius=0.17, bevel=0.005)]
