import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'docs', 'supabase', 'node_modules', 'test-results', 'playwright-report'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Only services/ may talk to the network or Supabase (CLAUDE.md).
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Use a module in src/services/.' }],
    },
  },
  {
    files: ['src/services/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // The server's one gateway to published data (D-095), like src/services/ for the app.
    files: ['api/_lib/data.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-restricted-globals': 'off' },
  },
);
