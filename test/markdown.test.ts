import { test, expect } from 'vitest'

import { declarationToMarkdown } from '../src/ui/util/markdown.ts'
import type { Types } from '../src/ui/context/index.tsx'
import { scanFixture, byName } from './fixture.ts'

const noSlug = () => undefined
const fenceCount = (md: string): number => (md.match(/```/g) ?? []).length
const exampleTag = (decl: Types.Declaration): Types.CommentTagMap['@example'] =>
  (decl as { comment?: Types.Comment }).comment!.tags!.find(
    (t) => t.tag === '@example',
  ) as Types.CommentTagMap['@example']

/** Scan a single declaration and render it to markdown. */
const declMd = (code: string, name: string): { decl: Types.Declaration; md: string } => {
  const decl = byName(scanFixture(code), name)
  return { decl, md: declarationToMarkdown(decl, noSlug) }
}

test('an @example with a caption keeps a single fenced block (no nesting)', () => {
  const { decl, md } = declMd(
    `
    /**
     * Run \`fn\` immediately.
     * @example live Ticker with cleanup
     * \`\`\`ts
     * const x = signal(0)
     * \`\`\`
     */
    export function effect(fn: () => void): void {}
    `,
    'effect',
  )
  // signature fence + example fence = two pairs, nothing more.
  expect(fenceCount(md)).toBe(4)
  expect(md).not.toMatch(/```ts\n```ts/)
  expect(md).toContain('**Example** live Ticker with cleanup')
  // The extracted code itself is clean: no fences, language captured.
  expect(exampleTag(decl).code).not.toContain('```')
  expect(exampleTag(decl).lang).toBe('ts')
})

test('prose after the closing fence does not leak a second fence', () => {
  const { md } = declMd(
    `
    /**
     * @example
     * \`\`\`ts
     * const x = signal(0)
     * \`\`\`
     * This sets up a ticking counter.
     */
    export function effect(): void {}
    `,
    'effect',
  )
  expect(fenceCount(md)).toBe(4)
  expect(md).not.toMatch(/```ts\n```ts/)
  expect(md).not.toContain('This sets up a ticking counter.')
})

test('an unfenced @example body is wrapped exactly once', () => {
  const { decl, md } = declMd(
    `
    /**
     * @example
     * const x = signal(0)
     */
    export function effect(): void {}
    `,
    'effect',
  )
  expect(exampleTag(decl).code).toBe('const x = signal(0)')
  expect(fenceCount(md)).toBe(4)
})

test('a plain function emits only its signature fence and a blank line before prose', () => {
  const { md } = declMd(
    `
    /** Adds two numbers. */
    export function add(a: number, b: number): number { return a + b }
    `,
    'add',
  )
  expect(fenceCount(md)).toBe(2)
  expect(md).not.toMatch(/```ts\n```/) // no empty code block
  expect(md).toMatch(/```\n\nAdds two numbers\./) // blank line between fence and summary
})
