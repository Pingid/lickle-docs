export const common = (pths: string[]): string => {
  if (pths.length === 0) return ''

  const split = pths.map((p) => p.split('/'))
  const first = split[0]!
  let i = 0
  for (; i < first.length; i++) {
    if (!split.every((parts) => parts[i] === first[i])) break
  }
  return first.slice(0, i).join('/')
}

export const slugMaker = () => {
  const used = new Set<string>()
  return {
    uniq: (sl: string) => uniqueSlug(sl, used),
    add: (sl: string) => {
      if (used.has(sl)) throw new Error(`Duplicate slug: ${sl}`)
      used.add(sl)
    },
  }
}

export const make = slugMaker()

export const stripExt = (s: string): string => s.replace(/\.[^./]+$/, '')

export const toSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')

const uniqueSlug = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  const slug = `${base}-${n}`
  used.add(slug)
  return slug
}

export const join = (...parts: string[]): string => parts.reduce(join2, '')
export const toPosix = (s: string): string => s.replace(/\\/g, '/')

const join2 = (a: string, b: string): string => {
  if (a.endsWith('/') && !b.startsWith('/')) return a + b
  if (!a.endsWith('/') && b.startsWith('/')) return a + b
  return a + '/' + b
}
