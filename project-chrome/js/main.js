import * as THREE from "three";
import { renderArmCards } from './collection.js';
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadGLB, loadArmTemplate, createArmView } from "./arms.js";
import { createRequestTracker, handTip, handBackNormal, assignHands } from "./arm-model.js";
import { measureWidth, createSmoother } from "./body-fit.js";
import { createGadgetView } from "./gadget.js";
import { createFlame, configureFx } from "./flame.js";
import { createBloom } from "./bloom.js";
import { createVideoEnvironment, matchLighting } from "./env.js";
import { ASSEMBLY_STAGES, ASSEMBLY_TIMING, assemblyDuration, lockedBetween } from "./assembly.js";
import { createFlash, createSparks } from "./fx.js";
import { playSfx, setLoop, setSfxMuted, setSfxVolume, sfxMuted, stopAllLoops, unlockAudio } from "./sfx.js";
import { createChargeController, createGestureTrigger, createPunchDetector, shotPhase, shotDuration, isAimPose, elbowAngle,
         classifyHand, createStableLabel, isFist, isOpenHand, GESTURE_TO_GADGET } from "./gadget-logic.js";
import { earShape } from "./face.js";
import { trackState, armAge, shoulderWidth, isFinitePoint, clampZStep, gateZByVis, reprojectXY, handOrientation, HOLD_SEC } from "./arm-tracking.js";
import { createEarController } from './ear-state.js';
import { loadEarAsset } from './ear-model.js';
import { loadMaskAsset } from './mask-model.js';
import { fitMask } from './mask-fit.js';
import { createLoadoutMenu } from './loadout-menu.js';
import { MASK_MODELS, MASK_DEFAULTS } from './config.js?v=33-develop-merge';
import { createHairTracker } from './hair-tracking.js';
import { fitEarAnchor } from './hair-fit.js';
import { PoseLandmarker, FaceLandmarker, HandLandmarker, FilesetResolver }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const glCanvas = document.getElementById("gl");
const skelCanvas = document.getElementById("skel");
const skelCtx = skelCanvas.getContext("2d");
const info = document.getElementById("info");
const loadoutMenu = createLoadoutMenu(document);

/* ---------------- 設定 ---------------- */
// 初期設定は config.js から読み込みます。
const settings = { ...DEFAULTS };
const VIS_MIN = 0.5;      // この信頼度未満の点は更新しない
// HOLD_SEC（保持時間）と tracking/holding/lost の境界は arm-tracking.js で一元管理する。
const BETA = 0.02;        // One Euro：速度への感度（ピクセル単位）

/* ---------------- One Euro フィルター ---------------- */
import { OneEuro } from './tracking.js';
import { createExperience, reduceExperience, armDisplayMode, EVENTS, PHASES } from './experience.js?v=2';
// 装着音の入口（#15）。腕のギミックの効果音（sfx.js）と名前が重ならないよう別名で読む
import { unlockAudio as unlockEquipSound, playEquip } from './sound.js';
import { createCameraInput } from './camera-input.js';


/* ---------------- モデルとカメラ ---------------- */
let landmarker, faceLm, vision, visionFiles;
try {
  info.textContent = "モデルを読み込み中（インターネット接続が必要）...";
  vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  visionFiles = vision;
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    outputSegmentationMasks: true, // 人物の切り抜き：腕の実際の太さを測るために使う
  });
  // 顔モデル：猫耳と目のエフェクト用
  faceLm = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });
} catch (e) {
  info.textContent = "モデルを読み込めませんでした: " + e.message;
  throw e;
}
info.textContent = "";

/* ---------------- カメラ（#20） ---------------- */
// 映像サイズは最初は仮の値。カメラが使えた時に applyVideoSize で実際の値へ合わせる（W/H を固定のまま復帰しない）
let W = 1280, H = 720, camState = "idle";
const hairTracker = createHairTracker(vision);
const cam = createCameraInput({ mediaDevices: navigator.mediaDevices, video, onChange: onCameraChange });

/* ---------------- three.jsシーン ---------------- */
// 正射影カメラ：1単位＝動画の1ピクセル、y軸は上向き（そのため y = H - y_ピクセル）
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(-1, 2, 3);
scene.add(key);
// クロームに実際の部屋を映し、部屋の明るさに照明を合わせる（TRACKING SETTINGS の Room reflections）
const roomEnv = createVideoEnvironment(renderer, scene, video);

// カメラ：ARM_TUNING.usePerspective で透視/正射影を切替。
// 透視投影：被写体から camDist だけ引き、z=0平面上では正射影と同じ画面位置になるFOVを使う。
//   x=q.x*W / y=q.y*H のピクセル座標はそのまま画面に一致し、z≠0 の点にだけ遠近（奥は小さく）が効く。
//   腕の前後関係が「重なり順」だけでなく「大きさ」でも表現され、交差時の破綻が減る。
// 正射影：従来挙動（遠近なし）。切り分け・フォールバック用。
let camera;
if (ARM_TUNING.usePerspective) {
  const camDist = ARM_TUNING.camDist;
  const fovRad = 2 * Math.atan((H / 2) / camDist);
  camera = new THREE.PerspectiveCamera(
    THREE.MathUtils.radToDeg(fovRad), W / H, ARM_TUNING.near, ARM_TUNING.far);
  camera.position.set(W / 2, H / 2, camDist);
  camera.lookAt(W / 2, H / 2, 0);
} else {
  camera = new THREE.OrthographicCamera(0, W, H, 0, 0.1, 5000);
  camera.position.z = 2000;
}
// 揺れ演出の基準位置。正射影は(0,0)、透視投影は(W/2,H/2)。揺れはこの位置を中心に加える。
const camBaseX = camera.position.x, camBaseY = camera.position.y;
const bloom = createBloom(renderer, W, H);              // 炎・弾のにじみ（Effects quality が HIGH の時）

/* ---------------- ロボットアームモデル ---------------- */
// 腕専用マテリアル（shell / joint / emission の3スロット）。猫耳とは共有しない。
// 左右の腕は同じ3つのmaterialを共有する（色変更が左右に同時に反映される）。
// 色・質感は applyAppearanceToMaterials() が appState.applied から更新する（materialは作り直さない）。
const armShellMat    = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.4, roughness: 0.38 });
const armJointMat    = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 1.0, roughness: 0.2 });
const armEmissionMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6 });

// 円柱：先端（+Y側）をやや細くし、腕の先に向かって細くなる形にする
const cylGeo = new THREE.CylinderGeometry(0.8, 1, 1, 32);
const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const torusGeo = new THREE.TorusGeometry(1, 0.08, 12, 48);

function makeArm(name, ids, handIds) {
  const g = new THREE.Group();
  const m = {
    shoulder: new THREE.Mesh(sphereGeo, armJointMat),
    upper: new THREE.Mesh(cylGeo, armShellMat),
    elbow: new THREE.Mesh(sphereGeo, armJointMat),
    fore: new THREE.Mesh(cylGeo, armShellMat),
    hand: new THREE.Mesh(boxGeo, armShellMat),
    ring1: new THREE.Mesh(torusGeo, armEmissionMat),
    ring2: new THREE.Mesh(torusGeo, armEmissionMat),
  };
  Object.values(m).forEach(mesh => g.add(mesh));
  g.visible = false;
  scene.add(g);
  // ids=[肩,肘,手首]（状態判定・腕本体用）、handIds=[人差し指付け根,小指付け根]（手の向き用）。
  return { name, ids, handIds, g, m, state: "lost" };
}
// MediaPipe Pose：左腕 11-13-15（手首）＋ 19/17（人差し指/小指付け根）、右腕 12-14-16 ＋ 20/18。
const ARMS = [makeArm("Left arm", [11, 13, 15], [19, 17]), makeArm("Right arm", [12, 14, 16], [20, 18])];
// カスタムGLBモデルの読み込みには arms.js の loadGLB() を使用できます。

/* ---------------- GLB腕モデル（Issue #7） ---------------- */
// status：none（簡易形状）/ loading / ready / failed。views は ARMS と同じ順の左右の表示。
// requests で最新の依頼だけを有効にし、連続切替やRESET後に古いモデルが復活しないようにする。
const armModel = { id: null, status: "none", views: null, requests: createRequestTracker(), assembly: null };

function clearArmModel() {
  armModel.requests.cancel();
  armModel.views?.forEach(v => v.dispose());
  Object.assign(armModel, { id: null, status: "none", views: null, assembly: null });
  $("assemblybox").style.display = "none";
}

/* ---------------- 装着の演出（APPLY 後に部品が飛んできてはまる） ---------------- */
// 人が映ってから始め、部品がはまるたびに関節で火花と閃光を出し、画面にシステム表示を1行ずつ出す。
const assemblyFx = { sparks: createSparks(160), flashes: Array.from({ length: 4 }, () => createFlash()), pops: [] };
scene.add(assemblyFx.sparks.object, ...assemblyFx.flashes);

function startAssembly() {
  armModel.assembly = { start: null, prev: -0.001 };
  const box = $("assemblybox");
  box.innerHTML = `<b>ASSEMBLING // ${design.name}</b>`;
  box.style.display = "none";
}

function assemblyJoint(arm, joint) {
  const [sh, el, wr] = arm.ids.map(id => conv(joints[id].p));
  if (joint === "shoulder") return sh;
  if (joint === "elbow") return el;
  if (joint === "wrist") return wr;
  return wr.clone().addScaledVector(wr.clone().sub(el), 0.35);   // 指の付け根あたり
}

function updateAssembly(now) {
  const a = armModel.assembly, box = $("assemblybox");
  // 閃光（はまった瞬間に関節で光る）
  assemblyFx.pops = assemblyFx.pops.filter(p => {
    const k = (now - p.t0) / 0.18;
    p.mesh.visible = k < 1;
    if (!p.mesh.visible) return false;
    p.mesh.position.copy(p.at); p.mesh.position.z += 20;
    p.mesh.scale.setScalar(p.size * (0.6 + 0.6 * k));
    p.mesh.material.uniforms.alpha.value = 1 - k;
    p.mesh.material.uniforms.time.value = now;
    return true;
  });
  assemblyFx.sparks.update(frameDt, bodyScale * 4);
  if (!a || armModel.status !== "ready") return;
  const visible = ARMS.filter(arm => arm.state !== "lost" && armDisplayMode(exp) === 'action');
  if (a.start === null) {
    if (!visible.length) { armModel.views.forEach(v => v.setAssembly(0)); return; }   // 人が映るまで待つ
    a.start = now;
    box.style.display = "block";
  }
  const t = now - a.start;
  for (let i = 0; i < lockedBetween(a.prev, t, { gap: ASSEMBLY_TIMING.gap, dur: 0 }).length; i++) playSfx("assemble-whir", { volume: 0.8 });
  for (const i of lockedBetween(a.prev, t)) {
    playSfx("assemble-lock", { volume: 0.9, rate: 1 + i * 0.05 });
    const stage = ASSEMBLY_STAGES[i];
    visible.forEach((arm, k) => {
      const at = assemblyJoint(arm, stage.joint);
      assemblyFx.sparks.burst(at.toArray(), [0, 1, 0], new THREE.Color(design.neon), 22, bodyScale * 1.6, 1.8);
      const mesh = assemblyFx.flashes[(i * 2 + k) % assemblyFx.flashes.length];
      mesh.material.uniforms.color.value.setHex(design.neon);
      mesh.material.uniforms.seed.value = Math.random() * 6.28;
      assemblyFx.pops.push({ mesh, at, t0: now, size: bodyScale * 0.7 });
    });
    box.insertAdjacentHTML("beforeend", `<div>${stage.label}<i></i><em>OK</em></div>`);
    shakeAmp = Math.min(1, shakeAmp + 0.25);
    if (i === ASSEMBLY_STAGES.length - 1) {
      box.insertAdjacentHTML("beforeend", `<div class="done">SYNC COMPLETE<em>ONLINE ▶</em></div>`);
      playSfx("assemble-done", { volume: 0.7, jitter: 0 });
    }
  }
  a.prev = t;
  const total = assemblyDuration();
  armModel.views.forEach(v => v.setAssembly(t < total ? t : null));
  if (t >= total) { armModel.assembly = null; box.style.display = "none"; }
}

