/**
 * @description Configuration for the documentation site.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@lickle/docs/config'
 *
 * export default defineConfig({
 *   name: 'My Project',
 *   version: '1.0.0',
 * })
 * ```
 *
 */
import type { UserConfig } from '../core/config/types.ts'
export type * from '../core/config/types.ts'

export * as Adapter from '../core/route/adapter/index.ts'

export const defineConfig = (config: UserConfig | (() => UserConfig) | (() => Promise<UserConfig>)) => {
  const c = typeof config === 'function' ? config() : config
  return Promise.resolve(c)
}

export * from './versions.ts'
