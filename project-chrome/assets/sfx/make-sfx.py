# 効果音を数式で合成して作る（外部の音源・録音は使わない）。
# 使い方：python3 make-sfx.py <出力フォルダ>
# 必要なもの：Python 3、numpy、scipy、ffmpeg（単発の音は MP3、繰り返す音はつなぎ目が出ないよう WAV で書き出す）
import os, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 32000
rng = np.random.default_rng(208)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
os.makedirs(OUT, exist_ok=True)

def t_(sec): return np.arange(int(sec * SR)) / SR
def noise(sec): return rng.uniform(-1, 1, int(sec * SR))
def brown(sec):
    x = np.cumsum(noise(sec)); x -= np.convolve(x, np.ones(400) / 400, mode='same'); return x / (np.abs(x).max() + 1e-9)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def decay(sec, tau, a=0.003):
    t = t_(sec); return np.minimum(1, t / a) * np.exp(-t / tau)
def sweep(sec, f0, f1, shape='exp'):
    t = t_(sec)
    f = f0 * (f1 / f0) ** (t / sec) if shape == 'exp' else f0 + (f1 - f0) * t / sec
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def saw(f, sec):
    ph = np.cumsum(np.full(int(sec * SR), f) if np.isscalar(f) else f) / SR
    return 2 * (ph % 1) - 1
def metal(sec, base, tau, ratios=(1, 2.76, 5.40, 8.93, 13.34), amps=(1, .6, .4, .25, .15)):
    t = t_(sec)
    return sum(a * np.sin(2 * np.pi * base * r * t) * np.exp(-t / (tau / (1 + i * 0.6))) for i, (r, a) in enumerate(zip(ratios, amps)))
def norm(x, peak=0.9):
    x = x - np.mean(x); return x / (np.abs(x).max() + 1e-9) * peak
def fade(x, a=0.003, b=0.02):
    n = len(x); x = x.copy()
    x[:int(a * SR)] *= np.linspace(0, 1, int(a * SR)); x[n - int(b * SR):] *= np.linspace(1, 0, int(b * SR)); return x
def loopable(x, xf=0.15):
    # 最後の xf 秒を最初に重ねて、繰り返してもつなぎ目が聞こえないようにする
    n = int(xf * SR); head, body, tail = x[:n], x[n:-n] if n else x, x[-n:]
    w = np.linspace(0, 1, n)
    return np.concatenate([tail * (1 - w) + head * w, body])

def save(name, x, loop=False, peak=0.9):
    x = norm(x, peak) if loop else fade(norm(x, peak))
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    if loop:
        wavfile.write(os.path.join(OUT, name + '.wav'), SR, pcm)
    else:
        tmp = os.path.join(OUT, name + '.tmp.wav')
        wavfile.write(tmp, SR, pcm)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k',
                        os.path.join(OUT, name + '.mp3')], check=True)
        os.remove(tmp)

# ---- チャージ（繰り返し）：少しずつずらしたのこぎり波＋電気のうなり ----
sec = 1.2; t = t_(sec)
hum = sum(saw(110 * k * (1 + d), sec) for k, d in [(1, 0), (1, 0.006), (2, -0.004), (3, 0.003)])
hum = lp(hum, 1400) * (0.8 + 0.2 * np.sin(2 * np.pi * 15 * t))
buzz = bp(noise(sec), 2500, 6000) * 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * 37 * t) ** 2)
save('charge-loop', loopable(hum + buzz), loop=True, peak=0.6)
# 満タン：高い音の「キーン」
save('charge-full', sweep(0.5, 1500, 2600) * decay(0.5, 0.18) + 0.4 * np.sin(2 * np.pi * 3200 * t_(0.5)) * decay(0.5, 0.1))

# ---- PLASMA ----
s = 0.7
zap = sweep(s, 2400, 140) * decay(s, 0.16) + 0.5 * sweep(s, 3600, 300) * decay(s, 0.08)
thump = np.sin(2 * np.pi * np.cumsum(np.linspace(120, 40, int(s * SR))) / SR) * decay(s, 0.12)
air = hp(noise(s), 3000) * decay(s, 0.05) * 0.4
save('plasma-fire', zap + thump * 1.2 + air)
s = 1.3
boom = lp(brown(s), 220) * decay(s, 0.35, 0.002) * 2.0
crack = hp(noise(s), 1800) * decay(s, 0.12) * 0.5
sub = np.sin(2 * np.pi * np.cumsum(np.linspace(70, 30, int(s * SR))) / SR) * decay(s, 0.4)
fizz = bp(noise(s), 3000, 9000) * (rng.random(int(s * SR)) > 0.985) * decay(s, 0.5) * 1.5
save('plasma-hit', boom + crack + sub * 1.3 + fizz)

# ---- NET ----
s = 0.5
pop = np.sin(2 * np.pi * np.cumsum(np.linspace(180, 60, int(s * SR))) / SR) * decay(s, 0.07)
hiss = bp(noise(s), 1500, 7000) * decay(s, 0.12) * 0.6
save('net-fire', pop * 1.4 + hiss)
s = 1.1; t = t_(s)
sparks = np.zeros(int(s * SR))
for _ in range(70):
    i = int(rng.random() ** 1.6 * (s - 0.05) * SR); n = int(0.004 * SR)
    sparks[i:i + n] += rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (0.0012 * SR)) * rng.uniform(0.3, 1)
