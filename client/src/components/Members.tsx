import { For } from 'solid-js'
import type * as docs from '@lickle/docs'

import { useComponents } from '../registry/context.js'
import { defaultSectionsFor } from '../theme/sections.js'
import type { ChildSection, MemberSections } from '../registry/types.js'

type ParentKind = keyof MemberSections

/**
 * Page-level member rendering. Computes the stock section list, then hands
 * it to the user override (if any) for filtering / addition / replacement
 * before rendering.
 */
export const Members = (props: { decl: docs.Declaration }) => {
  const { sections } = useComponents()

  const final = (): ChildSection[] => {
    const defaults = defaultSectionsFor(props.decl)
    const k = props.decl.kind as ParentKind
    const hook = sections?.[k]
    return hook ? hook(props.decl as any, defaults) : defaults
  }

  return (
    <For each={final()}>
      {(s) => (
        <section class="mt-8">
          <h2 class="font-semibold text-xl mb-3 pb-1.5 border-b border-line capitalize">{s.title}</h2>
          <div>{s.render()}</div>
        </section>
      )}
    </For>
  )
}
