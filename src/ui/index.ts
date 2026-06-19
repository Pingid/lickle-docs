/**
 * The SolidJS interface to the documentation site.
 *
 * Most projects never import this module — the CLI builds and mounts the
 * site on its own. Import it to customise rendering or to embed the docs UI
 * in another app. It is organised in three layers:
 *
 * - **Providers** put data in context: `DocsProvider` (project data),
 *   `LanguagesProvider` (syntax highlighting), `ThemeProvider` (light/dark)
 *   and `ComponentsProvider` (slot overrides).
 * - **Hooks** read that context: `useProject` (declaration lookups),
 *   `useDocRouter` (routes and sidebar), `useSearch`, `useTheme`, ….
 * - **Components** render it: `App` is the whole site; `Layout`, `Page`,
 *   `Declaration`, `Comment`, … are the stock renderers it dispatches to.
 *
 * The usual entry point is `defineComponents`: replace a named slot — keep
 * the rest of the site stock — from the file the config's `components` field
 * points at. Pair it with `LiveExample` to turn `@example` blocks into
 * editable, runnable previews.
 *
 * @example Override the `tag` slot to run `@example` blocks (docs/index.tsx)
 * ```tsx
 * import { defineComponents, LiveExample } from '@lickle/docs/ui'
 *
 * const run = (code: string, host: HTMLElement) => new Function('host', code)(host)
 *
 * export default defineComponents({
 *   tag: (props) =>
 *     props.tag.tag === '@example' ? (
 *       <LiveExample tag={props.tag} run={run} transform={{}} />
 *     ) : (
 *       <props.Default {...props} />
 *     ),
 * })
 * ```
 */
export {
  useDocActiveProject,
  useTheme,
  useComponents,
  ThemeProvider,
  ComponentsProvider,
  DocsProvider,
  useDocs,
  useDocVersions,
  useDocVersionsCurrent,
  defineComponents,
  LanguagesProvider,
  loadHighlighter,
  type Reflect,
} from './context/index.tsx'
export { useCodeHighlight, useSearch, useCommentMarkdown, useRoute, useProject, useDeclaration } from './hooks/index.ts'
export { withBaseUrl } from './util/base.ts'
export * from './components/index.ts'
export * from './App.tsx'
