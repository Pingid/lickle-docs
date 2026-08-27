import { createContext, useContext, lazy, type Component, type ParentComponent } from 'solid-js'

import type { ComponentPage } from '../../core/layout/types.ts'

/**
 * What a component page receives when it renders. Everything else it needs it
 * reads from context — a page module renders inside the same providers the
 * stock pages do, so `useProject`, `useDocRouter`, `useTheme` and the exported
 * components all work inside it.
 */
export interface PageProps {
  /** The route being rendered, including its title and module path. */
  route: ComponentPage
}

/**
 * How a component page's module is obtained: a loader returning the module,
 * synchronously or as a promise. The build writes one dynamic `import()` per
 * page, so each page is its own chunk; a host embedding the UI can hand over a
 * component it already has with `() => ({ default: MyPage })`.
 *
 * Always a loader, never a bare component — a Solid component *is* a function,
 * so the two could not be told apart without calling one of them.
 */
export type PageModule = () => Promise<{ default: Component<PageProps> }> | { default: Component<PageProps> }

/** Component page modules by their project-relative path — the `ComponentPage.module` key. */
export type PageModules = Record<string, PageModule>

const PagesContext = createContext<PageModules>({})

/**
 * Supply the component modules that back `.tsx` pages. The generated client
 * passes the map the bundler produced; pass your own to render component pages
 * when embedding the UI by hand.
  * @group providers
 */
export const PagesProvider: ParentComponent<{ value?: PageModules }> = (p) => (
  <PagesContext.Provider value={p.value ?? {}}>{p.children}</PagesContext.Provider>
)

/**
 * The component page modules in scope.
 * @group hooks
 */
export const usePageModules = (): PageModules => useContext(PagesContext)

// One `lazy` per module path: `lazy` memoises its own load, so re-creating it
// on every render would defeat that and re-suspend on each navigation.
const cache = new Map<PageModule, Component<PageProps>>()

/**
 * Resolve a page module to a renderable component, suspending while it loads.
 * `undefined` when no module is registered for that path — which is the normal
 * case for an older version's data, since a published `project.json` carries
 * page *paths* but not the code behind them.
  * @group hooks
 */
export const usePageComponent = (module: string): Component<PageProps> | undefined => {
  const entry = usePageModules()[module]
  if (!entry) return undefined
  const hit = cache.get(entry)
  if (hit) return hit
  const resolved = lazy(async () => await entry())
  cache.set(entry, resolved)
  return resolved
}
