import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// マージできる人の制限はGitHub Ruleset側で行う。この検査はPRの向きだけを確認する。
export function validateBranch(pr) {
  const base = pr?.base?.ref;
  const head = pr?.head?.ref;
  if (base === 'main') {
    if (head !== 'develop' || !pr.base.repo?.full_name ||
        pr.head.repo?.full_name !== pr.base.repo.full_name) {
      return ['mainへのPRは同じリポジトリのdevelopから作成してください。'];
    }
    return [];
  }
  if (base === 'develop') {
    if (!/^(feat|feature|fix|docs|refactor|test|chore)\/[a-z0-9][a-z0-9-]*$/.test(head ?? '')) {
      return ['developへのPRはfeat/12-title-screen等の作業ブランチから作成してください。'];
    }
    return [];
  }
  return ['PR先はdevelop、最終確認時のみmainにしてください。'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error('GitHub ActionsのPRイベントから実行してください。');
    process.exitCode = 1;
  } else {
    const errors = validateBranch(JSON.parse(readFileSync(eventPath, 'utf8')).pull_request);
    errors.forEach((error) => console.error(error));
    process.exitCode = errors.length ? 1 : 0;
    if (!errors.length) console.log('PRのブランチ構成を確認しました。');
  }
}
