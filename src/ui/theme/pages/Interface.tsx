import { For, Show } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { Comment } from '../../shared/Comment.js'
import { Members } from '../sections.js'
import { Type } from '../../primitives/Type.js'
import { PageHeader } from '../slots/index.js'

export const InterfacePage = (props: { decl: docs.Declaration<'interface'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    <Show when={props.decl.extends?.length}>
      <div class="text-sm text-mute font-mono mt-2">
        <span class="text-accent">extends </span>
        <For each={props.decl.extends!}>
          {(t, i) => (
            <>
              <Show when={i() > 0}>
                <span>, </span>
              </Show>
              <Type type={t} />
            </>
          )}
        </For>
      </div>
    </Show>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <Comment comment={props.decl.comment} />
      </div>
    </Show>
    <Members decl={props.decl} />
  </article>
)
