/**
 * Interactive HTML blocks run their scripts in an <iframe sandbox="allow-scripts"> loaded
 * from pn-sandbox://frame/<offline|online>. The page there is a tiny shell that receives the
 * block's HTML by postMessage and writes it into itself. The frame has an opaque origin (no
 * access to the app, its storage or its API), and its Content-Security-Policy decides what
 * the block may load: nothing from the network unless the block allows it.
 * Kept free of Electron imports so it can be unit-tested.
 */
export const SANDBOX_SCHEME = 'pn-sandbox'

/** CSP for a block's frame. `online`: may load scripts/styles/images and fetch over https. */
export function sandboxCsp(online: boolean): string {
  const net = online ? ' https:' : ''
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' blob: data:${net}`,
    `style-src 'unsafe-inline' data:${net}`,
    `img-src data: blob:${net}`,
    `font-src data:${net}`,
    `media-src data: blob:${net}`,
    `connect-src ${online ? 'https: wss:' : "'none'"}`,
    "worker-src blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
}

/** The frame's shell: waits for the block's HTML from the app, then becomes that document. */
export const SANDBOX_SHELL = `<!doctype html><html><head><meta charset="utf-8"><script>
(function () {
  function onMessage(e) {
    if (e.source !== parent || !e.data || e.data.type !== 'pn-run' || typeof e.data.html !== 'string') return;
    window.removeEventListener('message', onMessage);
    document.open();
    document.write(e.data.html);
    document.close();
  }
  window.addEventListener('message', onMessage);
  parent.postMessage({ type: 'pn-ready' }, '*');
})();
</script></head><body></body></html>`

/** The response for a pn-sandbox:// request, or null (anything else is refused). */
export function sandboxResponse(url: string): { body: string; headers: Record<string, string> } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${SANDBOX_SCHEME}:` || u.hostname !== 'frame' || (u.pathname !== '/offline' && u.pathname !== '/online')) return null
  return {
    body: SANDBOX_SHELL,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': sandboxCsp(u.pathname === '/online'),
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  }
}

/** May a sub-frame navigate to `url`? Only the sandbox shell (no web pages inside the app). */
export function isAllowedFrameUrl(url: string): boolean {
  return sandboxResponse(url) !== null
}
