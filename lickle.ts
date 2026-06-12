import { defineConfig, Adapter } from './src/config/index.ts'

export default defineConfig({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'tsx', 'bash'],
  include: (sf, d) => {
    if (sf.fileName.includes('solidjs/')) return false
    return d
  },
  versions: './docs/version/*.json',
  provider: Adapter.compose(
    Adapter.filter((d) => !d.tags.has('@internal')),
    Adapter.groupByTag('@group'),
    Adapter.mapComment((c) => ({ ...c, tags: c.tags?.filter((t) => t.tag !== '@group') })),
    // Adapter.section('essentials', ['defineConfig', 'defineComponents', 'LiveExample']),
  ),
})
