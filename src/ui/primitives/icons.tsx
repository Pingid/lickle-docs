import { Show, type Component } from 'solid-js'
import cn from '@lickle/cn'

/**
 * An external link rendered as an icon button. A recognised destination shows
 * its own glyph and hides the label; anything else keeps the label visible,
 * because a bare outbound arrow says nothing about where it goes.
 *
 * @example preview
 * ```tsx
 * <Row gap={2}>
 *   <LinkButton link={{ label: 'Repository', href: 'https://github.com/Pingid/lickle-docs' }} />
 *   <LinkButton link={{ label: 'Changelog', href: 'https://example.com/changelog' }} />
 * </Row>
 * ```
 *
 * @group primitives
 */
export const LinkButton = (props: { link: { label: string; href: string }; class?: string }) => {
  const Icon = iconForLink(props.link)
  const known = Icon !== ExternalIcon
  return (
    <a
      href={props.link.href}
      target="_blank"
      rel="noreferrer"
      title={props.link.label}
      class={cn('flex items-center gap-1.5 rounded-md text-mute hover:text-fg transition-colors', props.class)}
    >
      <Icon size={16} />
      <Show when={!known}>
        <span class="text-xs">{props.link.label}</span>
      </Show>
      <Show when={known}>
        <span class="sr-only">{props.link.label}</span>
      </Show>
    </a>
  )
}

/**
 * The icon set. Every glyph is a plain `<svg>` with no context and no
 * dependency, sized by `size` and coloured by the text around it.
 *
 * @example preview
 * ```tsx
 * <Row gap={4} class="text-mute">
 *   <GithubIcon size={20} />
 *   <ExternalIcon size={20} />
 *   <SearchIcon size={20} />
 *   <ChevronIcon size={20} />
 *   <CopyIcon size={20} />
 *   <CheckIcon size={20} />
 *   <MenuIcon size={20} />
 * </Row>
 * ```
 *
 * @group primitives
 */
export const GithubIcon = svg(() => (
  <path
    fill="currentColor"
    stroke="none"
    d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.94c-2.92.63-3.54-1.25-3.54-1.25-.48-1.21-1.17-1.54-1.17-1.54-.95-.65.08-.64.08-.64 1.05.07 1.6 1.08 1.6 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.88 1.08a9.98 9.98 0 0 1 5.24 0c2-1.36 2.88-1.08 2.88-1.08.57 1.45.21 2.52.1 2.79.67.74 1.08 1.67 1.08 2.82 0 4.02-2.46 4.9-4.8 5.16.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z"
  />
))

/** Outbound arrow, for links that leave the site. @group primitives */
export const ExternalIcon = svg(() => (
  <>
    <path d="M14 5h5v5" />
    <path d="M19 5 9.5 14.5" />
    <path d="M18 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </>
))

/** Magnifier, for the search trigger. @group primitives */
export const SearchIcon = svg(() => (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
))

/** Down chevron, for dropdown triggers. Use `Caret` for disclosure markers. @group primitives */
export const ChevronIcon = svg(() => <path d="m6 9 6 6 6-6" />)

/** Overlapping pages, for copy actions. @group primitives */
export const CopyIcon = svg(() => <path d="M9 9h10v10H9zM5 15H4V5h10v1" />)

/** Tick, for the confirmed state of a copy action. @group primitives */
export const CheckIcon = svg(() => <path d="m5 12 5 5 9-9" />)

/** Hamburger, for the mobile drawer toggle. @group primitives */
export const MenuIcon = svg(() => <path d="M4 7h16M4 12h16M4 17h16" />)

/** Sun, for the light theme. @group primitives */
export const SunIcon = svg(() => (
  <path d="M12 4V2M12 22v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
))

/** Moon, for the dark theme. @group primitives */
export const MoonIcon = svg(() => <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />)

/** Display, for the system theme. @group primitives */
export const DisplayIcon = svg(() => <path d="M3 6h18v10H3z M8 20h8 M12 16v4" />)

/**
 * Pick an icon for an external link by its href/label, falling back to a
 * generic external glyph.
 *
 * @group primitives
 */
export const iconForLink = (link: { label: string; href: string }): Component<IconProps> => {
  const k = `${link.href} ${link.label}`.toLowerCase()
  if (k.includes('github.com') || k.includes('github') || k.includes('repository')) return GithubIcon
  return ExternalIcon
}

/**
 * Props every icon takes. Icons stroke with `currentColor`, so colour comes
 * from the surrounding text.
 *
 * @group primitives
 */
export type IconProps = { size?: number; class?: string }

/**
 * Wraps a path body in the shared `<svg>` frame.
 *
 * A `function` declaration rather than a `const`: every icon above is built by
 * calling this at module-evaluation time, so it has to be hoisted to sit below
 * them.
 */
function svg(body: () => any, viewBox = '0 0 24 24'): Component<IconProps> {
  return (p) => (
    <svg
      width={p.size ?? 16}
      height={p.size ?? 16}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={p.class}
      aria-hidden="true"
    >
      {body()}
    </svg>
  )
}
