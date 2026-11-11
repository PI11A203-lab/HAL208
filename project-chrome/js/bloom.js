// 光る物（炎・弾・光の粒）だけのにじみ（ブルーム）。
// 光る物を GLOW_LAYER にも入れておき、それだけを小さな画像に描いてぼかし、通常の描画の上に光として足します。
// 映像の上に重ねる透明なキャンバスなので、ぼかした光は不透明度を変えずに足します（黒い部分は映像を隠さない）。
// 画質が LOW の時はぼかしを行わず、通常の描画だけをします。
import * as THREE from 'three';
import { ADD_LIGHT, GLOW_LAYER, fxQuality } from './flame.js';

const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// 9タップのガウスぼかし（dir 方向）
const BLUR_FRAG = /* glsl */`
  uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(src, vUv).rgb * 0.227027;
    c += (texture2D(src, vUv + dir * 1.384615).rgb + texture2D(src, vUv - dir * 1.384615).rgb) * 0.316216;
    c += (texture2D(src, vUv + dir * 3.230769).rgb + texture2D(src, vUv - dir * 3.230769).rgb) * 0.070270;
    gl_FragColor = vec4(c, 1.0);
  }`;
const MIX_FRAG = /* glsl */`
  uniform sampler2D a; uniform sampler2D b; uniform float strength; varying vec2 vUv;
  void main() {
    vec3 c = (texture2D(a, vUv).rgb * 0.6 + texture2D(b, vUv).rgb * 0.9) * strength;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

export function createBloom(renderer, width, height, { strength = 0.75 } = {}) {
  const opts = { type: THREE.HalfFloatType, depthBuffer: false };
  const size = (k) => [Math.max(1, Math.round(width / k)), Math.max(1, Math.round(height / k))];
  const src = new THREE.WebGLRenderTarget(...size(2), { type: THREE.HalfFloatType });
  const levels = [4, 8].map((k) => [new THREE.WebGLRenderTarget(...size(k), opts), new THREE.WebGLRenderTarget(...size(k), opts)]);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const blurMat = new THREE.ShaderMaterial({ uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false });
  const mixMat = new THREE.ShaderMaterial({ uniforms: { a: { value: null }, b: { value: null }, strength: { value: strength } },
    vertexShader: QUAD_VERT, fragmentShader: MIX_FRAG, depthTest: false, depthWrite: false, transparent: true, ...ADD_LIGHT });
  const black = new THREE.Color(0, 0, 0);
  const prevClear = new THREE.Color();

  function pass(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }
  function blur(input, [ping, pong]) {
    blurMat.uniforms.src.value = input.texture;
    blurMat.uniforms.dir.value.set(1 / ping.width, 0);
    pass(blurMat, ping);
    blurMat.uniforms.src.value = ping.texture;
    blurMat.uniforms.dir.value.set(0, 1 / pong.height);
    pass(blurMat, pong);
    return pong;
  }

  return {
    get strength() { return mixMat.uniforms.strength.value; },
    set strength(v) { mixMat.uniforms.strength.value = v; },
    render(scene, camera) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      if (fxQuality() !== 'high') return;
      // 光る物だけを描く
      const mask = camera.layers.mask, autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
      renderer.getClearColor(prevClear);
      camera.layers.set(GLOW_LAYER);
      renderer.setClearColor(black, 1);
      renderer.setRenderTarget(src);
      renderer.clear();
      renderer.render(scene, camera);
      camera.layers.mask = mask;
      // 2段階の大きさでぼかす（小さいほど広くにじむ）
      const a = blur(src, levels[0]);
      const b = blur(a, levels[1]);
      // 画面に光として足す
      renderer.setClearColor(prevClear, alpha);
      renderer.autoClear = false;
      mixMat.uniforms.a.value = a.texture;
      mixMat.uniforms.b.value = b.texture;
      pass(mixMat, null);
      renderer.autoClear = autoClear;
    },
    dispose() {
      src.dispose();
      levels.flat().forEach((t) => t.dispose());
      quad.geometry.dispose(); blurMat.dispose(); mixMat.dispose();
    },
  };
}
