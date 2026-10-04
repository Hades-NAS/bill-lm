//  #ts-check

import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactPlugin from 'eslint-plugin-react'
import importPlugin from 'eslint-plugin-import'
import { tanstackConfig } from '@tanstack/eslint-config'

const typescriptEslintPlugin = tanstackConfig
  .map((config) => config.plugins?.['@typescript-eslint'])
  .find(Boolean)
const importEslintPlugin = tanstackConfig
  .map((config) => config.plugins?.import)
  .find(Boolean)

export default [
  ...tanstackConfig,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      // globals: {
      //   ...globals.browser,
      // },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
      // parser: tseslint.parser,
    },
    plugins: {
      ...(typescriptEslintPlugin
        ? { '@typescript-eslint': typescriptEslintPlugin }
        : {}),
      ...(importEslintPlugin ? { import: importEslintPlugin } : {}),
      react: reactPlugin,
      importPlugin: importPlugin,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'import/no-cycle': 'off',
      'sort-imports': 'off',
      'import/order': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/method-signature-style': 'warn',
      '@typescript-eslint/naming-convention': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      'import/consistent-type-specifier-style': 'warn',
      'import/no-duplicates': 'warn',
      'pnpm/json-enforce-catalog': 'off',
      'react/jsx-sort-props': [
        'warn',
        {
          locale: 'auto',
          callbacksLast: true,
          shorthandFirst: true,
        },
      ],
      'importPlugin/order': [
        'warn',
        {
          groups: [
            ['builtin', 'external'],
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            {
              pattern: '#mantine/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#prisma/client',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#trpc/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#tanstack/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/schema/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/integrations/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/store/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/lib/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/utils/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/hooks/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/constants/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/assets/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '#/components/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: './**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'apps/web/prisma/seed.ts',
      '.claude',
      '.agents',
      '.output',
      '.tanstack',
      'dist',
      'build',
      'node_modules',
    ],
  },
]