async function useArmModel(id, { animate = true } = {}) {
  if (armModel.id === id && armModel.status === "ready") {   // 同じモデルは読み直さず外観だけ更新
    armModel.views.forEach(v => v.applyAppearance(armLook()));
    if (animate) startAssembly();
    else { armModel.assembly = null; armModel.views.forEach(v => v.setAssembly(null)); }
    say(design.name + " を適用しました。");
    return;
  }
  const model = ARM_MODELS[id];
  const request = armModel.requests.next();
  armModel.id = id; armModel.status = "loading";
  info.textContent = "腕モデルを読み込み中...";           // 読込中は簡易形状で表示を続ける
  const t0 = performance.now();
  try {
    if (!model) throw new Error(`ARM_MODELS に ${id} がありません`);
    const template = await loadArmTemplate(model.url);
    if (!armModel.requests.isCurrent(request)) return;       // 途中で別の装備やRESETが選ばれた
    // MediaPipe の 11-13-15 は本人の左腕。右腕として作ったモデルは左腕で左右反転する
    const views = ARMS.map(arm => createArmView(template, model, { mirror: Boolean(model.mirrorLeft) && arm.ids[0] === 11 }));
    armModel.views?.forEach(v => v.dispose());
    views.forEach(v => { v.applyAppearance(armLook()); scene.add(v.root); });
    armModel.views = views; armModel.model = model; armModel.status = "ready";
    // 部品は腕の外側・上から飛んでくる（MediaPipe の 12＝本人の右肩は映像の左側）
    if (animate) {
      views.forEach((v, i) => v.setAssembly(0, [(ARMS[i].ids[0] === 12 ? -1 : 1) * W * 0.45, H * 0.3, 200]));
      startAssembly();
    } else {
      armModel.assembly = null;
      views.forEach(v => v.setAssembly(null));
    }
    if (views.some(v => v.hasFingers)) ensureHandLandmarker();   // 指の追跡は必要になってから読み込む
    console.info(`腕モデル ${id} を ${Math.round(performance.now() - t0)} ms で読み込みました。`);
    say(design.name + " を適用しました。");
  } catch (e) {
    if (!armModel.requests.isCurrent(request)) return;
    armModel.views?.forEach(v => v.dispose());
    Object.assign(armModel, { views: null, status: "failed" });
    console.warn("腕モデルを読み込めませんでした。簡易モデルで表示します。", e);
    say("腕モデルを読み込めませんでした。簡易モデルで表示します。");
  }
}

/* ---------------- 関節の追跡点 ---------------- */
// 11-16=肩/肘/手首。17-20=手の向き用（小指/人差し指付け根の左右、handOrientation で使用）。
const JOINTS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const joints = {};
function resetJoints() {
  for (const id of JOINTS) {
    joints[id] = { fx: new OneEuro(), fy: new OneEuro(), fz: new OneEuro(),
                   p: new THREE.Vector3(), raw: new THREE.Vector2(), lastSeen: -Infinity, vis: 0 };
  }
}
resetJoints();
let bodyScale = 0.2 * W; // 肩幅（ピクセル）：腕の太さの基準

/* ---------------- 体格に合わせた腕の太さ ---------------- */
// 人物の切り抜きマスクから上腕・前腕の実際の幅を測り、なめらかにして使う（測れない間は肩幅から推定）
for (const arm of ARMS) arm.fit = { upper: createSmoother(BODY_FIT.smoothing), fore: createSmoother(BODY_FIT.smoothing) };
let fitFrame = 0;

function processBodyFit(result) {
  const masks = result.segmentationMasks ?? [];
  try {
    if (!masks.length || fitFrame++ % BODY_FIT.everyFrames !== 0) return;
    const mask = masks[0], data = mask.getAsFloat32Array();
    const opts = { maxHalf: bodyScale * 0.35 };
    const ok = (w) => (w !== null && w > bodyScale * 0.05 && w < bodyScale * 0.6 ? w : null);
    const now = performance.now() / 1000;
    for (const arm of ARMS) {
      const [s, e, w] = arm.ids.map(id => joints[id]);
      if ([s, e, w].some(j => now - j.lastSeen > 0.2)) continue;
      // マスクの解像度が映像と違う場合に合わせる
      const sx = mask.width / W, sy = mask.height / H;
      const px = (j) => ({ x: j.p.x * sx, y: j.p.y * sy });
      arm.fit.upper.update(ok(measureWidth(data, mask.width, mask.height, px(s), px(e), opts) / sx));
      arm.fit.fore.update(ok(measureWidth(data, mask.width, mask.height, px(e), px(w), opts) / sx));
    }
  } finally {
    masks.forEach(m => m.close()); // 毎フレーム解放する（GPUメモリの増加を防ぐ）
  }
}

/* ---------------- 指の追跡 ---------------- */
// 指に分かれたGLB腕を表示している間だけ、手の21点を検出して指の節を動かす
let handLm = null, handLmLoading = false;
for (const arm of ARMS) {
  arm.hand = { pts: Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })), lastSeen: -Infinity,
               f: Array.from({ length: 21 }, () => [new OneEuro(), new OneEuro(), new OneEuro()]) };
}

