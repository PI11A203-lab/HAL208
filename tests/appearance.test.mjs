import { test } from "node:test";
import assert from "node:assert/strict";
import { DESIGNS, DEMO_PRESETS } from "../project-chrome/js/config.js";
import {
  createAppearanceState, designToAppearance, sanitizeAppearance, selectPreset,
  editDraft, applyDraft, switchDesign, resetAppearance, isValidColor,
} from "../project-chrome/js/appearance.js";

const fresh = () => createAppearanceState(DESIGNS, DEMO_PRESETS);

test("色の検証: #rrggbbだけ有効", () => {
  assert.equal(isValidColor("#00e5ff"), true);
  for (const bad of ["00e5ff", "#00e5f", "#gggggg", "red", 123, null, undefined]) {
    assert.equal(isValidColor(bad), false, String(bad));
  }
});

test("範囲外は範囲内に丸め、NaN/Infinity/不正色は既定値のまま errors に残る", () => {
  const base = designToAppearance(DESIGNS.mk1);
  const { appearance, errors } = sanitizeAppearance(
    { metalness: 9, roughness: -3, glow: Infinity, shellColor: "zzz", jointColor: "#ABCDEF" }, base);
  assert.equal(appearance.metalness, 1);
  assert.equal(appearance.roughness, 0);
  assert.equal(appearance.glow, base.glow);
  assert.equal(appearance.shellColor, base.shellColor);
  assert.equal(appearance.jointColor, "#abcdef");
  assert.deepEqual(errors.sort(), ["glow", "shellColor"]);
  assert.equal(sanitizeAppearance({ glow: NaN }, base).errors[0], "glow");
});

test("全プリセットのdesignIdが存在し、2組以上・金属とマットの両方がある", () => {
  assert.ok(DEMO_PRESETS.length >= 2);
  for (const p of DEMO_PRESETS) assert.ok(DESIGNS[p.designId], p.id);
  assert.ok(DEMO_PRESETS.some((p) => p.appearance.metalness >= 0.5));
  assert.ok(DEMO_PRESETS.some((p) => p.appearance.metalness < 0.5));
});

test("プリセット選択でdraftが変わり、元の定数は変わらない", () => {
  const designsBefore = JSON.stringify(DESIGNS);
  const presetsBefore = JSON.stringify(DEMO_PRESETS);
  let s = selectPreset(fresh(), "demo-night");
  assert.equal(s.presetId, "demo-night");
  assert.equal(s.draft.metalness, 0.1);
  s = editDraft(s, { glow: 4 });
  const applied = applyDraft(s);
  assert.equal(applied.applied.glow, 4);
  assert.equal(JSON.stringify(DESIGNS), designsBefore);
  assert.equal(JSON.stringify(DEMO_PRESETS), presetsBefore);
});

test("編集中のdraftはAPPLYまで装備(applied)に反映されない", () => {
  const s0 = fresh();
  const s1 = editDraft(s0, { shellColor: "#ff0000" });
  assert.equal(s1.draft.shellColor, "#ff0000");
  assert.equal(s1.applied.shellColor, s0.applied.shellColor);
  assert.equal(applyDraft(s1).applied.shellColor, "#ff0000");
});

test("不明なプリセットは状態を変えずエラーにする", () => {
  const s0 = fresh();
  const s1 = selectPreset(s0, "nope");
  assert.deepEqual(s1.errors, ["unknown-preset"]);
  assert.deepEqual(s1.draft, s0.draft);
});

test("プリセット後に個別値を変えると custom、元の値へ戻すとプリセットに戻る", () => {
  let s = selectPreset(fresh(), "demo-chrome");
  assert.equal(s.presetId, "demo-chrome");
  s = editDraft(s, { roughness: 0.5 });
  assert.equal(s.presetId, "custom");
  s = editDraft(s, { roughness: 0.25 });
  assert.equal(s.presetId, "demo-chrome");
});

test("装備切替で外観とUI値が新しいデザインの既定値になる", () => {
  let s = editDraft(fresh(), { shellColor: "#123456" });
  s = switchDesign(s, "titan");
  assert.equal(s.designId, "titan");
  assert.deepEqual(s.applied, designToAppearance(DESIGNS.titan));
  assert.deepEqual(s.draft, s.applied);
  assert.equal(s.presetId, null);
  assert.deepEqual(switchDesign(s, "none").errors, ["unknown-design"]);
});

test("RESETでmk1の既定外観に戻り、appliedとdraftが一致する", () => {
  let s = selectPreset(fresh(), "demo-amber");
  s = applyDraft(s);
  s = resetAppearance(s);
  assert.equal(s.designId, "mk1");
  assert.deepEqual(s.applied, designToAppearance(DESIGNS.mk1));
  assert.deepEqual(s.draft, s.applied);
  assert.equal(s.presetId, null);
});