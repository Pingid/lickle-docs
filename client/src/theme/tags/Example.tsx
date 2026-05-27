import type * as docs from '@lickle/docs'

import { Markdown } from '../../components/Markdown.js'
import { Section } from './shared.js'

/** Wrap raw code in a default ```ts fence if it isn't already fenced. */
const ensureFenced = (code: string): string => (/^\s*```/.test(code) ? code : '```ts\n' + code + '\n```')

export const ExampleTag = (props: { tag: docs.CommentTagMap['@example'] }) => (
  <Section title="Example" description={props.tag.caption}>
    <Markdown source={ensureFenced(props.tag.code)} />
  </Section>
)
