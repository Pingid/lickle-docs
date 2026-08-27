import { Show, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import cn from '@lickle/cn'

import { type Kind, labelOf, shortOf } from '../util/kind.ts'

/**
 * A document heading at one of the site's four sizes. Taking the level as a
 * prop keeps the rendered tag and the type scale in step — a page that needs
 * an `<h3>` under an `<h2>` gets the `<h3>` size without restyling it.
 *
 * @example preview
 * ```tsx
 * <div>
 *   <Heading level={1}>defineComponents</Heading>
 *   <Heading level={2}>Signature</Heading>
 *   <Heading level={3}>Parameters</Heading>
 *   <Heading level={4}>returns</Heading>
 * </div>
 * ```
 *
 * @group primitives
 */
export const Heading = (props: { level?: 1 | 2 | 3 | 4; mono?: boolean; class?: string; children: JSX.Element }) => (
  <Dynamic
    component={`h${props.level ?? 2}`}
    class={cn(HEADING[props.level ?? 2], props.mono && 'font-mono', props.class)}
  >
    {props.children}
  </Dynamic>
)

/**
 * Inline monospace text at the site's code size. Use it for identifiers in
 * prose; use `Code` when the text should be syntax-highlighted.
 *
 * @example preview
 * ```tsx
 * <p class="text-sm">Point the config's <Mono>components</Mono> field at a module.</p>
 * ```
 *
 * @group primitives
 */
export const Mono = (props: { class?: string; children: JSX.Element }) => (
  <code class={cn('font-mono', props.class)}>{props.children}</code>
)

/**
 * A keyboard key. Used by the search trigger and anywhere a shortcut is
 * spelled out in prose.
 *
 * @example preview
 * ```tsx
 * <Row gap={1}><Kbd>⌘</Kbd><Kbd>K</Kbd></Row>
 * ```
 *
 * @group primitives
 */
export const Kbd = (props: { class?: string; children: JSX.Element }) => (
  <kbd
    class={cn(
      'inline-flex items-center rounded border border-line px-1.5 py-0.5',
      'font-mono text-[0.65rem] leading-none text-mute',
      props.class,
    )}
  >
    {props.children}
  </kbd>
)

/**
 * A small outlined label: a status, a version, a `deprecated` marker. Sized to
 * sit on a baseline row next to a heading without shifting it.
 *
 * @example preview
 * ```tsx
 * <Row gap={2}>
 *   <Badge>stable</Badge>
 *   <Badge tone="accent">new</Badge>
 *   <Badge tone="warn">deprecated</Badge>
 *   <Badge tone="error">removed</Badge>
 *   <Badge tone="success">shipped</Badge>
 * </Row>
 * ```
 *
 * @group primitives
 */
export const Badge = (props: { tone?: Tone; class?: string; children: JSX.Element }) => (
  <span
    class={cn(
      'inline-flex items-center rounded-md border px-1.5 py-0.5',
      'text-[0.65rem] font-medium uppercase tracking-wide leading-none whitespace-nowrap',
      BADGE_TONE[props.tone ?? 'neutral'],
      props.class,
    )}
  >
    {props.children}
  </span>
)

/**
 * A selectable pill. `pressed` styles the chosen one and sets `aria-current`,
 * which is what a group of them needs to read as a choice rather than a row
 * of buttons.
 *
 * @example preview
 * ```tsx
 * <Row gap={1}>
 *   <Chip pressed>default</Chip>
 *   <Chip>flat</Chip>
 *   <Chip>by folder</Chip>
 * </Row>
 * ```
 *
 * @group primitives
 */
export const Chip = (props: {
  pressed?: boolean
  onClick?: (e: MouseEvent) => void
  title?: string
  class?: string
  children: JSX.Element
}) => (
  <button
    type="button"
    onClick={props.onClick}
    title={props.title}
    aria-current={props.pressed ? 'true' : undefined}
    class={cn(
      'px-2.5 py-1 text-xs rounded-md border border-line text-mute cursor-pointer transition-colors',
      'hover:text-fg hover:bg-hover',
      'aria-current:text-fg aria-current:border-fg/30 aria-current:bg-hover',
      props.class,
    )}
  >
    {props.children}
  </button>
)

/**
 * An aside set off from the prose around it — a caveat, a migration note, the
 * error a preview threw. `title` is optional; without it the body carries the
 * whole message.
 *
 * @example preview
 * ```tsx
 * <Stack gap={2}>
 *   <Callout title="Note">Slots you omit keep the stock renderer.</Callout>
 *   <Callout tone="warn" title="Deprecated">Use <Mono>Place.compose</Mono> instead.</Callout>
 *   <Callout tone="error" title="Failed to run">n is not defined</Callout>
 * </Stack>
 * ```
 *
 * @group primitives
 */
export const Callout = (props: { tone?: Tone; title?: JSX.Element; class?: string; children: JSX.Element }) => (
  <div class={cn('rounded-lg border px-4 py-3 text-sm', CALLOUT_TONE[props.tone ?? 'neutral'], props.class)}>
    <Show when={props.title != null}>
      <div class="font-semibold mb-1">{props.title}</div>
    </Show>
    <div class="text-mute">{props.children}</div>
  </div>
)

/**
 * Single-glyph cue for a declaration kind — `ƒ`, `T`, `I`. Sized for dense
 * lists (the sidebar, member rows, search hits) where a full label would
 * crowd out the name.
 *
 * @example preview
 * ```tsx
 * <Row gap={3}>
 *   <KindBadge kind="function" />
 *   <KindBadge kind="interface" />
 *   <KindBadge kind="type-alias" />
 *   <KindBadge kind="variable" />
 * </Row>
 * ```
 *
 * @group primitives
 */
export const KindBadge = (props: { kind: Kind | string; class?: string }) => (
  <span class={cn('font-mono text-xs text-mute text-center', props.class)} title={labelOf(props.kind)}>
    {shortOf(props.kind)}
  </span>
)

/**
 * The spelled-out kind of a declaration — `MODULE`, `FUNCTION`, `TYPE` — as
 * shown beside a page title.
 *
 * @example preview
 * ```tsx
 * <Row gap={3}>
 *   <KindLabel kind="module" />
 *   <KindLabel kind="type-alias" />
 * </Row>
 * ```
 *
 * @group primitives
 */
export const KindLabel = (props: { kind: Kind | string; class?: string }) => (
  <span class={cn('text-xs uppercase tracking-wider text-mute', props.class)}>{labelOf(props.kind)}</span>
)

// --- Scales the components above resolve their class names from ---

/**
 * Tones shared by {@link Badge} and {@link Callout}. `neutral` is the default
 * everywhere; the rest map to the theme's semantic colours.
 *
 * @group primitives
 */
export type Tone = 'neutral' | 'accent' | 'warn' | 'error' | 'success'

const HEADING = {
  1: 'text-2xl font-semibold tracking-tight',
  2: 'text-lg font-semibold',
  3: 'text-sm font-semibold',
  4: 'text-xs font-semibold uppercase tracking-wider text-mute',
} as const

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'border-line text-mute',
  accent: 'border-accent/40 text-accent',
  warn: 'border-warn/40 text-warn',
  error: 'border-error/40 text-error',
  success: 'border-success/40 text-success',
}

const CALLOUT_TONE: Record<Tone, string> = {
  neutral: 'border-line bg-panel text-fg',
  accent: 'border-accent/30 bg-accent/5 text-fg',
  warn: 'border-warn/30 bg-warn-bg text-fg',
  error: 'border-error/30 bg-error-bg text-fg',
  success: 'border-success/30 bg-success-bg text-fg',
}
