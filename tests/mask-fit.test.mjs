import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fitMask, adjacentCategory, LOADOUT_CATEGORIES } from '../project-chrome/js/mask-fit.js';
import { MASK_MODEL, MASK_MODELS, MASK_DEFAULTS } from '../project-chrome/js/config.js';
import { createLoadoutMenu } from '../project-chrome/js/loadout-menu.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'espree';

const mainSource = readFileSync(new URL('../project-chrome/js/main.js', import.meta.url),'utf8');
const mainAst = parse(mainSource,{ecmaVersion:'latest',sourceType:'module',range:true});
function maskPicker() {
  const buttons = Object.keys(MASK_MODELS).map(mask => ({dataset:{mask},disabled:false,
    attributes:{},classList:{toggle(name,value){ this[name]=value; }},
    setAttribute(name,value){ this.attributes[name]=value; }}));
  const elements = {maskOn:{checked:false},maskCol:{value:'',disabled:false}};
  const calls=[];
  const context=vm.createContext({MASK_MODELS,MASK_DEFAULTS,maskSettings:{model:'prototype',enabled:false},maskError:'',
    $:id=>elements[id],document:{querySelectorAll:()=>buttons,getElementById:id=>elements[id]},
    maskController:{asset:null,setEnabled:(enabled,id)=>calls.push([enabled,id])}});
  const sync=mainAst.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='syncMask');
  vm.runInContext(mainSource.slice(...sync.range),context);
  const handler=mainAst.body.find(node=>node.expression?.left?.property?.name==='onclick'
    &&node.expression.left.object?.arguments?.[0]?.value==='maskCards').expression.right;
  const click=vm.runInContext('('+mainSource.slice(...handler.range)+')',context);
  return {buttons,elements,calls,context,click};
}

test('マスクの画像カードを押すと選んだ実モデルがONになり選択・色を同期する', () => {
  const ui=maskPicker();
  for (const button of ui.buttons) {
    ui.click({target:{closest:()=>button}});
    const id=button.dataset.mask;
    assert.deepEqual(ui.calls.at(-1),[true,id]);
    assert.equal(ui.elements.maskOn.checked,true);
    assert.equal(button.attributes['aria-pressed'],'true');
    assert.equal(ui.elements.maskCol.disabled,Boolean(MASK_MODELS[id].fixedColor));
    assert.equal(ui.elements.maskCol.value,MASK_MODELS[id].color??'#35383b');
    assert.equal(ui.buttons.filter(item=>item.classList.sel).length,1);
  }
  ui.context.maskSettings.enabled=false;ui.context.syncMask();
  assert.ok(ui.buttons.every(button=>button.attributes['aria-pressed']==='false'));
  Object.assign(ui.context.maskSettings,{model:'prototype',enabled:false});ui.context.syncMask();
  assert.deepEqual(ui.calls.at(-1),[false,'prototype']);
  assert.equal(ui.elements.maskCol.disabled,false);
});

test('準備中・不正なマスクカードは装備を変更しない', () => {
  const ui=maskPicker();
  for (const button of [null,{disabled:true,dataset:{mask:'oni'}},{dataset:{mask:'invalid'}}]) {
    ui.click({target:{closest:()=>button}});
  }
  assert.equal(ui.calls.length,0);
});

test('マスク3種のカード画像は実ファイルのPNGを参照する', async () => {
  const html=readFileSync(new URL('../project-chrome/index.html',import.meta.url),'utf8');
  const section=html.match(/id="maskCards"[\s\S]*?<\/div>/)[0];
  for (const id of Object.keys(MASK_MODELS)) {
    assert.ok(section.includes('data-mask="'+id+'"'));
    const bytes=await readFile(new URL('../project-chrome/assets/shop/mask-'+id+'.png',import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),512);
    assert.equal(bytes.readUInt32BE(20),384);
  }
  assert.ok(!html.includes('id="maskModel"'));
});

