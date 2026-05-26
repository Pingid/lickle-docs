import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: { alias: { '@lickle/docs': '../src' } },
})