async function ensureHandLandmarker() {
  if (handLm || handLmLoading) return;
  handLmLoading = true;
  try {
    handLm = await HandLandmarker.createFromOptions(visionFiles, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  } catch (e) {
    console.warn("手の追跡モデルを読み込めませんでした。指は固定の形で表示します。", e);
  } finally {
    handLmLoading = false;
  }
}

function processHands(t0, now) {
  if (!handLm || !armModel.views?.some(v => v.hasFingers) || !armsShown()) return;
  const res = handLm.detectForVideo(video, t0);
  const hands = res.landmarks ?? [];
  if (!hands.length) return;
  const pick = assignHands(hands.map(l => ({ x: l[0].x * W, y: l[0].y * H })),
                           ARMS.map(a => joints[a.ids[2]].p), bodyScale * 0.6);
  const minCutoff = 3.0 * Math.pow(0.1, settings.smooth);
  ARMS.forEach((arm, i) => {
    if (pick[i] < 0) return;
    const h = arm.hand, reset = now - h.lastSeen > 0.3;
    hands[pick[i]].forEach((q, k) => {
      const f = h.f[k];
      if (reset) f.forEach(x => x.reset());
      h.pts[k].x = f[0].filter(q.x * W, now, minCutoff, BETA);
      h.pts[k].y = f[1].filter(q.y * H, now, minCutoff, BETA);
      h.pts[k].z = f[2].filter(q.z * W, now, minCutoff, BETA);
    });
    h.lastSeen = now;
  });
}

// 手の21点をシーン座標にし、手首を腕の手首に合わせる
function handPose(arm, wrist, now) {
  const h = arm.hand;
  if (now - h.lastSeen > 0.25) return null;
  const pts = h.pts.map(p => [p.x, H - p.y, -p.z * settings.depth]);
  const d = [0, 1, 2].map(i => wrist[i] - pts[0][i]);
  pts.forEach(p => { p[0] += d[0]; p[1] += d[1]; p[2] += d[2]; });
  const palm = Math.hypot(...[0, 1, 2].map(i => pts[5][i] - pts[17][i]));
  return { points: pts, back: handBackNormal(pts, arm.ids[0] === 12), radius: palm * 0.62 * BODY_FIT.cover };
}

function processFrame(result, now) {
  const lm = result.landmarks[0];
  if (!lm) return;
  const minCutoff = 3.0 * Math.pow(0.1, settings.smooth); // 0 → 3Hz（平滑化が弱い）、1 → 0.3Hz（平滑化が強い）
  for (const id of JOINTS) {
    const q = lm[id], j = joints[id];
    // 欠落点は visibility を参照する前に弾く（q が無いと q.visibility で TypeError になるため）。
    // lastSeen を更新せず最後の位置を保持する（契約：異常点で跳ばさない）。
    if (!q) continue;
    j.vis = q.visibility ?? 0;
    if (j.vis < VIS_MIN) continue;                      // 信頼度の低い点：最後の位置を保持
    // 非有限値（NaN/Infinity）の点も同様に保持。
    if (!isFinitePoint({ x: q.x, y: q.y, z: q.z ?? 0 })) continue;
    if (now - j.lastSeen > 0.3) { j.fx.reset(); j.fy.reset(); j.fz.reset(); } // 長く途切れた後に滑って戻らないようリセット
    const x = j.fx.filter(q.x * W, now, minCutoff, BETA);
    const y = j.fy.filter(q.y * H, now, minCutoff, BETA);
    // z（奥行き）は単眼で最も不安定。x/yより弱いカットオフで強めに平滑化し、
    // さらにフレーム間の跳ねを肩幅基準でクランプして「荒ぶり」を抑える（実測ではない推定値）。
    const zFiltered = j.fz.filter((q.z ?? 0) * W, now, minCutoff * ARM_TUNING.zSmoothFactor, BETA);
    // ① visゲート：隠れてvisが落ちた点のzは信用せず直前値を凍結（荒ぶりの根元を断つ）。
    // ② ステップクランプ：凍結を通った更新でも、残る跳ねを肩幅基準で抑える。
    const zGated = gateZByVis(j.p.z, zFiltered, j.vis, ARM_TUNING.zVisFreeze);
    const z = clampZStep(j.p.z, zGated, bodyScale * ARM_TUNING.zMaxStepRatio);
    j.p.set(x, y, z);
    j.raw.set(q.x * W, q.y * H);
    j.lastSeen = now;
  }
  const a = joints[11], b = joints[12];
  if (now - a.lastSeen < 0.3 && now - b.lastSeen < 0.3) {
    // 有効な両肩から肩幅を更新。異常値（0・非有限・画面幅超）は前回値を保持。
    bodyScale = shoulderWidth(a.p, b.p, W, bodyScale);
  }
}

/* ---------------- 腕の配置 ---------------- */
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
// ピクセル空間→シーン座標。y軸は上向き（H-y）。
// zは settings.depth（UI 0..1）× ARM_TUNING.zDepthScale（config）で最終スケール。
// 透視投影のnearクリップで腕が消えないよう、増幅は控えめにする。
// 透視投影時は、zが付くと投影で画面中心基準に再拡大され追跡点からずれるため、
// reprojectXY で中心オフセットを逆数倍に縮め、投影後に映像ピクセルへ戻す（実腕と一致）。
// 正射影時は再拡大が起きないので補正しない（そのまま渡す）。
const conv = p => {
  const zScene = -p.z * settings.depth * ARM_TUNING.zDepthScale;
  const yFlip = H - p.y;
  if (!ARM_TUNING.usePerspective) return new THREE.Vector3(p.x, yFlip, zScene);
  const r = reprojectXY(p.x, yFlip, zScene, W / 2, H / 2, ARM_TUNING.camDist);
  return new THREE.Vector3(r.x, r.y, zScene);
};

function setCyl(mesh, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(d.length(), 1e-3);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
  mesh.scale.set(r, len, r);
}

/* ---------------- 腕のギミック（PLASMA / NET / HOOK / FIST）と指先の火 ---------------- */
// AUTO：手の形・動きでギミックを選んで発射する（対応は gadget-logic.js の GESTURE_TO_GADGET の説明を参照）。
// 種類を1つ選んだ時：腕をまっすぐ伸ばして肩の高さより上に向けると溜め始め、構えを解くか握った拳を開くと発射する。
// 溜めるほど弾が大きく遠くへ飛ぶ。FIREボタン・Gキーでは最大の溜めですぐ発射する（AUTO の時は PLASMA）。
const gadget = { kind: "off", views: null, requests: createRequestTracker(),
                 ctrls: ARMS.map(() => createChargeController({ fullCharge: GADGET.fullCharge })),
                 shots: ARMS.map(() => null), aimDir: ARMS.map(() => [0, 1, 0]), curDir: ARMS.map(() => [0, 1, 0]),
                 foreLen: ARMS.map(() => 100),
                 triggers: ARMS.map(() => createGestureTrigger({ hold: 0.2 })), punches: ARMS.map(() => createPunchDetector()),
                 labels: ARMS.map(() => null) };
// 待機中に表示する装置の形（AUTO の時は射出装置）
const idleKind = () => (gadget.kind === "auto" ? "plasma" : gadget.kind);
const flames = ARMS.map(() => { const f = createFlame(); scene.add(f.object); return f; });
const pointing = ARMS.map(() => ({ since: null }));
let frameDt = 1 / 30;
const ease01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// 1本の腕のギミックの状態（溜め・発射中の弾・ジェスチャー判定・指先の火）を初期状態に戻す。
// 追跡を失った時と RESET の時に呼び、溜めた時間や弾が後から復活しないようにする
function resetArmGadget(i) {
  gadget.ctrls[i].reset();
  gadget.shots[i] = null;
  gadget.triggers[i].reset();
  gadget.punches[i].reset();
  gadget.labels[i] = null;
  handLabels[i].reset();
  currentLabel[i] = null;
  pointing[i].since = null;
  pointing[i].lit = false;
}

// すべての腕のギミックの状態を初期化し、続いている音（溜め・火・噴射）も止める
function resetGadgetState() {
  ARMS.forEach((_, i) => resetArmGadget(i));
  wasFull = false;
  stopAllLoops();
}

function clearGadget() {
  gadget.requests.cancel();
  gadget.views?.forEach(v => v.dispose());
  gadget.views = null;
  resetGadgetState();
}

async function setGadgetKind(kind) {
  gadget.kind = kind;
  document.querySelectorAll("#gadgetMode button").forEach(b => b.classList.toggle("sel", b.dataset.g === kind));
  if (kind === "off") { clearGadget(); return; }
  if (gadget.views) return;                                    // 種類の切替は表示側で行う
  const request = gadget.requests.next();
  try {
    const template = await loadArmTemplate(GADGET.url);
    if (!gadget.requests.isCurrent(request)) return;
    gadget.views = ARMS.map(() => createGadgetView(template, { onEvent: gadgetSound }));
    gadget.views.forEach(v => { v.applyAppearance(armLook()); scene.add(v.root); });
  } catch (e) {
    if (!gadget.requests.isCurrent(request)) return;
    console.warn("ギミックのモデルを読み込めませんでした。", e);
    say("ギミックのモデルを読み込めませんでした。");
    gadget.kind = "off";
    document.querySelectorAll("#gadgetMode button").forEach(b => b.classList.toggle("sel", b.dataset.g === "off"));
  }
}

// ギミックの効果音（発射・命中・巻き取り）
const SHOT_SOUNDS = {
  fire: { plasma: "plasma-fire", net: "net-fire", hook: "hook-fire", fist: "fist-launch" },
  hit: { plasma: "plasma-hit", net: "net-open", hook: "hook-hit", fist: "fist-hit" },
  reel: { hook: "hook-reel" },
};
function gadgetSound(type, kind, power) {
  const name = SHOT_SOUNDS[type]?.[kind];
  // 溜めが強いほど低く大きな音にする
  if (name) playSfx(name, { volume: 0.6 + 0.4 * power, rate: kind === "plasma" ? 1.2 - 0.3 * power : 1 });
}

function startShot(i, power, opened, now, dir, kind = idleKind()) {
  const view = gadget.views?.[i];
  if (!view || gadget.kind === "off" || gadget.shots[i]) return;
  const arm = ARMS[i];
  const origin = kind === "fist" ? conv(joints[arm.ids[2]].p).toArray() : view.muzzle;
  const range = gadget.foreLen[i] * GADGET.range * (0.7 + 0.6 * power);
  gadget.shots[i] = { start: now, kind, power, opened, origin, dir, range };
  gadget.ctrls[i].busy(now + shotDuration(kind, power, opened));
}

function fireGadget(now) {
  if (armDisplayMode(exp) !== 'action') return;
  if (gadget.kind === "off") { say("GADGET で種類を選んでください。"); return; }
  ARMS.forEach((a, i) => { if (a.state !== "lost") startShot(i, 1, false, now, gadget.curDir[i]); });
}

// AUTO：手の形とパンチの動きから発射する。PLASMA の溜めに使う「構え」を返す
// 手の形（数フレーム続いた形だけを採用し、形を変える途中の一瞬の形では発射しない）
const handLabels = ARMS.map(() => createStableLabel({ window: 6, need: 4 }));
const currentLabel = ARMS.map(() => null);
function updateHandLabel(i, pts) {
  currentLabel[i] = handLabels[i].update(pts ? classifyHand(pts) : null);
  return currentLabel[i];
}

function autoGestures(i, pts, angle, aiming, now) {
  const label = currentLabel[i];
  gadget.labels[i] = label;
  const dir = gadget.curDir[i];
  // ロケットパンチ：拳を握って肘を勢いよく伸ばす（手が見えない時は腕の動きだけで判定）
  if (gadget.punches[i].update(now, angle, !pts || label === "fist")) startShot(i, 1, false, now, dir, "fist");
  // NET・HOOK：手の形を少し保つと発射
  const g = gadget.triggers[i].update(now, label);
  if (g && GESTURE_TO_GADGET[g]) startShot(i, 1, false, now, dir, GESTURE_TO_GADGET[g]);
  // PLASMA：腕を上げて手を開くと溜め始め、拳を握る（または腕を下ろす）と発射。
  // 溜めている間は、手の形が一瞬あいまいになっても（null）発射しない
  if (!aiming) return false;
  if (!pts) return true;
  if (gadget.ctrls[i].mode === "charging") return label === "open" || label === null;
  return label === "open";
}

// s：{ el, wr（シーン座標の THREE.Vector3）, thickness, hand（handPose の結果か null） }。戻り値：手をずらす量
function updateGadget(arm, s, now) {
  const i = ARMS.indexOf(arm), view = gadget.views?.[i];
  // 追跡を失った時は、この腕の溜め・弾・判定を取り消す（画面外にいた時間が溜めに加わらないように）
  if (!s || !gimmicksOn()) resetArmGadget(i);
  if (!gimmicksOn() || !view || gadget.kind === "off" || !s || armModel.assembly) { view?.setVisible(false); return null; }
  view.setVisible(true);
  const ctrl = gadget.ctrls[i];
  const d = new THREE.Vector3().subVectors(s.wr, s.el);
  gadget.foreLen[i] = Math.max(d.length(), 1);
  gadget.curDir[i] = d.normalize().toArray();
  const [ps, pe, pw] = arm.ids.map(id => joints[id].p);
  const aiming = isAimPose(ps, pe, pw);
  if (aiming) gadget.aimDir[i] = gadget.curDir[i];
  const pts = s.hand?.points;
  let ev;
  if (gadget.kind === "auto") {
    const charging = autoGestures(i, pts, elbowAngle(ps, pe, pw), aiming, now);
    ev = ctrl.update(now, { aiming: charging });
  } else {
    ev = ctrl.update(now, { aiming, fist: pts ? isFist(pts) : false, open: pts ? isOpenHand(pts) : false, tracked: Boolean(pts) });
  }
  if (ev) startShot(i, ev.power, true, now, gadget.aimDir[i]);
  let shot = gadget.shots[i], phase = null;
  if (shot) {
    phase = shotPhase(now - shot.start, shot.kind, shot.power, { opened: shot.opened });
    if (!phase.active) { gadget.shots[i] = shot = null; phase = null; }
  }
  const offset = view.update({ elbow: s.el.toArray(), wrist: s.wr.toArray(), thickness: s.thickness, config: GADGET,
                       kind: shot?.kind ?? idleKind(), open: ease01(ctrl.held / 0.3), charge: ctrl.charge,
                       shot: shot ? { ...shot, phase } : null }, frameDt);
  shakeAmp = Math.min(1, shakeAmp + view.takeShake());
  return offset;
}

// 画面の揺れ：発射・命中の強さに合わせて少し揺らし、すぐに収まる
let shakeAmp = 0;
function applyShake(dt) {
  const k = shakeAmp * bodyScale * 0.025;
  camera.position.x = camBaseX + (Math.random() - 0.5) * k;
  camera.position.y = camBaseY + (Math.random() - 0.5) * k;
  shakeAmp *= Math.exp(-dt * 9);
  if (shakeAmp < 0.01) shakeAmp = 0;
}

// 人差し指だけを立てると、指先に火がつく（手を追跡している時のみ）
function updateFlame(arm, hand, now) {
  const i = ARMS.indexOf(arm), st = pointing[i];
  const on = gimmicksOn() && Boolean(hand) && currentLabel[i] === "point";
  if (on) { if (st.since === null) st.since = now; } else st.since = null;
  const lit = on && now - st.since >= FLAME.holdSec;
  if (lit && !st.lit) playSfx("flame-ignite", { volume: 0.8 });   // 火が点いた瞬間
  st.lit = lit;
  let at = null;
  if (lit) {
    const [a, b] = [hand.points[7], hand.points[8]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    at = [0, 1, 2].map(k => b[k] + (b[k] - a[k]) / len * hand.radius * 0.15);
  }
  flames[i].update(frameDt, at, Math.max(hand ? hand.radius * FLAME.size : 10, 14), [0, 1, 0]); // 火は上へ立ちのぼる
}

// 続く音：溜め・指先の火・ロケットの噴射
let wasFull = false;
function updateLoops(now) {
  const c = Math.max(0, ...gadget.ctrls.map(x => x.charge));
  const charging = gadget.kind !== "off" && gadget.ctrls.some(x => x.mode === "charging");
  setLoop("charge-loop", charging ? 0.25 + 0.6 * c : 0, 0.7 + 0.9 * c);
  if (c >= 1 && !wasFull) playSfx("charge-full", { volume: 0.7 });
  wasFull = c >= 1;
  const lit = flames.some((f, i) => pointing[i].lit);
  setLoop("flame-loop", lit ? 0.8 : 0);
  const thrusting = gadget.shots.some(s => s?.kind === "fist" && now - s.start < 0.75);
  setLoop("thrust-loop", thrusting ? 0.7 : 0, 1.1);
}

// 溜めの表示（どちらかの腕が溜めている間だけ）
function updateChargeHud() {
  const c = Math.max(0, ...gadget.ctrls.map(x => x.charge));
  const charging = gadget.kind !== "off" && gadget.ctrls.some(x => x.mode === "charging");
  $("chargebox").style.display = charging ? "block" : "none";
  $("chargebar").style.width = Math.round(c * 100) + "%";
  $("chargeval").textContent = c >= 1 ? "MAX" : Math.round(c * 100) + "%";
  // 操作ガイド：AUTO の時だけ表示し、いま認識している手の形を光らせる
  const guide = $("gesturebox");
  guide.style.display = gadget.kind === "auto" && gimmicksOn() ? "block" : "none";
  const seen = new Set(gadget.labels.filter(Boolean));
  if (gadget.ctrls.some(x => x.mode === "charging")) seen.add("open");
  guide.querySelectorAll("[data-gs]").forEach(el => el.classList.toggle("on", seen.has(el.dataset.gs)));
}

function updateArm(arm, now) {
  const js = arm.ids.map(i => joints[i]);
  // 追跡状態の境界は arm-tracking.js で一元管理（tracking<0.1秒, holding<0.6秒, lost）。
  const lastSeen = {}; for (const id of arm.ids) lastSeen[id] = joints[id].lastSeen;
  const age = armAge(arm.ids, lastSeen, now);
  arm.state = trackState(age);
  const show = armsShown() && age < HOLD_SEC;
  const view = armModel.views?.[ARMS.indexOf(arm)];      // GLBが使える時はGLB、それ以外は簡易形状
  arm.g.visible = show && !view;
  view?.setVisible(show);
  if (!show) { updateHandLabel(ARMS.indexOf(arm), null); updateGadget(arm, null, now); updateFlame(arm, null, now); return; }

  const [sh, el, wr] = js.map(j => conv(j.p));
  // 非有限座標なら描画をスキップ（契約：異常点でモデルを跳ばさない）。
  if (!isFinitePoint(sh) || !isFinitePoint(el) || !isFinitePoint(wr)) return;
  const m = arm.m;
  // 腕の太さ：測れていれば実際の幅（少し大きめ）、測れていなければ肩幅から推定
  const k = settings.thick * design.thick;
  const guess = bodyScale * 0.14 * k;
  const upperR = arm.fit.upper.value !== null ? arm.fit.upper.value / 2 * BODY_FIT.cover * k : guess;
  const foreR = arm.fit.fore.value !== null ? arm.fit.fore.value / 2 * BODY_FIT.cover * k : guess * 0.85;
  const base = upperR;

  const hand = view?.hasFingers ? handPose(arm, wr.toArray(), now) : null;
  updateHandLabel(ARMS.indexOf(arm), hand?.points ?? null);
  const handOffset = updateGadget(arm, { el, wr, thickness: foreR, hand }, now);
  updateFlame(arm, hand, now);

  if (view) {
    const [a, b, c] = [sh, el, wr].map(v => v.toArray());
    const rs = armModel.model.parts.fore.radiusScale ?? 1;
    view.applyPose({ shoulder: a, elbow: b, wrist: c, handTip: handTip(b, c, armModel.model.handRatio) },
                   { upper: upperR, fore: foreR / rs, hand: foreR / rs }, hand, handOffset);
    return;
  }

  setCyl(m.upper, sh, el, base);
  setCyl(m.fore, el, wr, foreR);
  m.shoulder.position.copy(sh); m.shoulder.scale.setScalar(base * 1.25);
  m.elbow.position.copy(el);    m.elbow.scale.setScalar(base * 1.1);

  const fd = new THREE.Vector3().subVectors(wr, el);
  const fl = Math.max(fd.length(), 1e-3);
  fd.divideScalar(fl);

  // 手（簡易ボックス）：手首から先へ配置。
  // 手ランドマーク（人差し指/小指付け根）が十分見えていれば、手の向き・ひねりに追従させる。
  // 見えない場合は前腕方向へ伸ばす従来挙動にフォールバック（契約：見えない点で無理に向けない）。
  const handLen = fl * 0.45;
  const [idxJ, pinJ] = arm.handIds.map(i => joints[i]);
  const handVisOk = (now - idxJ.lastSeen < HOLD_SEC) && (now - pinJ.lastSeen < HOLD_SEC) &&
                    idxJ.vis >= VIS_MIN && pinJ.vis >= VIS_MIN;
  const ho = handVisOk ? handOrientation(wr, conv(idxJ.p), conv(pinJ.p)) : null; // 手首・指はシーン座標へ
  if (ho) {
    // forward=手の指す向き、normal=手の甲の法線（ロール）。両者から正規直交基底を作り、手をひねりまで追従させる。
    const fwd = new THREE.Vector3(ho.forward.x, ho.forward.y, ho.forward.z);
    const nrm = new THREE.Vector3(ho.normal.x, ho.normal.y, ho.normal.z);
    const side = new THREE.Vector3().crossVectors(nrm, fwd).normalize();
    const up2 = new THREE.Vector3().crossVectors(fwd, side).normalize(); // 直交化
    // ボックスのローカルY(長軸)を手の向きfwd、Z(厚み方向)を法線に合わせる。
    m.hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, fwd, up2));
    m.hand.position.copy(wr).addScaledVector(fwd, handLen / 2);
  } else {
    // フォールバック：手ランドマークが見えないときは前腕方向へ伸ばす（従来挙動）。
    m.hand.position.copy(wr).addScaledVector(fd, handLen / 2);
    m.hand.quaternion.setFromUnitVectors(Y, fd);
  }
  m.hand.scale.set(base * 1.5, handLen, base * 0.7);
  if (handOffset) m.hand.position.add(new THREE.Vector3().fromArray(handOffset));   // ロケットフィスト

  // ネオンリング：前腕の軸に垂直
  m.ring1.position.copy(el).addScaledVector(fd, fl * 0.12);
  m.ring1.quaternion.setFromUnitVectors(Z, fd);
  m.ring1.scale.setScalar(base * 0.95);
  m.ring2.position.copy(wr).addScaledVector(fd, -fl * 0.08);
  m.ring2.quaternion.setFromUnitVectors(Z, fd);
  m.ring2.scale.setScalar(base * 0.8);
}

