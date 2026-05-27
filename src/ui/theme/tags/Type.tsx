import type * as docs from '../../../core/client.ts'

import { TypedText } from './shared.js'

export const TypeTag = (props: { tag: docs.CommentTagMap['@type'] }) => <TypedText title="Type" tag={props.tag} />
