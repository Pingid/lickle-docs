import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  provider: {
    route: (r, d) => {
      if (d.srcFile.includes('solidjs/')) return undefined
      return r
    },
  },
})
