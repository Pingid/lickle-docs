import { Show, type JSX } from 'solid-js'
import cn from '@lickle/cn'

/**
 * Vertical flow with a uniform gap. The workhorse for stacking sections,
 * form rows and list bodies without hand-written `space-y-*`.
 *
 * @example preview
 * ```tsx
 * <Stack gap={3}>
 *   <Panel class="p-3">first</Panel>
 *   <Panel class="p-3">second</Panel>
 *   <Panel class="p-3">third</Panel>
 * </Stack>
 * ```
 *
 * @group primitives
 */
export const Stack = (props: { gap?: Gap; align?: keyof typeof ALIGN; class?: string; children: JSX.Element }) => (
  <div class={cn('flex flex-col', COL_GAP[props.gap ?? 2], props.align && ALIGN[props.align], props.class)}>
    {props.children}
  </div>
)

/**
 * Horizontal flow. Wraps by default — the site's headers and toolbars all sit
 * next to a narrow sidebar, so a row that can't wrap overflows on mobile.
 *
 * @example preview
 * ```tsx
 * <Row gap={2} align="baseline">
 *   <Heading level={2}>createSlot</Heading>
 *   <KindLabel kind="function" />
 *   <Badge tone="warn">deprecated</Badge>
 * </Row>
 * ```
 *
 * @group primitives
 */
export const Row = (props: {
  gap?: Gap
  align?: keyof typeof ALIGN
  justify?: keyof typeof JUSTIFY
  /** Keep children on one line. Off by default. */
  nowrap?: boolean
  class?: string
  children: JSX.Element
}) => (
  <div
    class={cn(
      'flex',
      !props.nowrap && 'flex-wrap',
      COL_GAP[props.gap ?? 2],
      ALIGN[props.align ?? 'center'],
      props.justify && JUSTIFY[props.justify],
      props.class,
    )}
  >
    {props.children}
  </div>
)

/**
 * A bordered surface — the site's one container shape, shared by code blocks,
 * live previews and dropdown bodies. Pass `pad` for the common inset; leave it
 * off when the contents manage their own edges (a code editor, a table).
 *
 * @example preview
 * ```tsx
 * <Panel pad>
 *   The bordered surface every block on this site is cut from.
 * </Panel>
 * ```
 *
 * @group primitives
 */
export const Panel = (props: {
  /** Fill with the muted panel background instead of the page background. */
  tone?: 'plain' | 'muted' | 'code'
  /** Apply the standard `p-4` inset. */
  pad?: boolean
  class?: string
  children: JSX.Element
}) => (
  <div
    class={cn(
      'rounded-lg border border-line',
      props.tone === 'muted' && 'bg-panel',
      props.tone === 'code' && 'bg-code-bg',
      props.pad && 'p-4',
      props.class,
    )}
  >
    {props.children}
  </div>
)

/**
 * A {@link Panel} with a titled header strip above its body, divided by the
 * same hairline. Use it when a block needs a label that isn't part of the
 * document outline — a preview frame, a result pane, an options group.
 *
 * @example preview
 * ```tsx
 * <Card title="sidebar" meta="3 pages">
 *   <p class="text-sm text-mute">Whatever the card frames.</p>
 * </Card>
 * ```
 *
 * @group primitives
 */
export const Card = (props: {
  title?: JSX.Element
  /** Trailing content in the header strip — a count, a toggle, a link. */
  meta?: JSX.Element
  tone?: 'plain' | 'muted' | 'code'
  class?: string
  children: JSX.Element
}) => (
  <Panel tone={props.tone} class={props.class}>
    <Show when={props.title != null || props.meta != null}>
      <Row justify="between" gap={2} class="px-4 py-2 border-b border-line">
        <Eyebrow>{props.title}</Eyebrow>
        <Show when={props.meta != null}>
          <div class="text-xs text-mute">{props.meta}</div>
        </Show>
      </Row>
    </Show>
    <div class="p-4">{props.children}</div>
  </Panel>
)

