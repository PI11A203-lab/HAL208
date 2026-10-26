import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'espree';

const root = new URL('../project-chrome/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const importMap = JSON.parse(html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/)[1]);
const files = (await readdir(new URL('js/', root))).filter((name) => name.endsWith('.js'));
const modules = new Map();
for (const name of files) {
  const url = new URL(`js/${name}`, root);
  const source = await readFile(url, 'utf8');
  modules.set(url.href, parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
}

test('HTMLから読み込むローカルCSS・スクリプトが存在する', async () => {
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)];
  assert.ok(refs.length >= 2, 'CSSとエントリースクリプトが必要です');
  for (const [, ref] of refs) {
    if (/^https?:/.test(ref)) continue;
    assert.ok((await stat(new URL(ref, root))).isFile(), `${ref} がありません`);
  }
});

test('モジュールのimport先と名前付きexportがつながっている', async () => {
  for (const [href, ast] of modules) {
    for (const node of ast.body.filter((node) => node.type === 'ImportDeclaration')) {
      const specifier = node.source.value;
      if (/^https?:/.test(specifier)) continue; // CDNの稼働は毎PRの必須検査にしない。
      if (!specifier.startsWith('.')) {
        assert.ok(Object.keys(importMap.imports).some((key) =>
          key.endsWith('/') ? specifier.startsWith(key) : specifier === key),
        `${specifier} のimportmapがありません`);
        continue;
      }
      const target = new URL(specifier, href);
      assert.ok((await stat(target)).isFile(), `${fileURLToPath(target)} がありません`);
      const targetAst = modules.get(target.href);
      assert.ok(targetAst, `${specifier} は検査対象のJSモジュールである必要があります`);
      const exports = new Set();
      for (const entry of targetAst.body) {
        if (entry.type !== 'ExportNamedDeclaration') continue;
        if (entry.declaration?.id) exports.add(entry.declaration.id.name);
        for (const declaration of entry.declaration?.declarations ?? []) exports.add(declaration.id.name);
        for (const spec of entry.specifiers ?? []) exports.add(spec.exported.name);
      }
      for (const spec of node.specifiers.filter((spec) => spec.type === 'ImportSpecifier')) {
        assert.ok(exports.has(spec.imported.name), `${specifier} に ${spec.imported.name} がありません`);
      }
    }
  }
});

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (node.type) callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, callback));
    else if (value && typeof value === 'object') visit(value, callback);
  }
}

test('固定IDで参照するUI要素がHTMLにあり、IDが重複しない', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTMLのIDが重複しています');
  for (const ast of modules.values()) {
    visit(ast, (node) => {
      if (node.type !== 'CallExpression') return;
      const isLookup = node.callee.name === '$' ||
        (node.callee.type === 'MemberExpression' && node.callee.object.name === 'document' &&
          node.callee.property.name === 'getElementById');
      const argument = node.arguments[0];
      if (isLookup && argument?.type === 'Literal' && typeof argument.value === 'string') {
        assert.ok(ids.includes(argument.value), `HTMLにID ${argument.value} がありません`);
      }
    });
  }
});
