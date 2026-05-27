import { For } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { Signature } from '../../shared/Signature.js'
import { PageHeader } from '../slots/index.js'

export const FunctionPage = (props: { decl: docs.Declaration<'function'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    {/* The function decl's comment is repeated on each signature, so
        skip it here and let `<Signature>` render the per-overload copy. */}
    <div class="mt-5">
      <For each={props.decl.signatures}>{(sig) => <Signature sig={sig} name={props.decl.name} kind="function" />}</For>
    </div>
  </article>
)
