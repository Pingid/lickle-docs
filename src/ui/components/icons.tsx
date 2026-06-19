import { Show, type Component } from 'solid-js'

type IconProps = { size?: number; class?: string }

const svg =
  (body: () => any, viewBox = '0 0 24 24'): Component<IconProps> =>
  (p) => (
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

export const GithubIcon = svg(() => (
  <path
    fill="currentColor"
    stroke="none"
    d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.94c-2.92.63-3.54-1.25-3.54-1.25-.48-1.21-1.17-1.54-1.17-1.54-.95-.65.08-.64.08-.64 1.05.07 1.6 1.08 1.6 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.88 1.08a9.98 9.98 0 0 1 5.24 0c2-1.36 2.88-1.08 2.88-1.08.57 1.45.21 2.52.1 2.79.67.74 1.08 1.67 1.08 2.82 0 4.02-2.46 4.9-4.8 5.16.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z"
  />
))

export const ExternalIcon = svg(() => (
  <>
    <path d="M14 5h5v5" />
    <path d="M19 5 9.5 14.5" />
    <path d="M18 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </>
))

export const SearchIcon = svg(() => (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
))

export const ChevronIcon = svg(() => <path d="m6 9 6 6 6-6" />)

/** Pick an icon for an external link by its href/label, falling back to a generic external glyph. */
export const iconForLink = (link: { label: string; href: string }): Component<IconProps> => {
  const k = `${link.href} ${link.label}`.toLowerCase()
  if (k.includes('github.com') || k.includes('github') || k.includes('repository')) return GithubIcon
  return ExternalIcon
}

/** Render an external link as an icon button, falling back to its label for unknown links. */
export const LinkButton = (props: { link: { label: string; href: string }; class?: string }) => {
  const Icon = iconForLink(props.link)
  const known = Icon !== ExternalIcon
  return (
    <a
      href={props.link.href}
      target="_blank"
      rel="noreferrer"
      title={props.link.label}
      class={`flex items-center gap-1.5 rounded-md text-mute hover:text-fg transition-colors ${props.class ?? ''}`}
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
