import { For, Show, createEffect, createSignal, onCleanup, type JSX } from 'solid-js'
import cn from '@lickle/cn'

/**
 * The site's button. Three weights — `solid` for the one action a block is
 * about, `outline` for alternatives, `ghost` for controls that live inside
 * other chrome (a header, a toolbar).
 *
 * @example preview
 * ```tsx
 * <Row gap={2}>
 *   <Button variant="solid">Run</Button>
 *   <Button variant="outline">Reset</Button>
 *   <Button variant="ghost">Cancel</Button>
 *   <Button variant="outline" disabled>Unavailable</Button>
 * </Row>
 * ```
 *
 * @group primitives
 */
export const Button = (props: {
  variant?: keyof typeof VARIANT
  size?: keyof typeof SIZE
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
  onClick?: (e: MouseEvent) => void
  class?: string
  children: JSX.Element
}) => (
  <button
    type={props.type ?? 'button'}
    disabled={props.disabled}
    title={props.title}
    onClick={props.onClick}
    class={cn(
      'inline-flex items-center justify-center rounded-md transition-colors cursor-pointer',
      'disabled:opacity-50 disabled:pointer-events-none',
      VARIANT[props.variant ?? 'outline'],
      SIZE[props.size ?? 'md'],
      props.class,
    )}
  >
    {props.children}
  </button>
)

/**
 * A square button holding a single glyph. `label` is required — it becomes
 * both the tooltip and the accessible name, which an icon alone can't supply.
 *
 * @example preview
 * ```tsx
 * <Row gap={1}>
 *   <IconButton label="Search"><SearchIcon size={15} /></IconButton>
 *   <IconButton label="Repository"><GithubIcon size={15} /></IconButton>
 * </Row>
 * ```
 *
 * @group primitives
 */
export const IconButton = (props: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick?: (e: MouseEvent) => void
  class?: string
  children: JSX.Element
}) => (
  <button
    type="button"
    title={props.label}
    aria-label={props.label}
    aria-pressed={props.pressed}
    disabled={props.disabled}
    onClick={props.onClick}
    class={cn(
      'inline-flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors',
      'text-mute hover:text-fg hover:bg-hover disabled:opacity-50 disabled:pointer-events-none',
      'aria-pressed:text-fg aria-pressed:bg-hover',
      props.class,
    )}
  >
    {props.children}
  </button>
)

/**
 * A controlled strip of choices. Fully controlled — it renders `value` and
 * reports clicks through `onChange` — so the selected tab is state the page
 * owns rather than something buried in the component.
 *
 * @example preview
 * ```tsx
 * const [tab, setTab] = createSignal('sidebar')
 * return (
 *   <Stack gap={3}>
 *     <Tabs
 *       value={tab}
 *       onChange={setTab}
 *       items={[
 *         { value: 'sidebar', label: 'Sidebar' },
 *         { value: 'pages', label: 'Pages' },
 *         { value: 'warnings', label: 'Warnings' },
 *       ]}
 *     />
 *     <Panel pad>showing {tab}</Panel>
 *   </Stack>
 * )
 * ```
 *
 * @group primitives
 */
export const Tabs = (props: {
  items: TabItem[]
  value?: string
  onChange?: (value: string) => void
  class?: string
}) => (
  <div role="tablist" class={cn('flex flex-wrap gap-1.5', props.class)}>
    <For each={props.items}>
      {(item) => (
        <button
          type="button"
          role="tab"
          title={item.title}
          aria-selected={props.value === item.value ? 'true' : 'false'}
          onClick={() => props.onChange?.(item.value)}
          class={cn(
            'px-2.5 py-1 text-xs rounded-md border border-line text-mute cursor-pointer transition-colors',
            'hover:text-fg hover:bg-hover',
            'aria-selected:text-fg aria-selected:border-fg/30 aria-selected:bg-hover',
          )}
        >
          {item.label}
        </button>
      )}
    </For>
  </div>
)

/** A single option in a {@link Tabs} strip. @group primitives */
export type TabItem = { value: string; label: JSX.Element; title?: string }

/**
 * A collapsible section. Uncontrolled by default; pass `open` to drive it
 * from outside, and `onToggle` fires either way so the two stay in step.
 *
 * Built on `<details>`, so it works before hydration and Cmd-F finds the
 * closed contents.
 *
 * @example preview
 * ```tsx
 * <Panel>
 *   <Disclosure summary="What the layout engine does" class="px-3 py-2">
 *     <p class="text-sm text-mute pt-2">It turns declarations into pages.</p>
 *   </Disclosure>
 * </Panel>
 * ```
 *
 * @group primitives
 */
export const Disclosure = (props: {
  summary: JSX.Element
  open?: boolean
  onToggle?: (open: boolean) => void
  class?: string
  children: JSX.Element
}) => {
  const [open, setOpen] = createSignal(props.open ?? false)
  createEffect(() => props.open !== undefined && setOpen(props.open))
  const toggle = (next: boolean) => {
    setOpen(next)
    props.onToggle?.(next)
  }
  return (
    <details open={open()} onToggle={(e) => toggle(e.currentTarget.open)}>
      <summary
        class={cn(
          'flex items-center gap-2 list-none cursor-pointer select-none',
          '[&::-webkit-details-marker]:hidden text-mute hover:text-fg transition-colors',
          props.class,
        )}
      >
        <Caret open={open()} />
        <span class="min-w-0">{props.summary}</span>
      </summary>
      {props.children}
    </details>
  )
}

