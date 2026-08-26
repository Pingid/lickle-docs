import { defineConfig, Place, Match, Select, Transform } from './src/core/config/lib.ts'

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
    Place.bucket(Select.kind),
    Place.bucket(Match.kinds('interface', 'type-alias'), 'types'),
    Place.bucket(Select.tag('@group')),
    Place.bucket(
      Match.any(
        Match.kind('function', { signatures: { return: { reference: { name: 'Element' } } } }),
        Match.kind('function', { signatures: { return: { reference: { name: 'Component' } } } }),
        Match.kind('variable', { type: { reference: { name: 'Element' } } }),
        Match.kind('variable', { type: { reference: { name: 'Component' } } }),
      ),
      'components',
    ),
    // After `Select.kind`, which buckets entrypoints as '' — later layers win.
    Place.bucket(Match.isEntry(), 'API'),
    // Root sections in reading order; the unnamed bucket (Overview) always
    // leads, since it has no heading to sit under.
    Place.bucketOrder('Guides', 'API', 'modules', 'components', 'hooks', 'types', /.*/),
    Place.visibility(
      Match.all(
        Match.not(Match.bucket('components', 'hooks', 'modules'), Match.file('src/core/layout/**/*.ts')),
        Match.kinds('function', 'variable'),
      ),
      { inline: true },
    ),
    Place.visibility(Match.kinds('type-alias', 'interface'), { nav: false }),
  ),
  transform: Transform.stripTags('@group'),
}))
