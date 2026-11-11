import * as THREE from "three";
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
         classifyHand, isFist, isOpenHand, GESTURE_TO_GADGET } from "./gadget-logic.js";
import { earShape } from "./face.js";
import { PoseLandmarker, FaceLandmarker, HandLandmarker, FilesetResolver }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const glCanvas = document.getElementById("gl");
const skelCanvas = document.getElementById("skel");
const skelCtx = skelCanvas.getContext("2d");
const info = document.getElementById("info");

/* ---------------- Ayarlar ---------------- */
// 初期設定は config.js から読み込みます。
const settings = { ...DEFAULTS };
const VIS_MIN = 0.5;      // この信頼度未満の点は更新しない
const HOLD_SEC = 0.6;     // 検出が途切れた点の最終位置を保持する時間（秒）
const BETA = 0.02;        // One Euro：速度への感度（ピクセル単位）

/* ---------------- One Euro filtresi ---------------- */
import { OneEuro } from './tracking.js';


/* ---------------- モデルとカメラ ---------------- */
let landmarker, faceLm, visionFiles;
try {
  info.textContent = "モデルを読み込み中（インターネット接続が必要）...";
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  visionFiles = vision;
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
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

try {
  info.textContent = "カメラの許可を待っています...";
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720 }, audio: false });
  await video.play();
} catch (e) {
  info.textContent = "カメラにアクセスできませんでした: " + e.message;
  throw e;
}

const W = video.videoWidth, H = video.videoHeight;
configureFx({ video, width: W, height: H });          // 熱かげろうで映像を使う
skelCanvas.width = W; skelCanvas.height = H;
info.textContent = "";
document.getElementById("camdot").className = "on";
document.getElementById("cam").textContent = "ONLINE"; document.getElementById("cam").className = "ok";
document.getElementById("camres").textContent = `WEBCAM (${W}×${H})`;

/* ---------------- three.js sahnesi ---------------- */
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

const camera = new THREE.OrthographicCamera(0, W, H, 0, 0.1, 5000);
camera.position.z = 2000;
const bloom = createBloom(renderer, W, H);              // 炎・弾のにじみ（Effects quality が HIGH の時）

/* ---------------- Robot kol modeli ---------------- */
const metalMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.9, roughness: 0.32 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 1.0, roughness: 0.2 });
const neonMat  = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6 });

// 円柱：先端（+Y側）をやや細くし、腕の先に向かって細くなる形にする
const cylGeo = new THREE.CylinderGeometry(0.8, 1, 1, 32);
const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const torusGeo = new THREE.TorusGeometry(1, 0.08, 12, 48);

function makeArm(name, ids) {
  const g = new THREE.Group();
  const m = {
    shoulder: new THREE.Mesh(sphereGeo, jointMat),
    upper: new THREE.Mesh(cylGeo, metalMat),
    elbow: new THREE.Mesh(sphereGeo, jointMat),
    fore: new THREE.Mesh(cylGeo, metalMat),
    hand: new THREE.Mesh(boxGeo, metalMat),
    ring1: new THREE.Mesh(torusGeo, neonMat),
    ring2: new THREE.Mesh(torusGeo, neonMat),
  };
  Object.values(m).forEach(mesh => g.add(mesh));
  g.visible = false;
  scene.add(g);
  return { name, ids, g, m, state: "lost" };
}
// MediaPipe：本人の左腕は 11-13-15、右腕は 12-14-16
const ARMS = [makeArm("Left arm", [11, 13, 15]), makeArm("Right arm", [12, 14, 16])];
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
  const visible = ARMS.filter(arm => arm.state !== "lost" && settings.showArm);
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

async function useArmModel(id) {
  if (armModel.id === id && armModel.status === "ready") {   // 同じモデルは読み直さず外観だけ更新
    armModel.views.forEach(v => v.applyAppearance(design));
    startAssembly();
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
    views.forEach(v => { v.applyAppearance(design); scene.add(v.root); });
    armModel.views = views; armModel.model = model; armModel.status = "ready";
    // 部品は腕の外側・上から飛んでくる（MediaPipe の 12＝本人の右肩は映像の左側）
    views.forEach((v, i) => v.setAssembly(0, [(ARMS[i].ids[0] === 12 ? -1 : 1) * W * 0.45, H * 0.3, 200]));
    startAssembly();
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

/* ---------------- Eklem durumu ---------------- */
const JOINTS = [11, 12, 13, 14, 15, 16];
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
  if (!handLm || !armModel.views?.some(v => v.hasFingers) || !settings.showArm) return;
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
    const q = lm[id], j = joints[id]; j.vis = q.visibility ?? 0;
    if ((q.visibility ?? 0) < VIS_MIN) continue;        // 信頼度の低い点：最後の位置を保持
    if (now - j.lastSeen > 0.3) { j.fx.reset(); j.fy.reset(); j.fz.reset(); } // 長く途切れた後に滑って戻らないようリセット
    j.p.set(j.fx.filter(q.x * W, now, minCutoff, BETA),
            j.fy.filter(q.y * H, now, minCutoff, BETA),
            j.fz.filter(q.z * W, now, minCutoff, BETA));  // z：相対的な「推定」奥行き（実測ではない）
    j.raw.set(q.x * W, q.y * H);
    j.lastSeen = now;
  }
  const a = joints[11], b = joints[12];
  if (now - a.lastSeen < 0.3 && now - b.lastSeen < 0.3) {
    bodyScale = Math.max(Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y), 0.1 * W);
  }
}

