import type * as T from './types.ts'
import * as modulePath from './module-path.ts'

/** Sink for streamed text output. Compatible with `(chunk) => stream.write(chunk)`. */
export type Writer = (chunk: string) => void

export const printStdout = <R extends T.TypeRegistry>(project: T.Project<R>): void =>
  print(project, (chunk) => void process.stdout.write(chunk))

/** Stream a human-readable project listing through `write`. */
export const print = <R extends T.TypeRegistry>(project: T.Project<R>, write: Writer): void => {
  const ctx = makePrintContext(project)
  write(`Project: ${project.name}\n`)
  for (const child of project.children) writeModule(child, 1, ctx, write)
}

const writeModule = (mod: T.Module, depth: number, ctx: PrintContext, write: Writer): void => {
  writeLine(write, depth, `module ${modulePath.label(mod)}`)
  const seen = new Set<string>()
  for (const child of mod.children) {
    if (child.kind === 're-export') {
      writeLine(write, depth + 1, printExport(child))
      writeFollowExport(mod, child, depth + 2, ctx, seen, write)
    } else {
      writeDeclaration(child, depth + 1, ctx, write)
    }
  }
}

const writeDeclaration = (decl: T.AnyDeclaration, depth: number, ctx: PrintContext, write: Writer): void => {
  switch (decl.kind) {
    case 'module':
      return writeModule(decl, depth, ctx, write)
    case 'variable':
      return writeLine(write, depth, `variable ${decl.name}: ${printType(decl.type)}`)
    case 'function':
      return writeSignatureGroup(write, 'function', decl.name, decl.signatures, depth)
    case 'class':
      return writeClass(decl, depth, write)
    case 'interface':
      return writeInterface(decl, depth, write)
    case 'type-alias':
      return writeLine(write, depth, `type ${decl.name}${printTypeParams(decl.typeParameters)} = ${printType(decl.type)}`)
    case 'enum': {
      writeLine(write, depth, `${decl.const ? 'const enum' : 'enum'} ${decl.name}`)
      for (const m of decl.members) {
        writeLine(write, depth + 1, m.value === undefined ? m.name : `${m.name} = ${String(m.value)}`)
      }
      return
    }
    case 're-export':
      return writeLine(write, depth, printExport(decl))
  }
}

const writeClass = (decl: T.Class, depth: number, write: Writer): void => {
  writeLine(
    write,
    depth,
    join(
      `class ${decl.name}${printTypeParams(decl.typeParameters)}`,
      decl.extends ? `extends ${printType(decl.extends)}` : '',
      decl.implements?.length ? `implements ${decl.implements.map(printType).join(', ')}` : '',
    ),
  )
  for (const ctor of decl.constructors) writeLine(write, depth + 1, `constructor${printCallSignature(ctor)}`)
  for (const prop of decl.properties) writeLine(write, depth + 1, `${prop.name}: ${printType(prop.type)}`)
  for (const m of decl.methods) writeSignatureGroup(write, 'method', m.name, m.signatures, depth + 1)
  if (decl.indexSignature) writeLine(write, depth + 1, printIndexSignature(decl.indexSignature))
}

const writeInterface = (decl: T.Interface, depth: number, write: Writer): void => {
  writeLine(
    write,
    depth,
    join(
      `interface ${decl.name}${printTypeParams(decl.typeParameters)}`,
      decl.extends?.length ? `extends ${decl.extends.map(printType).join(', ')}` : '',
    ),
  )
  for (const prop of decl.properties) writeLine(write, depth + 1, `${prop.name}: ${printType(prop.type)}`)
  for (const m of decl.methods) writeSignatureGroup(write, 'method', m.name, m.signatures, depth + 1)
  for (const sig of decl.callSignatures ?? []) writeLine(write, depth + 1, `call${printCallSignature(sig)}`)
  for (const sig of decl.constructSignatures ?? []) writeLine(write, depth + 1, `new${printCallSignature(sig)}`)
  if (decl.indexSignature) writeLine(write, depth + 1, printIndexSignature(decl.indexSignature))
}

