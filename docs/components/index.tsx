import { defineComponents, LiveExample, createSolidRun, LinkMapProvider } from '@lickle/docs/ui'
import * as Docs from '@lickle/docs/ui'

// Everything `@lickle/docs/ui` exports is in scope for an example, which is what
// lets `<Breadcrumb id={useDeclaration()()!.id} />` be a whole preview on its own.
//
// The wrapper makes links inside a preview inert: `<Sidebar>` and `<Breadcrumb>`
// render real anchors, and clicking one would navigate away from the page you
// are reading it on. It wraps the preview only, so the caption and the editor
// beside it keep working links.
const run = createSolidRun(Docs, {
  wrapper: (p) => (
    <LinkMapProvider value={{ map: (link) => ({ ...link, href: '', onClick: (e) => e.preventDefault() }) }}>
      {p.children}
    </LinkMapProvider>
  ),
})

export default defineComponents({
  tag: (p) => {
    if (p.tag.kind !== '@example' || !p.tag.caption?.includes('preview')) return <p.Default {...p} />
    return <LiveExample tag={p.tag} run={run} transform={{ jsxPragma: 'h' }} />
  },
})