/**
 * A dropdown anchored to its trigger, closing on outside click or `Escape`.
 * Uncontrolled: `trigger` receives the current state and a toggle, so any
 * button shape can open it.
 *
 * Handlers below take an unused `e`: examples compile through hyperscript,
 * which calls a *zero-argument* function prop to read it as a reactive value
 * rather than binding it as a listener. One parameter is enough to opt out.
 *
 * @example preview
 * ```tsx
 * const [copied, setCopied] = createSignal('nothing yet')
 * return (
 *   <Stack gap={2}>
 *     <Menu trigger={(open, toggle) => <Button onClick={(e) => toggle()}>Copy page ▾</Button>}>
 *       <MenuItem onClick={(e) => setCopied('page')}>Copy page</MenuItem>
 *       <MenuItem onClick={(e) => setCopied('page and members')}>Copy with members</MenuItem>
 *     </Menu>
 *     <span class="text-xs text-mute">copied: {copied}</span>
 *   </Stack>
 * )
 * ```
 *
 * @group primitives
 */
export const Menu = (props: {
  trigger: (open: boolean, toggle: () => void) => JSX.Element
  /** Which edge of the trigger the panel aligns to. Defaults to `end`. */
  align?: 'start' | 'end'
  class?: string
  children: JSX.Element
}) => {
  const [open, setOpen] = createSignal(false)
  let root: HTMLDivElement | undefined

  // Only listen while open: the effect re-runs and drops its listener the
  // moment the menu closes, so a page of these costs nothing at rest.
  createEffect(() => {
    if (!open()) return
    const onDocClick = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    onCleanup(() => document.removeEventListener('click', onDocClick))
  })

  return (
    <div
      ref={root}
      class={cn('relative inline-flex', props.class)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      {props.trigger(open(), () => setOpen((v) => !v))}
      <Show when={open()}>
        {/* Any click inside the panel dismisses it — selecting an item is the
            end of the interaction, and every item would otherwise have to
            remember to close. */}
        <div
          role="menu"
          onClick={() => setOpen(false)}
          class={cn(
            'absolute top-full mt-1 z-40 min-w-44 py-1 text-sm rounded-md border border-line bg-bg shadow-lg',
            props.align === 'start' ? 'left-0' : 'right-0',
          )}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}

/** One row of a {@link Menu}. @group primitives */
export const MenuItem = (props: { onClick?: (e: MouseEvent) => void; class?: string; children: JSX.Element }) => (
  <button
    type="button"
    role="menuitem"
    onClick={props.onClick}
    class={cn('block w-full text-left px-3 py-1.5 text-mute hover:text-fg hover:bg-hover cursor-pointer', props.class)}
  >
    {props.children}
  </button>
)

/**
 * A deferred loading cue. Stays invisible for `delay` milliseconds so a fast
 * resolve never flashes a spinner at the reader.
 *
 * @example preview
 * ```tsx
 * <Spinner label="Compiling…" delay={0} />
 * ```
 *
 * @group primitives
 */
export const Spinner = (props: { label?: string; delay?: number; class?: string }) => {
  const [show, setShow] = createSignal(false)
  const timer = setTimeout(() => setShow(true), props.delay ?? 100)
  onCleanup(() => clearTimeout(timer))
  return (
    <div
      class={cn('flex items-center gap-2 text-sm text-mute transition-opacity duration-200', props.class)}
      classList={{ 'opacity-100': show(), 'opacity-0': !show() }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" class="animate-spin shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" />
      </svg>
      <span>{props.label ?? 'Loading…'}</span>
    </div>
  )
}

/**
 * A rotating chevron — the disclosure marker used by {@link Disclosure} and
 * the sidebar tree. Points right when closed, down when open.
 *
 * @example preview
 * ```tsx
 * <Row gap={3}><Caret /><Caret open /></Row>
 * ```
 *
 * @group primitives
 */
export const Caret = (props: { open?: boolean; size?: number; class?: string }) => (
  <svg
    width={props.size ?? 10}
    height={props.size ?? 10}
    viewBox="0 0 12 12"
    aria-hidden="true"
    class={cn('shrink-0 text-mute transition-transform', props.open && 'rotate-90', props.class)}
  >
    <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
  </svg>
)

// --- Scales {@link Button} resolves its class names from ---

const VARIANT = {
  solid: 'border border-fg/20 bg-hover text-fg hover:bg-line',
  outline: 'border border-line text-mute hover:text-fg hover:bg-hover',
  ghost: 'border border-transparent text-mute hover:text-fg hover:bg-hover',
} as const

const SIZE = {
  sm: 'px-2 py-1 text-xs gap-1.5',
  md: 'px-2.5 py-1.5 text-sm gap-2',
} as const
