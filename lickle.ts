import { defineConfig, Place, Match, Select, Outline, Transform } from './src/core/config/lib.ts'

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
  layout: Place.compose(
    Place.defaultFilter,
    // The fallback bucket for anything the outline doesn't name: an explicit
    // `@group`, else the declaration's kind.
    Place.bucket(Select.first(Select.tag('@group'), Select.kind)),
    // The sidebar, in reading order. The first section to match a declaration
    // claims it, so the specific ones lead and the sweep trails.
    Outline.of(
      { name: 'Guides', include: Match.file('docs/**') },
      // Entrypoints and the namespaces they expose stay navigable; anything
      // deeper reads on the page above it.
      { name: 'API', include: Match.isEntry(), depth: 2, beyond: 'inline' },
      { name: 'modules' },
      {
        name: 'components',
        include: Match.any(
          Match.tag('@group', 'components'),
          Match.kind('function', { signatures: { return: { reference: { name: 'Element' } } } }),
          Match.kind('function', { signatures: { return: { reference: { name: 'Component' } } } }),
          Match.kind('variable', { type: { reference: { name: 'Element' } } }),
          Match.kind('variable', { type: { reference: { name: 'Component' } } }),
        ),
      },
      { name: 'hooks', include: Match.tag('@group', 'hooks') },
      // Types keep their pages — signatures link to them — but stay out of the
      // sidebar, which is about what you'd go looking for.
      { name: 'types', include: Match.kinds('interface', 'type-alias'), nav: false },
      { name: /.+/ },
    ),
    // Which declarations earn a page of their own; the rest read inline on their
    // parent's page. The layout presets are the API this site is about, so they
    // keep theirs.
    Place.pagesFor(
      Match.any(
        Match.bucket('components', 'hooks', 'modules', 'types'),
        Match.kinds('interface', 'type-alias'),
        Match.file('src/core/layout/**/*.ts'),
      ),
    ),
  ),
  transform: Transform.stripTags('@group'),
}))