sparks = hp(sparks, 1200)
elec = saw(120, s) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * decay(s, 0.45) * 0.35
whoosh = bp(noise(s), 400, 2500) * np.sin(np.pi * np.minimum(1, t / 0.5)) * 0.4 * decay(s, 0.6)
save('net-open', sparks * 1.2 + lp(elec, 2500) + whoosh)

# ---- HOOK ----
s = 0.55
chunk = metal(s, 340, 0.09) * 0.8 + lp(noise(s), 900) * decay(s, 0.03) * 1.2
pneu = hp(noise(s), 2500) * decay(s, 0.15) * 0.5
save('hook-fire', chunk + pneu)
s = 0.75
rattle = np.zeros(int(s * SR)); pos = 0.0
while pos < s - 0.03:
    i = int(pos * SR)
    click = metal(0.03, rng.uniform(1800, 2600), 0.006, ratios=(1, 1.7, 2.9), amps=(1, .5, .3))
    rattle[i:i + len(click)] += click * rng.uniform(0.5, 1)
    pos += rng.uniform(0.018, 0.035)
motor = saw(np.linspace(160, 220, int(s * SR)), s)
save('hook-reel', rattle + lp(motor, 700) * 0.25)
s = 0.7
clang = metal(s, 520, 0.22) + 0.6 * metal(s, 740, 0.15) + lp(noise(s), 3000) * decay(s, 0.02) * 1.5
save('hook-hit', clang)

# ---- FIST（ロケットパンチ） ----
s = 0.9; t = t_(s)
ign = lp(noise(s), 600) * decay(s, 0.25, 0.01) * 1.5
roar = bp(noise(s), 150, 2000) * np.minimum(1, t / 0.08) * np.exp(-t / 0.5)
boom = np.sin(2 * np.pi * np.cumsum(np.linspace(90, 35, int(s * SR))) / SR) * decay(s, 0.15)
save('fist-launch', ign + roar + boom * 1.3)
s = 1.0; t = t_(s)
thrust = bp(noise(s), 120, 1600) + 0.5 * lp(brown(s), 150)
thrust *= 0.85 + 0.15 * np.sin(2 * np.pi * 23 * t)
save('thrust-loop', loopable(thrust), loop=True, peak=0.55)
s = 0.6
punch = np.sin(2 * np.pi * np.cumsum(np.linspace(150, 45, int(s * SR))) / SR) * decay(s, 0.09) * 1.6
punch += lp(noise(s), 2500) * decay(s, 0.025) + metal(s, 410, 0.08) * 0.35
save('fist-hit', punch)

# ---- 指先の火 ----
s = 0.8; t = t_(s)
cut = np.exp(np.interp(t, [0, 0.12, s], [np.log(300), np.log(2500), np.log(500)]))
fw = np.zeros(int(s * SR)); src = noise(s); y = 0.0
a = 1 - np.exp(-2 * np.pi * cut / SR)
for i in range(len(src)):  # 遮断周波数が動くローパス（ボッという音）
    y += a[i] * (src[i] - y); fw[i] = y
save('flame-ignite', fw * np.sin(np.pi * np.minimum(1, t / 0.7)) ** 0.7 + lp(brown(s), 120) * decay(s, 0.3) * 0.6)
s = 2.4; t = t_(s)
roar = lp(brown(s), 500) * 0.8 + bp(noise(s), 600, 3000) * 0.12 * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * t))
crackle = np.zeros(int(s * SR))
for _ in range(90):
    i = int(rng.random() * (s - 0.01) * SR); n = int(rng.uniform(0.001, 0.004) * SR)
    crackle[i:i + n] += rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (0.0008 * SR)) * rng.uniform(0.3, 1)
fire = norm(roar) * 0.7 + norm(hp(crackle, 1500)) * 0.5
save('flame-loop', loopable(np.tanh(fire * 1.6), 0.3), loop=True, peak=0.6)

# ---- 装着 ----
s = 0.42; t = t_(s)
servo = lp(saw(np.linspace(220, 520, int(s * SR)) * (1 + 0.02 * np.sin(2 * np.pi * 40 * t)), s), 1800)
save('assemble-whir', servo * np.sin(np.pi * t / s) ** 0.5 + hp(noise(s), 4000) * 0.08)
s = 0.45
clamp = np.zeros(int(s * SR))
for at, f in [(0.0, 1600), (0.045, 1100)]:
    i = int(at * SR); c = metal(s - at, f, 0.03, ratios=(1, 2.2, 3.9), amps=(1, .5, .3))
    clamp[i:i + len(c)] += c[:len(clamp) - i]
clamp += np.sin(2 * np.pi * np.cumsum(np.linspace(130, 60, int(s * SR))) / SR) * decay(s, 0.05) * 1.2
clamp += hp(noise(s), 2000) * decay(s, 0.15) * 0.25           # 空気が抜ける音
save('assemble-lock', clamp)
s = 1.4; t = t_(s)
chime = np.zeros(int(s * SR))
for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
    i = int(k * 0.09 * SR); n = len(chime) - i; tt = np.arange(n) / SR
    chime[i:] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2 * tt)) * np.minimum(1, tt / 0.003) * np.exp(-tt / 0.35)
pad = sum(np.sin(2 * np.pi * f * t) for f in [261.6, 392.0, 523.3]) * np.sin(np.pi * np.minimum(1, t / s)) * 0.25
save('assemble-done', chime + pad)
print('ok', sorted(os.listdir(OUT)))
