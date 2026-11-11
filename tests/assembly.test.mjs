import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSEMBLY_STAGES, ASSEMBLY_TIMING, assemblyDuration, easeOutBack, lockTime, lockedBetween, stageProgress,
} from '../project-chrome/js/assembly.js';

test('部品は 上腕 → 前腕 → 手 → 指 の順にはまる', () => {
  assert.deepEqual(ASSEMBLY_STAGES.map((s) => s.key), ['upper', 'fore', 'hand', 'fingers']);
  for (let i = 1; i < ASSEMBLY_STAGES.length; i++) assert.ok(lockTime(i) > lockTime(i - 1));
  assert.ok(assemblyDuration() > lockTime(ASSEMBLY_STAGES.length - 1));
});

test('飛び始める前は画面の外、はまった後は関節の位置', () => {
  assert.equal(stageProgress(0, 0), 0);
  assert.equal(stageProgress(0.1, 2), 0, '手はまだ飛んでいない');
  assert.ok(Math.abs(stageProgress(lockTime(1), 1) - 1) < 1e-9);
  assert.equal(stageProgress(null, 3), 1, '演出なし');
  assert.ok(stageProgress(5, 3) === 1);
});

test('はまる直前に少し行き過ぎてから戻る', () => {
  const samples = Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49));
  assert.ok(Math.max(...samples) > 1.0);
  assert.equal(easeOutBack(0), 0);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
});

test('はまった瞬間をフレームの間で1回だけ知らせる', () => {
  const all = [];
  let prev = 0;
  for (let t = 1 / 30; t < assemblyDuration(); t += 1 / 30) { all.push(...lockedBetween(prev, t)); prev = t; }
  assert.deepEqual(all, [0, 1, 2, 3]);
  assert.deepEqual(lockedBetween(0, 10), [0, 1, 2, 3], 'フレームが飛んでもすべて知らせる');
  assert.equal(ASSEMBLY_TIMING.dur > 0 && ASSEMBLY_TIMING.gap > 0, true);
});

test('効果音のファイルがすべてあり、ローカルのファイルだけを使う', async () => {
  const { readFile, stat } = await import('node:fs/promises');
  const { SFX } = await import('../project-chrome/js/config.js');
  const base = new URL(SFX.dir, new URL('../project-chrome/', import.meta.url));
  let total = 0;
  for (const [name, file] of Object.entries(SFX.files)) {
    assert.match(file, /^[a-z-]+\.(mp3|wav)$/, `${name} はローカルのファイル名`);
    const info = await stat(new URL(file, base));
    total += info.size;
    const head = (await readFile(new URL(file, base))).subarray(0, 4).toString('latin1');
    assert.ok(file.endsWith('.wav') ? head === 'RIFF' : head.startsWith('ID3') || head.charCodeAt(0) === 0xff, `${file} の形式`);
  }
  for (const name of Object.keys(SFX.gain)) assert.ok(name in SFX.files, `gain の ${name} がファイル一覧にない`);
  assert.ok(total < 1024 * 1024, '効果音は合計 1 MB 未満');
});
