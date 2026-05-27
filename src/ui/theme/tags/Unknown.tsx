import type * as docs from '../../../core/client.ts'

import { Markdown } from '../../components/Markdown.js'
import { Section } from './shared.js'

/** `@deprecated` → `Deprecated`, `@runnable` → `Runnable`. */
const prettifyTagName = (tag: string): string => {
  const bare = tag.replace(/^@/, '')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

export const UnknownTag = (props: { tag: docs.CommentTag }) => (
  <Section title={prettifyTagName(props.tag.tag)}>
    <Markdown source={(props.tag as { text?: string }).text ?? ''} />
  </Section>
)
