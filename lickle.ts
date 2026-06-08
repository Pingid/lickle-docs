import { defineConfig, versions } from '@lickle/docs/config'

export default defineConfig({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'bash', 'tsx', 'bash'],
  include: (sf, d) => {
    if (sf.fileName.includes('solidjs/')) return false
    return d
  },
  versions: await versions({ tags: ['1dfd97'], prepare: 'pnpm install' }),
})
