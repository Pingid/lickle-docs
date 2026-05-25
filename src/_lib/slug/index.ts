const slugBuilder = () => {
  const used = new Set<string>()
  return (sl: string) => uniqueSlug(toSlug(sl), used)
}

export const make = slugBuilder()

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
