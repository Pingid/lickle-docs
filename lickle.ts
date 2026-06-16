import { defineConfig, Layout, Transform } from './src/core/config/lib.ts'

export default defineConfig(() => ({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'tsx', 'bash'],
  include: (sf, d) => {
    if (sf.fileName.includes('solidjs/')) return false
    return d
  },
  versions: './docs/version/*.json',

  // Placement (filter + grouping) composes into `layout`; content mutation
  // lives in the separate `transform` phase.
  layout: Layout.compose(
    Layout.filter(keep),
    Layout.grouping(Layout.composeGroups(Layout.groupByKind, Layout.groupByTag('@group'), regroup)),
  ),
  transform: Transform.stripTags('@group'),
}))

// Which declarations to document.
const keep = (d: Layout.DeclarationFacade) => !d.tags.has('@internal') && d.exposure.is()

// Grouping policy: types/components buckets, then by @group tag.
const regroup = (d: Layout.DeclarationFacade, v: Layout.Group | undefined) => {
  if (d.kind === 'interface' || d.kind === 'type-alias') return { name: 'types', order: order(3, v) }
  if (Layout.is('function', d) && Layout.is('reference', d.raw.signatures?.[0]?.return)) {
    if (d.raw.signatures?.[0]?.return.name === 'Element') return { name: 'components', order: order(0, v) }
  }
  if (Layout.is('variable', d) && Layout.is('reference', d.raw.type)) {
    if (d.raw.type?.name === 'Component') return { name: 'components', order: order(0, v) }
  }
  if (v?.name === 'hooks') return { name: 'hooks', order: order(1, v) }
  if (v) return { name: v.name, order: order(v.order ?? 3, v) }
  return undefined
}
const order = (n: number, v?: { order?: number }) => n + (v?.order ?? 0)
