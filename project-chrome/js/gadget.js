// 前腕のギミックの表示：射出装置（ふた・砲身）、溜めの光、弾（PLASMA / NET / HOOK）、ロケットフィストのケーブルと噴射。
// 発射の閃光・衝撃波・火花・腕を照らす光・画面の揺れで、撃った手ごたえを出します（光の表現は fx.js）。
// 本体は前腕に付け、発射した弾は「発射した瞬間の位置と向き」から飛ぶ（腕を下ろしても弾道は変わらない）。
// 動きの計算は gadget-logic.js、モデルの規格は assets/models/README.md を参照してください。
import * as THREE from 'three';
import { findMissingParts, segmentPose } from './arm-model.js';
import { createFlame } from './flame.js';
import { createCable, createEnergyNet, createFlash, createPlasmaOrb, createShockwave, createSparks } from './fx.js';

export const GADGET_NODES = ['LauncherBase', 'LauncherHatch', 'LauncherBarrel', 'HookHead', 'NetPod'];
const HATCH_OPEN = THREE.MathUtils.degToRad(70);
const PRONG_OPEN = THREE.MathUtils.degToRad(40);
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

function names(root) {
  const list = [];
  root.traverse((o) => list.push(o.name));
  return list;
}

// 方向 d（[x,y,z]）へ +Y を向ける回転
function quatAlong(d, out) {
  const sp = segmentPose([0, 0, 0], d, { baseLength: 1, baseRadius: 1 }, 1);
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().fromArray(sp.xAxis), new THREE.Vector3().fromArray(sp.yAxis),
    new THREE.Vector3().fromArray(sp.zAxis));
  return out.setFromRotationMatrix(m);
}

