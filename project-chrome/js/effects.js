// 充電（腕の発光）とシールドの描画。毎フレーム資産を作らず、init時に作成して使い回す。
import * as THREE from 'three';

// 腕専用材質の発光を一時的に強める。解除で基準外観(design)へ戻す。猫耳の材質は別インスタンス。
export function createArmGlow({ neonMat, metalMat }) {
  return {
    set(strength, design) {
      const s = Math.min(1, Math.max(0, strength));
      neonMat.emissiveIntensity = design.glow * (1 + 2.5 * s);
      metalMat.emissive.setHex(design.neon);
      metalMat.emissiveIntensity = 0.35 * s;
    },
    restore(design) {
      neonMat.emissiveIntensity = design.glow;
      metalMat.emissive.setHex(0x000000);
      metalMat.emissiveIntensity = 1;
    },
  };
}

export function createShield(scene) {
  const group = new THREE.Group();
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const fillGeo = new THREE.CircleGeometry(1, 6);
  const edgeGeo = new THREE.RingGeometry(0.93, 1, 6);
  const innerGeo = new THREE.RingGeometry(0.6, 0.63, 6);
  group.add(new THREE.Mesh(fillGeo, fillMat), new THREE.Mesh(edgeGeo, edgeMat), new THREE.Mesh(innerGeo, edgeMat));
  group.visible = false;
  group.renderOrder = 10;
  scene.add(group);
  return {
    group,
    // pos: シーン座標の中心、radius: ピクセル、color: 0xRRGGBB
    update(pos, radius, strength, color, tSec) {
      group.visible = true;
      group.position.copy(pos);
      group.position.z += 5;
      const pulse = 1 + 0.04 * Math.sin(tSec * 8);
      group.scale.setScalar(radius * (0.6 + 0.4 * strength) * pulse);
      group.rotation.z = tSec * 0.5;
      fillMat.color.setHex(color); edgeMat.color.setHex(color);
      fillMat.opacity = 0.22 * strength; edgeMat.opacity = 0.9 * strength;
    },
    hide() { group.visible = false; },
    dispose() {
      scene.remove(group);
      fillGeo.dispose(); edgeGeo.dispose(); innerGeo.dispose(); fillMat.dispose(); edgeMat.dispose();
    },
  };
}
