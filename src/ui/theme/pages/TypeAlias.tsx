import { For, Show } from 'solid-js'
import type * as docs from '../../../core/client.ts'

import { Comment } from '../../components/Comment.js'
import { Type } from '../../components/Type.js'
import { PageHeader } from '../slots/PageHeader.js'

export const TypeAliasPage = (props: { decl: docs.Declaration<'type-alias'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    <div class="font-mono text-sm leading-relaxed py-2">
      <span class="text-accent">type </span>
      <span class="font-semibold">{props.decl.name}</span>
      <Show when={props.decl.typeParameters?.length}>
        <span class="text-mute">{'<'}</span>
        <For each={props.decl.typeParameters!}>
          {(tp, i) => (
            <>
              <Show when={i() > 0}>
                <span class="text-mute">, </span>
              </Show>
              <span>{tp.name}</span>
              <Show when={tp.constraint}>
                <>
                  <span class="text-accent"> extends </span>
                  <Type type={tp.constraint!} />
                </>
              </Show>
            </>
          )}
        </For>
        <span class="text-mute">{'>'}</span>
      </Show>
      <span class="text-mute"> = </span>
      <Type type={props.decl.type} />
    </div>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <Comment comment={props.decl.comment} />
      </div>
    </Show>
  </article>
)
