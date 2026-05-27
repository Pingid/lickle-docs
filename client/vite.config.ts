import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: { alias: { '@lickle/docs': path.resolve('../src') } },
})
