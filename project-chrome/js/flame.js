// 炎・光の表示（指先の火、ロケットフィストの噴射、チャージの光）。
// 炎の本体は、流体シミュレーションで計算した炎の連番画像（assets/fx/fire-flipbook.jpg、8×8コマ）を
// 板に貼って再生します。そこに、周りの映像のゆらぎ（熱かげろう）、火の粉、煙、腕を照らす光を重ねます。
// 作り方は assets/fx/README.md を参照してください。
import * as THREE from 'three';
import { FIRE_FLIPBOOK } from './config.js';

// 画質：'high'（熱かげろう・煙・炎2枚重ね）/ 'low'（炎1枚と火の粉・光だけ）
const fx = { quality: 'high', video: null, width: 1, height: 1, videoTexture: null };
export function configureFx({ quality, video, width, height } = {}) {
  if (quality) fx.quality = quality;
  if (video && video !== fx.video) {
    fx.video = video;
    fx.videoTexture?.dispose();
    fx.videoTexture = new THREE.VideoTexture(video);
    // 映像はそのままの色で描き直すため、色空間の変換はしない（HEAT_FRAG も変換しない）
  }
  if (width) fx.width = width;
  if (height) fx.height = height;
}
export const fxQuality = () => fx.quality;

// ブルーム（にじみ）の対象を入れるレイヤー（bloom.js）
export const GLOW_LAYER = 1;
// object とその子をブルームの対象にする
export function markGlow(object) {
  object.traverse((o) => o.layers.enable(GLOW_LAYER));
  return object;
}

// 中心が明るく外へぼける丸いテクスチャ（加算合成で光って見える）
let glowTexture = null;
export function makeGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

