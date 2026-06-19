export interface DiagnosticsMap {}

export type Diagnostic<K extends keyof DiagnosticsMap = keyof DiagnosticsMap> = {
  level: 'warn' | 'error' | 'info'
  code: K
  message: string
  source?: string
} & DiagnosticsMap[K]
