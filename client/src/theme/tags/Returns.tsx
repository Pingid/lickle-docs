import type * as docs from '@lickle/docs'

import { TypedText } from './shared.js'

export const ReturnsTag = (props: { tag: docs.CommentTagMap['@returns'] }) => (
  <TypedText title="Returns" tag={props.tag} />
)
