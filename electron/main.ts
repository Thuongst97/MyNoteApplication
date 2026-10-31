import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PageStorage } from './storage'
import type { PageUpdate } from '../src/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Built directory structure
//
// ├─┬ dist-electron
// │ ├── main.js
// │ └── preload.cjs
// ├─┬ dist
// │ └── index.html
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

const isMac = process.platform === 'darwin'

// Allow overriding the data folder (useful for testing / portable setups).
if (process.env.NOTION_CLONE_DATA_DIR) app.setPath('userData', process.env.NOTION_CLONE_DATA_DIR)

let win: BrowserWindow | null = null
let storage: PageStorage

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    // Frameless look: macOS keeps native traffic lights inset into our header,
    // Windows/Linux draw custom controls in the renderer (see TitleBar).
    titleBarStyle: 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 14 } } : { frame: false }),
    backgroundColor: '#191919',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  win.once('ready-to-show', () => win?.show())

  const sendMaximized = () => win?.webContents.send('window:maximized-changed', win.isMaximized())
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)

  // Ask the renderer to flush any pending debounced saves before closing.
  let flushed = false
  win.on('close', (event) => {
    if (flushed || !win || win.webContents.isDestroyed()) return
    event.preventDefault()
    const target = win
    const finish = () => {
      if (flushed) return
      flushed = true
      ipcMain.removeListener('app:flush-done', finish)
      if (!target.isDestroyed()) target.close()
    }
    ipcMain.once('app:flush-done', finish)
    setTimeout(finish, 3000) // never block closing forever
    target.webContents.send('app:flush-request')
  })

  // Open external links in the default browser; never navigate the app window away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function registerIpc() {
  // ---- Page CRUD -------------------------------------------------------
  ipcMain.handle('get-page-tree', () => storage.getTree())
  ipcMain.handle('read-page', (_e, id: string) => storage.read(id))
  ipcMain.handle('save-page', (_e, update: PageUpdate) => storage.save(update))
  ipcMain.handle('delete-page', (_e, id: string) => storage.delete(id))
  ipcMain.handle('search-pages', (_e, query: string) => storage.search(query))

  // ---- Window controls (custom title bar on Windows/Linux) ---------------
  const fromEvent = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(e.sender)
  ipcMain.on('window:minimize', (e) => fromEvent(e)?.minimize())
  ipcMain.on('window:toggle-maximize', (e) => {
    const w = fromEvent(e)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on('window:close', (e) => fromEvent(e)?.close())
  ipcMain.handle('window:is-maximized', (e) => fromEvent(e)?.isMaximized() ?? false)
}

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

void app.whenReady().then(() => {
  storage = new PageStorage(app.getPath('userData'))
  registerIpc()
  createWindow()
})
