// 効果音（Web Audio API）。音のファイルは assets/sfx/（make-sfx.py で合成したオリジナル）。
// ブラウザはクリックなどの操作の後でないと音を出せないため、最初の操作（APPLY など）で unlockAudio() を呼びます。
// 単発の音は playSfx、溜め・炎・噴射のように続く音は setLoop で音量を変えて鳴らし続けます。
import { SFX } from './config.js';

let ctx = null, master = null, loading = null;
const buffers = new Map();
const loops = new Map();          // name → { source, gain }
const state = { volume: SFX.volume, muted: false };

async function loadAll() {
  await Promise.all(Object.entries(SFX.files).map(async ([name, file]) => {
    try {
      const res = await fetch(SFX.dir + file);
      if (!res.ok) throw new Error(res.status);
      buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch (e) {
      console.warn(`効果音 ${file} を読み込めませんでした。`, e);
    }
  }));
}

// 最初のクリック・キー操作で呼ぶ（2回目以降は何もしない）
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.muted ? 0 : state.volume;
    // 大きな音が重なっても割れないように軽く圧縮する
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    loading = loadAll();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return loading;
}

export function setSfxVolume(v) {
  state.volume = v;
  if (master) master.gain.setTargetAtTime(state.muted ? 0 : v, ctx.currentTime, 0.05);
}
export function setSfxMuted(m) {
  state.muted = m;
  setSfxVolume(state.volume);
}
export const sfxMuted = () => state.muted;

// 単発の音。volume：0〜1、rate：再生速度（1より大きいと高く短い音）。少しだけ高さをばらつかせて単調にならないようにする
export function playSfx(name, { volume = 1, rate = 1, jitter = 0.04 } = {}) {
  const buffer = buffers.get(name);
  if (!ctx || !buffer || state.muted) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
  const g = ctx.createGain();
  g.gain.value = volume * (SFX.gain[name] ?? 1);
  src.connect(g).connect(master);
  src.start();
}

// 続く音。level：音量（0 で止める）、rate：再生速度。毎フレーム呼んでよい（変化はなめらかにつなぐ）
export function setLoop(name, level, rate = 1) {
  const buffer = buffers.get(name);
  if (!ctx || !buffer) return;
  let loop = loops.get(name);
  const now = ctx.currentTime;
  if (level > 0.001 && !loop) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(master);
    source.start();
    loop = { source, gain, stopping: false };
    loops.set(name, loop);
  }
  if (!loop) return;
  loop.gain.gain.setTargetAtTime(level * (SFX.gain[name] ?? 1), now, 0.06);
  loop.source.playbackRate.setTargetAtTime(rate, now, 0.05);
  if (level <= 0.001 && !loop.stopping) {
    loop.stopping = true;
    loop.source.stop(now + 0.4);
    loops.delete(name);
  }
}

export function stopAllLoops() {
  for (const name of [...loops.keys()]) setLoop(name, 0);
}
