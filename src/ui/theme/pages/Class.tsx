import { For, Show } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { Comment } from '../../shared/Comment.tsx'
import { Members } from '../sections.tsx'
import { PageHeader } from '../slots/index.ts'
import { Type } from '../../primitives/Type.tsx'

export const ClassPage = (props: { decl: docs.Declaration<'class'> }) => (
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
    <Show when={props.decl.implements?.length}>
      <div class="text-sm text-mute font-mono mt-1">
        <span class="text-accent">implements </span>
        <For each={props.decl.implements!}>
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