/* ---------------- デバッグ用スケルトン ---------------- */
function drawSkel() {
  skelCtx.clearRect(0, 0, W, H);
  if (!settings.showSkel) return;
  for (const arm of ARMS) {
    const js = arm.ids.map(i => joints[i]);
    skelCtx.strokeStyle = "#4dd0e1"; skelCtx.lineWidth = 2; skelCtx.beginPath();
    js.forEach((j, k) => k === 0 ? skelCtx.moveTo(j.p.x, j.p.y) : skelCtx.lineTo(j.p.x, j.p.y));
    skelCtx.stroke();
    skelCtx.fillStyle = "#ffb300";
    js.forEach(j => { skelCtx.beginPath(); skelCtx.arc(j.raw.x, j.raw.y, 4, 0, Math.PI * 2); skelCtx.fill(); });
  }
}

/* ---------------- 顔モジュール（猫耳・目） ---------------- */
const face = { ears: false, earSize: 1, earModel: 'classic', earLEDCol: '#ff9fc9', earLEDOn: true, earCol: '#1b1f25', earSpread: 0, earLift: 0, eyeMode: "off", eyeCol: "#00e5ff", eyeOp: 0.85, lastSeen: -Infinity };
// ランドマーク番号：10=額、152=顎、234/454=頬、103/332=生え際、468/473=虹彩の中心、469-471/474-476=虹彩の左右端
const IRIS = [468, 473], IRIS_EDGE = [[469, 471], [474, 476]];
const LID = [[159, 145], [386, 374]], CORNER = [[33, 133], [362, 263]]; // まぶた（上下）と目尻・目頭
const EYE_POLY = [ // 目の開口部の輪郭（まぶたで虹彩を隠すためのマスク）
  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382],
];
const FIDS = [...new Set([6, 10, 152, 234, 454, 103, 332, 468, 469, 471, 473, 474, 476, ...EYE_POLY.flat()])];
const fp = {}; // 平滑化した顔の点（ピクセル空間）
for (const id of FIDS) fp[id] = { f: [new OneEuro(), new OneEuro(), new OneEuro()], p: new THREE.Vector3() };

/* --- 3D猫耳：外殻（面取り付きの金属プレート）＋内側の発光パネル＋根元のカラー＋発光ライン --- */
// 猫耳専用マテリアル。腕のマテリアルとは共有しない（腕の外観変更が猫耳に影響しないようにするため）。
const earMat = new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.9, roughness: 0.3 });
const earInMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4 });
const earCollarMat = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 1.0, roughness: 0.2 });
const earSeamMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6 });
const outerGeo = new THREE.ExtrudeGeometry(earShape(1), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 14 });
outerGeo.translate(0, 0, -0.13);   // 厚みの中心を z=0 に合わせる
const innerGeo = new THREE.ExtrudeGeometry(earShape(0.6), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 14 });
innerGeo.translate(0, 0.09, 0.07); // 外殻の前面からわずかに突き出す
const ears = [0, 1].map(() => {
  const g = new THREE.Group();
  const p = { g, shell: new THREE.Mesh(outerGeo, earMat), inner: new THREE.Mesh(innerGeo, earInMat),
              collar: new THREE.Mesh(cylGeo, earCollarMat), seam: new THREE.Mesh(boxGeo, earSeamMat) };
  g.add(p.shell, p.inner, p.collar, p.seam); g.visible = false; scene.add(g);
  return p;
});
let earLoadError = '';
const earController = createEarController({
  load: id => loadEarAsset(EAR_MODELS[id].url, EAR_MODELS[id]),
  onChange: () => {
    const asset = earController.asset;
    if (asset) {
      asset.roots.forEach(root => { if (!root.parent) scene.add(root); });
      asset.applyColor(face.earCol);
      asset.applyLED(face.earLEDCol, face.earLEDOn);
    }
    document.getElementById('earStatus').textContent = !EAR_MODELS[face.earModel]
      ? 'CLASSIC：コード生成の耳'
      : earController.loading ? '耳モデルを読込中…'
      : asset ? EAR_MODELS[face.earModel].name : earLoadError || '耳をONにするとBlenderモデルを読み込みます。';
  },
  onError: () => { earLoadError = 'GLBが未配置または読込に失敗しました。CLASSICの耳を表示します。OFF→ONで再試行できます。'; },
});
function syncEarModel() {
  document.querySelectorAll('#headCards button').forEach(button => {
    const active = face.ears && button.dataset.ear === face.earModel;
    button.classList.toggle('sel', active);
    button.setAttribute('aria-pressed', String(active));
  });
  // 切替・RESET直後にも旧表示を隠す。次の推論フレームを待たない。
  ears.forEach(ear => { ear.g.visible = false; });
  earController.asset?.roots.forEach(root => { root.visible = false; });
  earLoadError = '';
  hairTracker.reset();
  document.getElementById('earFitStatus').textContent = !EAR_MODELS[face.earModel]
    ? '装着位置：輪郭追従はBlenderモデルで利用できます。'
    : face.ears ? '装着位置：髪の輪郭を確認中'
    : '装着位置：耳をONにすると髪の輪郭へ配置します。';
  document.getElementById('earLEDControls').hidden = !EAR_MODELS[face.earModel]?.led;
  earController.setEnabled(face.ears && Boolean(EAR_MODELS[face.earModel]), face.earModel);
}

