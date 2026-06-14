import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'android/**',
      'ios/**',
      'dist/**',
      '**/dist/**',
      'node_modules/**',
      '.codex-temp/**',
      '.agent/**',
      'vite.log',
      'vite.err',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'preserve-caught-error': 'off',
    },
  },
  {
    // admin-backend la Node/Express, khong phai React. "usePostgresBackend"
    // chi la ham thuong (ten bat dau bang "use") nen react-hooks bao nham.
    files: ['admin-backend/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // Dashboard admin la script trinh duyet, dung pattern window.fn = ... roi
    // goi bare fn() -> no-undef bao nham. Khai bao moi truong browser.
    files: ['admin-backend/public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  eslintConfigPrettier
);
