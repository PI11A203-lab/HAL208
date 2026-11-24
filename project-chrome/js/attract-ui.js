// 待機画面（アトラクトモード）の表示。状態は attract-state.js が決め、ここでは画面を切り替える。
// ・カメラ：ライブ映像を暗くして、スキャン線・格子・立ち位置のシルエットと「カメラの前に立ってください」を重ねる
// ・人が来た時：シルエットを薄くし、実際の体の関節（Pose）を光らせて「スキャン中…」
// ・右のストア：商品の画像を一定時間ごとに切り替えるショーケース
import { ATTRACT, showcaseIndex } from './attract-state.js';

// 光らせる関節と、その間の線（Pose の点の番号）
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24];
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

const PROMPTS = {
  [ATTRACT.IDLE]: `<div class="at-jp">カメラの前に立ってください</div><div class="at-en">STEP IN TO BEGIN</div>
    <div class="at-hint">お金はかかりません・映像はこのPCの中だけで処理されます</div>`,
  [ATTRACT.SCANNING]: `<div class="at-jp"><span class="at-ring"></span>スキャン中…</div><div class="at-en">HOLD STILL</div>
    <div class="at-bar"><i></i></div>`,
  [ATTRACT.LEAVING]: `<div class="at-jp">またのお越しをお待ちしています</div><div class="at-en">SEE YOU AGAIN</div>`,
  welcome: `<div class="at-jp">WELCOME</div><div class="at-en">右のストアからパーツを選んでください</div>`,
};

export function createAttractView({ doc = document, items = [], cycleSec = 4, welcomeSec = 1.4 } = {}) {
  const root = doc.getElementById('attract');
  const prompt = doc.getElementById('atPrompt');
  const bones = doc.getElementById('atBones');
  const dots = doc.getElementById('atDots');
  const show = doc.getElementById('attractShow');
  const img = doc.getElementById('atImg');
  const name = doc.getElementById('atName');
  const desc = doc.getElementById('atDesc');
  const cat = doc.getElementById('atCat');
  const count = doc.getElementById('atCount');
  const strip = doc.getElementById('atStrip');
  const signal = doc.getElementById('atSignal');
  const SIGNAL = { none: 'NONE', far: 'TOO FAR', edge: 'EDGE', ok: 'LOCKED' };

  // 関節の点と線を先に作っておく
  const dotEls = JOINTS.map(() => { const d = doc.createElement('i'); dots.appendChild(d); return d; });
  bones.innerHTML = BONES.map(() => '<line vector-effect="non-scaling-stroke"/>').join('');
  const lineEls = [...bones.querySelectorAll('line')];
  // ショーケースの小さな画像
  strip.innerHTML = items.map((it) => `<div style="background-image:url('${it.img}')"></div>`).join('');
  const thumbs = [...strip.children];

  let shown = null, welcomeUntil = -Infinity, index = -1, promptKey = null;

  function setPrompt(key) {
    if (key === promptKey) return;
    promptKey = key;
    prompt.innerHTML = PROMPTS[key];
    prompt.dataset.kind = key;
  }

  function drawJoints(lm) {
    const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= 0.5;
    // 映像は鏡映しで表示しているので、左右を反転して重ねる
    JOINTS.forEach((k, n) => {
      const p = lm?.[k], el = dotEls[n];
      el.hidden = !ok(p);
      if (ok(p)) { el.style.left = `${(1 - p.x) * 100}%`; el.style.top = `${p.y * 100}%`; }
    });
    BONES.forEach(([a, b], n) => {
      const p = lm?.[a], q = lm?.[b], el = lineEls[n];
      const vis = ok(p) && ok(q);
      el.style.display = vis ? '' : 'none';
      if (vis) {
        el.setAttribute('x1', (1 - p.x) * 100); el.setAttribute('y1', p.y * 100);
        el.setAttribute('x2', (1 - q.x) * 100); el.setAttribute('y2', q.y * 100);
      }
    });
  }

  function updateShowcase(now) {
    const i = showcaseIndex(now, items.length, cycleSec);
    if (i === index || i < 0) return;
    index = i;
    const it = items[i];
    img.src = it.img; img.alt = it.name;
    img.classList.remove('kb'); void img.offsetWidth; img.classList.add('kb');   // 少しずつ近づく動きを毎回最初から
    name.textContent = it.name; desc.textContent = it.desc; cat.textContent = it.category;
    count.textContent = `${i + 1} / ${items.length}`;
    thumbs.forEach((t, n) => t.classList.toggle('on', n === i));
  }

  return {
    // state：ATTRACT の段階、progress：スキャンの進み、lm：Pose の33点（関節を光らせる）、
    // reason：人の見つかり方（none / far / edge / ok。右上に表示して、立つ位置の目安にする）
    render(state, progress, now, lm, reason = 'none') {
      if (state !== shown) {
        if (state === ATTRACT.ACTIVE && (shown === ATTRACT.SCANNING)) welcomeUntil = now + welcomeSec;
        shown = state;
      }
      const welcome = state === ATTRACT.ACTIVE && now < welcomeUntil;
      const visible = state !== ATTRACT.ACTIVE || welcome;
      root.hidden = !visible;
      show.hidden = state === ATTRACT.ACTIVE;
      doc.body.classList.toggle('attract', state === ATTRACT.IDLE || state === ATTRACT.SCANNING || state === ATTRACT.LEAVING);
      if (!visible) return;
      signal.textContent = SIGNAL[reason] ?? 'NONE';
      signal.dataset.reason = reason;
      root.dataset.state = welcome ? 'welcome' : state;
      setPrompt(welcome ? 'welcome' : state);
      if (state === ATTRACT.SCANNING) {
        prompt.querySelector('.at-bar i').style.width = `${Math.round(progress * 100)}%`;
        drawJoints(lm);
      } else drawJoints(null);
      if (!show.hidden) updateShowcase(now);
    },
  };
}