const face = { left: [-100, 0, 0], right: [100, 0, 0], forehead: [0, 120, 0],
  chin: [0, -140, 0], nose: [0, 10, 30] };
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
test('短縮したマスクの下端を顎先に合わせる', () => {
  const fit = fitMask(face);
  assert.deepEqual(fit.right, [1,0,0]);
  assert.deepEqual(fit.up, [0,1,0]);
  assert.deepEqual(fit.forward, [0,0,1]);
  close(fit.scale[0] * 2.533, 216);
  close(fit.origin[1] - .856*fit.scale[1], face.chin[1]);
});
test('サイズ変更や頭の傾きでも顎を支点にし、高さ調整だけ指定分ずらす', () => {
  const pitch = p => [p[0], p[1]*Math.cos(.35)-p[2]*Math.sin(.35), p[1]*Math.sin(.35)+p[2]*Math.cos(.35)];
  const tilted = Object.fromEntries(Object.entries(face).map(([key, p]) => [key, pitch(p)]));
  for (const points of [face, tilted]) {
    for (const size of [.8, 1, 1.3]) {
      for (const lift of [0, .1]) {
        const fit = fitMask(points, {size, lift});
        const bottom = fit.origin.map((v,i) => v - fit.up[i] * .856 * fit.scale[1]);
        const offset = bottom.map((v,i) => v - points.chin[i]);
        close(offset.reduce((sum,v,i) => sum + v * fit.up[i], 0), 200 * lift);
        close(offset.reduce((sum,v,i) => sum + v * fit.right[i], 0), 0);
      }
    }
  }
});
test('移動・距離・頭の回転を装着位置へ反映する', () => {
  const base = fitMask(face);
  const moved = Object.fromEntries(Object.entries(face).map(([key, p]) => [key, p.map((v,i) => v*2+[300,400,50][i])]));
  const fit = fitMask(moved);
  fit.origin.forEach((value,i) => close(value, base.origin[i]*2+[300,400,50][i]));
  const turn = p => [p[2], p[1], -p[0]];
  const rotated = fitMask(Object.fromEntries(Object.entries(face).map(([key,p]) => [key, turn(p)])));
  rotated.origin.forEach((v,i) => close(v, turn(base.origin)[i]));
  rotated.forward.forEach((value,i) => close(value, [1,0,0][i]));
});
test('位置調整と不正な追跡点を安全に扱う', () => {
  const base = fitMask(face), adjusted = fitMask(face, { lift: .1, depth: .1 });
  close(adjusted.origin[1] - base.origin[1], 20);
  close(adjusted.origin[2] - base.origin[2], 20);
  assert.equal(fitMask({...face, nose: [NaN,0,0]}), null);
  assert.equal(fitMask({...face, right: face.left}), null);
  assert.equal(fitMask({...face, forehead: face.chin}), null);
});
test('メニューは腕・目・マスク・耳の順で端を越えない', () => {
  assert.deepEqual(LOADOUT_CATEGORIES, ['arms','eyes','mask','head']);
  assert.equal(adjacentCategory('eyes', 1), 'mask');
  assert.equal(adjacentCategory('mask', 1), 'head');
  assert.equal(adjacentCategory('mask', -1), 'eyes');
  assert.equal(adjacentCategory('arms', -1), 'arms');
  assert.equal(adjacentCategory('head', 1), 'head');
});
test('カメラ待機中のカテゴリー移動と起動後の矢印状態を維持する', () => {
  const tabs = LOADOUT_CATEGORIES.map(category => ({
    dataset: { t: category }, disabled: true, attributes: {},
    classList: { toggle() {} }, scrollIntoView() {}, focus() {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }));
  const elements = Object.fromEntries(['categoryPrev', 'categoryNext', ...LOADOUT_CATEGORIES.map(c => 'sec-'+c)]
    .map(id => [id, { disabled: true, hidden: false }]));
  const document = { getElementById: id => elements[id], querySelectorAll: () => tabs };
  const menu = createLoadoutMenu(document);
  assert.equal(elements.categoryPrev.disabled, true);
  assert.equal(elements.categoryNext.disabled, false);
  assert.ok(tabs.every(tab => !tab.disabled));
  elements.categoryNext.onclick(); elements.categoryNext.onclick();
  assert.equal(elements['sec-mask'].hidden, false);
  assert.equal(elements['sec-eyes'].hidden, true);
  // mainの初期化完了が全buttonを有効にしても選択と端の状態を復元する。
  menu.refresh();
  assert.equal(tabs[2].attributes['aria-selected'], 'true');
  menu.select('arms'); elements.categoryPrev.disabled = false; menu.refresh();
  assert.equal(elements.categoryPrev.disabled, true);
  assert.equal(elements['sec-mask'].hidden, true);
});
test('マスク配布GLBが自己完結し正しいrootと外殻材質を持つ', async () => {
  const bytes = await readFile(new URL(`../project-chrome/${MASK_MODEL.url}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.nodes.filter(node => node.name === 'MaskRoot').length, 1);
  assert.ok(gltf.materials.some(material => material.name === 'MaskShell'));
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok(!gltf.cameras?.length);
});
test('ONIは牙・六角網・赤色LEDを持ち、専用比率でも顎を支点にする', async () => {
  const definition = MASK_MODELS.oni;
  const bytes = await readFile(new URL(`../project-chrome/${definition.url}`, import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)).toString());
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(gltf.nodes.filter(node => node.name === 'MaskRoot').length, 1);
  for (const name of ['Left Upper canine','Right Upper canine','Left Lower canine','Right Lower canine']) {
    assert.ok(gltf.nodes.some(node => node.name === name));
  }
  for (const name of ['Upper wraparound facial armor','Lower overlapping fang armor']) {
    assert.ok(gltf.nodes.some(node => node.name === name), '改修版の装甲が必要');
  }
  assert.ok(gltf.nodes.filter(node => node.name?.startsWith('Honeycomb wire')).length > 100);
  assert.ok(gltf.materials.some(mat => mat.name === 'OniCeramicTeeth'));
  const led = gltf.materials.find(mat => mat.name === 'MaskLED');
  assert.ok(led.emissiveFactor[0] > led.emissiveFactor[1]*10);
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  const fit = fitMask(face, {}, definition);
  close(fit.origin[1] - .856*fit.scale[1], face.chin[1]);
  close(fit.scale[1]*definition.heightSpan, 150);
});

test('ウサギは縦伸びを抑え、サイズ変更時も横幅と顎の支点を維持する', () => {
  const definition = MASK_MODELS.rabbit;
  for (const size of [.8, 1, 1.3]) {
    const before = fitMask(face, { size }, { ...definition, heightSpan: 1.30 });
    const after = fitMask(face, { size }, definition);
    close(after.scale[0], before.scale[0]);
    close(after.origin[1] - .856*after.scale[1], face.chin[1] + 200*definition.liftOffset);
    assert.ok(after.scale[1] / before.scale[1] < .65);
    assert.ok(after.scale[1] / before.scale[1] > .55);
  }
});
test('ウサギ顔マスクは頬・前歯・ピンクLEDを保持し、顎基準で装着する', async () => {
  const definition = MASK_MODELS.rabbit;
  const bytes = await readFile(new URL(`../project-chrome/${definition.url}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.nodes.filter(node => node.name === 'MaskRoot').length, 1);
  for (const name of ['Left ivory cheek','Right ivory cheek','Left short front tooth',
    'Right short front tooth','Soft pink triangular nose','Left cheek light pastel LED',
    'Right cheek light recessed channel']) assert.ok(gltf.nodes.some(node => node.name === name), name);
  for (const name of ['RabbitIvoryCheeks','RabbitIvoryTeeth','RabbitNosePink','RabbitArmor']) {
    assert.ok(gltf.materials.some(mat => mat.name === name), name);
  }
  const led = gltf.materials.find(mat => mat.name === 'RabbitPastelLED');
  assert.equal(definition.color, '#ffffff');
  assert.equal(definition.fixedColor, true);
  assert.equal(gltf.nodes.find(node => node.name === 'MaskRoot').extras.fixedArmorColor, '#ffffff');
  for (const name of ['MaskShell','RabbitArmor']) {
    const material = gltf.materials.find(mat => mat.name === name);
    assert.ok(material.pbrMetallicRoughness.baseColorFactor.slice(0,3).every(value => value > .85));
  }
  assert.ok(led.emissiveFactor[0] > led.emissiveFactor[1]*2);
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok(!gltf.cameras?.length);
  const fit = fitMask(face, {}, definition);
  close(fit.origin[1] - .856*fit.scale[1], face.chin[1] + 200*definition.liftOffset);
  close(fit.scale[1]*definition.heightSpan, 150);
});

test('ウサギの位置補正は顔の上方向へ作用し、高さスライダーを加算できる', () => {
  const definition = MASK_MODELS.rabbit;
  const angle = .35;
  const rotate = ([x,y,z]) => [x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z];
  const points = Object.fromEntries(Object.entries(face).map(([key,p]) => [key,rotate(p)]));
  const before = fitMask(points, {}, {...definition, liftOffset:0});
  const after = fitMask(points, {lift:.02}, definition);
  for (let i=0;i<3;i++) close(after.origin[i]-before.origin[i],after.up[i]*200*(definition.liftOffset+.02));
});
