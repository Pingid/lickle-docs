import { defineConfig, Page, Place, Match, Select, Transform } from './src/core/config/lib.ts'

/** `export * from './primitives'` flattens this module away; naming it as a row puts it back. */
const PRIMITIVES = Match.file('src/ui/primitives/index.ts')

export default defineConfig(() => ({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'tsx', 'bash'],
  include: (file, keep) => (file.relative.startsWith('src/solidjs/') ? false : keep),
  versions: './docs/version/*.json',
  pages: [
    { title: 'Overview', content: './README.md', slug: '/' },
    { glob: './docs/guides/*.md', folder: false },
    { title: 'Layout playground', content: './docs/playground/index.tsx', order: 99 },
  ],
  components: './docs/components/index.tsx',
  // The tree IS the sidebar: what is written here, in this order, is what
  // renders. Sources the tree doesn't reach keep their pages but no rows;
  // which pages exist at all is still `defaultFilter`'s call.
  layout: Place.compose(
    Place.defaultFilter,
    Page.roots(
      Page.nav('Overview', Match.file('README.md')),
      Page.section('Guides', Page.children(Match.file('docs/**'))),
      Page.section(
        'API',
        Page.nav(
          'config',
          Match.entry('config'),
          Page.bucket(Select.kind),
          // Namespaces and their members stay navigable; anything deeper
          // reads on the page above it.
          Page.depth(2, 'inline'),
        ),
        Page.nav(
          'ui',
          Match.entry('ui'),
          // 55 presentational components, read on one page rather than as 55
          // sidebar rows: gathered onto the revived primitives module.
          Page.nav('primitives', PRIMITIVES, Page.children(Match.tag('@group', 'primitives')), Page.inline),
          // Reading order: set the site up, render it, read from it, then customise.
          Page.bucket(Select.first(Select.tag('@group'), Select.kind)),
          Page.layer(
            Place.bucketOrder(
              'modules',
              'providers',
              'chrome',
              'reflection',
              'content',
              'hooks',
              'slots',
              'previews',
              'utilities',
              /.+/,
            ),
          ),
          Page.depth(2, 'inline'),
        ),
      ),
    ),
    // Types keep their pages — signatures link to them — but stay out of the
    // sidebar, which is about what you'd go looking for.
    Place.visibility(Match.kinds('interface', 'type-alias'), { nav: false }),
  ),
  transform: Transform.stripTags('@group'),
}))
