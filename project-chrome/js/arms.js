// カスタム 3D モデルの読み込みヘルパー。
// 読み込みに失敗した場合は呼び出し側で既存のプリミティブ形状を使い続けます。
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function loadGLB(url, onLoaded, onError = console.warn) {
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => onLoaded(gltf.scene),
    undefined,
    (error) => onError(`GLBモデルを読み込めませんでした (${url})`, error)
  );
}
