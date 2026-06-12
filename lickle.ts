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
    Adapter.groupBy((d, v) => {
      if (d.kind === 'interface' || d.kind === 'type-alias') return { name: 'types', order: v?.order }
      if (Adapter.match('function', d) && Adapter.match('reference', d.raw.signatures?.[0]?.return)) {
        const sig = d.raw.signatures?.[0]?.return
        if (sig.name === 'Element') return { name: 'components', order: v?.order }
      }
      if (Adapter.match('variable', d) && Adapter.match('reference', d.raw.type)) {
        if (d.raw.type.name === 'Component') return { name: 'components', order: v?.order }
      }
      return v
    }),
    Adapter.groupByTag('@group'),
    Adapter.mapComment((c) => ({ ...c, tags: c.tags?.filter((t) => t.tag !== '@group') })),
  ),
})
