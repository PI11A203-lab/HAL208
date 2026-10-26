import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBranch } from '../scripts/check-pr.mjs';

function pr(base, head, headRepo = 'PI11A203-lab/HAL208') {
  return {
    base: { ref: base, repo: { full_name: 'PI11A203-lab/HAL208' } },
    head: { ref: head, repo: { full_name: headRepo } },
  };
}

test('通常の作業PRとdevelopからの最終PRを許可する', () => {
  assert.deepEqual(validateBranch(pr('develop', 'feat/12-title-screen')), []);
  assert.deepEqual(validateBranch(pr('develop', 'feature/title-screen')), []);
  assert.deepEqual(validateBranch(pr('main', 'develop')), []);
});

test('作業ブランチからmainへの飛び越しを拒否する', () => {
  assert.ok(validateBranch(pr('main', 'fix/23-camera')).length);
});

test('forkでdevelopと名付けてもmainへ直接入れない', () => {
  assert.ok(validateBranch(pr('main', 'develop', 'other/fork')).length);
  const missingRepo = pr('main', 'develop');
  missingRepo.head.repo = null;
  assert.ok(validateBranch(missingRepo).length);
});

test('統合ブランチの逆向きPR・不正な作業名・不明なbaseを拒否する', () => {
  for (const input of [pr('develop', 'main'), pr('develop', 'personal'), pr('other', 'fix/1-camera'), null]) {
    assert.ok(validateBranch(input).length);
  }
});
