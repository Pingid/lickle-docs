const CODE_BLOCK_RE = /```([^\n]*)\n([\s\S]*?)```/g
export const extractCodeBlocks = (input: string): { lang: string; code: string }[] => [
  ...(input?.matchAll(CODE_BLOCK_RE)?.map((m) => ({ lang: m[1]!, code: m[2]! })) ?? []),
]

export const firstCodeBlock = (input: string): { lang: string; code: string } =>
  extractCodeBlocks(input)?.[0] ?? { lang: '', code: input }

export const getUnfencedCode = (code: string) => firstCodeBlock(code).code
