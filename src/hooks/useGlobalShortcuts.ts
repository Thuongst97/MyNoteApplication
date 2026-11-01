import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useTabsStore } from '@/stores/useTabsStore'

/**
 * App-wide keyboard shortcuts:
 *  - Ctrl/⌘+K        open search
 *  - Ctrl/⌘+N        new page
 *  - Ctrl/⌘+\        toggle sidebar
 *  - Ctrl/⌘+Shift+L  toggle dark/light mode
 *  - Ctrl/⌘+Shift+T  open Tasks (Eisenhower Matrix)
 *  - Ctrl/⌘+Shift+G  open Graph view
 * Tabs:
 *  - Ctrl/⌘+T new tab · Ctrl/⌘+W close tab · Ctrl/⌘+1…8 go to tab, 9 = last tab
 *  - Ctrl+Tab / Ctrl+Shift+Tab (also Ctrl+PageDown/PageUp) next / previous tab
 *  - Alt+← / Alt+→ (⌘+[ / ⌘+] on Mac, mouse back/forward buttons) back / forward
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      // The full-window drawing editor has its own shortcuts.
      if (document.body.classList.contains('drawing-open')) return
      const tabs = useTabsStore.getState()
      // Back / forward
      if (e.altKey && !mod && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        if (e.key === 'ArrowLeft') tabs.back()
        else tabs.forward()
        return
      }
      if (!mod || e.altKey) return
      if (e.metaKey && !e.shiftKey && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        if (e.key === '[') tabs.back()
        else tabs.forward()
        return
      }
      if ((e.ctrlKey && e.key === 'Tab') || (e.ctrlKey && (e.key === 'PageDown' || e.key === 'PageUp'))) {
        e.preventDefault()
        tabs.cycle(e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1)
        return
      }
      if (!e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const n = Number(e.key)
        const list = tabs.tabs
        const tab = n === 9 ? list[list.length - 1] : list[n - 1]
        if (tab) tabs.switchTab(tab.id)
        return
      }
      const s = useAppStore.getState()
      const key = e.key.toLowerCase()
      if (key === 't' && !e.shiftKey) {
        e.preventDefault()
        tabs.newTab()
      } else if (key === 'w' && !e.shiftKey) {
        e.preventDefault()
        tabs.closeTab(tabs.activeTabId)
      } else if (key === 'k' && !e.shiftKey) {
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
    // Mouse back/forward buttons.
    const onMouse = (e: MouseEvent) => {
      if (e.button !== 3 && e.button !== 4) return
      if (document.body.classList.contains('drawing-open')) return
      e.preventDefault()
      if (e.button === 3) useTabsStore.getState().back()
      else useTabsStore.getState().forward()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [])
}
