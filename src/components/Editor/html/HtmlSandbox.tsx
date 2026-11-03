import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export const SANDBOX_ORIGIN = 'pn-sandbox://frame'
const MIN_H = 24
const MAX_H = 4000

/**
 * The document an interactive block runs: the block's HTML plus a base style matching the
 * app's theme and a tiny script reporting its height (so the frame grows with its content).
 */
export function sandboxDocument(source: string, theme: 'light' | 'dark'): string {
  const color = theme === 'dark' ? '#e3e3e1' : '#37352f'
  const head = `<meta charset="utf-8"><style>
:root { color-scheme: ${theme}; }
html, body { margin: 0; background: transparent; }
body { font: 16px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: ${color}; overflow-wrap: anywhere; }
img, video, svg, canvas { max-width: 100%; }
</style><script>
(function () {
  var last = 0;
  // The content's own height (not the frame's): the root is a flow-root so margins count.
  function report() {
    var root = document.getElementById('pn-root');
    if (!root) return;
    var h = Math.ceil(Math.max(root.getBoundingClientRect().height, root.scrollHeight));
    if (h !== last) { last = h; parent.postMessage({ type: 'pn-height', height: h }, '*'); }
  }
  addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('pn-root');
    if (root) new ResizeObserver(report).observe(root);
    report();
  });
  addEventListener('load', report);
})();
</script>`
  return `<!doctype html><html><head>${head}</head><body><div id="pn-root" style="display:flow-root">${source}</div></body></html>`
}

/** Height reported by a frame, kept within sane limits (a block can't grow without bound). */
export function clampHeight(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(MIN_H, Math.min(MAX_H, Math.round(n)))
}

/**
 * Runs an HTML block's scripts in a sandboxed frame: opaque origin (no access to the app,
 * its data or its API), no popups, forms or navigation, and no network unless `allowNetwork`.
 */
export function HtmlSandbox({ source, allowNetwork }: { source: string; allowNetwork?: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const theme = useAppStore((s) => s.theme)
  const [height, setHeight] = useState(120)
  const src = `${SANDBOX_ORIGIN}/${allowNetwork ? 'online' : 'offline'}`

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const doc = sandboxDocument(source, theme)
    const onMessage = (e: MessageEvent) => {
      // Only this block's own frame is listened to.
      if (e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return
      if (e.data.type === 'pn-ready') frame.contentWindow?.postMessage({ type: 'pn-run', html: doc }, '*')
      else if (e.data.type === 'pn-height') {
        const h = clampHeight(e.data.height)
        if (h !== null) setHeight(h)
      }
    }
    window.addEventListener('message', onMessage)
    // Changing the source (or theme) restarts the block from a fresh frame.
    frame.src = `${src}?r=${Date.now().toString(36)}`
    return () => window.removeEventListener('message', onMessage)
  }, [source, theme, src])

  return (
    <iframe
      ref={frameRef}
      title="Interactive HTML"
      data-testid="html-sandbox"
      sandbox="allow-scripts"
      allow=""
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-transparent"
      style={{ height, colorScheme: theme }}
    />
  )
}
