import { transform as sucraseTransform, type Transform } from 'sucrase'

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
}

/**
 * Transform a TS/JSX snippet into runnable JS. Framework-agnostic: point
 * `jsxPragma` / `jsxFragmentPragma` at whatever runtime you inject when
 * executing the result.
 */
export const transform = (src: string, options: CompileOptions = {}): string => {
  const code = sucraseTransform(src, {
    transforms: options.transforms ?? ['typescript', 'jsx'],
    jsxPragma: options.jsxPragma,
    jsxFragmentPragma: options.jsxFragmentPragma,
    production: options.production ?? true,
  }).code
  return code
}
