import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../project-chrome/js/intro.js', import.meta.url), 'utf8');
function boot(reduce = false) {
  const timers = new Map();
  let next = 0;
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, inert: false, isConnected: true, handlers: {},
      classList: { add() {}, remove() {} },
      focus() { document.activeElement = this; },
      addEventListener(name, handler) { this.handlers[name] = handler; },
    });
    return elements.get(id);
  }
  const document = { getElementById: element, querySelector: element, activeElement: element('initial') };
  vm.runInNewContext(source, {
    document, window: { matchMedia: () => ({ matches: reduce, addEventListener() {} }) },
    setTimeout(fn, ms) { const id = ++next; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { element, timers, document };
}
test('SKIP・Escapeで待機を解除し、背景操作とフォーカスを復元する', () => {
  for (const escape of [false, true]) {
    const { element, timers, document } = boot();
    assert.equal(element('exhibitionMain').inert, true);
    if (escape) element('storeIntro').handlers.keydown({ key: 'Escape' });
    else element('skipIntro').handlers.click();
    assert.equal(element('storeIntro').hidden, true);
    assert.equal(element('exhibitionMain').inert, false);
    assert.equal(timers.size, 0);
    assert.equal(document.activeElement, element('initial'));
  }
});
test('連続再生しても旧タイマーが残らず、カメラ応答なしで自動終了する', () => {
  const { element, timers } = boot();
  element('skipIntro').handlers.click();
  element('replayIntro').handlers.click();
  element('replayIntro').handlers.click();
  assert.equal(timers.size, 3);
  [...timers.values()].sort((a, b) => a.ms - b.ms).forEach(({ fn }) => fn());
  assert.equal(element('storeIntro').hidden, true);
  assert.equal(element('header').inert, false);
});
test('動きを減らす設定では待機やアニメーションを強制しない', () => {
  const { element, timers } = boot(true);
  assert.equal(element('storeIntro').hidden, true);
  assert.equal(element('exhibitionMain').inert, false);
  assert.equal(timers.size, 0);
});
