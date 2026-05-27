import { Show } from 'solid-js'
import { A } from '@solidjs/router'

import type * as docs from '../../core/client.ts'

import { useSlugFor } from '../hooks/index.js'

/** Muted punctuation — brackets, commas, `=`, etc. */
export const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>

/** Accent keyword — `const`, `type`, `extends`, intrinsics. */
export const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

/** Default-styled identifier. */
export const Name = (p: { children: string }) => <span>{p.children}</span>

/**
 * Link to an in-project declaration by id, with a fallback rendering when
 * the target isn't resolvable. The `?` prefix marks anonymous external
 * references the resolver couldn't anchor to anything.
 */
export const TypeLink = (props: { id?: number; name: string; external?: docs.Reference['external'] }) => {
  const slugs = useSlugFor()
  const slug = () => (props.id != null ? slugs.byId(props.id) : undefined)
  return (
    <>
      <Show when={props.external === 'anonymous'}>
        <Punct>?</Punct>
      </Show>
      <Show when={slug()} fallback={<Name>{props.name}</Name>}>
        <A href={`/r/${slug()}`} class="underline decoration-line underline-offset-[3px] hover:opacity-70">
          {props.name}
        </A>
      </Show>
    </>
  )
}
