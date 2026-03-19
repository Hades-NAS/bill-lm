//  #ts-check

import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactPlugin from 'eslint-plugin-react'
import importPlugin from 'eslint-plugin-import'
import { tanstackConfig } from '@tanstack/eslint-config'

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
      react: reactPlugin,
      importPlugin: importPlugin,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'import/no-cycle': 'off',
      'sort-imports': 'off',
      'import/order': 'off',
      '#typescript-eslint/array-type': 'off',
      '#typescript-eslint/require-await': 'off',
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
    ignores: ['eslint.config.js', 'prettier.config.js', 'prisma/seed.ts'],
  },
]