// 耳と同じ非同期ライフサイクルを再利用（RESET/OFF中に完了した旧読込は破棄）。
const maskSettings = { ...MASK_DEFAULTS };
let maskError = '';
const maskController = createEarController({
  load: id => loadMaskAsset(MASK_MODELS[id].url),
  onError: () => { maskError = '読込に失敗しました。OFF→ONで再試行できます。'; },
  onChange: () => {
    const asset = maskController.asset;
    if (asset) {
      if (!asset.root.parent) scene.add(asset.root);
      asset.root.visible = false;
      asset.applyColor(maskSettings.color);
    }
    document.getElementById('maskStatus').textContent = !maskSettings.enabled
      ? 'OFF：マスクは外れています。' : maskController.loading ? 'マスクを読込中…'
      : maskError || (asset ? '装着準備完了：顔をカメラへ向けてください。' : '準備中…');
  },
});
function syncMask() {
  maskError = '';
  document.querySelectorAll('#maskCards button').forEach(button => {
    const active = maskSettings.enabled && button.dataset.mask === maskSettings.model;
    button.classList.toggle('sel', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('maskCol').disabled = Boolean(MASK_MODELS[maskSettings.model].fixedColor);
  if (maskController.asset) maskController.asset.root.visible = false;
  maskController.setEnabled(maskSettings.enabled, maskSettings.model);
}

/* --- 目：2Dキャンバスに描画（映像と同じ座標系。CSSで一緒に左右反転される） --- */
const eyec = document.getElementById("eyec"); eyec.width = W; eyec.height = H;
const ectx = eyec.getContext("2d");
const grab = document.createElement("canvas"), gctx = grab.getContext("2d", { willReadFrequently: true });
const maskC = document.createElement("canvas"), mctx = maskC.getContext("2d", { willReadFrequently: true });
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// LENS：実際の映像の虹彩ピクセルを取り出し、明るさ（模様・瞳孔・ハイライト）を保ったまま色相だけ置き換える
function drawLens(c, r, poly, rgb, op) {
  const R = Math.ceil(r * 1.5), size = 2 * R;
  grab.width = maskC.width = size; grab.height = maskC.height = size;
  const x0 = Math.round(c.x - R), y0 = Math.round(c.y - R), cx = c.x - x0, cy = c.y - y0;
  gctx.drawImage(video, x0, y0, size, size, 0, 0, size, size);
  mctx.filter = "blur(1.2px)"; mctx.fillStyle = "#fff"; mctx.beginPath();   // まぶたの開口部マスク（縁をぼかす）
  poly.forEach(([x, y], i) => i ? mctx.lineTo(x - x0, y - y0) : mctx.moveTo(x - x0, y - y0));
  mctx.closePath(); mctx.fill(); mctx.filter = "none";
  const img = gctx.getImageData(0, 0, size, size), d = img.data, msk = mctx.getImageData(0, 0, size, size).data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const o = (j * size + i) * 4, dist = Math.hypot(i - cx, j - cy);
    const a = (1 - sstep(r * 0.88, r * 1.02, dist)) * (msk[o + 3] / 255) * op;  // 虹彩の円 ∩ まぶたの開口部
    if (a <= 0.01) { d[o + 3] = 0; continue; }
    const L = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;       // 元の明るさ
    const f = Math.min(1, Math.max(0, (L - 0.03) / 0.22));                       // 瞳孔(暗)は暗いまま、虹彩の模様は残す
    const rim = 1 - 0.5 * sstep(r * 0.72, r * 1.0, dist);                        // 虹彩の縁を暗くする（輪部リング）
    const hl = sstep(0.65, 0.85, L);                                             // 光の反射は元の色を残す
    const k = (0.12 + 0.88 * f) * rim;
    for (let n = 0; n < 3; n++) d[o + n] = rgb[n] * k * (1 - hl) + d[o + n] * hl;
    d[o + 3] = a * 255;
  }
  ectx.putImageData(img, x0, y0);
}

// CYBER：機械式の虹彩（回転するシャッター羽根）＋発光リング＋瞳孔＋外側のHUDリング
function drawCyber(c, r, poly, col, op, t) {
  const g = ectx, TAU = Math.PI * 2;
  g.save(); g.globalAlpha = op;
  g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip(); // まぶたの外は描かない
  const grd = g.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r); grd.addColorStop(0, "#05080a"); grd.addColorStop(1, "#1b232b");
  g.fillStyle = grd; g.beginPath(); g.arc(c.x, c.y, r, 0, TAU); g.fill();
  g.strokeStyle = col; g.lineWidth = Math.max(1, r * 0.07);
  for (let k = 0; k < 24; k++) {
    const a = k * TAU / 24 + t * 0.6; g.globalAlpha = op * (k % 2 ? 0.45 : 1);
    g.beginPath(); g.moveTo(c.x + Math.cos(a) * r * 0.4, c.y + Math.sin(a) * r * 0.4);
    g.lineTo(c.x + Math.cos(a) * r * 0.94, c.y + Math.sin(a) * r * 0.94); g.stroke();
  }
  g.globalAlpha = op; g.shadowColor = col; g.shadowBlur = r * 0.9; g.lineWidth = Math.max(1.5, r * 0.12);
  g.beginPath(); g.arc(c.x, c.y, r * 0.96, 0, TAU); g.stroke();                       // 外側の発光リング
  g.lineWidth = Math.max(1, r * 0.07); g.beginPath(); g.arc(c.x, c.y, r * 0.42, 0, TAU); g.stroke();
  g.shadowBlur = 0; g.fillStyle = "#020304"; g.beginPath(); g.arc(c.x, c.y, r * 0.3, 0, TAU); g.fill(); // 瞳孔
  g.fillStyle = "#fff"; g.globalAlpha = op * 0.9; g.beginPath(); g.arc(c.x - r * 0.1, c.y - r * 0.1, r * 0.06, 0, TAU); g.fill(); // 反射光
  g.restore();
  g.save(); g.strokeStyle = col; g.globalAlpha = op * 0.7; g.lineWidth = 1.5;          // まぶたの外側のHUDリング（点線）
  g.setLineDash([r * 0.35, r * 0.25]); g.lineDashOffset = -t * r; g.beginPath(); g.arc(c.x, c.y, r * 1.55, 0, TAU); g.stroke(); g.restore();
}

function processFace(res, now) {
  const lm = res.faceLandmarks[0];
  if (!lm) return;
  const minC = 3.0 * Math.pow(0.1, settings.smooth);
  const reset = now - face.lastSeen > 0.3; // 長い欠落の後はフィルタをリセット
  for (const id of FIDS) {
    const q = lm[id], f = fp[id].f;
    if (reset) f.forEach(x => x.reset());
    fp[id].p.set(f[0].filter(q.x * W, now, minC, BETA), f[1].filter(H - q.y * H, now, minC, BETA), f[2].filter(-q.z * W, now, minC, BETA));
  }
  face.lastSeen = now;
}

function updateFace(now) {
  const ok = now - face.lastSeen < HOLD_SEC;
  const P = id => fp[id].p;
  const maskAsset = maskController.asset;
  if (maskAsset) {
    const fit = maskSettings.enabled && ok ? fitMask({
      left: P(234).toArray(), right: P(454).toArray(), forehead: P(10).toArray(),
      chin: P(152).toArray(), nose: P(6).toArray(),
    }, maskSettings, MASK_MODELS[maskSettings.model]) : null;
    maskAsset.root.visible = Boolean(fit);
    if (fit) {
      maskAsset.root.position.fromArray(fit.origin);
      maskAsset.root.scale.fromArray(fit.scale);
      maskAsset.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...fit.right), new THREE.Vector3(...fit.up), new THREE.Vector3(...fit.forward)));
    }
    if (maskSettings.enabled) document.getElementById('maskStatus').textContent = fit
      ? '装着中：顔に追従しています。' : '顔を探しています。カメラへ顔を向けてください。';
  }
  const earOn = face.ears && ok;
  const glbEars = EAR_MODELS[face.earModel] && earController.enabled ? earController.asset : null;
  ears.forEach(e => e.g.visible = earOn && !glbEars);
  earController.asset?.roots.forEach(root => { root.visible = Boolean(earOn && glbEars); });
  if (earOn) {
    const faceW = Math.max(P(454).distanceTo(P(234)), 1);
    const up = new THREE.Vector3().subVectors(P(10), P(152)).normalize();
    const right = new THREE.Vector3().subVectors(P(454), P(234));
    const fw = new THREE.Vector3().crossVectors(right, up).normalize();   // カメラ方向
    right.crossVectors(up, fw).normalize();
    let hairOffsets = null;
    if (EAR_MODELS[face.earModel]) {
      if (now - face.lastSeen < 0.15) {
        hairTracker.sample(video, now * 1000, {
          origin: { x: P(10).x, y: H - P(10).y },
          right: { x: right.x, y: -right.y }, up: { x: up.x, y: -up.y },
          faceWidth: faceW, imageWidth: W, imageHeight: H,
        });
      } else hairTracker.reset();
      hairOffsets = hairTracker.getOffsets(now * 1000);
      const fitMessage = hairOffsets ? '装着位置：髪の輪郭に追従中'
        : hairTracker.loading ? '装着位置：髪の輪郭を準備中（頭の外側へ仮配置）'
        : '装着位置：頭の外側へ推定配置（横位置・高さで調整できます）';
      if (document.getElementById('earFitStatus').textContent !== fitMessage) {
        document.getElementById('earFitStatus').textContent = fitMessage;
      }
    }
    [[103, -1], [332, 1]].forEach(([id, side], k) => {
      const dir = up.clone().addScaledVector(right, side * 0.35).normalize(); // 少し外向きに傾ける
      const x = new THREE.Vector3().crossVectors(dir, fw).normalize();
      const z = new THREE.Vector3().crossVectors(x, dir).normalize();
      const earW = faceW * 0.22 * face.earSize, earH = faceW * 0.34 * face.earSize, earT = earW * 0.6;
      const e = ears[k];
      if (glbEars) {
        const root = glbEars.roots[k];
        // 額の角(103/332)ではなく、頭頂付近の髪の左右輪郭に装着。
        const anchor = fitEarAnchor(hairOffsets?.[k] ?? { u: side * 0.52, v: 0.05 },
          EAR_MODELS[face.earModel], side, face.earSpread, face.earLift);
        root.position.copy(P(10))
          .addScaledVector(right, faceW * anchor.u)
          .addScaledVector(up, faceW * anchor.v);
        // 外向きの輪郭はモデル自体に含む。頭の姿勢のみ適用し二重に傾けない。
        root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fw));
        root.scale.setScalar(faceW * EAR_MODELS[face.earModel].faceWidthScale * face.earSize);
        return;
      }
      e.g.position.copy(P(id)).addScaledVector(up, faceW * 0.03);
      e.g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, z));
      e.shell.scale.set(side * earW, earH, earT); e.inner.scale.copy(e.shell.scale); // 左右対称（片側は反転）
      e.collar.position.set(0, -earW * 0.04, 0); e.collar.scale.set(earW * 0.55, earW * 0.22, earT * 0.9); // 根元のカラー
      e.seam.position.set(0, earH * 0.06, 0); e.seam.scale.set(earW * 0.92, earW * 0.035, earT * 0.55);    // 発光ライン
    });
  }
  ectx.clearRect(0, 0, W, H);
  if (!ok || face.eyeMode === "off") return;
  [0, 1].forEach(k => {
    const C = P(IRIS[k]), c = { x: C.x, y: H - C.y };
    const r = d2(P(IRIS_EDGE[k][0]), P(IRIS_EDGE[k][1])) / 2;
    const open = d2(P(LID[k][0]), P(LID[k][1])) / Math.max(d2(P(CORNER[k][0]), P(CORNER[k][1])), 1); // 目の開き具合
    if (open < 0.1 || r < 2) return;                                                                 // 閉じている時は描かない
    const poly = EYE_POLY[k].map(id => [P(id).x, H - P(id).y]);
    if (face.eyeMode === "lens") drawLens(c, r, poly, hex2rgb(face.eyeCol), face.eyeOp);
    else drawCyber(c, r, poly, face.eyeCol, face.eyeOp, now);
  });
}

/* ---------------- デザインとUI ---------------- */
const $ = id => document.getElementById(id);
import { DESIGNS, DEFAULTS, ARM_TUNING, ARM_MODELS, BODY_FIT, GADGET, FLAME, EAR_MODELS, MATERIAL_PRESETS, DEMO_PRESETS, ATTRACT_MODE, HAND_POINTER } from './config.js?v=33-develop-merge';
import {
  APPEARANCE_KEYS, createAppearanceState, selectPreset, editDraft,
  applyDraft, switchDesign, resetAppearance,
} from './appearance.js';

// 外観の状態は appState ひとつ。画面の表示は renderAppearance() がここから描き直す。
//   appState.draft   : 編集中の値（APPLYするまで腕に反映しない）
//   appState.applied : 腕に反映済みの値
let appState = createAppearanceState(DESIGNS, DEMO_PRESETS, "mk1");
let selected = "mk1", design = DESIGNS.mk1;
let exp = createExperience(); // カード選択で試着、APPLYで装着演出とアクションを開始
let purchase = null;          // 仮想購入の画面（#22）。下の「仮想購入」で作る
function armsShown() { return armDisplayMode(exp) !== 'none'; }