const writeSignatureGroup = (
  write: Writer,
  label: 'function' | 'method',
  name: string,
  signatures: T.Signature[],
  depth: number,
): void => {
  if (signatures.length === 1) {
    writeLine(write, depth, `${label} ${name}${printCallSignature(signatures[0]!)}`.trimEnd())
    return
  }
  for (let i = 0; i < signatures.length; i++) {
    writeLine(write, depth, `${label} ${name}#${i + 1}${printCallSignature(signatures[i]!)}`)
  }
}

const printCallSignature = (sig: T.Signature): string =>
  `${printTypeParams(sig.typeParameters)}(${sig.parameters.map(printParameter).join(', ')}): ${printType(sig.type)}`

const printParameter = (p: T.Parameter): string => {
  const rest = p.rest ? '...' : ''
  const optional = p.optional ? '?' : ''
  const defaultValue = p.default === undefined ? '' : ` = ${p.default}`
  return `${rest}${p.name}${optional}: ${printType(p.type)}${defaultValue}`
}

const printTypeParams = (params?: T.TypeParameter[]): string =>
  !params?.length ? '' : `<${params.map(printTypeParam).join(', ')}>`

const printTypeParam = (p: T.TypeParameter): string => {
  const constraint = p.constraint ? ` extends ${printType(p.constraint)}` : ''
  const defaultValue = p.default ? ` = ${printType(p.default)}` : ''
  return `${p.name}${constraint}${defaultValue}`
}

const printType = (t: T.AnyType): string => {
  switch (t.kind) {
    case 'intrinsic':
      return t.name
    case 'literal':
      return typeof t.value === 'string' ? JSON.stringify(t.value) : String(t.value)
    case 'reference':
      return `${t.name}${t.typeArguments?.length ? `<${t.typeArguments.map(printType).join(', ')}>` : ''}`
    case 'unresolved':
      return `?${t.name}${t.typeArguments?.length ? `<${t.typeArguments.map(printType).join(', ')}>` : ''}`
    case 'union':
      return t.types.map(printType).join(' | ')
    case 'intersection':
      return t.types.map(printType).join(' & ')
    case 'array':
      return `${wrapIfComplex(t.elementType)}[]`
    case 'tuple':
      return `[${t.elements.map(printTupleElement).join(', ')}]`
    case 'function-type':
      return t.signatures.length === 1
        ? `(${printSignatureLike(t.signatures[0]!)})`
        : `(${t.signatures.map(printSignatureLike).join(' | ')})`
    case 'type-operator':
      return `${t.operator} ${wrapIfComplex(t.target)}`
    case 'query':
      return `typeof ${printType(t.queryType)}`
    case 'reflection':
      return printObjectLiteral(t.declaration)
  }
}

const printTupleElement = (el: T.TupleElement): string => {
  const rest = el.rest ? '...' : ''
  const name = el.name ? `${el.name}${el.optional ? '?' : ''}: ` : ''
  const optional = el.name || !el.optional ? '' : '?'
  return `${rest}${name}${printType(el.type)}${optional}`
}

const printSignatureLike = (sig: T.Signature): string =>
  `${printTypeParams(sig.typeParameters)}(${sig.parameters.map(printParameter).join(', ')}) => ${printType(sig.type)}`

const printObjectLiteral = (decl: T.ObjectLiteral): string => {
  const parts = decl.properties.map((p) => `${p.name}: ${printType(p.type)}`)
  for (const m of decl.methods ?? []) {
    for (const sig of m.signatures) parts.push(`${m.name}${printCallSignature(sig)}`)
  }
  for (const sig of decl.callSignatures ?? []) parts.push(printSignatureLike(sig))
  for (const sig of decl.constructSignatures ?? []) parts.push(`new${printCallSignature(sig)}`)
  if (decl.indexSignature) parts.push(printIndexSignature(decl.indexSignature))
  return `{ ${parts.join('; ')} }`
}

const printIndexSignature = (sig: T.IndexSignature): string =>
  `[${sig.parameter.name}: ${printType(sig.parameter.type)}]: ${printType(sig.type)}`

// ---------------- Export shape helpers ----------------

