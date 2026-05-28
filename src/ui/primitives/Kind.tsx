import { labelOf, shortOf, type Kind } from '../util/kind.ts'

/**
 * Single-glyph badge for a declaration kind. Use in dense lists (sidebar,
 * member cards, search palette) where a `K` / `ƒ` cue is enough.
 */
export const KindBadge = (props: { kind: Kind | string; class?: string }) => (
  <span class={`font-mono text-xs text-mute text-center ${props.class ?? ''}`} title={labelOf(props.kind)}>
    {shortOf(props.kind)}
  </span>
)

/** Tracked uppercase label for a declaration kind (`MODULE`, `FUNCTION`, …). */
export const KindLabel = (props: { kind: Kind | string; class?: string }) => (
  <span class={`text-xs uppercase tracking-wider text-mute ${props.class ?? ''}`}>{labelOf(props.kind)}</span>
)
