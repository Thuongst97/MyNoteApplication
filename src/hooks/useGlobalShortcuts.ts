import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useTabsStore } from '@/stores/useTabsStore'
import { useFindStore } from '@/stores/useFindStore'
import { isMacLike } from '@/lib/utils'

/**
 * App-wide keyboard shortcuts:
 *  - Ctrl/⌘+Shift+F  search all pages, whiteboards and presentations
 *  - Ctrl/⌘+F        find in the open tab (see FindBar)
 *  - Ctrl/⌘+N        new page
 *  - Ctrl/⌘+\        toggle sidebar
 *  - Ctrl/⌘+Shift+L  toggle dark/light mode
 *  - Ctrl/⌘+Shift+T  open Tasks (Eisenhower Matrix)
 *  - Ctrl/⌘+Shift+G  open Graph view
 * Tabs:
 *  - Ctrl/⌘+T new tab · Ctrl/⌘+W close tab · Ctrl/⌘+1…8 go to tab, 9 = last tab
 *  - Ctrl+Tab / Ctrl+Shift+Tab (also Ctrl+PageDown/PageUp) next / previous tab
 *  - Alt+← / Alt+→ (⌘+[ / ⌘+] on Mac, mouse back/forward buttons) back / forward
 * On a whiteboard, Ctrl+F / Ctrl+K / Ctrl+Shift+G / Ctrl+Shift+L belong to the canvas.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      // Full-window editors (drawing, mind map, diagram viewer) have their own shortcuts.
      if (document.body.classList.contains('drawing-open')) return
      // On a whiteboard, keys the canvas uses itself (Ctrl+K link, Ctrl+Shift+G ungroup,
      // Ctrl+Shift+L lock) are left to it; tabs, back/forward, new page… still work.
      const onBoard = document.body.classList.contains('whiteboard-open')
      const tabs = useTabsStore.getState()
      // Back / forward: Alt+←/→ (not on Mac, where Option+←/→ moves by word while typing).
      if (!isMacLike() && e.altKey && !mod && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
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
      // Ctrl+F on a whiteboard: the canvas has its own search.
      if (onBoard && ((key === 'f' && !e.shiftKey) || key === 'k' || (e.shiftKey && (key === 'g' || key === 'l')))) return
      if (key === 't' && !e.shiftKey) {
        e.preventDefault()
        tabs.newTab()
      } else if (key === 'w' && !e.shiftKey) {
        e.preventDefault()
        tabs.closeTab(tabs.activeTabId)
      } else if (key === 'f' && e.shiftKey) {
        e.preventDefault()
        useFindStore.getState().setOpen(false)
        s.setSearchOpen(!s.isSearchOpen)
      } else if (key === 'f') {
        e.preventDefault()
        const find = useFindStore.getState()
        // Views without a find target (Tasks, Graph, new tab) use the search of all pages.
        if (!find.provider) {
          s.setSearchOpen(true)
          return
        }
        s.setSearchOpen(false)
        const selected = find.provider.selectedText?.() ?? ''
        if (selected && !selected.includes('\n') && selected.length <= 200) find.set({ query: selected })
        find.requestFocus()
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