type ExportForm = { kind: 'all' } | { kind: 'namespace'; as: string } | { kind: 'named'; named: T.NamedExport[] }

const exportForm = (exp: T.ReExport): ExportForm => {
  if (exp.named.length) return { kind: 'named', named: exp.named }
  if (exp.as) return { kind: 'namespace', as: exp.as }
  return { kind: 'all' }
}

const printExport = (exp: T.ReExport): string => {
  const form = exportForm(exp)
  const from = `from ${JSON.stringify(exp.sourceModule)}`
  if (form.kind === 'all') return `re-export * ${from}`
  if (form.kind === 'namespace') return `re-export * as ${form.as} ${from}`
  const items = form.named.map((n) => (n.as ? `${n.name} as ${n.as}` : n.name)).join(', ')
  return `re-export { ${items} } ${from}`
}

// ---------------- Re-export following ----------------

interface PrintContext {
  modulesByName: Map<string, T.Module>
}

const makePrintContext = <R extends T.TypeRegistry>(project: T.Project<R>): PrintContext => ({
  modulesByName: new Map(project.children.map((m) => [modulePath.label(m), m] as const)),
})

/** Per-module map of non-re-export children keyed by name. Cached so each target
 *  module pays the O(N) build cost at most once across the whole walk. */
type NamedChild = Exclude<T.AnyDeclaration, T.ReExport>
const namedChildrenCache = new WeakMap<T.Module, Map<string, NamedChild>>()
const namedChildren = (mod: T.Module): Map<string, NamedChild> => {
  const cached = namedChildrenCache.get(mod)
  if (cached) return cached
  const map = new Map<string, NamedChild>()
  for (const c of mod.children) {
    if (c.kind !== 're-export' && 'name' in c && typeof c.name === 'string') {
      map.set(c.name, c as NamedChild)
    }
  }
  namedChildrenCache.set(mod, map)
  return map
}

const writeFollowExport = (
  owner: T.Module,
  exp: T.ReExport,
  depth: number,
  ctx: PrintContext,
  seen: Set<string>,
  write: Writer,
): void => {
  const target = modulePath.resolve(modulePath.label(owner), exp.sourceModule, ctx.modulesByName)
  if (!target) return writeLine(write, depth, '(unresolved)')
  const key = `${modulePath.label(owner)}=>${modulePath.label(target)}`
  if (seen.has(key)) return writeLine(write, depth, '(cycle)')
  const form = exportForm(exp)

  if (form.kind === 'named') {
    const named = namedChildren(target)
    for (const entry of form.named) {
      const decl = named.get(entry.name)
      if (decl) writeDeclaration(decl, depth, ctx, write)
      else writeLine(write, depth, `(missing ${entry.name})`)
    }
    return
  }

  writeLine(write, depth, form.kind === 'namespace' ? `namespace ${form.as}` : `from ${modulePath.label(target)}`)
  seen.add(key)
  try {
    for (const child of target.children) {
      if (child.kind === 're-export') {
        writeLine(write, depth + 1, printExport(child))
        writeFollowExport(target, child, depth + 2, ctx, seen, write)
      } else {
        writeDeclaration(child, depth + 1, ctx, write)
      }
    }
  } finally {
    seen.delete(key)
  }
}

// ---------------- Output primitives ----------------

const wrapIfComplex = (t: T.AnyType): string =>
  t.kind === 'union' || t.kind === 'intersection' || t.kind === 'function-type' ? `(${printType(t)})` : printType(t)

const join = (...parts: string[]): string => {
  let out = ''
  for (const p of parts) {
    if (!p) continue
    out = out ? `${out} ${p}` : p
  }
  return out
}

/** Indent cache — `'  '.repeat(n)` is hot in deep trees; memoize for the lifetime of the process. */
const indents: string[] = ['']
const indent = (depth: number): string => {
  while (indents.length <= depth) indents.push(`${indents[indents.length - 1]!}  `)
  return indents[depth]!
}

const writeLine = (write: Writer, depth: number, content: string): void => {
  write(`${indent(depth)}- ${content}\n`)
}
