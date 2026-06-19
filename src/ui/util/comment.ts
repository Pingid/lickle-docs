import type { Reflect } from '../context/index.tsx'

/** Single-line plain-text preview of a comment. Used by listings/cards. */
export const commentSummaryText = (comment: Reflect.Comment | undefined): string => {
  if (!comment) return ''
  let out = ''
  for (const p of comment.parts) {
    if (p.kind === 'text') out += p.text
    else out += p.text ?? p.target
  }
  return stripMarkdown(out).trim()
}

/**
 * Flatten markdown to plain text for one-line previews: inline markers
 * (emphasis, code, links) unwrapped, block syntax (headings, list bullets,
 * quotes) dropped, lines joined with spaces.
 */
const stripMarkdown = (s: string): string =>
  s
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s?)/gm, '') // heading/bullet/quote leaders
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url)
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, '$2') // emphasis
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/\s+/g, ' ') // collapse whitespace/newlines
