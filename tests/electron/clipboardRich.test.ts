// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assetUrlsIn, inlineAssetImages, singleImageSrc } from '../../electron/clipboardRich'

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
})
