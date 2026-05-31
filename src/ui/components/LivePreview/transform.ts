import { transform, type Transform } from 'sucrase'

/** Options forwarded to `sucrase.transform`, plus import handling. */
export type CompileOptions = {
  /** Sucrase transforms to apply. Default `['typescript', 'jsx']`. */
  transforms?: Transform[]
  /** JSX factory, e.g. `'h'`. Left to sucrase's default when unset. */
  jsxPragma?: string
  /** JSX fragment factory, e.g. `'Fragment'`. */
  jsxFragmentPragma?: string
  /** Production JSX output (no `__source`/`__self`). Default `true`. */
  production?: boolean
  /** Strip top-level `import` lines so the result runs in a bare scope. Default `true`. */
  stripImports?: boolean
}

const IMPORT = /^[ \t]*import\b/

/**
 * Transform a TS/JSX snippet into runnable JS. Framework-agnostic: point
 * `jsxPragma` / `jsxFragmentPragma` at whatever runtime you inject when
 * executing the result.
 */
export const compile = (src: string, options: CompileOptions = {}): string => {
  const code = transform(src, {
    transforms: options.transforms ?? ['typescript', 'jsx'],
    jsxPragma: options.jsxPragma,
    jsxFragmentPragma: options.jsxFragmentPragma,
    production: options.production ?? true,
  }).code
  return options.stripImports === false ? code : stripImports(code)
}

/** Remove top-level `import` statements (single-line form). */
export const stripImports = (code: string): string =>
  code
    .split('\n')
    .filter((line) => !IMPORT.test(line))
    .join('\n')

/** Every fenced code block body in a markdown string, in order. */
export const extractCodeBlocks = (input: string): string[] => {
  const blocks: string[] = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) blocks.push(m[1]!.replace(/\n$/, ''))
  return blocks
}

/** The first fenced code block body, or undefined when there is none. */
export const firstCodeBlock = (input: string): string | undefined => extractCodeBlocks(input)[0]
