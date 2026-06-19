import { Show } from 'solid-js'

import { useSlugFor } from '../hooks/index.ts'
import { A } from '../util/router.tsx'
import { Syntax } from './Syntax.tsx'

/** Router-aware underlined link for in-site navigation. `Link.Type` and `Link.ByName` resolve declarations to pages. */
export const Link = (props: { href: string; children: string }) => {
  const href = () => (props.href.startsWith('//') ? props.href.slice(1) : props.href === '' ? '/' : props.href)

  return (
    <A href={href()} class="underline decoration-line underline-offset-[3px] hover:opacity-70">
      {props.children}
    </A>
  )
}

/**
 * Link to an in-project declaration by id, with a fallback rendering when
 * the target isn't resolvable. The `?` prefix marks anonymous external
 * references the resolver couldn't anchor to anything.
 */
Link.Type = (props: {
  id?: number
  name: string
  external?: 'stdlib' | 'package' | 'anonymous' | 'type-parameter'
}) => {
  const slugs = useSlugFor()
  const slug = () => (props.id != null ? slugs.byId(props.id) : undefined)
  return (
    <>
      <Show when={props.external === 'anonymous'}>
        <Syntax.Punct>?</Syntax.Punct>
      </Show>
      <Show when={slug()} fallback={<Syntax.Name>{props.name}</Syntax.Name>}>
        <Link href={`/${slug()}`}>{props.name}</Link>
      </Show>
    </>
  )
}

/** Link to a declaration by (qualified) name — `Foo` or `Foo.bar` — falling back to plain text when nothing resolves. */
Link.ByName = (props: { name: string }) => {
  const slugs = useSlugFor()
  const slug = () => slugs.byName(props.name)
  return (
    <Show when={slug()} fallback={<Syntax.Name>{props.name}</Syntax.Name>}>
      <Link href={`/${slug()}`}>{props.name}</Link>
    </Show>
  )
}
