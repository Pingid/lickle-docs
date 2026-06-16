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
  folder: v.or(v.string, v.undefined),
  group: v.or(v.string, v.undefined),
  order: v.or(v.number, v.undefined),
})

const entry = v.struct.match<T.Entry>({
  as: v.string,
  path: v.string,
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
  // Layout functions can't be validated at runtime — accept them as-is.
  layout: field(v.function as Valid<any, unknown>),
  transform: field(v.function as Valid<any, unknown>),
  versions: any,
  filter: field(v.function as Valid<any, unknown>),
})

const SHIKI_LANGUAGES = [
  'angular',
  'astro',
  'blade',
  'c',
  'coffee',
  'cpp',
  'css',
  'csv',
  'glsl',
  'graphql',
  'haml',
  'handlebars',
  'html',
  'html',
  'http',
  'hurl',
  'imba',
  'java',
  'javascript',
  'jinja',
  'jison',
  'json',
  'json5',
  'jsonc',
  'jsonl',
  'jsx',
  'julia',
  'less',
  'markdown',
  'marko',
  'mdc',
  'mdx',
  'php',
  'postcss',
  'pug',
  'python',
  'r',
  'regexp',
  'sass',
  'scss',
  'shellscript',
  'sql',
  'stylus',
  'svelte',
  'ts',
  'tsx',
  'typescript',
  'vue',
  'vue',
  'vue',
  'wasm',
  'wgsl',
  'wit',
  'xml',
  'yaml',
] as const

export const SHIKI_LANGUAGES_SET = new Set<string>(SHIKI_LANGUAGES)
