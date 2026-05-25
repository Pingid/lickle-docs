import type { Components } from '../ui/context/components.tsx'
import type { ConfigJson } from './types.ts'
export type * from './types.ts'

export const defineConfig = <C extends ConfigJson | (() => ConfigJson) | (() => Promise<ConfigJson>)>(config: C) => {
  const c = typeof config === 'function' ? config() : config
  return Promise.resolve(c)
}

export const defineComponents = <C extends Components>(components: C) => components
