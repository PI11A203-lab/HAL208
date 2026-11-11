// 実際の部屋を映すクロームの反射と、部屋の明るさに合わせた照明。
// カメラの映像をぼかして全方向の景色（正距円筒図法の画像）に並べ、PMREM で反射用の環境マップにします。
// 前（カメラ側）の半分には左右反転した映像、後ろの半分には暗くしてさらにぼかした映像を置き、
// 継ぎ目がつながるように並べます。数フレームごとに作り直し、同じ描画先を使い回します。
import * as THREE from 'three';

// 映像の平均の色と明るさ（0〜1）。data：RGBA の配列
export function averageColor(data) {
  let r = 0, g = 0, b = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  r /= n * 255; g /= n * 255; b /= n * 255;
  return { r, g, b, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}

// scene の環境マップを video から作る。every：何フレームごとに作り直すか
export function createVideoEnvironment(renderer, scene, video, { size = 256, every = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  const small = document.createElement('canvas');
  small.width = 8; small.height = 6;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const fallback = scene.environment;           // 映像を使わない時の環境（RoomEnvironment）
  let target = null, frame = 0, enabled = true;
  const state = { every, ambient: { r: 0.5, g: 0.5, b: 0.5, luminance: 0.5 } };

  function draw() {
    const w = canvas.width, h = canvas.height, half = w / 2;
    ctx.globalCompositeOperation = 'source-over';
    // 後ろ側（u 0〜0.5）：本人の後ろの部屋。暗く、強くぼかす
    ctx.filter = 'blur(6px) brightness(0.75)';
    ctx.drawImage(video, 0, 0, half, h);
    // 前側（u 0.5〜1.0、中央 0.75 が +Z＝カメラ側）：左右反転した映像
    ctx.filter = 'blur(3px) brightness(1.1)';
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, half, h);
    ctx.restore();
    // 天井の照明：上の方に柔らかい白い光を足す（クロームの輝きが消えないように）
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(w * 0.75, 0, 0, w * 0.75, 0, h * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.7);
    ctx.globalCompositeOperation = 'source-over';
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = v;
      scene.environment = v && target ? target.texture : fallback;
    },
    get every() { return state.every; },
    set every(v) { state.every = Math.max(1, Math.round(v)); },
    // 部屋の平均の色・明るさ（照明を合わせるのに使う）
    get ambient() { return state.ambient; },
    update() {
      if (!enabled || video.readyState < 2) return false;
      if (frame++ % state.every !== 0) return false;
      draw();
      texture.needsUpdate = true;
      target = pmrem.fromEquirectangular(texture, target);
      scene.environment = target.texture;
      if (frame % (state.every * 4) === 1) {
        sctx.drawImage(video, 0, 0, small.width, small.height);
        state.ambient = averageColor(sctx.getImageData(0, 0, small.width, small.height).data);
      }
      return true;
    },
    dispose() {
      scene.environment = fallback;
      target?.dispose();
      texture.dispose();
      pmrem.dispose();
    },
  };
}

// 部屋の明るさ・色に照明を合わせる。key：主光源、ambient：createVideoEnvironment の ambient、k：なめらかさ
export function matchLighting(key, ambient, k = 0.05) {
  const target = new THREE.Color(ambient.r, ambient.g, ambient.b);
  const m = Math.max(target.r, target.g, target.b, 1e-3);
  target.multiplyScalar(1 / m).lerp(new THREE.Color(1, 1, 1), 0.6);   // 色合いだけを弱く移す
  key.color.lerp(target, k);
  key.intensity += ((0.6 + 1.4 * Math.min(1, ambient.luminance * 1.6)) - key.intensity) * k;
}
