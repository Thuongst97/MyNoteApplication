// Loaded before the app (classic script, so it runs before any module code):
// Excalidraw reads this when it loads to find its bundled fonts instead of its CDN (which the
// Content Security Policy blocks). Excalidraw fetch()es the fonts, which doesn't work for
// file:// pages, so the packaged app serves them through the app-font:// scheme.
window.EXCALIDRAW_ASSET_PATH =
  window.location.protocol === 'file:' ? 'app-font://bundle/' : new URL('excalidraw-assets/', window.location.href).href
