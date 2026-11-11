// ギミックの光の表現（すべてシェーダーで作るため画像ファイルは不要）。
// ・プラズマ弾：ゆらぐエネルギーの球と、まわりを走る電気
// ・発射の閃光（放射状の光）・衝撃波の輪
// ・火花（重力で落ちる光の筋）
// ・ケーブル（たるむ金属の線。光で陰影がつく）
// ・エネルギーネット（網目が光り、波打ちながら広がる）
// 光る物は markGlow でブルーム（bloom.js）の対象にします。
import * as THREE from 'three';
import { ADD_LIGHT, markGlow } from './flame.js';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NOISE = /* glsl */`
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }`;

function fxMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, alpha: { value: 1 }, color: { value: new THREE.Color(0x00e5ff) }, ...uniforms },
    vertexShader: VERT, fragmentShader, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, ...ADD_LIGHT,
  });
}
function fxQuad(material, order = 12) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  m.frustumCulled = false;
  m.renderOrder = order;
  m.visible = false;
  return markGlow(m);
}

/* ---------------- プラズマ弾 ---------------- */
const ORB_FRAG = /* glsl */`
  uniform float time; uniform float alpha; uniform vec3 color; varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p), a = atan(p.y, p.x);
    float n = fbm(vec2(a * 1.6 + time * 1.7, r * 3.0 - time * 5.0));
    float body = smoothstep(0.72, 0.15, r + (n - 0.5) * 0.45);
    float core = smoothstep(0.32, 0.0, r);
    // 電気の筋：ノイズの等高線を細く光らせる
    float e = fbm(vec2(a * 2.5 + time * 3.1, r * 2.2 - time * 7.0) + floor(time * 14.0) * 0.37);
    float arc = smoothstep(0.035, 0.0, abs(e - 0.5)) * smoothstep(1.0, 0.45, r) * smoothstep(0.15, 0.35, r);
    float halo = exp(-r * r * 5.0) * 0.35;
    vec3 c = color * (body * 1.4 + halo) + vec3(1.0) * core * 1.6 + mix(color, vec3(1.0), 0.6) * arc * 1.8;
    gl_FragColor = vec4(c * alpha, 1.0);
    #include <colorspace_fragment>
  }`;
export function createPlasmaOrb() {
  return fxQuad(fxMaterial(ORB_FRAG), 13);
}

/* ---------------- 閃光（放射状の光） ---------------- */
const FLASH_FRAG = /* glsl */`
  uniform float time; uniform float alpha; uniform vec3 color; uniform float seed; varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p), a = atan(p.y, p.x);
    float rays = pow(abs(cos(a * 3.0 + seed)), 18.0) + 0.6 * pow(abs(cos(a * 5.0 + seed * 2.0)), 30.0);
    rays *= 0.6 + 0.8 * noise(vec2(a * 4.0, seed * 10.0));
    float glow = exp(-r * r * 9.0);
    float v = glow * 1.5 + rays * smoothstep(1.0, 0.0, r) * 1.2;
    vec3 c = mix(color, vec3(1.0), smoothstep(0.2, 0.9, glow)) * v;
    gl_FragColor = vec4(c * alpha, 1.0);
    #include <colorspace_fragment>
  }`;
export function createFlash() {
  return fxQuad(fxMaterial(FLASH_FRAG, { seed: { value: 0 } }), 14);
}

/* ---------------- 衝撃波の輪 ---------------- */
const RING_FRAG = /* glsl */`
  uniform float time; uniform float alpha; uniform vec3 color; uniform float progress; varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p), a = atan(p.y, p.x);
    float edge = 0.55 + 0.4 * progress;
    float w = 0.05 + 0.12 * (1.0 - progress);
    float ring = smoothstep(w, 0.0, abs(r - edge)) * (0.7 + 0.6 * noise(vec2(a * 6.0, time * 3.0)));
    float inner = smoothstep(edge, 0.0, r) * 0.25 * (1.0 - progress);
    vec3 c = mix(color, vec3(1.0), 0.35) * (ring + inner);
    gl_FragColor = vec4(c * alpha, 1.0);
    #include <colorspace_fragment>
  }`;
export function createShockwave() {
  return fxQuad(fxMaterial(RING_FRAG, { progress: { value: 0 } }), 12);
}