/**
 * A horizontal band of controls: wraps, stays baseline-aligned, and pushes
 * anything after `<Toolbar.Spacer />` to the far end.
 *
 * @example preview
 * ```tsx
 * <Toolbar>
 *   <Button size="sm">Build</Button>
 *   <Button size="sm" variant="ghost">Clear</Button>
 *   <Toolbar.Spacer />
 *   <Kbd>⌘K</Kbd>
 * </Toolbar>
 * ```
 *
 * @group primitives
 */
export const Toolbar = (props: { gap?: Gap; class?: string; children: JSX.Element }) => (
  <Row gap={props.gap ?? 2} class={cn('w-full', props.class)}>
    {props.children}
  </Row>
)

/** Consumes the free space in a {@link Toolbar}, pushing what follows to the end. */
Toolbar.Spacer = () => <div class="flex-1" />

/**
 * A titled block with the site's underlined section heading — the shape used
 * for "Parameters", "Members" and "Referenced In". Renders nothing when
 * `when` is falsy, so a caller can pass a possibly-empty list straight in.
 *
 * @example preview
 * ```tsx
 * <Section title="Members" when={true}>
 *   <p class="text-sm text-mute">The section body.</p>
 * </Section>
 * ```
 *
 * @group primitives
 */
export const Section = (props: {
  title?: JSX.Element
  /** Render only when truthy. Defaults to always. */
  when?: unknown
  /** Drop the rule under the heading. */
  plain?: boolean
  class?: string
  children: JSX.Element
}) => (
  <Show when={props.when ?? true}>
    <section class={cn('mt-8', props.class)}>
      <Show when={props.title != null}>
        <h2 class={cn('text-sm font-semibold mb-3 capitalize', !props.plain && 'pb-1.5 border-b border-line')}>
          {props.title}
        </h2>
      </Show>
      {props.children}
    </section>
  </Show>
)

/**
 * A hairline rule. Vertical variants inherit the row's height, so they only
 * show up inside a flex container that stretches.
 *
 * @example preview
 * ```tsx
 * <Row gap={3}>
 *   <span class="text-sm text-mute">before</span>
 *   <Divider orientation="vertical" class="h-4" />
 *   <span class="text-sm text-mute">after</span>
 * </Row>
 * ```
 *
 * @group primitives
 */
export const Divider = (props: { orientation?: 'horizontal' | 'vertical'; class?: string }) => (
  <div
    role="separator"
    aria-orientation={props.orientation ?? 'horizontal'}
    class={cn(props.orientation === 'vertical' ? 'w-px self-stretch' : 'h-px w-full', 'bg-line shrink-0', props.class)}
  />
)

/**
 * The small uppercase tracked label that heads a tag block, a kind cue or a
 * card strip. One primitive so every one of them tracks the same.
 *
 * @example preview
 * ```tsx
 * <Eyebrow>parameters</Eyebrow>
 * ```
 *
 * @group primitives
 */
export const Eyebrow = (props: { class?: string; children: JSX.Element }) => (
  <span class={cn('text-[0.6875rem] font-semibold uppercase tracking-wider text-mute', props.class)}>
    {props.children}
  </span>
)

/**
 * Muted placeholder for a list, panel or result pane with nothing in it.
 * Better than an empty box: it says the query ran and found nothing.
 *
 * @example preview
 * ```tsx
 * <Panel><EmptyState title="No matches" hint="Try a shorter prefix." /></Panel>
 * ```
 *
 * @group primitives
 */
export const EmptyState = (props: { title: JSX.Element; hint?: JSX.Element; class?: string }) => (
  <div class={cn('py-8 text-center', props.class)}>
    <div class="text-sm text-mute">{props.title}</div>
    <Show when={props.hint != null}>
      <div class="text-xs text-mute/70 mt-1">{props.hint}</div>
    </Show>
  </div>
)

// --- Scales the components above resolve their class names from ---

/**
 * Spacing steps shared by {@link Stack}, {@link Row} and {@link Toolbar}. A
 * fixed scale rather than an open number so the class strings stay literal and
 * Tailwind can see them.
 *
 * @group primitives
 */
export type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8

const COL_GAP: Record<Gap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  6: 'gap-6',
  8: 'gap-8',
}

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
} as const

const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const
