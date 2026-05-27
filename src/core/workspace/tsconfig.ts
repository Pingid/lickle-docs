import path from 'node:path'
import ts from 'typescript'

export const find = (searchPath: string = process.cwd(), name?: string) =>
  ts.findConfigFile(searchPath, ts.sys.fileExists, name)

export const read = (configPath: string): Record<string, any> | null => {
  const readConfigResult = ts.readConfigFile(configPath, ts.sys.readFile)
  if (readConfigResult.error) {
    const message = ts.flattenDiagnosticMessageText(readConfigResult.error.messageText, '\n')
    throw new Error(`Error reading tsconfig: ${message}`)
  }
  return readConfigResult.config
}

export const parse = (resolved: string, json: any): ts.ParsedCommandLine => {
  const parsed = ts.parseJsonConfigFileContent(json, ts.sys, path.dirname(resolved), undefined, resolved)
  if (parsed.errors.length) {
    const fatal = parsed.errors.filter((d) => d.category === ts.DiagnosticCategory.Error)
    if (fatal.length) throw new Error(fatal.map(formatDiagnostic).join('\n'))
  }
  return parsed
}

const formatDiagnostic = (d: ts.Diagnostic): string => ts.flattenDiagnosticMessageText(d.messageText, '\n')
