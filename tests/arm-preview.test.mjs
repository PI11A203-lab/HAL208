import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'espree';
import { DESIGNS } from '../project-chrome/js/config.js';
import { createExperience, reduceExperience, EVENTS, PHASES } from '../project-chrome/js/experience.js';

// 実際のカードイベントを実行し、表示だけの変更に戻らないことを検査する。
const source = readFileSync(new URL('../project-chrome/js/main.js', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
const handler = ast.body.find(node => {
  const left = node.expression?.left;
  return left?.property?.name === 'onclick' && left.object?.callee?.name === '$'
    && left.object.arguments[0]?.value === 'cards';
}).expression.right;
function setup(state = createExperience()) {
  const calls = [];
  const box = { style: { display: 'block' } };
  const context = vm.createContext({
    exp: state, selected: 'mk1', design: DESIGNS.mk1, DESIGNS, reduceExperience, EVENTS, PHASES,
    armModel: { assembly: {} }, $: () => box,
    applyDesign(item) { context.design = item; calls.push(['appearance', item.model]); },
    useArmModel(id, options) { calls.push(['model', id, options.animate]); },
    clearArmModel() { calls.push(['clear']); },
    resetGadgetState() { calls.push(['resetGadget']); },
    renderCards() { calls.push(['render']); },
  });
  const click = vm.runInContext('(' + source.slice(...handler.range) + ')', context);
  return { context, calls, click, box };
}
test('選択イベントが3種類の実モデルをプレビューとして読み込む', () => {
  const { context, calls, click, box } = setup();
  for (const id of ['mk1', 'neon', 'titan']) {
    click({ target: { closest: () => ({ dataset: { k: id }, disabled: false }) } });
    assert.equal(context.exp.previewId, id);
    assert.equal(context.exp.phase, PHASES.SELECT);
    assert.deepEqual(calls.at(-2), ['model', DESIGNS[id].model, false]);
    assert.equal(context.armModel.assembly, null);
    assert.equal(box.style.display, 'none');
  }
});
test('無効なカード・カメラ準備中・装着中のクリックではモデルを切り替えない', () => {
  for (const [state, card] of [
    [createExperience(), null],
    [createExperience(), { disabled: true, dataset: { k: 'neon' } }],
    [reduceExperience(createExperience(), { type: EVENTS.APPLY }), { dataset: { k: 'neon' } }],
  ]) {
    const { click, calls, context } = setup(state);
    click({ target: { closest: () => card } });
    assert.equal(calls.length, 0);
    assert.equal(context.exp, state);
  }
});
