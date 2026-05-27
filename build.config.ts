import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({ externals: ['typescript', 'fast-glob', 'micromatch'], declaration: true })
