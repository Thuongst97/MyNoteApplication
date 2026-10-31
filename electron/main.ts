import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, Notification, protocol, shell, Tray } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { PageStorage } from './storage'
import { ASSET_SCHEME, AssetStorage } from './assets'
import type { PageUpdate, TaskSettings, TaskUpdate } from '../src/types'
import { TaskStore } from './tasks'
import { notificationText } from '../src/lib/reminders'

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

// Must happen before the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

const APP_ID = 'com.thuong.notionclone'
const REMINDER_CHECK_MS = 15_000

let win: BrowserWindow | null = null
let storage: PageStorage
let assets: AssetStorage
let tasks: TaskStore
let tray: Tray | null = null
let isQuitting = false
let toldAboutBackground = false
/** Keep notifications referenced, otherwise their click handlers can be garbage-collected. */
const liveNotifications = new Set<Notification>()

// Only one instance: a second launch focuses the existing window (important when running in the tray).
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
}
if (process.platform === 'win32') app.setAppUserModelId(APP_ID)

/** Windows/Linux keep running in the tray after the window is closed (if enabled). */
async function shouldHideOnClose() {
  if (isMac || isQuitting) return false
  return (await tasks.getSettings()).runInBackground
}

function showWindow() {
  if (!app.isReady()) return
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function trayIconPath() {
  return path.join(process.env.VITE_PUBLIC, 'tray.png')
}

function ensureTray() {
  if (isMac || tray) return
  tray = new Tray(nativeImage.createFromPath(trayIconPath()))
  tray.setToolTip('NotionClone')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open NotionClone', click: () => showWindow() },
      { label: 'Open Tasks', click: () => openTaskInWindow(null) },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => showWindow())
}

function destroyTray() {
  tray?.destroy()
  tray = null
}

function openTaskInWindow(taskId: string | null) {
  const send = () => win?.webContents.send('tasks:open', taskId)
  if (!win || win.isDestroyed()) {
    createWindow()
    win!.webContents.once('did-finish-load', () => setTimeout(send, 300))
  } else {
    showWindow()
    send()
  }
}

function notify(title: string, body: string, onClick?: () => void) {
  if (!Notification.isSupported()) return false
  const n = new Notification({ title, body, icon: trayIconPath(), silent: false })
  liveNotifications.add(n)
  const drop = () => liveNotifications.delete(n)
  n.on('click', () => {
    drop()
    onClick?.()
  })
  n.on('close', drop)
  n.on('failed', drop)
  n.show()
  return true
}

async function checkReminders() {
  try {
    const now = Date.now()
    const due = await tasks.takeDueReminders(now, REMINDER_CHECK_MS)
    for (const item of due) {
      const { title, body } = notificationText(item, now)
      notify(title, body, () => openTaskInWindow(item.task.id))
    }
    if (due.length) win?.webContents.send('tasks:changed')
  } catch (err) {
    console.error('[reminders] check failed:', err)
  }
}

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
  let hideDecided = false
  win.on('close', (event) => {
    if (flushed || !win || win.webContents.isDestroyed()) return
    event.preventDefault()
    const target = win
    // First decide whether this close should just hide the window to the tray.
    if (!hideDecided) {
      void shouldHideOnClose().then((hide) => {
        if (target.isDestroyed()) return
        if (hide) {
          target.webContents.send('app:flush-request')
          target.hide()
          ensureTray()
          if (!toldAboutBackground) {
            toldAboutBackground = true
            notify('NotionClone is still running', 'Task reminders will keep arriving. Quit from the tray icon.')
          }
        } else {
          hideDecided = true
          target.close()
        }
      })
      return
    }
    const finish = () => {
      if (flushed) return
      flushed = true
      ipcMain.removeListener('app:flush-done', finish)
      if (!target.isDestroyed()) target.close()
    }
    hideDecided = false
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
  // ---- Tasks & reminders ------------------------------------------------
  ipcMain.handle('tasks:list', () => tasks.list())
  ipcMain.handle('tasks:save', async (_e, update: TaskUpdate) => {
    const t = await tasks.save(update)
    void checkReminders()
    return t
  })
  ipcMain.handle('tasks:remove', (_e, id: string) => tasks.remove(id))
  ipcMain.handle('tasks:get-settings', () => tasks.getSettings())
  ipcMain.handle('tasks:set-settings', async (_e, patch: Partial<TaskSettings>) => {
    const next = await tasks.setSettings(patch)
    if (!isMac && !next.runInBackground) destroyTray()
    return next
  })
  ipcMain.handle('tasks:test-notification', () =>
    notify('🔔 Notifications are working', 'You will be reminded about tasks like this.', () => showWindow()),
  )

  ipcMain.handle('save-asset', (_e, data: Uint8Array, mime: string) => assets.save(data, mime))

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

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
    win = null
  }
})

app.on('activate', () => showWindow())

void app.whenReady().then(() => {
  storage = new PageStorage(app.getPath('userData'))
  assets = new AssetStorage(app.getPath('userData'))

  // Serve stored images. Only files inside the assets folder with names we generated are reachable.
  protocol.handle(ASSET_SCHEME, async (request) => {
    const hit = assets.resolve(request.url)
    if (!hit) return new Response('Not found', { status: 404 })
    try {
      const res = await net.fetch(pathToFileURL(hit.file).toString())
      return new Response(res.body, { status: res.status, headers: { 'content-type': hit.mime } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  // Remove images no page uses anymore (in the background).
  void storage
    .pageFiles()
    .then((files) => assets.collectGarbage(files))
    .catch((err) => console.error('[assets] cleanup failed:', err))

  tasks = new TaskStore(app.getPath('userData'))

  registerIpc()
  createWindow()

  // Reminder scheduler: runs in the main process so it works while the window is hidden/closed.
  void checkReminders()
  setInterval(() => void checkReminders(), REMINDER_CHECK_MS)
})
