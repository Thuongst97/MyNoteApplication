import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'

/**
 * App-wide keyboard shortcuts:
 *  - Ctrl/⌘+K        open search
 *  - Ctrl/⌘+N        new page
 *  - Ctrl/⌘+\        toggle sidebar
 *  - Ctrl/⌘+Shift+L  toggle dark/light mode
 *  - Ctrl/⌘+Shift+T  open Tasks (Eisenhower Matrix)
 *  - Ctrl/⌘+Shift+G  open Graph view
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.altKey) return
      // The full-window drawing editor has its own shortcuts.
      if (document.body.classList.contains('drawing-open')) return
      const s = useAppStore.getState()
      const key = e.key.toLowerCase()
      if (key === 'k' && !e.shiftKey) {
        e.preventDefault()
        s.setSearchOpen(!s.isSearchOpen)
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault()
        void s.createPage(null)
      } else if (e.key === '\\') {
        e.preventDefault()
        s.toggleSidebar()
      } else if (key === 'g' && e.shiftKey) {
        e.preventDefault()
        s.openGraph()
      } else if (key === 't' && e.shiftKey) {
        e.preventDefault()
        s.openTasks()
      } else if (key === 'l' && e.shiftKey) {
        e.preventDefault()
        s.toggleTheme()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
