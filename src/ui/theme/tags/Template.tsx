import { For, Show } from 'solid-js'
import type * as docs from '../../../core/client.ts'

import { Type } from '../../components/Type.js'
import { InlineText, TagSection } from './shared.js'

export const TemplateTag = (props: { tag: docs.CommentTagMap['@template'] }) => (
  <TagSection title="Type Parameters">
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
      <For each={props.tag.typeParameters}>
        {(tp) => (
          <>
            <dt class="font-mono text-sm font-semibold">{tp.name}</dt>
            <dd class="text-sm text-mute">
              <Show when={tp.constraint}>
                <>
                  <span class="text-accent">extends </span>
                  <Type type={tp.constraint!} />
                </>
              </Show>
            </dd>
          </>
        )}
      </For>
    </dl>
    <Show when={props.tag.text?.trim()}>
      <div class="mt-2">
        <InlineText source={props.tag.text} />
      </div>
    </Show>
  </TagSection>
)
