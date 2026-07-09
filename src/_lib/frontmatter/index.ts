/**
 * Minimal YAML frontmatter: a leading `---` fenced block of `key: value` pairs.
 *
 * Deliberately not a YAML parser — the keys a page declares (`title`, `slug`,
 * `folder`, `group`, `order`, `draft`) are all scalars, and a real YAML
 * dependency would buy nothing for them. Nested structures are left as their
 * raw string, so a future field can grow into one without a format change.
 */
export type Frontmatter = { data: Record<string, string | number | boolean>; body: string }

const FENCE = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** Split `source` into its frontmatter data and the remaining body. */
export const parse = (source: string): Frontmatter => {
  const match = FENCE.exec(source)
  if (!match) return { data: {}, body: source }

  const data: Record<string, string | number | boolean> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colon = trimmed.indexOf(':')
    if (colon <= 0) continue
    const key = trimmed.slice(0, colon).trim()
    const raw = trimmed.slice(colon + 1).trim()
    if (key) data[key] = coerce(raw)
  }
  return { data, body: source.slice(match[0].length) }
}

const coerce = (raw: string): string | number | boolean => {
  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : undefined
  if (unquoted !== undefined) return unquoted
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

/** Read a frontmatter field as a string, or `undefined` when absent. */
export const str = (data: Frontmatter['data'], key: string): string | undefined => {
  const v = data[key]
  return v === undefined ? undefined : String(v)
}

/** Read a frontmatter field as a number, or `undefined` when absent or unparseable. */
export const num = (data: Frontmatter['data'], key: string): number | undefined => {
  const v = data[key]
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v)
  return undefined
}

/** The first `# heading` in a markdown body, if it has one. */
export const heading = (body: string): string | undefined => /^#\s+(.+)$/m.exec(body)?.[1]?.trim()
