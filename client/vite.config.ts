import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vite'

/** Fallback alias so `pnpm --filter lickle-docs dev` works without the CLI plugin. */
const defaultCss = fileURLToPath(new URL('./src/index.css', import.meta.url))

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: { alias: { 'lickle:docs-css': defaultCss } },
})
