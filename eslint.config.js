const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
];
