import type { PageModules } from '../../../ui/index.ts'

/**
 * Component page modules, keyed by project-relative path. Replaced at build
 * time by `plugin-pages` with one dynamic `import()` per `.tsx` page, so each
 * page ships as its own chunk. This stub is what the type checker sees.
 */
const modules: PageModules = {}

export default modules
