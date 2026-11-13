// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assetUrlsIn, inlineAssetImages, singleImageSrc, svgSize } from '../../electron/clipboardRich'

const A = 'notion-asset://local/11111111-2222-3333-4444-555555555555.png'
const B = 'notion-asset://local/aaaaaaaa-2222-3333-4444-555555555555.jpg'

describe('clipboard with images', () => {
  it('embeds stored images as data: URLs (once per image), keeping unknown ones', async () => {
    const html = `<p>x</p><img src="${A}"><img src="${A}"><img src="${B}">`
    expect(assetUrlsIn(html)).toEqual([A, B])
    const read = async (url: string) => (url === A ? { data: new Uint8Array([1, 2, 3]), mime: 'image/png' } : null)
    const out = await inlineAssetImages(html, read)
    expect(out).toBe(`<p>x</p><img src="data:image/png;base64,AQID"><img src="data:image/png;base64,AQID"><img src="${B}">`)
    expect(await inlineAssetImages('<p>no images</p>', read)).toBe('<p>no images</p>')
  })
  it('puts a picture on the clipboard only for a single image', () => {
    expect(singleImageSrc('<p>a</p><img alt="x" src="data:image/png;base64,AA">')).toBe('data:image/png;base64,AA')
    expect(singleImageSrc('<img src="a"><img src="b">')).toBeNull()
    expect(singleImageSrc('<p>text</p>')).toBeNull()
  })
  it('reads a diagram size from width/height or viewBox', () => {
    expect(svgSize('<svg width="300" height="120px">')).toEqual({ width: 300, height: 120 })
    expect(svgSize('<svg width="100%" viewBox="0 0 812.5 400" style="max-width: 812px">')).toEqual({ width: 813, height: 400 })
    expect(svgSize('<svg>')).toEqual({ width: 600, height: 600 })
    expect(svgSize('<svg width="99999" height="5">').width).toBe(8000)
  })
})
