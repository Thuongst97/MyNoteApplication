// Fallback for environments that don't load public/excalidraw-asset-path.js (e.g. tests).
// The real setting happens in that classic script, which runs before any module code;
// Excalidraw reads the path when its module loads.
const w = window as unknown as { EXCALIDRAW_ASSET_PATH?: string }
if (typeof w.EXCALIDRAW_ASSET_PATH !== 'string') w.EXCALIDRAW_ASSET_PATH = new URL('excalidraw-assets/', window.location.href).toString()

export {}
