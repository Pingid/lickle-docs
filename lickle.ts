import { defineConfig, Place, Match, Select, Outline, Transform } from './src/core/config/lib.ts'

/** `export * from './primitives'` flattens this module away; the layout puts it back. */
const PRIMITIVES = Match.file('src/ui/primitives/index.ts')

export default defineConfig(() => ({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'tsx', 'bash'],
  include: (file, keep) => (file.relative.startsWith('src/solidjs/') ? false : keep),
  versions: './docs/version/*.json',
  pages: [
    { title: 'Overview', content: './README.md', slug: '/' },
    { glob: './docs/guides/*.md', group: 'Guides', folder: false },
    { title: 'Layout playground', content: './docs/playground/index.tsx', group: 'Guides', order: 99 },
  ],
  components: './docs/components/index.tsx',
  layout: Place.compose(
    Place.defaultFilter,
    // Every declaration's bucket: an explicit `@group`, else its kind. The
    // outline below only has to put those buckets in order.
    Place.bucket(Select.first(Select.tag('@group'), Select.kind)),
    // The sidebar, in reading order. Sections that only position a bucket the
    // layer above assigned are bare names; the rest say what they claim.
    Outline.of(
      { name: 'Guides', include: Match.file('docs/**') },
      // Entrypoints and the namespaces they expose stay navigable; anything
      // deeper reads on the page above it.
      { name: 'API', include: Match.isEntry(), depth: 2, beyond: 'inline' },
      // 55 presentational components, read on one page rather than as 55
      // sidebar rows. `into` hosts them on the module that declares them.
      { name: 'primitives', include: Match.tag('@group', 'primitives'), into: PRIMITIVES },
      // Reading order: set the site up, render it, read from it, then customise.
      'modules',
      'providers',
      'chrome',
      'reflection',
      'content',
      'hooks',
      'slots',
      'previews',
      'utilities',
      // Types keep their pages — signatures link to them — but stay out of the
      // sidebar, which is about what you'd go looking for.
      { name: 'types', include: Match.kinds('interface', 'type-alias'), nav: false },
      { name: /.+/ },
    ),
    // Where the primitives' host page itself sits. After the outline, which is
    // what revived the module `export *` had flattened away.
    Place.into(PRIMITIVES, Match.entry('ui')),
    Place.rename(PRIMITIVES, 'primitives'),
  ),
  transform: Transform.stripTags('@group'),
}))
