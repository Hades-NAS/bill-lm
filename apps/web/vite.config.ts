import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

const config = defineConfig(({ mode }) => ({
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  // Health injects its explicit fixture through the process environment. Do
  // not merge repository-local .env files into build, test, or dev processes.
  envDir: false,
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: [resolve(import.meta.dirname, 'tsconfig.json')] }),
    tailwindcss(),
    ...(mode === 'test' ? [] : [tanstackStart()]),
    viteReact(
      mode === 'test'
        ? undefined
        : {
            babel: {
              plugins: ['babel-plugin-react-compiler'],
            },
          },
    ),
  ],
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', '.opencode/**'],
    server: {
      deps: {
        inline: ['react', 'react-dom', '@testing-library/react'],
      },
    },
  },
}))

export default config