// 煙用：ふちがやわらかく、少しむらのある丸
let smokeTexture = null;
function makeSmokeTexture() {
  if (smokeTexture) return smokeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, rad = 18 + Math.random() * 28;
    const r = g.createRadialGradient(x, y, 0, x, y, rad);
    r.addColorStop(0, 'rgba(255,255,255,0.22)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }
  smokeTexture = new THREE.CanvasTexture(c);
  return smokeTexture;
}

let fireTexture = null;
function loadFireTexture() {
  if (fireTexture) return fireTexture;
  fireTexture = new THREE.TextureLoader().load(FIRE_FLIPBOOK.url, undefined, undefined,
    (e) => console.warn('炎の画像を読み込めませんでした。', e));
  fireTexture.colorSpace = THREE.SRGBColorSpace;
  return fireTexture;
}

// 光を足すだけの合成（透明なキャンバスの不透明度は変えない。そのため黒い部分が映像を隠さない）
export const ADD_LIGHT = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

// 炎の連番画像を再生する板。swap：1 で色を青系に入れ替える（噴射用）
const FIRE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FIRE_FRAG = /* glsl */`
  uniform sampler2D map; uniform float frame; uniform float cols; uniform float rows;
  uniform float intensity; uniform float swap; uniform float flip;
  varying vec2 vUv;
  vec3 cell(float i, vec2 uv) {
    float c = mod(i, cols), r = floor(i / cols);
    return texture2D(map, vec2((c + uv.x) / cols, 1.0 - (r + 1.0 - uv.y) / rows)).rgb;
  }
  void main() {
    vec2 uv = vec2(mix(vUv.x, 1.0 - vUv.x, flip), vUv.y);
    uv = clamp(uv, vec2(0.004), vec2(0.996));
    float n = cols * rows, f = floor(frame), t = frame - f;
    vec3 c = mix(cell(mod(f, n), uv), cell(mod(f + 1.0, n), uv), t);
    // 付け根：画像の下端で切れて見えないよう、細く暗くしてから立ち上げる。火は根元を青くする（ろうそく・ガスの炎のように）
    float y = vUv.y;
    float rise = smoothstep(0.0, 0.15, y);
    float width = mix(0.06, 0.5, smoothstep(0.0, 0.3, y));
    float taper = smoothstep(width, width * 0.45, abs(vUv.x - 0.5));
    float blueZone = (1.0 - smoothstep(0.08, 0.24, y)) * (1.0 - swap);
    vec3 blue = vec3(0.2, 0.45, 1.0) * dot(c, vec3(0.4, 0.4, 0.2));
    c = mix(c, blue, blueZone * 0.8);
    // 根元は暗く、上へ行くほど明るい（白く飛ばない）
    c *= rise * mix(0.45, 1.0, smoothstep(0.12, 0.4, y)) * mix(taper, 1.0, smoothstep(0.15, 0.35, y));
    c = mix(c, c.bgr * vec3(0.75, 0.95, 1.15), swap);
    gl_FragColor = vec4(c * intensity, 1.0);
    #include <colorspace_fragment>
  }`;

function makeFirePlane(swap, flip) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: loadFireTexture() }, frame: { value: 0 }, cols: { value: FIRE_FLIPBOOK.cols }, rows: { value: FIRE_FLIPBOOK.rows },
      intensity: { value: 1 }, swap: { value: swap }, flip: { value: flip } },
    vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG,
    transparent: true, depthWrite: false, depthTest: false, ...ADD_LIGHT,
  });
  // 炎の付け根（画像の下から base の位置）を原点にする
  const geo = new THREE.PlaneGeometry(1, 2);
  geo.translate(0, 1 - 2 * FIRE_FLIPBOOK.base, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

// 熱かげろう：炎の上の映像を、ゆらぐノイズでずらして描き直す（映像を three.js に読み込むため HIGH の時だけ）
const HEAT_FRAG = /* glsl */`
  uniform sampler2D video; uniform vec2 screen; uniform float time; uniform float strength;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 p = vUv * vec2(3.0, 6.0) - vec2(0.0, time * 2.2);
    vec2 d = vec2(noise(p) - 0.5, noise(p + 17.3) - 0.5);
    float mask = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.5, 0.15, abs(vUv.x - 0.5));
    vec2 uv = gl_FragCoord.xy / screen + d * strength * mask / screen;
    gl_FragColor = vec4(texture2D(video, uv).rgb, mask);
  }`;

// 炎を作る。variant：'fire'（指先の火）/ 'blue'（ロケットの噴射）
// update(dt, origin, scale, up)：origin＝炎の付け根 [x,y,z]（null で消していく）、scale＝炎の幅（ピクセル）、up＝炎の向き
export function createFlame({ variant = 'fire', light = true, embers = 40, smoke = 10 } = {}) {
  const swap = variant === 'blue' ? 1 : 0;
  const group = new THREE.Group();
  const planes = [makeFirePlane(swap, 0), makeFirePlane(swap, 1)].map(markGlow);
  const offsets = [Math.random() * 64, Math.random() * 64];
  group.add(...planes);

  // 熱かげろう
  let heat = null;
  if (variant === 'fire') {
    heat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: { video: { value: null }, screen: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, strength: { value: 6 } },
      vertexShader: FIRE_VERT, fragmentShader: HEAT_FRAG, transparent: true, depthWrite: false, depthTest: false,
    }));
    heat.geometry.translate(0, 0.5, 0);
    heat.renderOrder = 5;
    heat.frustumCulled = false;
    group.add(heat);
  }

  // 火の粉
  const ePos = new Float32Array(embers * 3), eCol = new Float32Array(embers * 3);
  const eVel = Array.from({ length: embers }, () => new THREE.Vector3());
  const eLife = new Float32Array(embers), eMax = new Float32Array(embers);
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const eMat = new THREE.PointsMaterial({ size: 4, map: makeGlowTexture(), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false });
  const emberPoints = new THREE.Points(eGeo, eMat);
  emberPoints.frustumCulled = false;
  emberPoints.renderOrder = 11;
  markGlow(emberPoints);
  for (let i = 0; i < embers; i++) ePos[i * 3 + 2] = -1e5;
  group.add(emberPoints);
  const emberColor = variant === 'blue' ? new THREE.Color(0x9fe8ff) : new THREE.Color(0xffa040);

  // 煙
  const puffs = Array.from({ length: smoke }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSmokeTexture(), color: 0x3a3a3c, transparent: true,
      opacity: 0, depthWrite: false, depthTest: false }));
    s.visible = false;
    s.renderOrder = 4;
    s.userData = { life: 0, vel: new THREE.Vector3(), size: 1, spin: 0 };
    group.add(s);
    return s;
  });

  // 腕を照らす光（ライトの数が変わるとシェーダーの作り直しで一瞬止まるため、常に置いて明るさだけ変える）
  const lamp = light ? new THREE.PointLight(variant === 'blue' ? 0x60c8ff : 0xff7a20, 0, 1, 0) : null;
  if (lamp) group.add(lamp);

  let level = 0, time = Math.random() * 10, emberAcc = 0, smokeAcc = 0, nextEmber = 0, nextPuff = 0;
  const last = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
  let lastScale = 20;

  return {
    object: group,
    update(dt, origin, scale = 20, up = [0, 1, 0]) {
      time += dt;
      const on = Boolean(origin);
      // 点く時はすばやく、消える時は少しゆっくり
      level += ((on ? 1 : 0) - level) * Math.min(1, dt * (on ? 9 : 5));
      if (on) { last.fromArray(origin); lastScale = scale; upV.fromArray(up).normalize(); }
      const high = fx.quality === 'high';
      const visible = level > 0.02;
      const w = lastScale * 3 * (0.6 + 0.4 * level);
      const angle = Math.atan2(-upV.x, upV.y);            // 画面の中で炎を up の向きに回す
      side.set(upV.y, -upV.x, 0);
      planes.forEach((p, i) => {
        p.visible = visible && (i === 0 || high);
        p.position.copy(last);
        p.position.z += 4 + i;
        p.rotation.set(0, 0, angle);
        const flick = 1 + 0.06 * Math.sin(time * 23 + i * 2) + 0.04 * Math.sin(time * 37 + i);
        p.scale.set(w * (i ? 0.85 : 1), w * flick * (i ? 0.9 : 1), 1);
        p.material.uniforms.frame.value = time * FIRE_FLIPBOOK.fps + offsets[i];
        p.material.uniforms.intensity.value = level * (i ? 0.4 : 0.85);
      });
      if (heat) {
        heat.visible = visible && high && Boolean(fx.videoTexture);
        if (heat.visible) {
          heat.position.copy(last).addScaledVector(upV, w * 0.3);
          heat.position.z += 3;
          heat.rotation.set(0, 0, angle);
          heat.scale.set(w * 1.1, w * 2.6, 1);
          const u = heat.material.uniforms;
          u.video.value = fx.videoTexture;
          u.screen.value.set(fx.width, fx.height);
          u.time.value = time;
          u.strength.value = lastScale * 0.25 * level;
        }
      }
      // 火の粉：炎の中から舞い上がる
      if (on && embers) {
        emberAcc += dt * 26;
        while (emberAcc >= 1) {
          emberAcc -= 1;
          const i = nextEmber++ % embers;
          const a = Math.random() * w * 0.9;
          ePos.set([last.x + upV.x * a + side.x * (Math.random() - 0.5) * w * 0.25,
            last.y + upV.y * a + side.y * (Math.random() - 0.5) * w * 0.25, last.z + 6], i * 3);
          eVel[i].copy(upV).multiplyScalar(w * (0.8 + Math.random() * 1.4)).addScaledVector(side, (Math.random() - 0.5) * w * 0.8);
          eLife[i] = eMax[i] = 0.5 + Math.random() * 0.9;
        }
      }
      for (let i = 0; i < embers; i++) {
        if (eLife[i] <= 0) { ePos[i * 3 + 2] = -1e5; continue; }
        eLife[i] -= dt;
        eVel[i].addScaledVector(side, Math.sin(time * 9 + i) * w * 2 * dt);
        ePos[i * 3] += eVel[i].x * dt; ePos[i * 3 + 1] += eVel[i].y * dt;
        const k = Math.max(0, eLife[i] / eMax[i]);
        const flicker = 0.6 + 0.4 * Math.sin(time * 30 + i * 7);
        eCol.set([emberColor.r * k * flicker, emberColor.g * k * k * flicker, emberColor.b * k * k * flicker], i * 3);
      }
      eMat.size = Math.max(2, lastScale * 0.09);
      eGeo.attributes.position.needsUpdate = true;
      eGeo.attributes.color.needsUpdate = true;
      // 煙：炎の先から立ちのぼって広がる
      if (on && high && smoke) {
        smokeAcc += dt * 7;
        while (smokeAcc >= 1) {
          smokeAcc -= 1;
          const p = puffs[nextPuff++ % smoke];
          p.visible = true;
          p.position.copy(last).addScaledVector(upV, w * (1.1 + Math.random() * 0.3));
          p.position.z += 2;
          p.userData.life = 1;
          p.userData.vel.copy(upV).multiplyScalar(w * (0.5 + Math.random() * 0.4)).addScaledVector(side, (Math.random() - 0.5) * w * 0.4);
          p.userData.size = w * (0.35 + Math.random() * 0.25);
          p.material.rotation = Math.random() * 6.28;
          p.userData.spin = (Math.random() - 0.5) * 1.5;
        }
      }
      for (const p of puffs) {
        const d = p.userData;
        if (d.life <= 0) { p.visible = false; continue; }
        d.life -= dt * 0.7;
        p.position.addScaledVector(d.vel, dt);
        p.material.rotation += d.spin * dt;
        const age = 1 - d.life;
        p.scale.setScalar(d.size * (1 + age * 2.2));
        p.material.opacity = Math.max(0, Math.sin(Math.PI * Math.min(1, age * 1.3)) * 0.16 * (variant === 'blue' ? 0.6 : 1));
      }
      // 光：炎に合わせてちらつく
      if (lamp) {
        lamp.position.copy(last).addScaledVector(upV, w * 0.35);
        lamp.position.z += lastScale * 2;
        lamp.distance = lastScale * 14;
        lamp.intensity = visible ? level * (9 + 2.5 * Math.sin(time * 19) + 1.5 * Math.sin(time * 31)) : 0;
      }
    },
    dispose() {
      planes.forEach((p) => { p.geometry.dispose(); p.material.dispose(); });
      heat?.geometry.dispose(); heat?.material.dispose();
      eGeo.dispose(); eMat.dispose();
      puffs.forEach((p) => p.material.dispose());
      lamp?.dispose();
    },
  };
}