/* ---------------- 火花 ---------------- */
// burst(at, dir, color, count, speed)：at から dir のまわりに散る。update(dt, gravity)
export function createSparks(max = 60) {
  const pos = new Float32Array(max * 6), col = new Float32Array(max * 6);
  const p = Array.from({ length: max }, () => ({ x: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, c: new THREE.Color() }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, ...ADD_LIGHT });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 15;
  markGlow(lines);
  let next = 0;
  const tmp = new THREE.Vector3();
  return {
    object: lines,
    burst(at, dir, color, count = 24, speed = 400, spread = 1.2) {
      for (let k = 0; k < count; k++) {
        const s = p[next++ % max];
        s.x.fromArray(at);
        tmp.set(Math.random() - 0.5, Math.random() - 0.5, 0).normalize().multiplyScalar(spread);
        s.v.fromArray(dir).add(tmp).normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.9));
        s.life = s.max = 0.25 + Math.random() * 0.45;
        s.c.set(color);
      }
    },
    update(dt, gravity = 900) {
      let any = false;
      p.forEach((s, i) => {
        if (s.life <= 0) { pos.fill(0, i * 6, i * 6 + 6); col.fill(0, i * 6, i * 6 + 6); return; }
        any = true;
        s.life -= dt;
        s.v.y -= gravity * dt;
        s.v.multiplyScalar(1 - 1.5 * dt);
        s.x.addScaledVector(s.v, dt);
        const k = Math.max(0, s.life / s.max);
        // 速さに合わせた長さの筋（先が明るく、尾は暗い）
        pos.set([s.x.x, s.x.y, s.x.z + 8, s.x.x - s.v.x * 0.035, s.x.y - s.v.y * 0.035, s.x.z + 8], i * 6);
        const hot = Math.min(1, k * 1.6);
        col.set([Math.min(1, s.c.r + hot * 0.5) * k, Math.min(1, s.c.g + hot * 0.4) * k, Math.min(1, s.c.b + hot * 0.3) * k, 0, 0, 0], i * 6);
      });
      lines.visible = any;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/* ---------------- ケーブル ---------------- */
// 画面に向いた細い帯で、法線を円柱のように付けて金属の陰影を出す。
// set(a, b, width, slack, wave, time)：slack＝たるみ（0〜1）、wave＝飛んでいる間の揺れ
export function createCable(material, segments = 28) {
  const n = segments + 1;
  const pos = new Float32Array(n * 2 * 3), nor = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2);
  const index = [];
  for (let i = 0; i < segments; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (let i = 0; i < n; i++) uv.set([i / segments, 0, i / segments, 1], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const pts = Array.from({ length: n }, () => new THREE.Vector3());
  const A = new THREE.Vector3(), B = new THREE.Vector3(), side = new THREE.Vector3(), d = new THREE.Vector3();
  return {
    object: mesh,
    set(a, b, width, slack = 0, wave = 0, time = 0) {
      A.copy(a); B.copy(b);
      const len = A.distanceTo(B);
      d.subVectors(B, A).normalize();
      const perp = new THREE.Vector3(-d.y, d.x, 0);
      for (let i = 0; i < n; i++) {
        const t = i / segments, s = Math.sin(Math.PI * t);
        pts[i].lerpVectors(A, B, t);
        pts[i].y -= slack * len * 0.18 * s;                                   // 重力でたるむ
        pts[i].addScaledVector(perp, wave * width * 3 * s * Math.sin(t * 18 - time * 30)); // 飛ぶ時の波
      }
      for (let i = 0; i < n; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
        d.subVectors(p1, p0);
        side.set(-d.y, d.x, 0).normalize();
        for (const [k, sgn] of [[0, -1], [1, 1]]) {
          const j = (i * 2 + k) * 3;
          pos[j] = pts[i].x + side.x * width * sgn; pos[j + 1] = pts[i].y + side.y * width * sgn; pos[j + 2] = pts[i].z + 2;
          nor[j] = side.x * sgn * 0.85; nor[j + 1] = side.y * sgn * 0.85; nor[j + 2] = 0.53;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
    },
    dispose() { geo.dispose(); },
  };
}

/* ---------------- エネルギーネット ---------------- */
const NET_VERT = /* glsl */`
  uniform float time; uniform float open; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float r = length(p.xy);
    // 広がりながら波打つ（ふちほど遅れて揺れる）
    float wave = sin(r * 9.0 - time * 10.0) * 0.06 * r * (1.0 - open * 0.6);
    p.xy *= 1.0 + wave;
    p.z += sin(atan(p.y, p.x) * 3.0 + time * 6.0) * 0.08 * r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const NET_FRAG = /* glsl */`
  uniform float time; uniform float alpha; uniform vec3 color; varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    // ひし形の網目
    vec2 g = vec2(p.x + p.y, p.x - p.y) * 7.0;
    vec2 f = abs(fract(g) - 0.5);
    float line = smoothstep(0.08, 0.0, min(f.x, f.y) - 0.0);
    float knot = smoothstep(0.16, 0.0, length(f - 0.5)) ;
    // ふちの太いロープ
    float rim = smoothstep(0.05, 0.0, abs(r - 0.96));
    // 網を走る電気のちらつき
    float zap = smoothstep(0.75, 1.0, noise(vec2(g.x * 0.7 + time * 9.0, g.y * 0.7 - time * 7.0)));
    float v = (line * (0.55 + 0.9 * zap) + knot * 0.9 + rim * 1.2) * smoothstep(1.0, 0.85, r) + rim * 0.4;
    vec3 c = mix(color, vec3(1.0), zap * 0.5 + knot * 0.3) * v;
    gl_FragColor = vec4(c * alpha, 1.0);
    #include <colorspace_fragment>
  }`;
export function createEnergyNet() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, alpha: { value: 1 }, open: { value: 0 }, color: { value: new THREE.Color(0x00e5ff) } },
    vertexShader: NET_VERT, fragmentShader: NET_FRAG, transparent: true, depthWrite: false, depthTest: false,
    side: THREE.DoubleSide, ...ADD_LIGHT,
  });
  // 円の中にも頂点を並べて波打たせる（RingGeometry の uv は位置から (x+1)/2, (y+1)/2 で作られる）
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.001, 1, 48, 10), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.visible = false;
  return markGlow(mesh);
}
