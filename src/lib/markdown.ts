import DOMPurify from 'dompurify'
import { Marked } from 'marked'

/** GitHub-flavored Markdown (tables, task lists, strikethrough, fenced code). */
const md = new Marked({ gfm: true, breaks: false })

/** Image sources the app can show; anything else (e.g. relative "docs/x.png") can't be resolved. */
const SAFE_IMG = /^(?:https:|data:image\/(?:png|jpe?g|gif|webp|avif|bmp);|notion-asset:)/i
/** Link targets that are allowed to stay links. */
const SAFE_HREF = /^(?:https?:|mailto:|notionclone:|#)/i

/**
 * Converts Markdown to sanitized HTML.
 * - Scripts, event handlers, iframes, forms and style attributes are removed.
 * - Links keep only http(s)/mailto/app targets.
 * - Images that can't be loaded (relative paths, http:) become a small "🖼 alt" placeholder.
 * - Task lists use the editor's task-list markup; H4–H6 become H3.
 */
export function markdownToHtml(source: string): string {
  const raw = md.parse(source ?? '', { async: false }) as string
  // Template content is inert (nothing loads or runs), so it's safe to restructure before sanitizing.
  const tpl = document.createElement('template')
  tpl.innerHTML = raw
  markTaskLists(tpl.content)
  const clean = DOMPurify.sanitize(tpl.innerHTML, {
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'svg', 'math'],
    FORBID_ATTR: ['style', 'id', 'name'],
    ADD_ATTR: ['data-type', 'data-checked'],
    RETURN_DOM_FRAGMENT: true,
  }) as DocumentFragment
  return fragmentToHtml(postProcess(clean))
}

/** <ul><li><input type=checkbox> text</li></ul> → the editor's task-list markup. */
function markTaskLists(root: DocumentFragment) {
  for (const list of root.querySelectorAll('ul')) {
    const items = [...list.children].filter((c) => c.tagName === 'LI')
    const boxOf = (li: Element) => {
      const host = li.firstElementChild?.tagName === 'P' ? li.firstElementChild : li
      const first = host.firstElementChild
      return first?.tagName === 'INPUT' && first.getAttribute('type') === 'checkbox' && host.firstChild === first ? first : null
    }
    const boxes = items.map(boxOf)
    if (!boxes.some(Boolean)) continue
    const allTasks = boxes.every(Boolean)
    items.forEach((li, i) => {
      const box = boxes[i]
      if (!box) return
      const checked = box.hasAttribute('checked')
      const next = box.nextSibling
      if (next?.nodeType === 3) next.textContent = (next.textContent ?? '').replace(/^\s+/, '')
      if (allTasks) {
        li.setAttribute('data-type', 'taskItem')
        li.setAttribute('data-checked', String(checked))
        box.remove()
      } else {
        box.replaceWith(checked ? '☑ ' : '☐ ')
      }
    })
    if (allTasks) list.setAttribute('data-type', 'taskList')
  }
}

function postProcess(frag: DocumentFragment): DocumentFragment {
  const doc = frag.ownerDocument
  // Only code fences keep a class (their language); nothing else may borrow the app's CSS classes.
  for (const el of frag.querySelectorAll('[class]')) {
    const lang = el.tagName === 'CODE' ? /(?:^|\s)(language-[\w+#-]+)/.exec(el.getAttribute('class') ?? '')?.[1] : null
    if (lang) el.setAttribute('class', lang)
    else el.removeAttribute('class')
  }
  // Headings deeper than H3 map to H3 (the editor has three heading levels).
  for (const h of frag.querySelectorAll('h4, h5, h6')) {
    const h3 = doc.createElement('h3')
    h3.append(...h.childNodes)
    h.replaceWith(h3)
  }
  // marked ends code fences with a newline; the editor's code blocks don't.
  for (const code of frag.querySelectorAll('pre > code')) {
    const last = code.lastChild
    if (last?.nodeType === 3) last.textContent = (last.textContent ?? '').replace(/\n$/, '')
  }
  for (const a of frag.querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? ''
    if (!SAFE_HREF.test(href)) {
      a.replaceWith(...a.childNodes)
      continue
    }
    a.setAttribute('rel', 'noopener noreferrer nofollow')
  }
  for (const img of frag.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? ''
    if (SAFE_IMG.test(src)) continue
    const alt = img.getAttribute('alt') || src.split('/').pop() || 'image'
    const ph = doc.createElement('em')
    ph.setAttribute('title', src)
    ph.textContent = `🖼 ${alt}`
    img.replaceWith(ph)
  }
  return frag
}

function fragmentToHtml(frag: DocumentFragment) {
  const div = frag.ownerDocument.createElement('div')
  div.append(frag)
  return div.innerHTML
}

/**
 * True when pasted plain text is clearly Markdown (so it should be converted to
 * blocks instead of pasted as raw text). Single lines are left alone: the editor's
 * own input/paste rules already handle `**bold**`, `# ` etc. while typing.
 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split(/\r?\n/)
  if (lines.filter((l) => l.trim()).length < 2) return false
  let strong = 0
  let headings = 0
  let headingThenBlank = false
  let weak = 0
  let inFence = false
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) strong++
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^#{1,6}\s+\S/.test(line)) {
      headings++
      if (!(lines[n + 1] ?? '').trim()) headingThenBlank = true
    } else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[n + 1] ?? '')) strong++
    else if (/^\s*[-*+]\s+\[[ xX]\]\s/.test(line)) strong++
    else if (/^\s*([-*+]|\d+[.)])\s+\S/.test(line)) weak++
    else if (/^>\s?\S/.test(line)) weak++
    else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) weak++
    if (/\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\([^)\s]+\)|`[^`\n]+`|!\[[^\]\n]*\]\([^)\s]+\)/.test(line)) weak++
  }
  // Tables, fences and task lists are unambiguous. A "# " line alone could be a code comment,
  // so headings need a blank line after them (Markdown style) or other Markdown around them.
  if (strong > 0) return true
  if (headings > 0) return headingThenBlank || headings + weak >= 2
  return weak >= 3
}
