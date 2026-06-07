import { v, type Valid } from '@lickle/is'

import type { Router } from '../index.ts'
import * as T from './types.ts'

export const validate = (v: unknown): Partial<T.UserConfig> => {
  const result = schema(v)
  if (result.ok) return result.value
  throw new Error(result.error)
}

// ---------------- Validation ----------------
const repo = v.struct.match<T.Repo>({
  url: v.string,
  rev: v.or(v.string, v.undefined),
  fileUrl: v.or(v.string, v.undefined),
})

const page = v.struct.match<T.Page>({
  title: v.string,
  slug: v.or(v.string, v.undefined),
  content: v.string,
})

const entry = v.struct.match<T.Entry>({
  as: v.string,
  path: v.string,
})

const adapter = v.struct.match<Router.Adapter>({
  alias: v.function,
  title: v.function,
  slug: v.function,
  route: v.function,
  sidebar: v.function,
  modules: v.function,
  referenced: v.function,
})

const any: Valid<any, unknown> = (v) => ({ ok: true, value: v })

const field = <T>(tp: Valid<T, unknown>) => v.optional(tp)

export const schema = v.struct.match<Partial<T.UserConfig>>({
  name: field(v.string),
  version: field(v.string),
  links: field(v.array(v.struct({ label: v.string, href: v.string }))),
  tsconfig: field(v.string),
  repository: field(repo),
  srcDir: field(v.string),
  entrypoints: field(v.array(entry)),
  pages: field(v.array(page)),
  components: field(v.string),
  exclude: field(v.array(v.string)),
  include: field(any),
  languages: field(v.array(v.string)),
  provider: field(adapter),
  manifest: field(v.string),
})
