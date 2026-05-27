import type * as docs from '@lickle/docs'

import { TypedText } from './shared.js'

export const ThrowsTag = (props: { tag: docs.CommentTagMap['@throws'] }) => (
  <TypedText title="Throws" tag={props.tag} />
)
