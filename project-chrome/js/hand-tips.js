// 初めての来場者向けの操作案内（#36 の残り）。来場者ごとに1回ずつ出す。
// ・select：WELCOME の後「手を上げて、指でパーツを選んでください」。手のカーソルが出たら（または一定時間で）消す
// ・menu：体験（ACTION）が始まった時「両手を上げて1秒 → メニュー」。メニューを開いたら（または一定時間で）消す
// 判定は純粋な処理（Node のテストで確認できるように）。表示は renderHandTip。

export const TIP_DEFAULTS = Object.freeze({
  selectSec: 7,        // 指で選ぶ案内の最長表示時間
  menuSec: 6,          // メニュー案内の最長表示時間
  pointerSec: 0.6,     // カーソルがこの時間出続けたら「分かった」として消す
});

export function createHandTips(options = {}) {
  const o = { ...TIP_DEFAULTS, ...options };
  let current = null, from = 0, until = 0, pointerSince = null;
  const done = new Set();          // この来場者に出した案内
  const start = (kind, at, sec) => { current = kind; from = at; until = at + sec; pointerSince = null; done.add(kind); };
  return {
    // WELCOME の時：delay 秒後（WELCOME の表示が終わってから）に指の案内を出す
    welcome(now, delay = 0) { if (!done.has('select')) start('select', now + delay, o.selectSec); },
    // 体験（ACTION）が始まった時：メニューの案内を出す
    action(now) { if (!done.has('menu')) start('menu', now, o.menuSec); },
    // 毎フレーム。pointer：手のカーソルが出ているか、menu：体験中のメニューが開いているか。戻り値：出す案内か null
    update({ pointer = false, menu = false } = {}, now) {
      if (!current) return null;
      if (now < from) return null;                                   // まだ出す前（WELCOME の表示中）
      if (current === 'select') {
        if (pointer) { if (pointerSince === null) pointerSince = now; } else pointerSince = null;
        if (pointerSince !== null && now - pointerSince >= o.pointerSec) current = null;
      }
      if (current === 'menu' && menu) current = null;
      if (current && now >= until) current = null;
      return current;
    },
    hide() { current = null; },
    // 次の来場者のために最初から（待機画面へ戻る時・スタッフ用リセット）
    reset() { current = null; done.clear(); pointerSince = null; },
    get current() { return current; },
  };
}

const TIPS = {
  select: `<span class="ht-demo" aria-hidden="true"><i></i></span>
    <div><b>✋ 手を上げて、指でパーツを選んでください</b><small>ボタンの上で1秒止めると選べます（マウスでも操作できます）</small></div>`,
  menu: `<span class="ht-icon" aria-hidden="true">🙌</span>
    <div><b>両手を上げて1秒 → メニュー（購入・写真）</b><small>☝️ 人差し指を立てると炎。ほかの動きは左下のガイドを見てください</small></div>`,
};

// 案内の表示（el：#handTip）。同じ案内の間は書き換えない
export function renderHandTip(el, kind) {
  if ((el.dataset.kind ?? '') === (kind ?? '')) return;
  el.dataset.kind = kind ?? '';
  el.hidden = !kind;
  el.innerHTML = kind ? TIPS[kind] : '';
}
