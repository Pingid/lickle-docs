import type { Route, DocStatement, DocReferenced, MarkdownBody } from '../../core/client/index.ts'

/** The primary declaration body of a route, if it renders a declaration. */
export const docStatement = (route: Route): DocStatement | undefined =>
  route.body.find((b): b is DocStatement => b.kind === 'doc:statement')

/** The "used in" backlink body of a route, if any. */
export const docReferenced = (route: Route): DocReferenced | undefined =>
  route.body.find((b): b is DocReferenced => b.kind === 'doc:referenced')

/** The markdown body of a route, if it renders prose. */
export const markdownBody = (route: Route): MarkdownBody | undefined =>
  route.body.find((b): b is MarkdownBody => b.kind === 'markdown')
