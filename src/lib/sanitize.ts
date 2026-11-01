import DOMPurify from 'dompurify'

/**
 * Cleans SVG markup before it's put into the page: drawing previews (which can arrive
 * through pasted content) and library thumbnails (from downloaded libraries).
 * Removes scripts, event handlers, foreign HTML and javascript: links; keeps shapes,
 * text, embedded fonts (<style> with data: URLs) and data: images.
 */
export function sanitizeSvg(markup: string): string {
  if (!markup) return ''
  return DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['style', 'use'],
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed', 'a'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onbegin', 'onend'],
    // <image href="data:..."> (embedded pictures) is fine; remote and javascript: URLs are not.
    ALLOWED_URI_REGEXP: /^(?:data:image\/(?:png|jpe?g|gif|webp|svg\+xml);|#)/i,
  })
}

export { coverToCss } from './pageMeta'
