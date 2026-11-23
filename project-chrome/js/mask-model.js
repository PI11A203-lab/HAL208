import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLB } from './arms.js';

// 編集原本の独立した部品は保ち、表示時だけ材質単位にまとめてdraw callを減らす。
export function loadMaskAsset(url) {
  return new Promise((resolve, reject) => {
    loadGLB(url, source => {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      const batches = new Map(), temporary = [];
      const root = new THREE.Group();
      root.name = 'TrackedMask'; root.visible = false;
      source.updateMatrixWorld(true);
      source.traverse(node => {
        if (node.geometry) geometries.add(node.geometry);
        for (const material of [node.material].flat().filter(Boolean)) {
          materials.add(material);
          Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
        }
      });
      const dispose = () => {
        root.removeFromParent();
        root.traverse(node => node.geometry?.dispose());
        geometries.forEach(geometry => geometry.dispose());
        temporary.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        textures.forEach(texture => texture.dispose());
      };
      try {
        if (!source.getObjectByName('MaskRoot')) throw new Error('MaskRootがありません');
        source.traverse(node => {
          if (!node.isMesh) return;
          if (Array.isArray(node.material)) throw new Error('マスクの材質をprimitiveごとに分けてください');
          const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
          temporary.push(geometry);
          geometry.applyMatrix4(node.matrixWorld);
          for (const name of Object.keys(geometry.attributes)) {
            if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
          }
          if (!geometry.attributes.normal) geometry.computeVertexNormals();
          if (!batches.has(node.material)) batches.set(node.material, []);
          batches.get(node.material).push(geometry);
        });
        if (!batches.size) throw new Error('マスクのMeshがありません');
        for (const [material, parts] of batches) {
          const geometry = mergeGeometries(parts, false);
          if (!geometry) throw new Error('マスクの結合に失敗しました');
          root.add(new THREE.Mesh(geometry, material));
        }
        const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
        if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) throw new Error('マスクの寸法が不正です');
        geometries.forEach(geometry => geometry.dispose()); geometries.clear();
        temporary.forEach(geometry => geometry.dispose()); temporary.length = 0;
        let disposed = false;
        resolve({ root, applyColor(color) {
          materials.forEach(material => {
            if (['MaskShell', 'MaskLowerArmor', 'OniRaisedArmor'].includes(material.name)) material.color.set(color);
          });
        }, dispose() { if (!disposed) { disposed = true; dispose(); } } });
      } catch (error) { dispose(); reject(error); }
    }, (message, error) => reject(new Error(message, { cause: error })));
  });
}
