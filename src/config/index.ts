import type { Components } from '../ui/context/components.tsx'
import type { UserConfig } from './types.ts'
export type * from './types.ts'

export const defineConfig = (config: UserConfig | (() => UserConfig) | (() => Promise<UserConfig>)) => {
  const c = typeof config === 'function' ? config() : config
  return Promise.resolve(c)
}

export const defineComponents = <C extends Components>(components: C) => components