// GLBの腕・ギミックに渡す外観。デザインの値に、いま腕に見せている外観を重ねて返す。
// armAppearance：試着中はそのデザインの既定値、APPLY後は装着した値。
// 読込が遅れて完了した時も、その時点で見せるべき外観になる。
let armAppearance = appState.applied;
const hexNum = s => parseInt(s.slice(1), 16);
function armLook() {
  const a = armAppearance;
  // その装備の既定の外観と比べ、画面で「変えた項目」だけを上書きする。
  // 変えていない項目は、デザイン（サテン仕上げ・NEONの赤色LEDなど）の見た目のままにする。
  const id = Object.keys(DESIGNS).find(k => DESIGNS[k] === design);
  const base = switchDesign(appState, id).draft;
  const look = { ...design };
  if (a.shellColor !== base.shellColor) look.metal = hexNum(a.shellColor);
  if (a.jointColor !== base.jointColor) look.joint = hexNum(a.jointColor);
  if (a.emissionColor !== base.emissionColor) { look.neon = hexNum(a.emissionColor); look.ledLinear = null; }   // 赤色LED指定より画面の色を優先
  if (a.roughness !== base.roughness) look.rough = a.roughness;
  if (a.metalness !== base.metalness) look.metalness = a.metalness;
  if (a.glow !== base.glow) look.glow = a.glow;
  return look;
}

// カードで試着する時に呼ぶ。デザインを切り替え、編集値(draft)をそのデザインの既定値にし、
// 試着中の見た目として腕のマテリアルへ反映する。装着中の外観(applied)はAPPLYするまで変えない。
function applyDesign(d) {
  design = d;
  const id = Object.keys(DESIGNS).find(k => DESIGNS[k] === d);
  const sw = switchDesign(appState, id);
  appState = { ...appState, draft: sw.draft, presetId: null, basePresetId: null, pendingDesignId: id, errors: [] };
  applyAppearanceToMaterials(sw.draft);
  armAppearance = sw.draft;
  renderAppearance();
}

// 腕用マテリアルだけを更新する（猫耳のマテリアルには触れない。materialは作り直さず既存instanceを更新）
function applyAppearanceToMaterials(a) {
  armShellMat.color.set(a.shellColor);
  armShellMat.metalness = a.metalness;
  armShellMat.roughness = a.roughness;
  armJointMat.color.set(a.jointColor);
  armEmissionMat.color.set(a.emissionColor);
  armEmissionMat.emissive.set(a.emissionColor);
  armEmissionMat.emissiveIntensity = a.glow;
}
applyAppearanceToMaterials(appState.applied);

function renderCards() {
  renderArmCards(selected);
}
function say(t) { info.textContent = t; setTimeout(() => { if (info.textContent === t) info.textContent = ""; }, 3000); }

// プリセット・素材ボタンは最初に1回だけ作る（選択表示の切替は renderAppearance が行う）
$("presets").innerHTML = DEMO_PRESETS.map(p => `<button data-p="${p.id}">${p.label}</button>`).join("");
$("materials").innerHTML = Object.entries(MATERIAL_PRESETS).map(([k, m]) => `<button data-mat="${k}">${m.label}</button>`).join("");

// appState から、画面（カード・プリセット・素材・色・スライダー・状態表示）をまとめて更新する
function renderAppearance() {
  const next = appState.pendingDesignId ?? appState.designId;
  if (next !== selected) { selected = next; renderCards(); }
  const d = appState.draft;
  $("armShell").value = d.shellColor;
  $("armJoint").value = d.jointColor;
  $("armEmission").value = d.emissionColor;
  $("armMetal").value = d.metalness; $("armMetalV").textContent = d.metalness.toFixed(2);
  $("armRough").value = d.roughness; $("armRoughV").textContent = d.roughness.toFixed(2);
  $("armGlow").value = d.glow;       $("armGlowV").textContent = d.glow.toFixed(1);
  document.querySelectorAll("#presets button").forEach(b => b.classList.toggle("sel", b.dataset.p === appState.presetId));
  document.querySelectorAll("#materials button").forEach(b => {
    const m = MATERIAL_PRESETS[b.dataset.mat];
    b.classList.toggle("sel", d.metalness === m.metalness && d.roughness === m.roughness);
  });
  const preset = DEMO_PRESETS.find(p => p.id === appState.presetId);
  $("presetState").textContent = "プリセット：" + (appState.presetId === "custom" ? "カスタム" : preset ? preset.label : "未選択");
  const dirty = (appState.pendingDesignId !== undefined && appState.pendingDesignId !== appState.designId)
    || APPEARANCE_KEYS.some(k => appState.draft[k] !== appState.applied[k]);
  const worn = exp.phase === PHASES.ACTION || exp.phase === PHASES.EQUIPPING;
  $("applyState").textContent = dirty ? "編集中：APPLYで腕に反映されます"
        : worn ? "装着中の外観と一致しています" : "外観は設定済み：APPLYで装着します";
}

function edit(patch) { appState = editDraft(appState, patch); renderAppearance(); }

// デザインカードを選ぶ：試着表示にする（外観の処理は applyDesign の中）
$("cards").onclick = e => {
  const card = e.target.closest('.card');
  if (!card || card.disabled || exp.phase !== PHASES.SELECT) return;
  selected = card.dataset.k;
  exp = reduceExperience(exp, { type: EVENTS.SELECT, id: selected });
  applyDesign(DESIGNS[selected]);
  resetGadgetState();
  armModel.assembly = null;
  $("assemblybox").style.display = 'none';
  if (design.model) useArmModel(design.model, { animate: false });
  else clearArmModel();
  renderCards();
};
$("presets").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  appState = selectPreset(appState, b.dataset.p);
  if (appState.errors.length) say("プリセットを適用できませんでした。");
  renderAppearance();
};
$("materials").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  const m = MATERIAL_PRESETS[b.dataset.mat];
  edit({ metalness: m.metalness, roughness: m.roughness });
};
$("armShell").oninput = e => edit({ shellColor: e.target.value });
$("armJoint").oninput = e => edit({ jointColor: e.target.value });
$("armEmission").oninput = e => edit({ emissionColor: e.target.value });
$("armMetal").oninput = e => edit({ metalness: +e.target.value });
$("armRough").oninput = e => edit({ roughness: +e.target.value });
$("armGlow").oninput = e => edit({ glow: +e.target.value });

document.querySelectorAll(".tab.locked").forEach(t => t.onclick = () => say(t.dataset.n + " モジュールは次のステップで追加予定です。"));
const EQUIP_MS = 1000;
let equipTimer = null;
function cancelEquip() {
  if (equipTimer !== null) clearTimeout(equipTimer);
  equipTimer = null;
}
function syncPhaseUI() {
  const action = exp.phase === PHASES.ACTION;
  document.body.classList.toggle("phase-action", action);
  $("back").hidden = !action;
  $("help").hidden = !action;
  if (!action) $("guide").hidden = true;
  $("reset").hidden = action;
  $("apply").disabled = exp.phase === PHASES.EQUIPPING || camState !== "ready";
  renderAppearance(); // 装着状態の表示も appState と exp から描き直す
  if (!action && purchase?.active) purchase.cancel();        // 体験中以外では購入を続けない（#22）
  $("buy").hidden = !action || !!purchase?.active;
}
$("apply").onclick = () => {
  if (camState !== "ready") { say("カメラの準備ができてから装着してください。"); return; }
  if (exp.phase === PHASES.EQUIPPING) return; // 装着中の連打は無視
  purchase?.cancel();                         // 購入の途中なら取り消す（#22）
  if (exp.phase === PHASES.ACTION) exp = reduceExperience(exp, { type: EVENTS.BACK }); // 体験中の再装着は一度選択へ戻す
  // 編集値(draft)を装備へ反映する（腕のマテリアルは作り直さず更新）
  appState = applyDraft(appState);
  applyAppearanceToMaterials(appState.applied);
  armAppearance = appState.applied;
  selected = appState.designId;
  design = DESIGNS[appState.designId];
  exp = reduceExperience(exp, { type: EVENTS.SELECT, id: appState.designId });
  exp = reduceExperience(exp, { type: EVENTS.APPLY, now: performance.now() });
  unlockEquipSound();
  playEquip();
  gadget.views?.forEach(v => v.applyAppearance(armLook()));
  if (design.model) useArmModel(design.model);                // GLBモデルがある装備（ACTION になると装着演出が始まる）
  else clearArmModel();
  const id = exp.requestId;
  cancelEquip();
  equipTimer = setTimeout(() => {
    equipTimer = null;
    exp = reduceExperience(exp, { type: EVENTS.FINISH_EQUIP, requestId: id }); // 古い完了は experience.js が無視する
    syncPhaseUI();
  }, EQUIP_MS);
  syncPhaseUI();
  say("装着中…");
};
$("back").onclick = () => {
  cancelEquip();
  cancelCapture(); // 未実行の撮影要求を取り消す（#11）
  purchase?.cancel(); // 購入の途中なら取り消す（#22）
  exp = reduceExperience(exp, { type: EVENTS.BACK });
  armModel.assembly = null;
  armModel.views?.forEach(view => view.setAssembly(null));
  $("assemblybox").style.display = 'none';
  resetGadgetState(); // 溜め・弾・判定・音を持ち越さない
  syncPhaseUI();
  say("装備選択に戻りました。");
};
$("help").onclick = () => { $("guide").hidden = !$("guide").hidden; };
let staffOpen = false;
function setStaffConfirm(open) { staffOpen = open; $("staffConfirm").hidden = !open; }
window.addEventListener("keydown", e => {
  if (e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r")) { e.preventDefault(); setStaffConfirm(true); return; }
  if (!staffOpen) return;
  if (e.key === "Enter") { e.preventDefault(); setStaffConfirm(false); doReset(); }
  else if (e.key === "Escape") setStaffConfirm(false);
});
$("showSkel").onchange = e => settings.showSkel = e.target.checked;
$("showStaff").onchange = e => document.body.classList.toggle('show-staff', e.target.checked);
$("smooth").oninput = e => settings.smooth = +e.target.value;
$("depth").oninput = e => settings.depth = +e.target.value;
$("thick").oninput = e => settings.thick = +e.target.value;
// 効果音：ブラウザの制限で、最初のクリック・キー操作の後から鳴る
document.addEventListener("pointerdown", () => unlockAudio(), { capture: true });
document.addEventListener("keydown", e => {
  unlockAudio();
  if (e.key.toLowerCase() === "m" && !(e.target instanceof HTMLInputElement)) {   // M キーで消音の切り替え
    setSfxMuted(!sfxMuted()); $("sound").checked = !sfxMuted();
    if (sfxMuted()) stopAllLoops();
  }
}, { capture: true });
$("sound").onchange = e => { setSfxMuted(!e.target.checked); if (!e.target.checked) stopAllLoops(); };
$("volume").oninput = e => setSfxVolume(+e.target.value);
$("fxq").onchange = e => {
  configureFx({ quality: e.target.value });
  roomEnv.every = e.target.value === "high" ? 8 : 20;          // LOW では反射の作り直しを減らす
};
$("roomEnv").onchange = e => {
  roomEnv.enabled = e.target.checked;
  if (!e.target.checked) { key.color.set(0xffffff); key.intensity = 1.2; }
};
function doReset() {
  Object.assign(settings, { smooth: 0.5, depth: 0.5, thick: 1, showSkel: false });
  cancelEquip();
  cancelCapture(); // 未実行の撮影要求を取り消す（#11）
  purchase?.reset(); // 購入の途中なら取り消し、写真も捨てる（#22）
  exp = reduceExperience(exp, { type: EVENTS.RESET }); // 体験状態の初期化（experience.js）
  $("showSkel").checked = false; $("smooth").value = 0.5; $("depth").value = 0.5; $("thick").value = 1;
  appState = resetAppearance(appState);              // 外観の状態をmk1の既定へ
  applyAppearanceToMaterials(appState.applied);      // 腕のマテリアルも既定へ（古い色を残さない）
  armAppearance = appState.applied;
  design = DESIGNS[appState.designId];
  gadget.views?.forEach(v => v.applyAppearance(armLook()));   // ギミックの色もmk1の既定へ（RESETで残さない）
  selected = "mk1"; renderCards(); resetJoints();
  ARMS.forEach(a => { a.fit.upper.reset(); a.fit.fore.reset(); a.hand.lastSeen = -Infinity; });
  // 顔・目・耳の設定を初期値へ戻す（画面の入力欄も合わせる）
  face.ears = false; face.earSize = 1; face.earModel = 'classic'; face.earCol = '#1b1f25'; face.eyeMode = "off"; face.eyeCol = "#00e5ff"; face.eyeOp = 0.85;
  face.earLEDCol = '#ff9fc9'; face.earLEDOn = true;
  $("earLEDCol").value = face.earLEDCol; $("earLEDOn").checked = true;
  $("earModel").value = 'classic'; syncEarModel();
  face.earSpread = 0; face.earLift = 0;
  $("earSpread").value = 0; $("earLift").value = 0;
  $("earFitStatus").textContent = '装着位置：髪の輪郭を基準に配置します。';
  $("ears").checked = false; $("earSize").value = 1; $("earCol").value = "#1b1f25"; earMat.color.set("#1b1f25");
  $("eyeCol").value = "#00e5ff"; $("eyeOp").value = 0.85;
  Object.assign(maskSettings, MASK_DEFAULTS);
  $('maskOn').checked = maskSettings.enabled; $('maskSize').value = maskSettings.size;
  $('maskLift').value = maskSettings.lift;
  $('maskDepth').value = maskSettings.depth; $('maskCol').value = maskSettings.color; syncMask();
  document.querySelectorAll("#eyeMode button").forEach(b => b.classList.toggle("sel", b.dataset.m === "off"));
  document.querySelectorAll("#eyeSw i").forEach(i => i.classList.remove("sel"));
  ARMS.forEach(a => { a.g.visible = false; a.state = "lost"; });
  clearArmModel();
  resetGadgetState();                                          // 溜め・弾・ジェスチャー判定・音を持ち越さない
  setGadgetKind("auto");
  // タブを初期表示（ARMS）へ戻す
  loadoutMenu.select('arms');
  $("apply").style.display = "";
  syncPhaseUI();
}
$("reset").onclick = doReset;
$("gadgetMode").onclick = e => { const g = e.target.dataset.g; if (g) setGadgetKind(g); };
$("gadgetFire").onclick = () => fireGadget(performance.now() / 1000);
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "g" && !(e.target instanceof HTMLInputElement)) fireGadget(performance.now() / 1000);
});
document.querySelectorAll('#panel button, #stage button').forEach(button => { button.disabled = false; });
loadoutMenu.refresh();
renderCards();
syncPhaseUI();
setGadgetKind("auto");                                         // 初期状態はジェスチャーで選ぶ AUTO
$('maskOn').onchange = event => { maskSettings.enabled = event.target.checked; syncMask(); };
$('maskCards').onclick = event => {
  const button = event.target.closest('button[data-mask]');
  if (!button || button.disabled || !MASK_MODELS[button.dataset.mask]) return;
  maskSettings.model = button.dataset.mask;
  maskSettings.enabled = true;
  $('maskOn').checked = true;
  maskSettings.color = MASK_MODELS[maskSettings.model].color ?? MASK_DEFAULTS.color;
  $('maskCol').value = maskSettings.color;
  syncMask();
};
for (const [id, key] of [['maskSize', 'size'], ['maskLift', 'lift'], ['maskDepth', 'depth']]) {
  $(id).oninput = event => { maskSettings[key] = +event.target.value; };
}
$('maskCol').oninput = event => {
  if (MASK_MODELS[maskSettings.model].fixedColor) return;
  maskSettings.color = event.target.value; maskController.asset?.applyColor(maskSettings.color);
};
$("eyeSw").innerHTML = ["#00e5ff", "#ffb300", "#ff1744", "#00e676", "#b388ff", "#ffffff"].map(c => `<i data-c="${c}" style="background:${c}"></i>`).join("");
$("eyeSw").onclick = e => { const c = e.target.dataset.c; if (c) { face.eyeCol = c; $("eyeCol").value = c; } };
$("eyeCol").oninput = e => face.eyeCol = e.target.value;
$("eyeOp").oninput = e => face.eyeOp = +e.target.value;
$("eyeMode").onclick = e => { const m = e.target.dataset.m; if (!m) return; face.eyeMode = m; document.querySelectorAll("#eyeMode button").forEach(b => b.classList.toggle("sel", b === e.target)); };
$("ears").onchange = e => { face.ears = e.target.checked; syncEarModel(); };
$("earModel").onchange = e => { face.earModel = e.target.value; syncEarModel(); };
$("headCards").onclick = e => {
  const button = e.target.closest('button[data-ear]');
  if (!button) return;
  face.earModel = button.dataset.ear;
  face.ears = true;
  $("ears").checked = true;
  $("earModel").value = face.earModel;
  syncEarModel();
};
$("earLEDCol").oninput = e => { face.earLEDCol = e.target.value; earController.asset?.applyLED(face.earLEDCol, face.earLEDOn); };
$("earLEDOn").onchange = e => { face.earLEDOn = e.target.checked; earController.asset?.applyLED(face.earLEDCol, face.earLEDOn); };
$("earSize").oninput = e => face.earSize = +e.target.value;
$("earSpread").oninput = e => face.earSpread = +e.target.value;
$("earLift").oninput = e => face.earLift = +e.target.value;
$("earCol").oninput = e => {
  face.earCol = e.target.value;
  earMat.color.set(face.earCol);
  earController.asset?.applyColor(face.earCol);
};

