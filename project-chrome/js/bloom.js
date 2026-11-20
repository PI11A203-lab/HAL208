// 光る物（炎・弾・光の粒）だけのにじみ（ブルーム）。
// 光る物を GLOW_LAYER にも入れておき、それだけを小さな画像に描いてぼかし、通常の描画の上に光として足します。
// 映像の上に重ねる透明なキャンバスなので、ぼかした光は不透明度を変えずに足します（黒い部分は映像を隠さない）。
// 画質が LOW の時はぼかしを行わず、通常の描画だけをします。
import * as THREE from 'three';
import { ADD_LIGHT, GLOW_LAYER, LIGHT_ALPHA, fxQuality } from './flame.js';

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
    vec3 c = clamp((texture2D(a, vUv).rgb * 0.6 + texture2D(b, vUv).rgb * 0.9) * strength, 0.0, 1.0);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    ${LIGHT_ALPHA}
  }`;

export function createBloom(renderer, width, height, { strength = 0.75 } = {}) {
  // 描画先は 8bit（どのPC・ブラウザーでも描画できる形式）。小数の形式（HalfFloat）は描画できない環境があり、
  // その場合は中身が不定になって画面全体が黒くなることがあるため使わない
  const opts = { type: THREE.UnsignedByteType, depthBuffer: false };
  const size = (k) => [Math.max(1, Math.round(width / k)), Math.max(1, Math.round(height / k))];
  const src = new THREE.WebGLRenderTarget(...size(2), { type: THREE.UnsignedByteType });
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

  // 描画先が使えるかを最初に一度だけ確かめ、使えない環境ではにじみを出さない（画面を壊さない）
  let usable = null;
  function checkTargets() {
    const gl = renderer.getContext();
    usable = [src, ...levels.flat()].every((t) => {
      renderer.setRenderTarget(t);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    });
    renderer.setRenderTarget(null);
    if (!usable) console.warn('この環境ではブルーム（にじみ）を使えないため、表示しません。');
    return usable;
  }
  // 念のため、にじみを重ねた後の画面が大部分「不透明な黒」になっていないかを数回だけ確かめる。
  // そうなっていれば（映像が黒く隠れる環境）、にじみを止める
  let frames = 0;
  function checkScreen() {
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    let black = 0, total = 0;
    for (let y = 1; y < 8; y++) {
      for (let x = 1; x < 8; x++) {
        gl.readPixels(Math.floor(w * x / 8), Math.floor(h * y / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        total++;
        if (px[3] > 200 && Math.max(px[0], px[1], px[2]) < 16) black++;
      }
    }
    if (black > total * 0.6) {
      usable = false;
      console.warn('ブルーム（にじみ）で画面が黒くなったため、にじみを止めました。');
    }
  }

  return {
    get strength() { return mixMat.uniforms.strength.value; },
    set strength(v) { mixMat.uniforms.strength.value = v; },
    render(scene, camera) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      if (fxQuality() !== 'high' || (usable ?? checkTargets()) === false) return;
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
      frames++;
      if (frames === 10 || frames === 60 || frames === 300) checkScreen();
    },
    dispose() {
      src.dispose();
      levels.flat().forEach((t) => t.dispose());
      quad.geometry.dispose(); blurMat.dispose(); mixMat.dispose();
    },
  };
}
