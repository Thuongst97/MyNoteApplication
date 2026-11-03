import { createContext, useContext } from 'react'
import { useAppStore, type Theme } from '@/stores/useAppStore'

/**
 * The light/dark look blocks should use. Normally the app's theme; inside a themed slide it's
 * the slide's (a dark slide in light mode draws its charts and diagrams for a dark background).
 */
export const SurfaceThemeContext = createContext<Theme | null>(null)

export function useDocTheme(): Theme {
  const surface = useContext(SurfaceThemeContext)
  const app = useAppStore((s) => s.theme)
  return surface ?? app
}