/* ---------------- 撮影（PNG保存） #11 ---------------- */
import { createCaptureController, composeFrame, canvasToPngBlob, makeFileName, downloadBlob } from './capture.js';
const shotCanvas = document.createElement("canvas"); shotCanvas.width = W; shotCanvas.height = H;
const shotCtx = shotCanvas.getContext("2d");
const capture = createCaptureController({ isReady: () => camState === "ready" && W > 0 && H > 0 });
// 体験中はパネルが隠れるため、案内はボタン自体にも短く表示する
const CAPTURE_LABEL = $("capture").textContent;
let captureMsgTimer = null;
function captureMsg(t) {
  say(t);
  $("capture").textContent = t;
  clearTimeout(captureMsgTimer);
  captureMsgTimer = setTimeout(() => { $("capture").textContent = CAPTURE_LABEL; }, 2000);
}
$("capture").onclick = () => {
  if (!capture.request()) { captureMsg(capture.busy ? "保存処理中です" : "カメラの準備ができていません"); return; }
  $("capture").disabled = true;
  captureMsg("撮影中...");
};
function endCapture() { capture.finish(); $("capture").disabled = camState !== "ready"; }
function cancelCapture() {
  capture.cancel();
  if (!capture.busy) {
    $("capture").disabled = camState !== "ready";
    if (purchaseShot) { purchaseShot.reject(new Error("撮影を取り消しました")); purchaseShot = null; }
  }
}
// 購入用の撮影（#22）：PNG をダウンロードせずに返す。保存の撮影と同じ合成（video→eyec→gl）を使う
let purchaseShot = null;
function requestPurchaseShot() {
  return new Promise((resolve, reject) => {
    if (!capture.request()) { reject(new Error(capture.busy ? "前の撮影を処理しています。もう一度お試しください。" : "カメラの準備ができていません。")); return; }
    purchaseShot = { resolve, reject };
  });
}
// renderer.render の直後に呼ぶ（WebGLの描画内容が消える前に読むため）
function runCapture() {
  if (!capture.take()) return;
  const forPurchase = purchaseShot;
  purchaseShot = null;
  if (camState !== "ready") {
    endCapture();
    if (forPurchase) forPurchase.reject(new Error("カメラが停止したため撮影しませんでした"));
    else captureMsg("カメラが停止したため撮影しませんでした");
    return;
  }
  try {
    composeFrame(shotCtx, [video, eyec, glCanvas], W, H);
  } catch (e) {
    console.warn("撮影の合成に失敗:", e.message);
    if (forPurchase) forPurchase.reject(new Error("撮影に失敗しました。"));
    else captureMsg("撮影に失敗しました");
    endCapture();
    return;
  }
  if (forPurchase) {
    canvasToPngBlob(shotCanvas).then(forPurchase.resolve, forPurchase.reject).finally(endCapture);
    return;
  }
  canvasToPngBlob(shotCanvas)
    .then(blob => { downloadBlob(blob, makeFileName(), { doc: document, urlApi: URL }); captureMsg("ダウンロードを開始しました"); })
    .catch(e => { console.warn("PNG保存に失敗:", e.message); captureMsg("保存に失敗しました"); })
    .finally(endCapture);
}

/* ---------------- 仮想購入（撮影 → QR 受取） #22 ---------------- */
import { createPurchaseFlow } from './purchase-ui.js';
import { registerReceipt, cancelReceipt, newRequestId, drawQr } from './receipt-client.js';
import { composeReceipt } from './receipt.js';
// レシートに載せる、その時の装備（名前などの個人情報は入れない）
function loadoutSnapshot() {
  return {
    arm: DESIGNS[exp.appliedId]?.name ?? null,
    eyes: face.eyeMode,
    eyeColor: face.eyeCol,
    ears: face.ears ? $("earModel").selectedOptions[0]?.textContent.replace(/\s*\(.*\)$/, "") ?? null : null,
  };
}
purchase = createPurchaseFlow({
  $,
  requestShot: requestPurchaseShot,
  // 写真入りレシートを作って登録。取り消した時は登録を止め、サーバーに届いたレシートも消す（#27 のレビュー）
  register: async (photo, options) => registerReceipt(await composeReceipt({ photo, loadout: loadoutSnapshot() }), options),
  unregister: cancelReceipt,
  makeRequestId: newRequestId,
  drawQr,
  onChange: () => {
    document.body.classList.toggle("purchasing", purchase?.active ?? false);
    syncPhaseUI();
  },
});
$("buy").onclick = () => { if (exp.phase === PHASES.ACTION) purchase.buy(); };
setInterval(() => purchase.tick(), 100);
syncPhaseUI();

function updateHud(now) {
  const conf = JOINTS.reduce((s, id) => { const j = joints[id]; return s + (now - j.lastSeen < 0.3 ? j.vis : 0); }, 0) / JOINTS.length;
  $("conf").textContent = Math.round(conf * 100) + "%"; $("confbar").style.width = conf * 100 + "%";
  $("fps").textContent = fps.toFixed(0);
  const on = ARMS.some(a => a.state === "tracking");
  for (const id of ["pose", "pill"]) $(id).className = on ? "ok" : "bad";
  $("pose").textContent = on ? "ACTIVE" : "LOST"; $("trk").textContent = on ? "ACTIVE" : "LOST";
  const sc = a => a.ids.reduce((s, i) => s + joints[i].vis, 0);
  const best = ARMS.reduce((a, b) => sc(a) >= sc(b) ? a : b);
  ["SHOULDER", "ELBOW", "WRIST"].forEach((n, i) => {
    const el = $("lbl" + i), j = joints[best.ids[i]];
    el.style.display = best.state === "tracking" ? "block" : "none";
    el.style.left = (1 - j.p.x / W) * 100 + "%"; el.style.top = j.p.y / H * 100 + "%"; // 映像は左右反転表示のため
    el.innerHTML = `${n}<br><b>${Math.round(j.vis * 100)}%</b>`;
  });
}

