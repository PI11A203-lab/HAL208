import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EAR_MODELS } from '../project-chrome/js/config.js';

test('配布GLBに左右・LED・実際の凹み形状が存在する', async () => {
  for (const definition of Object.values(EAR_MODELS)) {
    const bytes = await readFile(new URL(`../project-chrome/${definition.url}`, import.meta.url));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    for (const name of ['EarLeft', 'EarRight']) {
      assert.equal(gltf.nodes.filter(node => node.name === name).length, 1);
    }
    assert.ok(gltf.materials.some(mat => mat.name === 'EarShell'));
    if (!definition.led) continue;
    const ledIndex = gltf.materials.findIndex(mat => mat.name === 'EarLED');
    assert.ok(ledIndex >= 0);
    assert.ok(gltf.materials[ledIndex].emissiveFactor.some(v => v > 0));
    for (const side of ['Left', 'Right']) {
      const node = suffix => gltf.nodes.find(item => item.name === side + suffix);
      const mesh = suffix => gltf.meshes[node(suffix).mesh];
      // 配布GLBの+Zが前面。exporterは頂点をY-upへ変換する。
      const range = suffix => {
        const accessors = mesh(suffix).primitives.map(p => gltf.accessors[p.attributes.POSITION]);
        return [Math.min(...accessors.map(a => a.min[2])), Math.max(...accessors.map(a => a.max[2]))];
      };
      const frame = range('RecessFrame'), floor = range('RecessFloor'), led = range('InnerLED');
      assert.ok(frame[1] - floor[1] > .15, '内板が外枠前面より奥にある');
      assert.ok(led[1] < frame[1] && led[0] > floor[1], 'LEDは枠と内板の間にある');
      assert.ok(mesh('InnerLED').primitives.every(p => p.material === ledIndex));
      assert.ok(node('ClosedBack') && node('BackCover'));
    }
  }
});
