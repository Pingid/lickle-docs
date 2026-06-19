import { defineConfig, Place, Match, Select, Transform } from './src/core/config/lib.ts'

export default defineConfig(() => ({
  name: '@lickle/docs',
  tsconfig: './tsconfig.esm.json',
  languages: ['ts', 'tsx', 'bash'],
  include: (sf, d) => (sf.fileName.includes('solidjs/') ? false : d),
  versions: './docs/version/*.json',
  layout: Place.compose(
    Place.filter(Match.all(Match.exposed(), Match.not(Match.tag('@internal')))),
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
    Place.bucketOrder('modules', 'components', 'hooks', 'modules', 'types', /.*/),
    Place.visibility(
      Match.all(
        Match.not(Match.bucket('components', 'hooks', 'modules'), Match.file('*/layout/**/*.ts')),
        Match.kinds('function', 'variable'),
      ),
      { inline: true },
    ),
    Place.visibility(Match.kinds('type-alias', 'interface'), { nav: false }),
  ),
  transform: Transform.stripTags('@group'),
}))