/* ---------------- 腕の配置 ---------------- */
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const conv = p => new THREE.Vector3(p.x, H - p.y, -p.z * settings.depth);

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

function clearGadget() {
  gadget.requests.cancel();
  gadget.views?.forEach(v => v.dispose());
  gadget.views = null;
  gadget.shots = ARMS.map(() => null);
  gadget.ctrls.forEach(c => c.reset());
  gadget.triggers.forEach(t => t.reset());
  gadget.punches.forEach(p => p.reset());
  gadget.labels = ARMS.map(() => null);
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
    gadget.views.forEach(v => { v.applyAppearance(design); scene.add(v.root); });
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
  if (gadget.kind === "off") { say("GADGET で種類を選んでください。"); return; }
  ARMS.forEach((a, i) => { if (a.state !== "lost") startShot(i, 1, false, now, gadget.curDir[i]); });
}

// AUTO：手の形とパンチの動きから発射する。PLASMA の溜めに使う「構え」を返す
function autoGestures(i, pts, angle, aiming, now) {
  const label = pts ? classifyHand(pts) : null;
  gadget.labels[i] = label;
  const dir = gadget.curDir[i];
  // ロケットパンチ：拳を握って肘を勢いよく伸ばす（手が見えない時は腕の動きだけで判定）
  if (gadget.punches[i].update(now, angle, !pts || label === "fist")) startShot(i, 1, false, now, dir, "fist");
  // NET・HOOK：手の形を少し保つと発射
  const g = gadget.triggers[i].update(now, label);
  if (g && GESTURE_TO_GADGET[g]) startShot(i, 1, false, now, dir, GESTURE_TO_GADGET[g]);
  // PLASMA：腕を上げて手を開いている間に溜まり、拳を握る（または腕を下ろす）と発射
  return aiming && (!pts || label === "open");
}

// s：{ el, wr（シーン座標の THREE.Vector3）, thickness, hand（handPose の結果か null） }。戻り値：手をずらす量
function updateGadget(arm, s, now) {
  const i = ARMS.indexOf(arm), view = gadget.views?.[i];
  if (!view || gadget.kind === "off" || !s || armModel.assembly) { view?.setVisible(false); return null; }
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
  camera.position.x = (Math.random() - 0.5) * k;
  camera.position.y = (Math.random() - 0.5) * k;
  shakeAmp *= Math.exp(-dt * 9);
  if (shakeAmp < 0.01) shakeAmp = 0;
}

// 人差し指だけを立てると、指先に火がつく（手を追跡している時のみ）
function updateFlame(arm, hand, now) {
  const i = ARMS.indexOf(arm), st = pointing[i];
  const on = Boolean(hand) && classifyHand(hand.points) === "point";
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
  guide.style.display = gadget.kind === "auto" && settings.showArm ? "block" : "none";
  const seen = new Set(gadget.labels.filter(Boolean));
  if (gadget.ctrls.some(x => x.mode === "charging")) seen.add("open");
  guide.querySelectorAll("[data-gs]").forEach(el => el.classList.toggle("on", seen.has(el.dataset.gs)));
}

