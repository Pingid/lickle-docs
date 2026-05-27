import { For, Show } from 'solid-js'
import type * as docs from '@lickle/docs'

import { Comment } from '../../components/Comment.js'
import { Members } from '../../components/Members.js'
import { Type } from '../../components/Type.js'
import { PageHeader } from '../slots/PageHeader.js'

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
