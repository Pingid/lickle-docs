const CODE_BLOCK_RE = /```([^\n]*)\n([\s\S]*?)```/g
export const extractCodeBlocks = (input: string): { lang: string; code: string }[] => [
  ...(input?.matchAll(CODE_BLOCK_RE)?.map((m) => ({ lang: m[1]!, code: m[2]! })) ?? []),
]

export const firstCodeBlock = (input: string): { lang: string; code: string } =>
  extractCodeBlocks(input)?.[0] ?? { lang: '', code: input }

export const getUnfencedCode = (code: string) => firstCodeBlock(code).code

const LANGS = ['ts', 'tsx', 'js', 'jsx', 'json', 'bash', 'html', 'css', 'md']
export const langOf = (info: string | undefined) => {
  const raw = (info ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!raw) return 'text'
  if (LANGS.includes(raw)) return raw
  if (raw === 'sh' || raw === 'zsh') return 'bash'
  if (raw === 'typescript') return 'ts'
  if (raw === 'javascript') return 'js'
  return 'text'
}
