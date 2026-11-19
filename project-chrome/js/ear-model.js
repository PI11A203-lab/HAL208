import * as THREE from 'three';
import { loadGLB } from './arms.js';
import { findEarNodes } from './ear-state.js';

// このGLBの所有資産のみを解放。左右の共有資産は一度だけ解放する。
function disposeSource(source) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  source.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [node.material].flat().filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

export function createEarAsset(source) {
  let parts;
  try {
    parts = findEarNodes(source);
    source.updateMatrixWorld(true);
    // BlenderのZ-up→glTFのY-up変換を含むworld姿勢を維持する。
    // 制作用の左右配置だけを除去し、各pivotを追跡側で配置する。
    const roots = parts.map(part => {
      const model = part.clone(true);
      part.matrixWorld.decompose(model.position, model.quaternion, model.scale);
      model.position.set(0, 0, 0);
      model.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) {
        throw new Error(`${part.name} の寸法が不正です`);
      }
      const pivot = new THREE.Group();
      pivot.add(model); pivot.visible = false;
      return pivot;
    });
    // 他の装備と共有しない。色を変えるのはshellのみで発光色は維持する。
    const shells = new Set();
    source.traverse(node => {
      for (const material of [node.material].flat().filter(Boolean)) {
        if (material.name === 'EarShell') shells.add(material);
      }
    });
    if (!shells.size) throw new Error('EarShell materialがありません');
    let disposed = false;
    return {
      roots,
      applyColor(color) { shells.forEach(material => material.color.set(color)); },
      dispose() {
        if (disposed) return;
        disposed = true;
        roots.forEach(root => root.removeFromParent());
        disposeSource(source);
      },
    };
  } catch (error) {
    disposeSource(source);
    throw error;
  }
}

export function loadEarAsset(url) {
  return new Promise((resolve, reject) => {
    loadGLB(url, source => {
      try { resolve(createEarAsset(source)); } catch (error) { reject(error); }
    }, (message, error) => reject(new Error(message, { cause: error })));
  });
}
