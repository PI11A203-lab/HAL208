// 腕の3Dモデル（GLB）の読み込みと表示（Issue #7）。
// 読み込みに失敗した場合は呼び出し側で既存のプリミティブ形状を使い続けます。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FINGER_BONES, findMissingParts, segmentPose } from './arm-model.js';

export function loadGLB(url, onLoaded, onError = console.warn) {
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => onLoaded(gltf.scene),
    undefined,
    (error) => onError(`GLBモデルを読み込めませんでした (${url})`, error)
  );
}

// 読み込んだモデルの元データ（url → Promise）。
// geometry は全instanceで共有し、ページを開いている間は保持する（RESETでも解放しない）。
// 読込に失敗したurlはキャッシュから外し、次のAPPLYで再試行できるようにする。
const templates = new Map();
export function loadArmTemplate(url) {
  if (!templates.has(url)) {
    const promise = new Promise((resolve, reject) => {
      new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    templates.set(url, promise);
    promise.catch(() => templates.delete(url));
  }
  return templates.get(url);
}

function nodeNames(root) {
  const names = [];
  root.traverse((object) => names.push(object.name));
  return names;
}

// 片腕分の表示を作る。左右の腕で別々に呼び出す（マテリアルはinstanceごとに複製）。
// model：config.js の ARM_MODELS の1件。必要なノードがなければ例外を投げる。
// mirror：右腕として作ったモデルを左右反転して左腕に使う（three.js が面の向きを自動で補正する）。
// 手（Hand）の子に指の節（FINGER_BONES のノード）があれば、指を1本ずつ追跡に合わせて動かせる。
// 戻り値：{ root, parts, hasFingers, applyPose, applyAppearance, setVisible, dispose }
export function createArmView(template, model, { mirror = false } = {}) {
  const required = Object.values(model.parts).map((part) => part.node);
  const missing = findMissingParts(nodeNames(template), required);
  if (missing.length) throw new Error(`腕モデルに必要なノードがありません: ${missing.join(', ')}`);

  const root = new THREE.Group();
  root.name = 'ArmView';
  root.visible = false;
  const materials = new Map(); // マテリアル名（shell / joint / emission）→ このinstance専用の複製
  const ownMaterial = (material) => {
    const key = material.name || 'shell';
    if (!materials.has(key)) materials.set(key, material.clone());
    return materials.get(key);
  };

  const parts = {};
  for (const [key, spec] of Object.entries(model.parts)) {
    const piece = template.getObjectByName(spec.node).clone(true);
    piece.position.set(0, 0, 0); // ファイル内の並べ方は使わず、ノードの原点＝関節として扱う
    piece.quaternion.identity();
    piece.scale.set(mirror ? -1 : 1, 1, 1);
    piece.traverse((object) => {
      if (!object.isMesh) return;
      object.material = ownMaterial(object.material);
      object.frustumCulled = false; // 拡縮が大きいため、境界判定で消えないようにする
    });
    const holder = new THREE.Group(); // 追跡から求めた姿勢を受け取る
    holder.add(piece);
    root.add(holder);
    parts[key] = { holder, spec, piece };
  }

  // 指の節：手から切り離し、それぞれの姿勢を受け取る holder に入れる。
  // 手を追跡していない時は、手のひらに対するモデル上の姿勢（rest）で表示する
  const mirrorMatrix = new THREE.Matrix4().makeScale(mirror ? -1 : 1, 1, 1);
  const handPart = Object.values(parts).find((p) => p.spec.to === 'handTip');
  const fingerNodes = handPart ? FINGER_BONES.map((b) => handPart.piece.getObjectByName(b.node)) : [];
  const hasFingers = fingerNodes.length > 0 && fingerNodes.every(Boolean);
  const fingers = [];
  if (hasFingers) {
    handPart.piece.updateMatrix();
    FINGER_BONES.forEach((bone, i) => {
      const node = fingerNodes[i];
      node.updateMatrix();
      const rest = node.matrix.clone();
      node.removeFromParent();
      node.position.set(0, 0, 0);
      node.quaternion.identity();
      node.scale.set(mirror ? -1 : 1, 1, 1);
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      holder.add(node);
      root.add(holder);
      fingers.push({ holder, rest, bone, baseLength: node.userData.baseLength ?? 0.1, baseRadius: node.userData.baseRadius ?? 0.03 });
    });
  }
  const palm = handPart?.piece.userData ?? {};

  const basis = new THREE.Matrix4();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  const setPose = (holder, pose) => {
    pos.fromArray(pose.position);
    basis.makeBasis(ax.fromArray(pose.xAxis), ay.fromArray(pose.yAxis), az.fromArray(pose.zAxis));
    quat.setFromRotationMatrix(basis);
    scl.fromArray(pose.scale);
    if (holder.matrixAutoUpdate) { holder.position.copy(pos); holder.quaternion.copy(quat); holder.scale.copy(scl); }
    else holder.matrix.compose(pos, quat, scl);
  };
  let disposed = false;

  return {
    root,
    parts,
    hasFingers,
    // points：{ shoulder, elbow, wrist, handTip }（シーン座標の [x, y, z]）
    // thickness：腕の太さ（ピクセル）。数値、または部品ごとの { upper, fore, hand }
    // hand：手を追跡している時 { points: 21点（シーン座標、0番＝手首）, back: 手の甲の向き, radius: 手のひらの幅の半分 }
    applyPose(points, thickness, hand = null) {
      const tracked = hasFingers && hand !== null;
      for (const [key, { holder, spec }] of Object.entries(parts)) {
        const t = typeof thickness === 'number' ? thickness : thickness[key];
        if (tracked && holder === handPart.holder) {
          // 手のひら：手首 → 中指の付け根。幅は手の大きさから
          const spec2 = { baseLength: palm.trackLength ?? 0.44, baseRadius: palm.trackRadius ?? 0.15 };
          setPose(holder, segmentPose(hand.points[0], hand.points[9], spec2, hand.radius, hand.back));
        } else {
          setPose(holder, segmentPose(points[spec.from], points[spec.to], spec, t));
        }
      }
      if (!hasFingers) return;
      if (tracked) {
        const k = hand.radius / (palm.trackRadius ?? 0.15); // モデルの手のひらと同じ比率で指の太さを決める
        for (const f of fingers) {
          setPose(f.holder, segmentPose(hand.points[f.bone.from], hand.points[f.bone.to],
            { baseLength: f.baseLength, baseRadius: f.baseRadius }, f.baseRadius * k, hand.back));
        }
      } else {
        handPart.holder.updateMatrix();
        for (const f of fingers) {
          f.holder.matrix.copy(handPart.holder.matrix).multiply(mirrorMatrix).multiply(f.rest).multiply(mirrorMatrix);
        }
      }
    },
    // design：config.js の DESIGNS の1件（色・粗さ・発光）
    applyAppearance(design) {
      const shell = materials.get('shell'), joint = materials.get('joint'), emission = materials.get('emission');
      if (shell) { shell.color.setHex(design.metal); shell.roughness = design.rough; }
      if (joint) joint.color.setHex(design.joint);
      if (emission) {
        emission.color.setHex(design.neon);
        emission.emissive.setHex(design.neon);
        emission.emissiveIntensity = design.glow;
      }
    },
    setVisible(visible) { root.visible = visible; },
    // このinstanceのマテリアルだけを解放する（共有geometryはテンプレートが持つため解放しない）
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      materials.forEach((material) => material.dispose());
      materials.clear();
    },
  };
}