/* ---------------- 待機画面（アトラクトモード） ---------------- */
// 誰もいない時：暗くしたライブ映像に「カメラの前に立ってください」と立ち位置、右にショーケース。
// 人が1秒いたら開始（関節が光る→WELCOME）。いなくなって一定時間たったら、スタッフ用リセットと同じ処理をして待機へ戻る
import { createAttract, presence, ATTRACT_DEFAULTS } from './attract-state.js';
import { createAttractView } from './attract-ui.js';
import { createHandTips, renderHandTip } from './hand-tips.js';
const handTips = createHandTips();   // 初めての来場者向けの操作案内（来場者ごとに1回）
const attract = createAttract(ATTRACT_MODE);
const attractView = createAttractView({
  cycleSec: ATTRACT_MODE.cycleSec,
  items: [
    ...Object.entries(DESIGNS).map(([key, d]) => ({ category: 'ARMS', name: d.name, desc: d.desc, img: `./assets/shop/${key}.png` })),
    { category: 'MASK', name: 'PROTOTYPE 04', desc: '機械式ハーフマスク', img: './assets/shop/mask-prototype.png' },
    { category: 'MASK', name: 'ONI 04 / 鬼面', desc: '赤いLEDと牙のある鬼面', img: './assets/shop/mask-oni.png' },
    { category: 'MASK', name: 'RABBIT 04 / ウサギ', desc: '白い外装のウサギマスク', img: './assets/shop/mask-rabbit.png' },
    { category: 'HEAD', name: 'PROTOTYPE 04', desc: '機械式猫耳', img: './assets/shop/cat.png' },
    { category: 'HEAD', name: 'RABBIT LED', desc: 'LEDウサギ耳', img: './assets/shop/rabbit.png' },
  ],
});
let attractOn = ATTRACT_MODE.enabled;
$("attractOn").checked = attractOn;
$("attractOn").onchange = e => {
  attractOn = e.target.checked;
  const now = performance.now() / 1000;
  if (attractOn) attract.reset(now); else attract.skip(now);
};
function updateAttract(result, now) {
  if (!attractOn) { attractView.render('active', 1, now, null); return; }
  const lm = result.landmarks?.[0] ?? null;
  // 購入中（QR の読み取りで少し離れる時など）は長めに待つ
  const seen = presence(lm, { ...ATTRACT_DEFAULTS, ...ATTRACT_MODE });
  const { state, progress, event, countdown } = attract.update({ present: seen.present, hold: Boolean(purchase?.active) }, now);
  if (event === 'welcome') { playSfx("assemble-done", { volume: 0.5 }); handTips.welcome(now, 1.4); }   // WELCOME の後に指の案内
  if (event === 'reset') { setStaffConfirm(false); doReset(); handTips.reset(); say("待機画面に戻りました。"); }
  attractView.render(state, progress, now, lm, seen.reason, { side: seen.side, countdown });
}

/* ---------------- タッチレス操作（指先カーソル） #36 ---------------- */
// 腕を上げて人差し指で指すとカーソルが出て、ボタンの上で約1秒止めると選ぶ。▲▼の帯の上ではストアの一覧をスクロール。
// 選択画面：カーソル。体験中：ギミック（両手を上げて1秒でメニュー＝カーソルへ切替）。
// 仮想購入：カウントダウン中はギミック（写真のポーズ用）、案内・確認・QR の画面ではカーソル。
import { createHandPointer, createMenuToggle, bothHandsUp, handModes } from './hand-pointer.js';
import { createHandCursor } from './hand-cursor.js';
const handPointer = createHandPointer(HAND_POINTER);
const handMenu = createMenuToggle({ holdSec: HAND_POINTER.menuHoldSec, idleSec: HAND_POINTER.menuIdleSec });
let handMode = { cursor: false, gimmicks: true };
let handPointing = false;
// ギミックを動かしてよいか（体験中で、メニュー・購入の画面を手で操作していない時）
function gimmicksOn() { return armDisplayMode(exp) === 'action' && handMode.gimmicks; }
const handCursor = createHandCursor({
  selector: '#panel button, #stage button, #storeIntro button, [data-hand-scroll]',
  scrollSpeed: HAND_POINTER.scrollSpeed,
  exclude: 'details, #staffConfirm, .tab.locked',     // スタッフ用設定などは手では選ばない
  dwellSec: HAND_POINTER.dwellSec,
  cooldownSec: HAND_POINTER.cooldownSec,
  onSelect: () => playSfx("assemble-lock", { volume: 0.35, rate: 1.6 }),
});
function updateHandPointer(result, now) {
  if (!HAND_POINTER.enabled) { handMode = { cursor: false, gimmicks: true }; return; }
  // 待機画面（誰もいない・スキャン中・またのお越しを）の間は手のカーソルを出さない
  if (attractOn && attract.state !== 'active') {
    handMode = { cursor: false, gimmicks: false }; handMenu.reset(); handPointing = false;
    handPointer.reset(); handCursor.update(null, now); $("handMenu").hidden = true; return;
  }
  const lm = result.landmarks?.[0] ?? null;
  const state = { phase: exp.phase, purchase: purchase?.phase ?? 'idle', menu: handMenu.active };
  if (exp.phase !== PHASES.ACTION) handMenu.reset();
  let progress = 0;
  if (handModes(state).menuToggle) {
    ({ active: state.menu, progress } = handMenu.update({ bothUp: bothHandsUp(lm), pointing: handPointing }, now));
  } else state.menu = handMenu.active;
  handMode = handModes(state);
  // メニューの案内：両手を上げている途中の進み具合と、メニュー中であること
  const hint = $("handMenu");
  hint.hidden = !(handModes(state).menuToggle && (state.menu || progress > 0));
  hint.textContent = state.menu ? "MENU MODE｜指でボタンを選べます（両手を上げるとギミックに戻ります）"
    : `両手を上げたまま… ${Math.round(progress * 100)}%`;
  if (!handMode.cursor) { handPointing = false; handPointer.reset(); handCursor.update(null, now); return; }
  const point = handPointer.update(lm, now);
  handPointing = Boolean(point);
  handCursor.update(point, now);
}

// 操作案内：体験（ACTION）が始まったらメニューの案内。待機画面・購入の画面の間は出さない
let tipPhase = exp.phase;
function updateHandTips(now) {
  if (exp.phase === PHASES.ACTION && tipPhase !== PHASES.ACTION) handTips.action(now);
  tipPhase = exp.phase;
  const tip = handTips.update({ pointer: handPointing, menu: handMenu.active }, now);
  const blocked = (attractOn && attract.state !== 'active') || Boolean(purchase?.active);
  renderHandTip($("handTip"), blocked ? null : tip);
}

/* ---------------- カメラの状態に応じた処理（#20） ---------------- */
const CAM_MESSAGES = {
  denied: "カメラの許可がブロックされています。アドレスバーの鍵マークや設定から、このサイトのカメラを「許可」に変えてから再試行してください（再試行だけでは許可は変わりません）。",
  notFound: "カメラが見つかりません。USBの接続を確認してから再試行してください。",
  busy: "カメラが他のアプリで使われているか、接続が切れています。他のアプリを閉じるか接続を確認してから再試行してください。",
  unsupported: "このカメラは要求した解像度などに対応していません。",
  playback: "カメラの映像を再生できませんでした。再試行してください。",
  trackEnded: "カメラの接続が切れました。接続を確認してから再試行してください。",
  videoStopped: "カメラの映像が止まりました。接続を確認してから再試行してください。",
  unknown: "カメラを開始できませんでした。再試行してください。",
};

// 映像サイズが決まった時に、サイズに依存するものをすべて揃える（W/H を固定のまま復帰しない）
function applyVideoSize(w, h) {
  W = w; H = h;
  skelCanvas.width = W; skelCanvas.height = H;
  eyec.width = W; eyec.height = H;
  shotCanvas.width = W; shotCanvas.height = H;
  renderer.setSize(W, H, false);
  camera.right = W; camera.top = H; camera.updateProjectionMatrix();
  bloom.setSize(W, H);
  bodyScale = 0.2 * W;
  hairTracker.reset();
  resetJoints();
  ARMS.forEach(a => { a.fit.upper.reset(); a.fit.fore.reset(); a.hand.lastSeen = -Infinity; });
  face.lastSeen = -Infinity;
  lastVideoTime = -1; lastFrame = null;
  $("camres").textContent = `WEBCAM (${W}×${H})`;
}

// 切断・失敗の時に、古い表示を残さない
function enterCameraLoss() {
  cancelEquip();
  cancelCapture();
  ARMS.forEach(a => { a.g.visible = false; a.state = "lost"; });
  clearArmModel();
  gadget.views?.forEach(v => v.setVisible(false));
  resetGadgetState();
  flames.forEach(f => f.reset());
  ears.forEach(e => { e.g.visible = false; });
  earController.asset?.roots.forEach(r => { r.visible = false; });
  ectx.clearRect(0, 0, W, H);
  skelCtx.clearRect(0, 0, W, H);
  [0, 1, 2].forEach(i => { $("lbl" + i).style.display = "none"; });
  $("pose").textContent = "LOST"; $("pose").className = "bad";
  $("trk").textContent = "LOST";
  $("pill").className = "bad";
  $("conf").textContent = "0%"; $("confbar").style.width = "0%";
  $("fps").textContent = "0";
  roomEnv.suspend();
  face.lastSeen = -Infinity;
  // 体験中は選択へ戻す。装着中は選択へ戻す（experience.js の RESET / BACK の挙動を確認すること）
  if (exp.phase === PHASES.ACTION) exp = reduceExperience(exp, { type: EVENTS.BACK });
  else if (exp.phase === PHASES.EQUIPPING) exp = reduceExperience(exp, { type: EVENTS.RESET });
  syncPhaseUI();
}

function setCamPanel(show, text = "") {
  $("camPanel").hidden = !show;
  $("camMsg").textContent = text;
  $("camRetry").disabled = camState === "starting";
}

function onCameraChange({ state, reason, width, height }) {
  camState = state;
  // 待機画面：カメラが使えない間は隠し（カメラの案内を見せる）、使えるようになったら待機から始め直す
  if (state !== "ready") attractView.render("active", 1, 0, null);
  else if (attractOn) attract.reset(performance.now() / 1000);
  syncPhaseUI();
  $("capture").disabled = state !== "ready";
  if (state === "ready") {
    applyVideoSize(width, height);
    $("camdot").className = "on";
    $("cam").textContent = "ONLINE"; $("cam").className = "ok";
    roomEnv.resume();
    setCamPanel(false);
  } else if (state === "starting") {
    $("camdot").className = "";
    $("cam").textContent = "WAIT"; $("cam").className = "";
    setCamPanel(true, "カメラを準備中です...");
    } else if (state === "idle") {
  // 停止（画面からは呼ばない）。案内は出さない
  $("camdot").className = "";
  setCamPanel(false);
  } else {                                   // lost / error
    enterCameraLoss();
    $("camdot").className = "";
    $("cam").textContent = state === "lost" ? "LOST" : "ERROR"; $("cam").className = "bad";
    setCamPanel(true, CAM_MESSAGES[reason] ?? CAM_MESSAGES.unknown);
  }
}

/* ---------------- メインループ ---------------- */
let lastVideoTime = -1, frames = 0, fps = 0, fpsStart = performance.now(), inferMs = 0, lastFrame = null;

function loop() {
  if (camState === "ready" && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, t0);
    inferMs = performance.now() - t0;
    const now = t0 / 1000;

    processFrame(result, now);
    updateAttract(result, now);
    updateHandPointer(result, now);
    updateHandTips(now);
    processBodyFit(result);
    processHands(t0, now);
    if (face.ears || face.eyeMode !== "off" || maskSettings.enabled) processFace(faceLm.detectForVideo(video, t0), now); // 顔検出は必要な時のみ実行
    frameDt = lastFrame === null ? 1 / 30 : Math.min(0.1, Math.max(0.001, now - lastFrame));
    lastFrame = now;
    ARMS.forEach(a => updateArm(a, now));
    updateAssembly(now);
    updateChargeHud();
    updateLoops(now);
    updateFace(now);
    drawSkel();

    frames++;
    if (t0 - fpsStart >= 1000) { fps = frames * 1000 / (t0 - fpsStart); frames = 0; fpsStart = t0; }
    updateHud(now);
  }
  applyShake(frameDt);
  if (camState === "ready" && roomEnv.update()) matchLighting(key, roomEnv.ambient, 0.25);
  bloom.render(scene, camera);
  runCapture();                                               // 描画（ブルーム込み）の直後に撮影する（#11）
  requestAnimationFrame(loop);
}
$("camRetry").onclick = () => cam.retry();
cam.start();
loop();
