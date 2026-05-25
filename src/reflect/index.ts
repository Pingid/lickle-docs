import ts from 'typescript'

import { generateProject, type GenerateOptions } from './generate.ts'
import type { ProjectReflection } from './types.ts'
import { resolveReferences } from './resolve.ts'

export const generate = (
  projectName: string,
  files: string[],
  tsconfig: ts.CompilerOptions,
  options: Partial<GenerateOptions> = {},
): ProjectReflection => {
  const { project, resolverContext } = generateProject(files, projectName, tsconfig, options)
  return resolveReferences(project, resolverContext)
}

export * as debug from './debug.ts'
