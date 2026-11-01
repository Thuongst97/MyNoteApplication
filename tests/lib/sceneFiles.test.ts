import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saveAsset = vi.fn(async (_data: Uint8Array, mime: string) => `notion-asset://local/${'0'.repeat(8)}-0000-0000-0000-${String(saveAsset.mock.calls.length).padStart(12, '0')}.${mime === 'image/png' ? 'png' : 'jpg'}`)
vi.mock('@/lib/api', () => ({ api: { saveAsset: (d: Uint8Array, m: string) => saveAsset(d, m) } }))

import { externalizeFiles, externalizeFilesSync, inlineFiles, replaceInSvg, resetSceneFileCache } from '@/lib/sceneFiles'
import { sanitizeSvg } from '@/lib/sanitize'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const file = (id: string, dataURL: string) => ({ id, dataURL, mimeType: 'image/png', created: 1 })

beforeEach(() => {
  resetSceneFileCache()
  saveAsset.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

describe('scene image files', () => {
  it('uploads inline images once and stores asset URLs instead of base64', async () => {
    const files = { f1: file('f1', PNG), f2: file('f2', 'notion-asset://local/11111111-1111-1111-1111-111111111111.png') }
    expect(externalizeFilesSync(files)).toBeNull() // f1 not uploaded yet
    const { files: out, replaced } = await externalizeFiles(files)
    expect(saveAsset).toHaveBeenCalledTimes(1)
    expect(saveAsset.mock.calls[0][1]).toBe('image/png')
    expect(saveAsset.mock.calls[0][0]).toBeInstanceOf(Uint8Array)
    const url = (out.f1 as { dataURL: string }).dataURL
    expect(url).toMatch(/^notion-asset:\/\/local\//)
    expect(out.f1).toMatchObject({ id: 'f1', mimeType: 'image/png', created: 1 })
    expect(out.f2).toEqual(files.f2)
    expect(replaced.get(PNG)).toBe(url)
    // Later saves reuse the upload, synchronously.
    expect(externalizeFilesSync(files)).toEqual(out)
    await externalizeFiles(files)
    expect(saveAsset).toHaveBeenCalledTimes(1)
  })

  it('uploads the same new image only once when saves overlap', async () => {
    const files = { f1: file('f1', PNG) }
    await Promise.all([externalizeFiles(files), externalizeFiles(files), externalizeFiles(files)])
    expect(saveAsset).toHaveBeenCalledTimes(1)
  })

  it('keeps an image inline when it cannot be stored', async () => {
    saveAsset.mockRejectedValueOnce(new Error('disk full'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { files } = await externalizeFiles({ f1: file('f1', PNG) })
    expect((files.f1 as { dataURL: string }).dataURL).toBe(PNG)
    warn.mockRestore()
  })

  it('rewrites SVG previews to the stored images, which the sanitizer keeps', async () => {
    const { replaced } = await externalizeFiles({ f1: file('f1', PNG) })
    const svg = replaceInSvg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="${PNG}"/><image href="${PNG}"/></svg>`, replaced)
    expect(svg).not.toContain('base64')
    const url = replaced.get(PNG)!
    expect(sanitizeSvg(svg)).toContain(`href="${url}"`)
    // Other schemes are still removed.
    expect(sanitizeSvg('<svg><image href="notion-asset://evil/../x.png"/><image href="https://x.y/a.png"/></svg>')).not.toMatch(/href=/)
  })

  it('loads stored images back as data URLs (and does not upload them again)', async () => {
    const assetUrl = 'notion-asset://local/22222222-2222-2222-2222-222222222222.png'
    const bytes = Uint8Array.from(atob(PNG.split(',')[1]), (c) => c.charCodeAt(0))
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (u === assetUrl) return { blob: async () => new Blob([bytes], { type: 'image/png' }) }
      if (u === 'notion-asset://local/33333333-3333-3333-3333-333333333333.png') throw new Error('missing')
      throw new Error('unexpected ' + u)
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await inlineFiles({ a: file('a', assetUrl), b: file('b', PNG), gone: file('gone', 'notion-asset://local/33333333-3333-3333-3333-333333333333.png') })
    warn.mockRestore()
    expect((out.a as { dataURL: string }).dataURL).toBe(PNG)
    expect(out.b).toEqual(file('b', PNG))
    expect(out.gone).toBeUndefined()
    // Saving the board again keeps the existing asset.
    expect(externalizeFilesSync({ a: out.a })).toEqual({ a: file('a', assetUrl) })
  })
})
