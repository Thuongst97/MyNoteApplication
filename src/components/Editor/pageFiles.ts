import { generateJSON, type JSONContent } from '@tiptap/core'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { markdownToHtml } from '@/lib/markdown'
import { newId } from '@/lib/utils'
import { useAppStore } from '@/stores/useAppStore'
import { createEditorExtensions } from './extensions'

/** Turns a Markdown document into a page: a leading "# Heading" becomes the title. */
export function markdownToPage(fileName: string, text: string): { title: string; content: JSONContent } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const first = lines.findIndex((l) => l.trim() !== '')
  let title = fileName
  let body = lines.join('\n')
  const h1 = first >= 0 ? /^#\s+(.+?)\s*#*\s*$/.exec(lines[first]) : null
  if (h1) {
    title = h1[1]
    body = lines.slice(first + 1).join('\n')
  }
  const content = generateJSON(markdownToHtml(body), createEditorExtensions()) as JSONContent
  return { title: title.trim() || 'Untitled', content }
}

const message = (err: unknown) => String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Saves a page (and its sub-pages) to a .ncpage file chosen by the user. */
export async function exportPageToFile(pageId: string, includeChildren = true) {
  const { showToast } = useAppStore.getState()
  try {
    // Unsaved edits are written first, so the file has the latest content.
    await autoSaver.flushAll()
    const r = await api.pageFiles.export(pageId, includeChildren)
    if (!r.ok) return
    const extra = [r.pages > 1 && `${r.pages} pages`, r.images > 0 && `${r.images} image${r.images === 1 ? '' : 's'}`].filter(Boolean).join(', ')
    showToast(`Exported${extra ? ` (${extra})` : ''} — share the file and import it with “Import”`)
  } catch (err) {
    showToast(`Could not export: ${message(err)}`)
  }
}

/** Imports a .ncpage or Markdown file as new page(s) under `parentId` and opens it. */
export async function importPageFile(parentId: string | null = null) {
  const store = useAppStore.getState()
  try {
    await autoSaver.flushAll()
    const r = await api.pageFiles.import(parentId)
    if (!r) return
    let rootId: string
    let count = 1
    if (r.kind === 'markdown') {
      const { title, content } = markdownToPage(r.name, r.text)
      rootId = newId()
      await api.savePage({ id: rootId, parentId, title, content })
    } else {
      rootId = r.rootId
      count = r.count
    }
    await store.loadPages()
    if (parentId) store.toggleExpanded(parentId, true)
    store.setActivePage(rootId)
    const skipped = r.kind === 'pages' && r.skippedImages > 0 ? ` (${r.skippedImages} image${r.skippedImages === 1 ? '' : 's'} could not be imported)` : ''
    store.showToast(`Imported ${count === 1 ? 'page' : `${count} pages`}${skipped}`)
  } catch (err) {
    store.showToast(`Could not import: ${message(err)}`)
  }
}
