import type * as T from './types.ts'
import path from 'node:path'

export const printStdout = (project: T.ProjectReflection) => {
  process.stdout.write(printProject(project))
}

const printProject = (project: T.ProjectReflection): string => {
  const ctx = makePrintContext(project)
  const lines = [`Project: ${project.name}`]
  for (const child of project.children) lines.push(...printModule(child, 1, ctx))
  return lines.join('\n') + '\n'
}

const printModule = (
  module: T.ModuleReflection,
  depth: number,
  ctx: PrintContext,
  seen: Set<string> = new Set(),
): string[] => {
  const lines = [line(depth, `module ${module.name}`)]
  for (const child of module.children) lines.push(...printDeclaration(child, depth + 1, ctx))
  for (const re of module.reExports ?? []) {
    lines.push(line(depth + 1, printReExport(re)))
    lines.push(...printFollowedReExport(module, re, depth + 2, ctx, seen))
  }
  return lines
}

const printDeclaration = (declaration: T.DeclarationReflection, depth: number, ctx: PrintContext): string[] => {
  switch (declaration.kind) {
    case 'module':
      return printModule(declaration, depth, ctx)
    case 'variable':
      return [line(depth, `variable ${declaration.name}: ${printType(declaration.type)}`)]
    case 'function':
      return printSignatureGroup('function', declaration.name, declaration.signatures, depth)
    case 'class':
      return printClass(declaration, depth)
    case 'interface':
      return printInterface(declaration, depth)
    case 'type-alias':
      return [line(depth, `type ${declaration.name}${printTypeParams(declaration.typeParameters)} = ${printType(declaration.type)}`)]
    case 'enum':
      return [
        line(depth, `${declaration.isConst ? 'const enum' : 'enum'} ${declaration.name}`),
        ...declaration.members.map((member) =>
          line(depth + 1, member.value === undefined ? member.name : `${member.name} = ${String(member.value)}`),
        ),
      ]
  }
}

