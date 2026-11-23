# 2次元の流体シミュレーション（燃料・温度・煙・渦）で炎を計算し、ループするフリップブック画像を作る。
# 使い方：python3 make-fire-flipbook.py fire.png [--preview <フォルダ>]
# 必要なもの：Python 3、numpy、scipy、Pillow。出力した PNG を JPEG（品質88）に変換して fire-flipbook.jpg にしています。
# 出力：8×8 マスのアトラス（1マス 96×192、黒背景・加算合成用）。左上から右へ、上から下へ再生する。
import sys, os
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter, zoom
from PIL import Image

rng = np.random.default_rng(7)
NX, NY = 72, 144                 # 格子（横・縦）。y は上向き
FW, FH = 96, 192                 # 1コマの画素
COLS, ROWS = 8, 8
N = COLS * ROWS                  # ループするコマ数
K = 16                           # ループのつなぎ目で重ねるコマ数
SUB = 2                          # 1コマあたりの計算ステップ
DT = 0.6

u = np.zeros((NY, NX)); v = np.zeros((NY, NX))
T = np.zeros((NY, NX)); fuel = np.zeros((NY, NX)); soot = np.zeros((NY, NX))
yy, xx = np.mgrid[0:NY, 0:NX].astype(float)

def advect(f, u, v):
    return map_coordinates(f, [yy - DT * v, xx - DT * u], order=1, mode='constant', cval=0.0)

def project(u, v, iters=50):
    div = np.zeros_like(u)
    div[1:-1, 1:-1] = 0.5 * (u[1:-1, 2:] - u[1:-1, :-2] + v[2:, 1:-1] - v[:-2, 1:-1])
    p = np.zeros_like(u)
    for _ in range(iters):
        p[1:-1, 1:-1] = (p[1:-1, 2:] + p[1:-1, :-2] + p[2:, 1:-1] + p[:-2, 1:-1] - div[1:-1, 1:-1]) / 4
    u[1:-1, 1:-1] -= 0.5 * (p[1:-1, 2:] - p[1:-1, :-2])
    v[1:-1, 1:-1] -= 0.5 * (p[2:, 1:-1] - p[:-2, 1:-1])
    return u, v

def curl(u, v):
    w = np.zeros_like(u)
    w[1:-1, 1:-1] = 0.5 * ((v[1:-1, 2:] - v[1:-1, :-2]) - (u[2:, 1:-1] - u[:-2, 1:-1]))
    return w

def vorticity(u, v, eps):
    w = curl(u, v); a = np.abs(w)
    gx = np.zeros_like(w); gy = np.zeros_like(w)
    gx[:, 1:-1] = 0.5 * (a[:, 2:] - a[:, :-2]); gy[1:-1] = 0.5 * (a[2:] - a[:-2])
    l = np.hypot(gx, gy) + 1e-6
    gx /= l; gy /= l
    return u + DT * eps * gy * w, v - DT * eps * gx * w

# 小さな渦（乱流）を時間とともに変化させる
noise_phase = rng.uniform(0, 6.28, size=6)
def turbulence(t):
    f = np.zeros((NY, NX))
    for k, (kx, ky) in enumerate([(0.21, 0.13), (0.11, 0.27), (0.33, 0.09)]):
        f += np.sin(xx * kx + yy * ky - t * (0.15 + 0.05 * k) + noise_phase[k]) * np.cos(yy * ky * 0.7 + t * 0.11 + noise_phase[k + 3])
    return f

def step(t):
    global u, v, T, fuel, soot
    # 燃料を出す（指先の位置：下の中央。少し揺らす）
    cx = NX / 2 + 1.2 * np.sin(t * 0.21) + rng.normal(0, 0.4)
    cy = 12.0
    r2 = ((xx - cx) / 9.0) ** 2 + ((yy - cy) / 4.0) ** 2
    src = np.exp(-r2 * 1.5) * (0.85 + 0.3 * rng.random())
    fuel = np.maximum(fuel, src)
    T = np.maximum(T, src * 0.9)
    v += src * 0.7
    u += src * rng.normal(0, 0.25)
    # 燃焼：燃料が燃えて熱になり、燃え残りが煙になる
    burn = np.minimum(fuel, 0.06 * DT * (T > 0.2))
    fuel -= burn
    T += burn * 3.0
    soot += burn * 0.25
    # 浮力・渦・乱流
    v += DT * (0.32 * T - 0.05 * soot)
    u, v = vorticity(u, v, 0.3)
    tb = turbulence(t)
    u += DT * 0.09 * tb * np.clip(T, 0, 1)
    u, v = project(u, v)
    u = advect(u, u, v); v = advect(v, u, v)
    T = gaussian_filter(advect(T, u, v), 0.35); fuel = advect(fuel, u, v); soot = advect(soot, u, v)
    # 冷える・消える
    T = np.maximum(0, T * (1 - 0.06 * DT) - 0.02 * DT)
    soot *= (1 - 0.03 * DT)
    fuel *= (1 - 0.02 * DT)
    u *= 0.995; v *= 0.995

# 温度 → 色（暗い赤 → 橙 → 黄 → 白）
STOPS = np.array([
    [0.00, 0.00, 0.00, 0.00],
    [0.18, 0.35, 0.04, 0.00],
    [0.40, 0.95, 0.30, 0.03],
    [0.65, 1.00, 0.62, 0.15],
    [0.85, 1.00, 0.86, 0.50],
    [1.00, 1.00, 0.98, 0.88],
])
def colorize(t):
    t = np.clip(t, 0, 1)
    rgb = np.zeros(t.shape + (3,))
    for c in range(3):
        rgb[..., c] = np.interp(t, STOPS[:, 0], STOPS[:, c + 1])
    return rgb

def render():
    heat = gaussian_filter(T, 0.9)
    img = colorize(np.clip(heat / 1.35, 0, 1) ** 0.85)
    big = np.stack([zoom(img[..., c], (FH / NY, FW / NX), order=1) for c in range(3)], -1)
    glow = np.stack([gaussian_filter(big[..., c], 4) for c in range(3)], -1)
    out = np.clip(big + glow * 0.35, 0, 1)
    out[:, :2] *= 0.5; out[:, -2:] *= 0.5
    return out[::-1]               # 画像は上が y=最大

t = 0.0
for _ in range(140):               # 炎が安定するまで回す
    step(t); t += DT
frames = []
for i in range(N + K):
    for _ in range(SUB):
        step(t); t += DT
    frames.append(render())
loop = []
for i in range(N):
    if i < K:
        a = i / K
        loop.append(frames[N + i] * (1 - a) + frames[i] * a)
    else:
        loop.append(frames[i])

atlas = np.zeros((FH * ROWS, FW * COLS, 3))
for i, f in enumerate(loop):
    r, c = divmod(i, COLS)
    atlas[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = f
out = sys.argv[1] if len(sys.argv) > 1 else 'fire-flipbook.png'
Image.fromarray((atlas * 255 + 0.5).astype(np.uint8)).save(out, optimize=True)
if '--preview' in sys.argv:
    d = sys.argv[sys.argv.index('--preview') + 1]
    os.makedirs(d, exist_ok=True)
    strip = np.concatenate([loop[i] for i in range(0, N, 8)], 1)
    Image.fromarray((strip * 255).astype(np.uint8)).save(os.path.join(d, 'strip.png'))
print('ok', out, os.path.getsize(out))
