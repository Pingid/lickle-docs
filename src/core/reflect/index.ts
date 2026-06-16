import * as Indexer from './indexer/index.ts'
import * as Scan from './scanner/index.ts'
import * as Resolve from './resolve.ts'
import * as State from './state.ts'

export { type DeclarationIndex as Index, type Exposure } from './indexer/index.ts'
export * from './types.ts'

export type BuildOptions = State.ScanOptions & Indexer.Options

export const build = (o: BuildOptions) => {
  const state = State.makeScanState(o)
  const index = Indexer.builder(o)

  const gen = Scan.scan(state)

  while (true) {
    const { value, done } = gen.next()
    if (done) break
    o.abortSignal?.throwIfAborted()
    index.add(value)
  }

  Resolve.resolve(state)

  return index.build({ references: state.references, langs: state.langs })
}
