import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'dist/**'] },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Allow intentionally-unused args/vars when prefixed with _ (e.g. Express
      // error-handler arity, ignored callback params).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Ownership-scoping guard (tracker A6, decision C1): querying by _id alone
  // bypasses org scoping, so findById* is a build error in controllers and
  // services. Use scopedFilter(Model, id, req.user) with findOne/updateOne/etc.
  {
    files: ['src/controllers/**/*.js', 'src/services/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^findById(AndUpdate|AndDelete|AndRemove)?$/]",
          message:
            'Ownership scoping (A6): never query by _id alone. Use scopedFilter(Model, id, req.user) with findOne/updateOne/deleteOne.',
        },
      ],
    },
  },
];
