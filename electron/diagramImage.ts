import { BrowserWindow, type NativeImage } from 'electron'
import { svgSize } from './clipboardRich'

/**
 * Draws a diagram's SVG into a PNG. Diagrams use HTML inside SVG (Mermaid labels), which a
 * canvas can't export, so the SVG is shown in a hidden, script-free window and captured.
 */
export async function svgToPng(svg: string, background: string, scale = 2): Promise<NativeImage> {
  const { width, height } = svgSize(svg)
  const s = Math.max(1, Math.min(3, scale, 12000 / Math.max(width, height)))
  const win = new BrowserWindow({
    show: false,
    width: Math.ceil(width * s) + 2,
    height: Math.ceil(height * s) + 2,
    useContentSize: true,
    frame: false,
    webPreferences: { offscreen: true, javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false, zoomFactor: s, images: true },
  })
  try {
    const bg = /^#[0-9a-f]{3,8}$|^[a-z]+$/i.test(background) ? background : '#ffffff'
    const sized = svg.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
      const rest = attrs.replace(/\s(width|height)="[^"]*"/gi, '').replace(/\sstyle="[^"]*"/i, '')
      return `<svg${rest} width="${width}" height="${height}" style="display:block">`
    })
    const page = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}</style></head><body>${sized}</body></html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
    await new Promise((r) => setTimeout(r, 150)) // let it paint
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: Math.ceil(width * s), height: Math.ceil(height * s) })
    return img
  } finally {
    win.destroy()
  }
}
