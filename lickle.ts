import { defineConfig, Adapter } from '@lickle/docs/config'

/** Areas of the `ui` module, replacing kind buckets with by-purpose groups. */
const AREAS: [RegExp, { name: string; order: number }][] = [
  [/^ui\/(components|App)/, { name: 'components', order: 10 }],
  [/^ui\/hooks/, { name: 'hooks', order: 11 }],
  [/^ui\/context/, { name: 'context', order: 12 }],
  [/^ui\/util/, { name: 'helpers', order: 13 }],
]

export default defineConfig({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'tsx', 'bash'],
  include: (sf, d) => {
    if (sf.fileName.includes('solidjs/')) return false
    return d
  },
  versions: './docs/version/*.json',
  provider: Adapter.groupBy((d, cx, group) => {
    // Keep modules/namespaces (and entrypoints) in their kind groups so the
    // Modules / Namespaces sections stay first.
    if (d.isEntry() || d.kind === 'module' || d.kind === 'namespace') return group ?? { name: '' }
    // Areas apply to direct exports of an entrypoint only; members of nested
    // modules/namespaces keep their kind buckets.

    const direct = cx.docs.exposures(d.id).some((p) => p.length === 1)
    if (!direct) return group ?? { name: '' }
    const srcFile = d.sources[0]?.file ?? ''
    if (srcFile.startsWith('ui/') && /^use[A-Z]/.test(d.name)) return { name: 'hooks', order: 11 }
    for (const [match, area] of AREAS) if (match.test(srcFile)) return area
    return group ?? { name: '' }
  }),
})
