export const join = (...parts: (string | undefined)[]): string => {
  const validParts = parts.filter((part): part is string => typeof part === 'string' && part !== '/')
  if (validParts.length === 0) return ''
  return validParts.reduce(join2)
}

const join2 = (a: string, b: string): string => {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const aEnds = a.endsWith('/')
  const bStarts = b.startsWith('/')
  if (aEnds && bStarts) return a + b.slice(1)
  if (aEnds || bStarts) return a + b
  return a + '/' + b
}

export const normalize = (slug?: string): string => {
  let s = slug?.trim().replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '')
  return `/${s}`
}

export const toSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
