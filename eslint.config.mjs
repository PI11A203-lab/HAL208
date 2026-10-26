import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['project-chrome/js/**/*.js'],
    languageOptions: { globals: globals.browser },
    // 試作中の補助関数・計測値は許容し、実行時エラーにつながる規則を優先する。
    rules: { 'no-unused-vars': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
];
