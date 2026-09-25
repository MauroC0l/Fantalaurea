/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * GitHub Pages has no rewrites: it answers an unknown path (/Fantalaurea/bacheca) with 404.html.
 * A copy of index.html there starts the app at that path (ADR 0017).
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    apply: 'build',
    closeBundle() {
      copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'))
    },
  }
}

export default defineConfig({
  // Absolute: with real paths, /Fantalaurea/giocatore/<id> must still find /Fantalaurea/assets.
  base: process.env.BASE_PATH ?? '/',
  plugins: [svelte(), spaFallback()],
  server: { host: true },
  test: { include: ['src/**/*.test.ts'] },
})
