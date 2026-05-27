import type { TagComponents } from '../../registry/types.js'

import { ReturnsTag } from './Returns.js'
import { ThrowsTag } from './Throws.js'
import { TypeTag } from './Type.js'
import { SatisfiesTag } from './Satisfies.js'
import { ExampleTag } from './Example.js'
import { SeeTag } from './See.js'
import { TemplateTag } from './Template.js'
import { DeprecatedTag } from './Deprecated.js'
import { RemarksTag } from './Remarks.js'
import { AuthorTag } from './Author.js'
import { DefaultTag } from './Default.js'
import { UnknownTag } from './Unknown.js'

export {
  ReturnsTag,
  ThrowsTag,
  TypeTag,
  SatisfiesTag,
  ExampleTag,
  SeeTag,
  TemplateTag,
  DeprecatedTag,
  RemarksTag,
  AuthorTag,
  DefaultTag,
  UnknownTag,
}

/** Stock tag registry. `UnknownTag` is the catch-all the dispatcher uses. */
export const defaultTags: TagComponents = {
  '@returns': ReturnsTag,
  '@throws': ThrowsTag,
  '@type': TypeTag,
  '@satisfies': SatisfiesTag,
  '@example': ExampleTag,
  '@see': SeeTag,
  '@template': TemplateTag,
  '@deprecated': DeprecatedTag,
  '@remarks': RemarksTag,
  '@author': AuthorTag,
  '@default': DefaultTag,
}
