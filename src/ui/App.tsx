import { Match, Show, Switch, createMemo, type Component } from 'solid-js'
import type { RouteSectionProps } from '@solidjs/router'
import type { JSX } from 'solid-js/jsx-runtime'

import { ComponentsProvider, ThemeProvider, type Components, type Reflect } from './context/index.tsx'
import { DocsProvider, useDocActiveProject, type DocsInput } from './context/docs/index.tsx'
import { Route, useParams, Navigate, HashRouter } from './util/router.tsx'
import { Link, Page, Layout } from './components/index.ts'
import { Loading } from './components/Loading.tsx'
import { DocRouter } from './hooks/index.ts'

import { BASE_URL } from './util/base.ts'

export interface AppProps {
  /** Current URL when rendering on the server. */
  url?: string
  /** Project data — the generated `project.json`, or a multi-version `DocsJson`. */
  docs?: DocsInput
  /** Slot overrides built with `defineComponents`. */
  components?: Components
  /** Router implementation. Defaults to a hash router; pass `Router` from `@solidjs/router` for clean URLs. */
  Router?: Component<{
    children: JSX.Element
    root?: Component<{ children?: JSX.Element }>
    base?: string
    url?: string
  }>
}

/**
 * The complete documentation site as one component: theme, docs and
 * component providers, the router, and page rendering for every route. The
 * generated client entry mounts exactly this; render it yourself to embed
 * the docs in another app.
 *
 * Wrap it in a `LanguagesProvider` to enable syntax highlighting — it is
 * left outside `App` so the host controls which grammars are bundled.
 *
 * @example Mount the site against a generated `project.json`
 * ```tsx
 * import { render } from 'solid-js/web'
 * import { Router } from '@solidjs/router'
 * import { App, LanguagesProvider } from '@lickle/docs/ui'
 * import project from './docs/project.json'
 *
 * const langs = [{ name: 'ts', import: import('shiki/dist/langs/typescript.mjs') }]
 *
 * render(
 *   () => (
 *     <LanguagesProvider langs={() => langs}>
 *       <App docs={project} Router={Router} />
 *     </LanguagesProvider>
 *   ),
 *   document.getElementById('root')!,
 * )
 * ```
 */
export const App = (p: AppProps) => {
  const Router = p.Router ?? HashRouter
  return (
    <ThemeProvider>
      <DocsProvider value={p.docs ?? null}>
        <ComponentsProvider value={p.components}>
          <Router base={BASE_URL} url={p.url}>
            <Route path="/*slug" component={AppRoutes} />
          </Router>
        </ComponentsProvider>
      </DocsProvider>
    </ThemeProvider>
  )
}

const AppRoutes: Component<RouteSectionProps> = () => {
  const doc = useDocActiveProject()

  return (
    <Layout loading={doc.loading}>
      <Switch>
        <Match when={doc.current() !== null}>
          <ProjectPage />
        </Match>
        <Match when={doc.loading()}>
          <Loading />
        </Match>
        <Match when={doc.error()}>Error: {doc.error().message}</Match>
        <Match when={doc.current() === null}>
          <NotFound />
        </Match>
      </Switch>
    </Layout>
  )
}

/** Resolve the current `/*slug` path to a route and render its page. */
const ProjectPage = () => {
  const params = useParams()
  const router = DocRouter.use()
  const route = createMemo(() => router()?.get({ slug: params['slug'] ?? '' }))
  // A redirect-mode alias slug has no route of its own — send it to its canonical.
  const redirect = createMemo(() => (route() ? undefined : router()?.redirect(params['slug'] ?? '')))
  return (
    <Show when={route()} fallback={<Show when={redirect()} fallback={<Fallback slug={params['slug']} />}>
      {(to) => <Navigate href={to()} />}
    </Show>}>
      {(r) => <Page route={r()} />}
    </Show>
  )
}

/** First navigable slug in DFS order, descending through folders (which have none). */
const firstSlug = (groups?: Reflect.GroupedItems<Reflect.SidebarNode>[]): string | undefined => {
  for (const group of groups ?? [])
    for (const node of group.items) {
      if (node.kind !== 'folder') return node.slug
      const child = firstSlug(node.children)
      if (child) return child
    }
  return undefined
}

/** Empty path redirects to the first sidebar route; anything else is a miss. */
const Fallback = (props: { slug?: string }) => {
  const router = DocRouter.use()
  const first = createMemo(() => firstSlug(router()?.sidebar))
  return (
    <Show when={!props.slug && first()} fallback={<NotFound />}>
      {(slug) => <Navigate href={slug()} />}
    </Show>
  )
}

/** Fallback for routes that don't match a registered path. */
const NotFound = () => (
  <div class="py-20 text-center">
    <h1 class="text-2xl font-semibold mb-2">Not found</h1>
    <p class="text-mute">No page matches this URL.</p>
    <Link href="/">Back home</Link>
  </div>
)
