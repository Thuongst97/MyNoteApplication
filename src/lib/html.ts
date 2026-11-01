import DOMPurify from 'dompurify'

/**
 * HTML block support: user-written HTML is sanitized (no scripts, event handlers,
 * frames, forms or <link>/<base>) and shown inside a Shadow DOM, so its <style>
 * rules only affect the block itself, never the app.
 */

const purifier = typeof window !== 'undefined' ? DOMPurify(window) : null
purifier?.addHook('afterSanitizeAttributes', (node) => {
  // Links open in the browser, not inside the app.
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})
purifier?.addHook('uponSanitizeElement', (node, data) => {
  // No loading of other stylesheets (also blocked by the app's CSP).
  if (data.tagName === 'style') node.textContent = (node.textContent ?? '').replace(/@import[^;]*;?/gi, '')
})

/** `html` / `body` selectors in the user's CSS apply to the block's root instead. */
export function scopeCss(css: string): string {
  return css.replace(/(^|[\s,{}>+~])(html|body)(?=[\s,{.:#[>+~]|$)/gi, '$1.html-root')
}

/** Sanitized HTML for the block (a full document's <head> styles are kept). */
export function sanitizeHtml(source: string): string {
  if (!purifier || !source.trim()) return ''
  let input = source
  if (/<(html|head|body)[\s>]/i.test(source)) {
    // A whole document: keep its styles and body. (DOMParser never runs scripts.)
    const doc = new DOMParser().parseFromString(source, 'text/html')
    input = [...doc.querySelectorAll('style')].map((s) => s.outerHTML).join('') + doc.body.innerHTML
  }
  const clean = purifier.sanitize(input, {
    ADD_TAGS: ['style'],
    FORCE_BODY: true,
    FORBID_TAGS: ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'link', 'meta', 'base'],
    FORBID_ATTR: ['srcdoc', 'formaction'],
  })
  return clean.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, a: string, css: string, b: string) => a + scopeCss(css) + b)
}

/** Plain text of an HTML block (for search). Works without a DOM (main process). */
export function htmlToText(source: string): string {
  return source
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}
