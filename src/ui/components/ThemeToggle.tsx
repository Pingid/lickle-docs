import { useTheme, type ThemeMode } from '../context/theme.tsx'
import { For } from 'solid-js'

const ICONS: Record<ThemeMode, string> = {
  light:
    'M12 4V2M12 22v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  dark: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z',
  system: 'M3 6h18v10H3z M8 20h8 M12 16v4',
}

const LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' }

export const ThemeToggle = () => {
  const { mode, setMode } = useTheme()
  const order: ThemeMode[] = ['system', 'light', 'dark']

  return (
    <div role="radiogroup" aria-label="Theme" class="inline-flex items-center gap-0.5">

      <For each={order}>
        {(m) => (
          <button
            type="button"
            role="radio"
            aria-checked={mode() === m}
            title={LABELS[m]}
            onClick={() => setMode(m)}
            class="px-2 py-1 rounded-[5px] transition-colors duration-150 text-mute hover:text-fg cursor-pointer"
            classList={{
              'bg-hover text-fg': mode() === m,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d={ICONS[m]} />
            </svg>
          </button>
        )}
      </For>
    </div>
  )
}
