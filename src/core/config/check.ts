import { v, type Valid } from '@lickle/is'
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

const any: Valid<any, unknown> = (v) => ({ ok: true, value: v })

export const schema = v.struct.match<Partial<T.UserConfig>>({
  name: v.or(v.string, v.undefined),
  version: v.or(v.string, v.undefined),
  links: v.or(v.array(v.struct({ label: v.string, href: v.string })), v.undefined),
  tsconfig: v.or(v.string, v.undefined),
  repository: v.or(repo, v.undefined),
  srcDir: v.or(v.string, v.undefined),
  entrypoints: v.or(v.array(entry), v.undefined),
  pages: v.or(v.array(page), v.undefined),
  components: v.or(v.string, v.undefined),
  exclude: v.or(v.array(v.string), v.undefined),
  include: v.or(any, v.undefined),
  languages: v.or(v.array(v.string), v.undefined),
  provider: any,
})
