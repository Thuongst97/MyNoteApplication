import { describe, expect, it } from 'vitest'
import { diagramSvg } from '@/components/Editor/pageCopy'

describe('diagram export', () => {
  it('uses the natural size (not the size it is shown at) and valid XML', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<svg width="100%" viewBox="-50 -10 1025 871" style="max-width: 1025px;"><foreignObject width="100" height="40"><div>Line one<br>line two</div></foreignObject></svg>'
    const svg = diagramSvg(root)!
    expect(svg).toMatch(/<svg[^>]* width="1025"/)
    expect(svg).toMatch(/<svg[^>]* height="871"/)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).not.toContain('max-width')
    expect(svg).toContain('<br />') // XML (an SVG image fails to load with HTML's <br>)
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull()
  })
  it('falls back to numeric width/height without a viewBox', () => {
    const root = document.createElement('div')
    root.innerHTML = '<svg width="640px" height="320"><rect width="10" height="10"/></svg>'
    const svg = diagramSvg(root)!
    expect(svg).toMatch(/width="640"/)
    expect(svg).toMatch(/height="320"/)
  })
  it('returns null when nothing is drawn', () => {
    expect(diagramSvg(document.createElement('div'))).toBeNull()
  })
})
