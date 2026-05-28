import * as modulePath from './module-path.ts'
import type * as T from './types.ts'

/** Sink for streamed text output. Compatible with `(chunk) => stream.write(chunk)`. */
export type Writer = (chunk: string) => void

export const printStdout = <R extends T.TypeRegistry>(declarations: T.AnyDeclaration<R>[], children: number[]): void =>
  print(declarations, children, (chunk) => void process.stdout.write(chunk))

/** Stream a human-readable module listing through `write`. */
export const print = <R extends T.TypeRegistry>(
  declarations: T.AnyDeclaration<R>[],
  children: number[],
  write: Writer,
): void => {
  // The walker doesn't care about the registry shape — it dispatches on `kind`.
  // Erase R at the boundary so internal helpers stay simple.
  const decls = declarations as unknown as T.AnyDeclaration[]
  const ctx = makePrintContext(decls)
  for (const id of children) {
    const m = ctx.byId.get(id)
    if (m && m.kind === 'module') writeModule(m, 0, ctx, write)
  }
}

const writeModule = (mod: T.Module, depth: number, ctx: PrintContext, write: Writer): void => {
  writeLine(write, depth, `module ${modulePath.label(mod)}`)
  for (const childId of mod.children) {
    const child = ctx.byId.get(childId)
    if (child) writeDeclaration(child, depth + 1, ctx, write)
  }
}

const writeNamespace = (ns: T.Namespace, depth: number, ctx: PrintContext, write: Writer): void => {
  writeLine(write, depth, `namespace ${ns.name}`)
  for (const childId of ns.children) {
    const child = ctx.byId.get(childId)
    if (child) writeDeclaration(child, depth + 1, ctx, write)
  }
}

const writeDeclaration = (decl: T.AnyDeclaration, depth: number, ctx: PrintContext, write: Writer): void => {
  switch (decl.kind) {
    case 'module':
      return writeModule(decl, depth, ctx, write)
    case 'namespace':
      return writeNamespace(decl, depth, ctx, write)
    case 'variable':
      return writeLine(write, depth, `variable ${decl.name}: ${printType(decl.type)}`)
    case 'function':
      return writeSignatureGroup(write, 'function', decl.name, decl.signatures, depth)
    case 'class':
      return writeClass(decl, depth, write)
    case 'interface':
      return writeInterface(decl, depth, write)
    case 'type-alias':
      return writeLine(
        write,
        depth,
        `type ${decl.name}${printTypeParams(decl.typeParameters)} = ${printType(decl.type)}`,
      )
    case 'enum': {
      writeLine(write, depth, `${decl.const ? 'const enum' : 'enum'} ${decl.name}`)
      for (const m of decl.members) {
        writeLine(write, depth + 1, m.value === undefined ? m.name : `${m.name} = ${String(m.value)}`)
      }
      return
    }
    case 'exports':
      return writeExports(decl, depth, ctx, write)
  }
}

const writeExports = (exp: T.Exports, depth: number, ctx: PrintContext, write: Writer): void => {
  if (!exp.names.length) {
    writeLine(write, depth, 'exports {}')
    return
  }
  for (const entry of exp.names) {
    const target = ctx.byId.get(entry.id)
    if (!target) {
      writeLine(write, depth, `export ${entry.name} (unresolved id ${entry.id})`)
      continue
    }
    if (target.kind === 'module') {
      writeLine(write, depth, `export namespace ${entry.name} = ${modulePath.label(target)}`)
      continue
    }
    const targetName = (target as { name?: string }).name ?? '<anonymous>'
    if (entry.name !== targetName) {
      writeLine(write, depth, `export ${targetName} as ${entry.name}`)
    } else {
      writeLine(write, depth, `export ${entry.name}`)
    }
  }
}

const writeClass = (decl: T.Class, depth: number, write: Writer): void => {
  writeLine(
    write,
    depth,
    join(
      `class ${decl.name}${printTypeParams(decl.typeParameters)}`,
      decl.extends?.length ? `extends ${decl.extends.map(printType).join(', ')}` : '',
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
    case 'reference': {
      const prefix = t.external ? '?' : ''
      return `${prefix}${t.name}${t.typeArguments?.length ? `<${t.typeArguments.map(printType).join(', ')}>` : ''}`
    }
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

// ---------------- Print context ----------------

interface PrintContext {
  byId: Map<number, T.AnyDeclaration>
}

const makePrintContext = (decls: T.AnyDeclaration[]): PrintContext => ({
  byId: new Map(decls.map((d) => [d.id, d])),
})

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
