import { Show } from 'solid-js'
import { A } from '@solidjs/router'
import type * as docs from '../../../core/client.ts'

import { useSlugFor } from '../../hooks/index.js'
import { InlineText, TagSection } from './shared.js'

export const SeeTag = (props: { tag: docs.CommentTagMap['@see'] }) => {
  const slugs = useSlugFor()
  const slug = () => (props.tag.target ? slugs.byName(props.tag.target) : undefined)
  return (
    <TagSection title="See">
      <Show when={props.tag.target}>
        <div class="font-mono text-sm mb-1">
          <Show when={slug()} fallback={<span>{props.tag.target}</span>}>
            <A href={`/r/${slug()}`} class="underline decoration-line underline-offset-[3px] hover:opacity-70">
              {props.tag.target}
            </A>
          </Show>
        </div>
      </Show>
      <Show when={props.tag.text?.trim()}>
        <InlineText source={props.tag.text} />
      </Show>
    </TagSection>
  )
}
