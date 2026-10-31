import type { Editor } from '@tiptap/react'
import { api } from './api'

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
]
const MAX_BYTES = 25 * 1024 * 1024

/** Image files contained in a paste/drop, in order. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((f) => IMAGE_MIME_TYPES.includes(f.type))
}

/**
 * Stores each file (as a file in the app's data folder, or a data URL in a
 * browser) and inserts it as an image block at `pos` (default: the cursor).
 */
export async function insertImageFiles(editor: Editor, files: File[], pos?: number) {
  let insertAt = pos
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      window.alert(`"${file.name || 'Image'}" is larger than 25 MB and was not added.`)
      continue
    }
    try {
      const src = await api.saveAsset(new Uint8Array(await file.arrayBuffer()), file.type)
      if (editor.isDestroyed) return
      const node = { type: 'image', attrs: { src, alt: file.name || null } }
      const chain = editor.chain().focus()
      if (insertAt === undefined) chain.insertContent(node)
      else chain.insertContentAt(insertAt, node)
      chain.run()
      // Following images go after the one just inserted.
      insertAt = editor.state.selection.to
    } catch (err) {
      console.error('[images] failed to add image', err)
      window.alert(`Couldn't add image: ${(err as Error)?.message ?? err}`)
    }
  }
}

/** Opens the system file picker and inserts the chosen images. */
export function pickAndInsertImages(editor: Editor) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = IMAGE_MIME_TYPES.join(',')
  input.multiple = true
  input.onchange = () => {
    const files = Array.from(input.files ?? [])
    if (files.length) void insertImageFiles(editor, files)
  }
  input.click()
}