const printClass = (declaration: T.ClassReflection, depth: number): string[] => {
  const lines = [
    line(
      depth,
      [
        `class ${declaration.name}${printTypeParams(declaration.typeParameters)}`,
        declaration.extends ? `extends ${printType(declaration.extends)}` : '',
        declaration.implements?.length ? `implements ${declaration.implements.map(printType).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    ),
  ]
  for (const ctor of declaration.constructors) lines.push(line(depth + 1, `constructor${printCallSignature(ctor)}`))
  for (const property of declaration.properties) lines.push(line(depth + 1, `${property.name}: ${printType(property.type)}`))
  for (const method of declaration.methods) {
    lines.push(...printSignatureGroup('method', method.name, method.signatures, depth + 1))
  }
  if (declaration.indexSignature) {
    lines.push(line(depth + 1, printIndexSignature(declaration.indexSignature)))
  }
  return lines
}

const printInterface = (declaration: T.InterfaceReflection, depth: number): string[] => {
  const lines = [
    line(
      depth,
      [
        `interface ${declaration.name}${printTypeParams(declaration.typeParameters)}`,
        declaration.extends?.length ? `extends ${declaration.extends.map(printType).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    ),
  ]
  for (const property of declaration.properties) lines.push(line(depth + 1, `${property.name}: ${printType(property.type)}`))
  for (const method of declaration.methods) {
    lines.push(...printSignatureGroup('method', method.name, method.signatures, depth + 1))
  }
  for (const sig of declaration.callSignatures ?? []) lines.push(line(depth + 1, `call${printCallSignature(sig)}`))
  for (const sig of declaration.constructSignatures ?? []) lines.push(line(depth + 1, `new${printCallSignature(sig)}`))
  if (declaration.indexSignature) lines.push(line(depth + 1, printIndexSignature(declaration.indexSignature)))
  return lines
}

const printSignatureGroup = (
  label: 'function' | 'method',
  name: string,
  signatures: T.SignatureReflection[],
  depth: number,
): string[] => {
  if (signatures.length === 1) return [line(depth, `${label} ${name}${printCallSignature(signatures[0]!)} `.trimEnd())]
  return signatures.map((signature, idx) => line(depth, `${label} ${name}#${idx + 1}${printCallSignature(signature)}`))
}

const printCallSignature = (signature: T.SignatureReflection): string => {
  const params = signature.parameters.map(printParameter).join(', ')
  return `${printTypeParams(signature.typeParameters)}(${params}): ${printType(signature.type)}`
}

const printParameter = (parameter: T.ParameterReflection): string => {
  const rest = parameter.isRest ? '...' : ''
  const optional = parameter.isOptional ? '?' : ''
  const defaultValue = parameter.defaultValue === undefined ? '' : ` = ${parameter.defaultValue}`
  return `${rest}${parameter.name}${optional}: ${printType(parameter.type)}${defaultValue}`
}

const printTypeParams = (parameters?: T.TypeParameterReflection[]): string => {
  if (!parameters?.length) return ''
  return `<${parameters.map(printTypeParam).join(', ')}>`
}

const printTypeParam = (parameter: T.TypeParameterReflection): string => {
  const constraint = parameter.constraint ? ` extends ${printType(parameter.constraint)}` : ''
  const defaultValue = parameter.default ? ` = ${printType(parameter.default)}` : ''
  return `${parameter.name}${constraint}${defaultValue}`
}

const printType = (type: T.TypeReflection): string => {
  switch (type.kind) {
    case 'intrinsic':
      return type.name
    case 'literal':
      return typeof type.value === 'string' ? JSON.stringify(type.value) : String(type.value)
    case 'reference':
      return `${type.name}${type.typeArguments?.length ? `<${type.typeArguments.map(printType).join(', ')}>` : ''}`
    case 'union':
      return type.types.map(printType).join(' | ')
    case 'intersection':
      return type.types.map(printType).join(' & ')
    case 'array':
      return `${wrapIfComplex(type.elementType)}[]`
    case 'tuple':
      return `[${type.elements.map(printTupleElement).join(', ')}]`
    case 'function-type':
      return type.signatures.length === 1
        ? `(${printSignatureLike(type.signatures[0]!)})`
        : `(${type.signatures.map(printSignatureLike).join(' | ')})`
    case 'type-operator':
      return `${type.operator} ${wrapIfComplex(type.target)}`
    case 'query':
      return `typeof ${printType(type.queryType)}`
    case 'reflection':
      return printObjectLiteral(type.declaration)
  }
}

const printTupleElement = (element: T.TupleElement): string => {
  const rest = element.isRest ? '...' : ''
  const name = element.name ? `${element.name}${element.isOptional ? '?' : ''}: ` : ''
  const optional = element.name || !element.isOptional ? '' : '?'
  return `${rest}${name}${printType(element.type)}${optional}`
}

const printSignatureLike = (signature: T.SignatureReflection): string => {
  const params = signature.parameters.map(printParameter).join(', ')
  return `${printTypeParams(signature.typeParameters)}(${params}) => ${printType(signature.type)}`
}

const printObjectLiteral = (declaration: T.ObjectLiteralReflection): string => {
  const parts = declaration.properties.map((property) => `${property.name}: ${printType(property.type)}`)
  for (const method of declaration.methods ?? []) {
    parts.push(...method.signatures.map((signature) => `${method.name}${printCallSignature(signature)}`))
  }
  for (const signature of declaration.callSignatures ?? []) parts.push(printSignatureLike(signature))
  for (const signature of declaration.constructSignatures ?? []) parts.push(`new${printCallSignature(signature)}`)
  if (declaration.indexSignature) parts.push(printIndexSignature(declaration.indexSignature))
  return `{ ${parts.join('; ')} }`
}

const printIndexSignature = (signature: T.IndexSignatureReflection): string => {
  const key = `${signature.parameter.name}: ${printType(signature.parameter.type)}`
  return `[${key}]: ${printType(signature.type)}`
}

const printReExport = (reExport: T.ReExportReflection): string => {
  switch (reExport.kind) {
    case 're-export-all':
      return `re-export * from ${JSON.stringify(reExport.sourceModule)}`
    case 're-export-namespace':
      return `re-export * as ${reExport.as} from ${JSON.stringify(reExport.sourceModule)}`
    case 're-export-named':
      return `re-export { ${reExport.name}${reExport.as ? ` as ${reExport.as}` : ''} } from ${JSON.stringify(reExport.sourceModule)}`
  }
}

interface PrintContext {
  modulesByName: Map<string, T.ModuleReflection>
}

const makePrintContext = (project: T.ProjectReflection): PrintContext => {
  return { modulesByName: new Map(project.children.map((module) => [module.name, module])) }
}

const printFollowedReExport = (
  owner: T.ModuleReflection,
  reExport: T.ReExportReflection,
  depth: number,
  ctx: PrintContext,
  seen: Set<string>,
): string[] => {
  const target = resolveReExportModule(owner.name, reExport.sourceModule, ctx.modulesByName)
  if (!target) return [line(depth, '(unresolved)')]
  const key = `${owner.name}=>${target.name}`
  if (seen.has(key)) return [line(depth, '(cycle)')]
  const nextSeen = new Set(seen)
  nextSeen.add(key)

  if (reExport.kind === 're-export-named') {
    const declaration = target.children.find((x) => x.name === reExport.name)
    return declaration ? printDeclaration(declaration, depth, ctx) : [line(depth, `(missing ${reExport.name})`)]
  }

  const lines = [line(depth, `from ${target.name}`)]
  if (reExport.kind === 're-export-namespace') {
    const lines = [line(depth, `namespace ${reExport.as}`)]
    for (const declaration of target.children) lines.push(...printDeclaration(declaration, depth + 1, ctx))
    for (const nested of target.reExports ?? []) {
      lines.push(line(depth + 1, printReExport(nested)))
      lines.push(...printFollowedReExport(target, nested, depth + 2, ctx, nextSeen))
    }
    return lines
  }

  for (const declaration of target.children) lines.push(...printDeclaration(declaration, depth + 1, ctx))
  for (const nested of target.reExports ?? []) {
    lines.push(line(depth + 1, printReExport(nested)))
    lines.push(...printFollowedReExport(target, nested, depth + 2, ctx, nextSeen))
  }
  return lines
}

const resolveReExportModule = (
  ownerName: string,
  sourceModule: string,
  modulesByName: Map<string, T.ModuleReflection>,
): T.ModuleReflection | undefined => {
  if (path.isAbsolute(sourceModule)) return modulesByName.get(sourceModule)
  const relativeBase = path.isAbsolute(ownerName) ? path.resolve(path.dirname(ownerName), sourceModule) : sourceModule
  const candidates = modulePathCandidates(relativeBase)
  for (const candidate of candidates) {
    const module = modulesByName.get(candidate)
    if (module) return module
  }
  const wanted = new Set(candidates.map(normalizeModulePath))
  for (const module of modulesByName.values()) {
    const normalized = normalizeModulePath(module.name)
    if (wanted.has(normalized)) return module
    if ([...wanted].some((x) => normalized.endsWith(`/${x}`) || normalized.endsWith(x))) return module
  }
  return undefined
}

const modulePathCandidates = (base: string): string[] => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  `${base}.js`,
  `${base}.mjs`,
  path.join(base, 'index.ts'),
  path.join(base, 'index.tsx'),
  path.join(base, 'index.js'),
]

const normalizeModulePath = (name: string): string => {
  const normalized = name.replaceAll('\\', '/').replace(/^\.\/+/, '')
  return normalized
    .replace(/\/index\.(ts|tsx|js|mjs)$/, '')
    .replace(/\.(ts|tsx|js|mjs)$/, '')
    .replace(/\/+$/, '')
}

const wrapIfComplex = (type: T.TypeReflection): string => {
  return type.kind === 'union' || type.kind === 'intersection' || type.kind === 'function-type'
    ? `(${printType(type)})`
    : printType(type)
}

const line = (depth: number, content: string): string => `${'  '.repeat(depth)}- ${content}`
