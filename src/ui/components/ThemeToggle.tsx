import { Dynamic } from 'solid-js/web'

import { useTheme, type ThemeMode } from '../context/theme.tsx'
import { DisplayIcon, IconButton, MoonIcon, SunIcon } from '../primitives/index.ts'

/**
 * Cycles the site between system, light and dark. The label spells out both
 * the current mode and the one a click moves to, which a lone icon can't.
 *
 * @group components
 */
export const ThemeToggle = () => {
  const { mode, setMode } = useTheme()
  return (
    <IconButton
      label={`Theme: ${LABELS[mode()]}. Switch to ${LABELS[next(mode())]}`}
      onClick={() => setMode(next(mode()))}
    >
      <Dynamic component={ICONS[mode()]} size={15} />
    </IconButton>
  )
}

const next = (m: ThemeMode): ThemeMode => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]!

const ICONS = { light: SunIcon, dark: MoonIcon, system: DisplayIcon } as const
const LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' }
const ORDER: ThemeMode[] = ['system', 'light', 'dark']
