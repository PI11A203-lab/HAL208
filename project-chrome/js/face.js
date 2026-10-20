// 顔パーツ用ジオメトリ。猫耳の輪郭はここで調整できます。
import * as THREE from 'three';

export function earShape(k) { // 底辺が y=0、先端が y=1 の丸みのある三角形（耳の輪郭）
  const sh = new THREE.Shape();
  sh.moveTo(-0.5 * k, 0);
  sh.quadraticCurveTo(-0.58 * k, 0.55 * k, -0.06 * k, 0.98 * k);
  sh.quadraticCurveTo(0, 1.03 * k, 0.06 * k, 0.98 * k);
  sh.quadraticCurveTo(0.5 * k, 0.6 * k, 0.5 * k, 0);
  sh.quadraticCurveTo(0, -0.1 * k, -0.5 * k, 0);
  return sh;
}
