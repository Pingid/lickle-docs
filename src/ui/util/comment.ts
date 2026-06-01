import type { Types } from '../context/index.ts'

/** Single-line plain-text preview of a comment. Used by listings/cards. */
export const commentSummaryText = (comment: Types.Comment | undefined): string => {
  if (!comment) return ''
  let out = ''
  for (const p of comment.parts) {
    if (p.kind === 'text') out += p.text
    else out += p.text ?? p.target
  }
  return out.trim()
}
