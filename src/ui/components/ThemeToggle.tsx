import { useTheme, type ThemeMode } from '../context/theme.tsx'

const ICONS: Record<ThemeMode, string> = {
  light:
    'M12 4V2M12 22v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  dark: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z',
  system: 'M3 6h18v10H3z M8 20h8 M12 16v4',
}

const LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' }
const ORDER: ThemeMode[] = ['system', 'light', 'dark']

const next = (m: ThemeMode): ThemeMode => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]!

export const ThemeToggle = () => {
  const { mode, setMode } = useTheme()

  return (
    <button
      type="button"
      title={`Theme: ${LABELS[mode()]}`}
      aria-label={`Theme: ${LABELS[mode()]}. Switch to ${LABELS[next(mode())]}`}
      onClick={() => setMode(next(mode()))}
      class="flex items-center justify-center w-8 h-8 rounded-md text-mute hover:text-fg transition-colors cursor-pointer"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d={ICONS[mode()]} />
      </svg>
    </button>
  )
}
