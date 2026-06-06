import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'bash', 'tsx', 'bash'],
  include: (sf) => !sf.fileName.includes('solidjs/'),
})
