import type * as docs from '@lickle/docs'

import { TypedText } from './shared.js'

export const SatisfiesTag = (props: { tag: docs.CommentTagMap['@satisfies'] }) => (
  <TypedText title="Satisfies" tag={props.tag} />
)
