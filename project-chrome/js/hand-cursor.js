// タッチレス操作（#36）の画面側：カーソルのリングを表示し、下にあるボタンを強調して、
// 止まった時間がたまったらそのボタンの click() を呼ぶ（既存の操作処理をそのまま使う）。
// 判定（位置・平滑化・ドウェル）は hand-pointer.js。マウス操作はこれまで通り使える。
// スクロール：data-hand-scroll="up|down" の帯（data-hand-scroll-target で対象の一覧を指定）の上では、
// 待たずにその一覧をスクロールする。帯はカーソルが出ている時（body.hand-pointer-on）だけ、スクロールできる方向に表示する。
import { createDwell } from './hand-pointer.js';

const RING = 2 * Math.PI * 26;   // リングの円周（半径 26）

export function createHandCursor({
  doc = document, win = window,
  selector = 'button',            // 手で選べる物
  exclude = '',                   // 選ばせない物（スタッフ用設定など）
  dwellSec, cooldownSec,
  scrollSpeed = 520,              // スクロールの速さ（px／秒）
  onSelect = () => {},
} = {}) {
  const dwell = createDwell({ dwellSec, cooldownSec });
  const el = doc.createElement('div');
  el.className = 'hand-cursor';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 64 64"><circle class="hc-track" cx="32" cy="32" r="26"/>`
    + `<circle class="hc-fill" cx="32" cy="32" r="26" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/>`
    + `<circle class="hc-dot" cx="32" cy="32" r="5"/></svg>`;
  doc.body.appendChild(el);
  const fill = el.querySelector('.hc-fill');
  let hovered = null, enabled = true, lastNow = null;
  const scrollBars = () => [...doc.querySelectorAll('[data-hand-scroll]')];
  const scrollTarget = (bar) => doc.querySelector(bar.dataset.handScrollTarget);
  // 帯を、スクロールできる方向だけ表示する
  function refreshScrollBars() {
    for (const bar of scrollBars()) {
      const box = scrollTarget(bar);
      const can = Boolean(box) && (bar.dataset.handScroll === 'up'
        ? box.scrollTop > 1 : box.scrollTop + box.clientHeight < box.scrollHeight - 1);
      bar.classList.toggle('can-scroll', can);
    }
  }

  // その点の下にある、手で選べる物（無効・非表示・除外は null）
  function targetAt(px, py) {
    const hit = doc.elementFromPoint(px, py);
    const t = hit?.closest?.(selector);
    if (!t || t.disabled || t.hidden || t.closest('[hidden]') || (exclude && t.closest(exclude))) return null;
    return t;
  }
  function setHover(t) {
    if (t === hovered) return;
    hovered?.classList.remove('hand-hover');
    t?.classList.add('hand-hover');
    hovered = t;
  }
  function hide() {
    lastNow = null;
    doc.body.classList.remove('hand-pointer-on');
    el.hidden = true;
    setHover(null);
    dwell.reset();
    fill.setAttribute('stroke-dashoffset', String(RING));
  }

  return {
    // point：{ x, y }（画面に対する 0〜1）か null。毎フレーム呼ぶ
    update(point, now) {
      if (!enabled || !point) { hide(); return null; }
      const px = point.x * win.innerWidth, py = point.y * win.innerHeight;
      const dt = lastNow === null ? 0 : Math.min(0.1, Math.max(0, now - lastNow));
      lastNow = now;
      el.hidden = false;
      doc.body.classList.add('hand-pointer-on');
      refreshScrollBars();
      el.style.transform = `translate(${px}px, ${py}px)`;
      const t = targetAt(px, py);
      setHover(t);
      // スクロールの帯の上では、選ぶ代わりにスクロールする（待たない）
      if (t?.dataset.handScroll) {
        dwell.update(null, now);
        scrollTarget(t)?.scrollBy?.({ top: (t.dataset.handScroll === 'up' ? -1 : 1) * scrollSpeed * dt });
        fill.setAttribute('stroke-dashoffset', String(RING));
        el.classList.add('on-target');
        return t;
      }
      const { progress, fire } = dwell.update(t, now);
      fill.setAttribute('stroke-dashoffset', String(RING * (1 - progress)));
      el.classList.toggle('on-target', Boolean(t));
      if (fire) {
        el.classList.remove('fired'); void el.offsetWidth; el.classList.add('fired');   // 決定の光を毎回出す
        t.click();
        onSelect(t);
      }
      return t;
    },
    setEnabled(v) { enabled = Boolean(v); if (!enabled) hide(); },
    get element() { return el; },
  };
}
