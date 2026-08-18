import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Web lint config — added 2026-08-17, mirroring the backend's.
 *
 * 🔴 Why it exists: `npm run build` does NOT check this project's code. Vite
 * only bundles what is REACHABLE, so a batch of new files can compile "clean"
 * while being entirely unimported — which is exactly what happened to the M4
 * chat primitives. The build is a bundler, not a linter; this is the linter.
 *
 * The rules below are the project's own written rules made mechanical, so they
 * fail a command instead of relying on review.
 */
export default [
  { ignores: ['node_modules/**', 'dist/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /**
       * ⚠️ Severity split, deliberate (2026-08-17).
       *
       * `rules-of-hooks` stays an ERROR — a conditionally-called hook is a real
       * bug, always. But plugin v7's recommended set also carries the React
       * Compiler's style rules, and those fire 24 times across screens that have
       * been shipped and working for weeks. Making them errors would mean either
       * refactoring code nobody asked me to touch, or people learning to run
       * lint with a flag that ignores it — and a linter everyone bypasses
       * catches nothing.
       *
       * As warnings they stay visible for whoever next edits that file, without
       * blocking the command. Promote them once the flagged screens are
       * deliberately revisited.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // web-frontend.md: "No dead code, no commented-out blocks, no console.log
      // in committed code." There is no logger in the browser bundle, so the
      // ban is total rather than a level filter.
      'no-console': 'error',

      'no-restricted-syntax': [
        'error',
        {
          // web-frontend.md bans this outright — sanitised or not. React escapes
          // by default, and every string in this app is user-generated content
          // from a seller, a buyer or a chat message.
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'dangerouslySetInnerHTML is banned (web-frontend.md). Render user content as text — React escapes it.',
        },
        {
          selector: 'CallExpression[callee.name="eval"]',
          message: 'eval is banned (web-frontend.md).',
        },
      ],
    },
  },

  /**
   * A2 token storage. The access token lives in MEMORY ONLY and the refresh
   * token in an httpOnly cookie — an XSS that can read either from storage
   * defeats the whole scheme.
   *
   * Scoped to the auth layer on purpose: `localStorage` is legitimately used
   * elsewhere for recent search terms (owner carve-out, plain strings, nothing
   * sensitive), so a blanket ban would be wrong and would train people to
   * disable the rule.
   */
  {
    files: ['src/auth/**/*.{js,jsx}', 'src/api/**/*.{js,jsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'A2: tokens live in memory (access) and an httpOnly cookie (refresh). Never persist auth state to storage.',
        },
        {
          name: 'sessionStorage',
          message: 'A2: never persist auth state to storage.',
        },
      ],
    },
  },
];
