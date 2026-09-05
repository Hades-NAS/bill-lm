import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

const config = defineConfig(({ mode }) => ({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
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