function updateArm(arm, now) {
  const js = arm.ids.map(i => joints[i]);
  const age = Math.max(...js.map(j => now - j.lastSeen));
  arm.state = age < 0.1 ? "tracking" : age < HOLD_SEC ? "holding" : "lost";
  const show = settings.showArm && age < HOLD_SEC;
  const view = armModel.views?.[ARMS.indexOf(arm)];      // GLBが使える時はGLB、それ以外は簡易形状
  arm.g.visible = show && !view;
  view?.setVisible(show);
  if (!show) { updateGadget(arm, null, now); updateFlame(arm, null, now); return; }

  const [sh, el, wr] = js.map(j => conv(j.p));
  const m = arm.m;
  // 腕の太さ：測れていれば実際の幅（少し大きめ）、測れていなければ肩幅から推定
  const k = settings.thick * design.thick;
  const guess = bodyScale * 0.14 * k;
  const upperR = arm.fit.upper.value !== null ? arm.fit.upper.value / 2 * BODY_FIT.cover * k : guess;
  const foreR = arm.fit.fore.value !== null ? arm.fit.fore.value / 2 * BODY_FIT.cover * k : guess * 0.85;
  const base = upperR;

  const hand = view?.hasFingers ? handPose(arm, wr.toArray(), now) : null;
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

  // 手（簡易ボックス）：手首から先へ配置。手首のひねり（ロール）は分からないため単純な形にしている
  const handLen = fl * 0.45;
  m.hand.position.copy(wr).addScaledVector(fd, handLen / 2);
  m.hand.quaternion.setFromUnitVectors(Y, fd);
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
const face = { ears: false, earSize: 1, eyeMode: "off", eyeCol: "#00e5ff", eyeOp: 0.85, lastSeen: -Infinity };
// ランドマーク番号：10=額、152=顎、234/454=頬、103/332=生え際、468/473=虹彩の中心、469-471/474-476=虹彩の左右端
const IRIS = [468, 473], IRIS_EDGE = [[469, 471], [474, 476]];
const LID = [[159, 145], [386, 374]], CORNER = [[33, 133], [362, 263]]; // まぶた（上下）と目尻・目頭
const EYE_POLY = [ // 目の開口部の輪郭（まぶたで虹彩を隠すためのマスク）
  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382],
];
const FIDS = [...new Set([10, 152, 234, 454, 103, 332, 468, 469, 471, 473, 474, 476, ...EYE_POLY.flat()])];
const fp = {}; // 平滑化した顔の点（ピクセル空間）
for (const id of FIDS) fp[id] = { f: [new OneEuro(), new OneEuro(), new OneEuro()], p: new THREE.Vector3() };

