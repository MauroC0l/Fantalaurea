/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base: the build works under any sub-path (e.g. GitHub Pages /Fantalaurea/).
  base: './',
  plugins: [svelte()],
  server: { host: true },
  test: { include: ['src/**/*.test.ts'] },
})
