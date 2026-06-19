/**
 * Project configuration for the documentation generator.
 *
 * Configuration is optional. Without it the CLI infers everything from
 * `package.json` (name, version, entrypoints via `main` / `exports`), git
 * (repository links) and `README.md` (home page). To customise, add a
 * `lickle.ts` (or `.js` / `.mjs` / `.json`) to the project root and
 * default-export the result of {@link defineConfig}.
 *
 * `UserConfig` documents every field. Page generation — which declarations get
 * pages, their slugs and how the sidebar is grouped — is customised through the
 * {@link Layout} namespace and the `layout` field, with content tweaks via the
 * {@link Transform} namespace and the `transform` field.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@lickle/docs/config'
 *
 * export default defineConfig({
 *   name: 'My Library',
 *   languages: ['ts', 'tsx', 'bash'],
 *   pages: [{ title: 'Overview', content: './README.md' }],
 *   components: './docs/index.tsx',
 * })
 * ```
 */
import type { UserConfig } from './types.ts'
export type * from './types.ts'

export * as Transform from '../layout/transform.ts'
export * from '../layout/layout/index.ts'

/**
 * Declare the project configuration with type checking.
 *
 * Accepts the config object directly, or a function (sync or async)
 * returning it for values computed at load time. `name` is the only
 * required field; everything else falls back to `package.json`, git and
 * conventional files — see {@link UserConfig} for the defaults.
 *
 * @param config Configuration object, or a factory producing one.
 * @returns A promise of the configuration, as the CLI consumes it.
 *
 * @example Static configuration
 * ```ts
 * import { defineConfig } from '@lickle/docs/config'
 *
 * export default defineConfig({ name: 'My Library' })
 * ```
 *
 * @example Computed configuration
 * ```ts
 * import { defineConfig } from '@lickle/docs/config'
 *
 * export default defineConfig(async () => ({
 *   name: 'My Library',
 *   version: await readVersionFromChangelog(),
 * }))
 * ```
 */
export const defineConfig = (config: UserConfig | (() => UserConfig) | (() => Promise<UserConfig>)) =>
  Promise.resolve().then(() => {
    const c = typeof config === 'function' ? config() : config
    return Promise.resolve(c)
  })