/* --- 3D猫耳：外殻（面取り付きの金属プレート）＋内側の発光パネル＋根元のカラー＋発光ライン --- */
const earMat = new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.9, roughness: 0.3 });
const earInMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4 });
const outerGeo = new THREE.ExtrudeGeometry(earShape(1), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 14 });
outerGeo.translate(0, 0, -0.13);   // 厚みの中心を z=0 に合わせる
const innerGeo = new THREE.ExtrudeGeometry(earShape(0.6), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 14 });
innerGeo.translate(0, 0.09, 0.07); // 外殻の前面からわずかに突き出す
const ears = [0, 1].map(() => {
  const g = new THREE.Group();
  const p = { g, shell: new THREE.Mesh(outerGeo, earMat), inner: new THREE.Mesh(innerGeo, earInMat),
              collar: new THREE.Mesh(cylGeo, jointMat), seam: new THREE.Mesh(boxGeo, neonMat) };
  g.add(p.shell, p.inner, p.collar, p.seam); g.visible = false; scene.add(g);
  return p;
});

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
  const earOn = face.ears && ok;
  ears.forEach(e => e.g.visible = earOn);
  if (earOn) {
    const faceW = Math.max(P(454).distanceTo(P(234)), 1);
    const up = new THREE.Vector3().subVectors(P(10), P(152)).normalize();
    const right = new THREE.Vector3().subVectors(P(454), P(234));
    const fw = new THREE.Vector3().crossVectors(right, up).normalize();   // カメラ方向
    right.crossVectors(up, fw).normalize();
    [[103, -1], [332, 1]].forEach(([id, side], k) => {
      const dir = up.clone().addScaledVector(right, side * 0.35).normalize(); // 少し外向きに傾ける
      const x = new THREE.Vector3().crossVectors(dir, fw).normalize();
      const z = new THREE.Vector3().crossVectors(x, dir).normalize();
      const earW = faceW * 0.22 * face.earSize, earH = faceW * 0.34 * face.earSize, earT = earW * 0.6;
      const e = ears[k];
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
import { DESIGNS, DEFAULTS, ARM_MODELS, BODY_FIT, GADGET, FLAME } from './config.js';

let selected = "mk1", design = DESIGNS.mk1;
settings.showArm = false; // APPLYを押すまで腕は表示しない

function applyDesign(d) {
  metalMat.color.setHex(d.metal); metalMat.roughness = d.rough;
  jointMat.color.setHex(d.joint);
  neonMat.color.setHex(d.neon); neonMat.emissive.setHex(d.neon); neonMat.emissiveIntensity = d.glow;
  design = d;
}
function thumb(d) { // 仮の簡易イラスト（実際のモデルではない）
  const [m, j, n] = d.css;
  return `<svg viewBox="0 0 60 80"><g transform="rotate(14 30 40)"><rect x="22" y="3" width="16" height="33" rx="8" fill="${m}" stroke="${n}" stroke-opacity=".5"/>` +
    `<circle cx="30" cy="39" r="7" fill="${j}" stroke="${n}" stroke-width="2"/><rect x="24" y="44" width="12" height="25" rx="6" fill="${m}" stroke="${n}" stroke-opacity=".5"/>` +
    `<rect x="19" y="67" width="22" height="9" rx="3" fill="${j}" stroke="${n}" stroke-opacity=".6"/></g></svg>`;
}
function renderCards() {
  $("cards").innerHTML = Object.entries(DESIGNS).map(([k, d]) =>
    `<div class="card ${k === selected ? "sel" : ""}" data-k="${k}">${thumb(d)}<b>${d.name}</b><p>${d.desc}</p><span>${k === selected ? "✓ SELECTED" : "SELECT"}</span></div>`).join("");
  const d = DESIGNS[selected];
  $("dname").textContent = d.name; $("ddesc").textContent = d.long;
  ["str", "spd", "dur"].forEach((id, i) => $(id).style.width = d.stats[i] + "%");
}
function say(t) { info.textContent = t; setTimeout(() => { if (info.textContent === t) info.textContent = ""; }, 3000); }
$("cards").onclick = e => { const c = e.target.closest(".card"); if (c) { selected = c.dataset.k; renderCards(); } };
document.querySelectorAll(".tab.locked").forEach(t => t.onclick = () => say(t.dataset.n + " モジュールは次のステップで追加予定です。"));
$("apply").onclick = () => {
  applyDesign(DESIGNS[selected]); settings.showArm = true;
  gadget.views?.forEach(v => v.applyAppearance(design));
  if (design.model) { useArmModel(design.model); return; }   // GLBモデルがある装備
  clearArmModel();
  say(DESIGNS[selected].name + " を適用しました。");
};
$("showSkel").onchange = e => settings.showSkel = e.target.checked;
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
$("reset").onclick = () => {
  Object.assign(settings, { smooth: 0.5, depth: 0.5, thick: 1, showSkel: false, showArm: false });
  $("showSkel").checked = false; $("smooth").value = 0.5; $("depth").value = 0.5; $("thick").value = 1;
  selected = "mk1"; renderCards(); resetJoints();
  ARMS.forEach(a => { a.fit.upper.reset(); a.fit.fore.reset(); a.hand.lastSeen = -Infinity; });
  face.ears = false; face.eyeMode = "off"; $("ears").checked = false;
  document.querySelectorAll("#eyeMode button").forEach(b => b.classList.toggle("sel", b.dataset.m === "off"));
  ARMS.forEach(a => { a.g.visible = false; a.state = "lost"; });
  clearArmModel();
  setGadgetKind("auto");
};
$("gadgetMode").onclick = e => { const g = e.target.dataset.g; if (g) setGadgetKind(g); };
$("gadgetFire").onclick = () => fireGadget(performance.now() / 1000);
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "g" && !(e.target instanceof HTMLInputElement)) fireGadget(performance.now() / 1000);
});
renderCards();
setGadgetKind("auto");                                         // 初期状態はジェスチャーで選ぶ AUTO
document.querySelectorAll(".tab[data-t]").forEach(t => t.onclick = () => {   // タブ切替
  document.querySelectorAll(".tab[data-t]").forEach(x => x.classList.toggle("sel", x === t));
  for (const n of ["arms", "eyes", "head"]) $("sec-" + n).hidden = n !== t.dataset.t;
  $("apply").style.display = t.dataset.t === "arms" ? "" : "none";
});
$("eyeSw").innerHTML = ["#00e5ff", "#ffb300", "#ff1744", "#00e676", "#b388ff", "#ffffff"].map(c => `<i data-c="${c}" style="background:${c}"></i>`).join("");
$("eyeSw").onclick = e => { const c = e.target.dataset.c; if (c) { face.eyeCol = c; $("eyeCol").value = c; } };
$("eyeCol").oninput = e => face.eyeCol = e.target.value;
$("eyeOp").oninput = e => face.eyeOp = +e.target.value;
$("eyeMode").onclick = e => { const m = e.target.dataset.m; if (!m) return; face.eyeMode = m; document.querySelectorAll("#eyeMode button").forEach(b => b.classList.toggle("sel", b === e.target)); };
$("ears").onchange = e => face.ears = e.target.checked;
$("earSize").oninput = e => face.earSize = +e.target.value;
$("earCol").oninput = e => earMat.color.set(e.target.value);

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

/* ---------------- メインループ ---------------- */
let lastVideoTime = -1, frames = 0, fps = 0, fpsStart = performance.now(), inferMs = 0, lastFrame = null;

function loop() {
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, t0);
    inferMs = performance.now() - t0;
    const now = t0 / 1000;

    processFrame(result, now);
    processBodyFit(result);
    processHands(t0, now);
    if (face.ears || face.eyeMode !== "off") processFace(faceLm.detectForVideo(video, t0), now); // 顔検出は必要な時のみ実行
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
  if (roomEnv.update()) matchLighting(key, roomEnv.ambient, 0.25);
  bloom.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