// template：gadget-launcher.glb の scene。必要なノードがなければ例外を投げる
// onEvent(type, kind, power)：'fire'（発射）・'hit'（命中）・'reel'（フックの巻き取り開始）の時に呼ぶ（効果音用）
export function createGadgetView(template, { onEvent = () => {} } = {}) {
  const missing = findMissingParts(names(template), GADGET_NODES);
  if (missing.length) throw new Error(`ギミックのモデルに必要なノードがありません: ${missing.join(', ')}`);

  const materials = new Map();
  const own = (object) => object.traverse((o) => {
    if (!o.isMesh) return;
    const key = o.material.name || 'shell';
    if (!materials.has(key)) materials.set(key, o.material.clone());
    o.material = materials.get(key);
    o.frustumCulled = false;
  });
  const take = (name) => { const p = template.getObjectByName(name).clone(true); own(p); p.position.set(0, 0, 0); return p; };

  // 前腕に付く射出装置
  const mount = new THREE.Group();
  const base = take('LauncherBase');
  mount.add(base);
  const hatch = base.getObjectByName('LauncherHatch');
  const barrel = base.getObjectByName('LauncherBarrel');
  const hatchRest = hatch.quaternion.clone(), barrelRest = barrel.position.clone();

  // 弾と光の表現
  const hook = take('HookHead'), pod = take('NetPod');
  const prongs = hook.children.filter((c) => c.name.startsWith('HookProng'));
  const prongRest = prongs.map((p) => p.quaternion.clone());
  const glowColor = new THREE.Color(0x00e5ff);
  const orb = createPlasmaOrb();                                   // プラズマ弾
  const trail = Array.from({ length: 5 }, () => createPlasmaOrb()); // 弾の残像
  const charge = createPlasmaOrb();                                // 砲口に溜まる光
  const flash = createFlash();                                     // 発射の閃光
  const impactFlash = createFlash();                               // 命中の閃光
  const ring = createShockwave();                                  // 衝撃波
  const sparks = createSparks(90);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 1, roughness: 0.35, side: THREE.DoubleSide });
  const cable = createCable(cableMat);
  const net = createEnergyNet();
  const exhaust = createFlame({ variant: 'blue', light: false, embers: 24, smoke: 8 }); // ロケットフィストの噴射
  const lamp = new THREE.PointLight(0x00e5ff, 0, 1, 0);           // 溜め・閃光・弾で腕を照らす光
  const fxMats = [orb, charge, flash, impactFlash, ring, net, ...trail].map((m) => m.material);

  const root = new THREE.Group();
  root.name = 'GadgetView';
  root.add(mount, hook, pod, orb, ...trail, charge, flash, impactFlash, ring, sparks.object, cable.object, net, exhaust.object, lamp);
  root.visible = false;

  const basis = new THREE.Matrix4(), q = new THREE.Quaternion();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  const muzzle = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3(), origin = new THREE.Vector3();
  const fistOffset = new THREE.Vector3(), flashAt = new THREE.Vector3(), hitAt = new THREE.Vector3(), ringAt = new THREE.Vector3();
  let disposed = false, time = 0, shake = 0;
  let current = null;                                   // 表示中の弾：{ start, fired, hit }
  let flashT = Infinity, hitT = Infinity, ringT = Infinity, hitScale = 1, ringScale = 1, flashScale = 1;
  const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const HIT_COLOR = { plasma: null, net: null, hook: 0xffb060, fist: 0xcfefff };

  function showQuad(m, at, size, alpha, z = 10) {
    m.visible = alpha > 0.003 && size > 0;
    if (!m.visible) return;
    m.position.copy(at);
    m.position.z += z;
    m.scale.set(size, size, 1);
    m.material.uniforms.alpha.value = alpha;
    m.material.uniforms.time.value = time;
  }

  return {
    root,
    get muzzle() { return muzzle.toArray(); }, // 直前のフレームの砲口の位置（シーン座標）
    // 発射・命中で起きた画面の揺れの強さを受け取る（受け取ると 0 に戻る）
    takeShake() { const v = shake; shake = 0; return v; },
    // s：{ elbow, wrist（シーン座標 [x,y,z]）, thickness, config, kind, open（ふたの開き 0〜1）, charge（溜め 0〜1）,
    //      shot：発射中なら { start, phase, origin, dir, power, range } }, dt：前フレームからの秒数
    // 戻り値：ロケットフィストの時、手をずらす量 [x, y, z]（それ以外は null）
    update(s, dt) {
      time += dt;
      const { config, kind, shot } = s;
      const th = s.thickness;
      const pose = segmentPose(s.elbow, s.wrist, { baseLength: 1, baseRadius: 1 }, 1);
      const len = pose.scale[1];
      ax.fromArray(pose.xAxis); ay.fromArray(pose.yAxis); az.fromArray(pose.zAxis);
      basis.makeBasis(ax, ay, az);
      const isFist = kind === 'fist';
      mount.visible = !isFist;
      mount.quaternion.setFromRotationMatrix(basis);
      mount.position.fromArray(pose.position).addScaledVector(ay, len * config.along).addScaledVector(az, th * config.out);
      const scale = th * config.scale;
      mount.scale.setScalar(scale);

      const phase = shot?.phase;
      const open = phase ? phase.hatch : s.open;
      const ext = phase ? phase.barrel : s.open;
      hatch.quaternion.copy(hatchRest).multiply(q.setFromAxisAngle(X, HATCH_OPEN * open));
      barrel.position.copy(barrelRest).y += config.barrelTravel * ext;
      mount.updateMatrixWorld(true);
      if (isFist) muzzle.fromArray(s.wrist);
      else barrel.localToWorld(muzzle.set(0, config.muzzle, 0));

      // 溜めの光：溜めるほど大きく白くなり、満タンで脈打つ
      const pulse = 1 + (s.charge >= 1 ? 0.18 : 0.08) * Math.sin(time * (s.charge >= 1 ? 30 : 16));
      showQuad(charge, muzzle, !phase && s.charge > 0 ? th * (1.2 + 3.6 * s.charge) * pulse : 0, 0.35 + 0.75 * s.charge);

      for (const o of [hook, pod, orb, net, cable.object, ...trail]) o.visible = false;
      fistOffset.set(0, 0, 0);
      let exhaustAt = null, lampAt = muzzle, lampLevel = s.charge * 3 * pulse;
      if (!shot) current = null;
      else if (!current || current.start !== shot.start) current = { start: shot.start, fired: false, hit: false, reeled: false };

      if (phase?.active) {
        origin.fromArray(shot.origin);
        dir.fromArray(shot.dir);
        const flying = phase.flying && phase.travel > 0.005;
        const target = origin.clone().addScaledVector(dir, shot.range);
        const power = shot.power;
        // 発射の瞬間：閃光・火花・揺れ（FIST は衝撃波）
        if (flying && !current.fired) {
          current.fired = true;
          flashT = 0; flashAt.copy(muzzle); flashScale = th * (4 + 4 * power);
          flash.material.uniforms.seed.value = Math.random() * 6.28;
          sparks.burst(muzzle.toArray(), shot.dir, glowColor, isFist ? 10 : 14, th * 14, 0.9);
          if (isFist) { ringT = 0; ringAt.copy(muzzle); ringScale = th * 7; }
          shake += 0.25 + 0.5 * power;
          onEvent('fire', kind, power);
        }
        // 命中の瞬間：閃光・火花・衝撃波・揺れ
        if (phase.impact > 0.01 && !current.hit) {
          current.hit = true;
          hitT = 0; hitAt.copy(isFist ? tip.fromArray(s.wrist).lerp(target, phase.travel) : target);
          hitScale = th * (kind === 'hook' ? 3 : 5 + 4 * power);
          impactFlash.material.uniforms.seed.value = Math.random() * 6.28;
          sparks.burst(hitAt.toArray(), dir.clone().negate().toArray(), HIT_COLOR[kind] ?? glowColor,
            kind === 'hook' ? 26 : 34, th * (kind === 'hook' ? 12 : 18), 1.6);
          if (kind === 'plasma' || kind === 'fist') { ringT = 0; ringAt.copy(hitAt); ringScale = th * (8 + 6 * power); }
          shake += kind === 'hook' || kind === 'net' ? 0.25 : 0.4 + 0.5 * power;
          onEvent('hit', kind, power);
        }
        if (kind === 'hook' && current.hit && !current.reeled && phase.fade > 0.01) { current.reeled = true; onEvent('reel', kind, power); }
        if (isFist) {
          // 手が飛び出し、手首とケーブルでつながったまま戻る
          tip.fromArray(s.wrist).lerp(target, phase.travel);
          fistOffset.copy(tip).sub(muzzle);
          if (flying) {
            cable.object.visible = true;
            cable.set(muzzle, tip, th * 0.08, 0.15 * (1 - phase.travel) + 0.05, 0.2 * (1 - phase.travel), time);
            exhaustAt = tip.clone().addScaledVector(dir, -th * 0.6).toArray();
            lampAt = tip; lampLevel += 2.5;
          }
        } else {
          tip.copy(origin).addScaledVector(dir, shot.range * phase.travel);
          const projScale = scale * config.projectileScale * (0.8 + 0.6 * power);
          if (kind === 'plasma') {
            const r = th * (0.45 + 0.9 * power);
            if (flying && phase.impact < 0.05) {
              showQuad(orb, tip, r * 3.4, 1);
              orb.material.uniforms.time.value = time * (1 + power);
              trail.forEach((t, i) => {
                const k = 1 - (i + 1) / (trail.length + 1);
                showQuad(t, tip.clone().addScaledVector(dir, -r * 0.55 * (i + 1)), r * 2.8 * k, 0.4 * k, 9 - i * 0.1);
              });
              lampAt = tip; lampLevel += 3 + 3 * power;
            }
          } else {
            const isHook = kind === 'hook';
            const p = isHook ? hook : pod;
            p.visible = flying && (isHook || phase.impact < 0.05);
            p.position.copy(tip);
            quatAlong(shot.dir, p.quaternion);
            p.scale.setScalar(projScale);
            prongs.forEach((pr, i) => pr.quaternion.copy(prongRest[i]).multiply(q.setFromAxisAngle(Z, -PRONG_OPEN * phase.impact)));
            if (isHook && flying) {
              // 飛ぶ間は張って波打ち、刺さった後はたるみながら巻き取られる
              cable.object.visible = true;
              cable.set(muzzle, tip, th * 0.06, phase.impact > 0 ? 0.08 + 0.25 * phase.fade : 0.03, phase.impact > 0 ? 0 : 0.35 * (1 - phase.travel), time);
            }
            if (!isHook && phase.impact > 0.01) {
              const n = ease(phase.impact);
              showQuad(net, target, th * config.netRadius * 2 * Math.max(0.05, n), 1 - phase.fade, 6);
              net.material.uniforms.open.value = n;
              net.rotation.z = n * 0.5;
              lampAt = target; lampLevel += 2 * (1 - phase.fade);
            }
          }
        }
      }
      // 閃光・衝撃波（発射が終わった後も短く残る）
      flashT += dt; hitT += dt; ringT += dt;
      showQuad(flash, flashAt, flashT < 0.14 ? flashScale * (0.6 + 0.6 * flashT / 0.14) : 0, 1 - flashT / 0.14, 12);
      showQuad(impactFlash, hitAt, hitT < 0.22 ? hitScale * (0.7 + 0.5 * hitT / 0.22) : 0, 1 - hitT / 0.22, 12);
      showQuad(ring, ringAt, ringT < 0.45 ? ringScale * (0.4 + 0.8 * ringT / 0.45) : 0, 1 - ringT / 0.45, 8);
      if (ring.visible) ring.material.uniforms.progress.value = ringT / 0.45;
      if (flashT < 0.14) { lampAt = flashAt; lampLevel += 12 * (1 - flashT / 0.14); }
      if (hitT < 0.22) lampLevel += 6 * (1 - hitT / 0.22);
      sparks.update(dt, th * 25);
      exhaust.update(dt, exhaustAt, th * 0.6, dir.clone().negate().toArray());
      // 腕を照らす光
      lamp.position.copy(lampAt);
      lamp.position.z += th * 3;
      lamp.distance = th * 22;
      lamp.intensity = root.visible ? lampLevel : 0;
      return isFist && phase?.active ? fistOffset.toArray() : null;
    },
    applyAppearance(design) {
      const shell = materials.get('shell'), joint = materials.get('joint'), emission = materials.get('emission');
      if (shell) { shell.color.setHex(design.metal); shell.roughness = design.rough; }
      if (joint) joint.color.setHex(design.joint);
      if (emission) { emission.color.setHex(design.neon); emission.emissive.setHex(design.neon); emission.emissiveIntensity = design.glow; }
      glowColor.setHex(design.neon);
      fxMats.forEach((m) => m.uniforms.color.value.copy(glowColor));
      lamp.color.copy(glowColor);
    },
    setVisible(visible) { root.visible = visible; if (!visible) lamp.intensity = 0; },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      materials.forEach((m) => m.dispose());
      fxMats.forEach((m) => m.dispose());
      for (const o of [orb, charge, flash, impactFlash, ring, net, ...trail]) o.geometry.dispose();
      cableMat.dispose(); cable.dispose(); sparks.dispose(); exhaust.dispose(); lamp.dispose();
    },
  };
}
