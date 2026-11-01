import DOMPurify from 'dompurify'

/** Link targets allowed inside SVG: embedded pictures (data: images) and in-document references. */
const SAFE_SVG_LINK = /^(?:data:image\/(?:png|jpe?g|gif|webp|svg\+xml);|#)/i
const LINK_ATTRS = new Set(['href', 'xlink:href', 'src'])
/** CSS url(...) that points anywhere but a data: URL or an in-document #reference. */
const REMOTE_CSS_URL = /url\(\s*(['"]?)\s*(?!data:|#)/i

// A dedicated instance, so these rules don't affect other sanitizing (e.g. Markdown).
const svgPurifier = typeof window !== 'undefined' ? DOMPurify(window) : null
svgPurifier?.addHook('uponSanitizeAttribute', (_node, data) => {
  const name = data.attrName.toLowerCase()
  const value = String(data.attrValue ?? '').trim()
  if (LINK_ATTRS.has(name) && !SAFE_SVG_LINK.test(value)) data.keepAttr = false
  if (name === 'style' && REMOTE_CSS_URL.test(value)) data.keepAttr = false
})
svgPurifier?.addHook('uponSanitizeElement', (node, data) => {
  // <style> may only embed fonts/images as data: URLs (no remote loads).
  if (data.tagName === 'style' && REMOTE_CSS_URL.test(node.textContent ?? '')) node.textContent = (node.textContent ?? '').replace(/url\(\s*(['"]?)\s*(?!data:|#)[^)]*\)/gi, 'none')
})

/**
 * Cleans SVG markup before it's put into the page: drawing previews (which can arrive
 * through pasted content) and library thumbnails (from downloaded libraries).
 * Removes scripts, event handlers, foreign HTML and javascript:/remote links; keeps shapes
 * (paths, viewBox, transforms, strokes), text, embedded fonts (data: URLs) and data: images.
 *
 * Note: link targets are checked by a hook rather than DOMPurify's ALLOWED_URI_REGEXP,
 * because that option is applied to *every* attribute value — it would delete path data,
 * viewBox and transforms and leave the drawing empty.
 */
export function sanitizeSvg(markup: string): string {
  if (!markup || !svgPurifier) return ''
  return svgPurifier.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['style', 'use'],
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed', 'a'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onbegin', 'onend'],
  })
}

export { coverToCss } from './pageMeta'
