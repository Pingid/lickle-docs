import { Match, Show, Switch, createMemo, type Component } from 'solid-js'
import type { RouteSectionProps } from '@solidjs/router'
import type { JSX } from 'solid-js/jsx-runtime'

import { ComponentsProvider, ProjectProvider, ThemeProvider, useProject, type Components } from './context/index.tsx'
import { DocsProvider, useDocActiveProject, type DocsInput } from './context/doc/index.tsx'
import { Route, useParams, Navigate, HashRouter } from './context/router.tsx'
import { MarkdownProvider } from './context/markdown/index.tsx'
import { Link, Page, Layout } from './components/index.ts'
import { Loading } from './components/Loading.tsx'

import { BASE_URL } from './util/base.ts'

export interface AppProps {
  docs?: DocsInput
  components?: Components
  Router?: Component<{ children: JSX.Element; root?: Component<{ children?: JSX.Element }>; base?: string }>
}

export const App = (p: AppProps) => {
  const Router = p.Router ?? HashRouter
  return (
    <DocsProvider value={p.docs ?? null}>
      <ComponentsProvider value={p.components}>
        <Router base={BASE_URL}>
          <Route path="/*slug" component={AppRoutes} />
        </Router>
      </ComponentsProvider>
    </DocsProvider>
  )
}

const AppRoutes: Component<RouteSectionProps> = () => {
  const doc = useDocActiveProject()

  return (
    <MarkdownProvider>
      <ThemeProvider>
        <ProjectProvider json={() => doc.current() ?? null} base={doc.version()?.slug}>
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
        </ProjectProvider>
      </ThemeProvider>
    </MarkdownProvider>
  )
}

/** Resolve the current `/*slug` path to a route and render its page. */
const ProjectPage = () => {
  const params = useParams()
  const project = useProject()
  const route = createMemo(() => project()?.routes.get({ slug: params['slug'] ?? '' }))
  return (
    <Show when={route()} fallback={<Fallback slug={params['slug']} />}>
      {(r) => <Page route={r()} />}
    </Show>
  )
}

/** Empty path redirects to the first sidebar route; anything else is a miss. */
const Fallback = (props: { slug?: string }) => {
  const project = useProject()
  const first = createMemo(() => project()?.routes.sidebar[0]?.items?.[0]?.slug)
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
