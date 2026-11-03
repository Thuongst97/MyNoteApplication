import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'

const saveAsset = vi.fn(async (_d: Uint8Array, mime: string) => `notion-asset://local/00000000-0000-0000-0000-000000000000.${mime.split('/')[1]}`)
vi.mock('@/lib/api', () => ({ api: { saveAsset: (d: Uint8Array, m: string) => saveAsset(d, m) } }))

const { imageFilesFrom, insertImageFiles } = await import('@/lib/images')
const { doc, makeEditor, p } = await import('../editor/helpers')

let editor: Editor
afterEach(() => editor?.destroy())

const file = (name: string, type: string, size = 4) => new File([new Uint8Array(size)], name, { type })

describe('images', () => {
  it('picks only supported image files from a paste/drop', () => {
    const files = [file('a.png', 'image/png'), file('b.txt', 'text/plain'), file('c.webp', 'image/webp')]
    const dt = { files } as unknown as DataTransfer
    expect(imageFilesFrom(dt).map((f) => f.name)).toEqual(['a.png', 'c.webp'])
    expect(imageFilesFrom(null)).toEqual([])
  })

  it('stores each file and inserts it as an image block', async () => {
    editor = makeEditor(doc(p('Text'), p()))
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    await insertImageFiles(editor, [file('shot.png', 'image/png'), file('two.jpeg', 'image/jpeg')])
    const images = editor.getJSON().content!.filter((n) => n.type === 'image')
    expect(images.map((i) => i.attrs!.src)).toEqual([expect.stringMatching(/\.png$/), expect.stringMatching(/\.jpeg$/)])
    expect(images[0].attrs!.alt).toBe('shot.png')
    expect(saveAsset).toHaveBeenCalledTimes(2)
  })

  it('skips files over 25 MB with a message', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    editor = makeEditor(doc(p()))
    const big = file('big.png', 'image/png')
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 })
    await insertImageFiles(editor, [big])
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('25 MB'))
    expect(saveAsset).not.toHaveBeenCalled()
  })

  it('reports storage errors', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    saveAsset.mockRejectedValueOnce(new Error('disk full'))
    editor = makeEditor(doc(p()))
    await insertImageFiles(editor, [file('a.png', 'image/png')])
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('disk full'))
  })
})

describe('pickImageFile', () => {
  const capture = () => {
    let input: HTMLInputElement | null = null
    const orig = HTMLInputElement.prototype.click
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      input = this
    }
    return { get: () => input!, restore: () => (HTMLInputElement.prototype.click = orig) }
  }

  it('resolves to null when the picker is cancelled (no stuck "Uploading…")', async () => {
    const { pickImageFile } = await import('@/lib/images')
    const c = capture()
    const p = pickImageFile()
    c.get().dispatchEvent(new Event('cancel'))
    expect(await p).toBeNull()
    c.restore()
  })

  it('resolves to the chosen file', async () => {
    const { pickImageFile } = await import('@/lib/images')
    const c = capture()
    const p = pickImageFile()
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    Object.defineProperty(c.get(), 'files', { value: [file] })
    c.get().dispatchEvent(new Event('change'))
    expect(await p).toBe(file)
    c.restore()
  })

  it('falls back to "cancelled" when the window regains focus without a file', async () => {
    vi.useFakeTimers()
    const { pickImageFile } = await import('@/lib/images')
    const c = capture()
    const p = pickImageFile()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(600)
    expect(await p).toBeNull()
    c.restore()
    vi.useRealTimers()
  })
})
