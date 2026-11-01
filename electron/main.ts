import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, Notification, protocol, session, shell, Tray, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { PageStorage } from './storage'
import { ASSET_SCHEME, AssetStorage } from './assets'
import type { PageUpdate, TaskSettings, TaskUpdate } from '../src/types'
import { TaskStore } from './tasks'
import { LibraryStore } from './libraries'
import { addLibraryUrlFrom, libraryNameFrom } from '../src/lib/libraries'
import { notificationText } from '../src/lib/reminders'
import { assetResponseHeaders, isAppUrl, isPermissionAllowed, isSafeExternalUrl } from './security'

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
/** Development/test builds only: never true in a packaged release. */
const isDev = !app.isPackaged

/** Is this one of the app's own pages (not the libraries website or anything else)? */
const isApp = (url: string | undefined | null) =>
  isAppUrl(url, { devServerUrl: VITE_DEV_SERVER_URL, rendererIndexFile: path.join(RENDERER_DIST, 'index.html') })

/**
 * Only the app's own pages may call into the main process. (The libraries website in the
 * browse window has no preload, but this also guards against any future window.)
 */
function trusted(e: IpcMainEvent | IpcMainInvokeEvent) {
  const ok = isApp(e.senderFrame?.url)
  if (!ok) console.warn('[security] blocked IPC from', e.senderFrame?.url)
  return ok
}
const handle = <A extends unknown[], R>(channel: string, fn: (e: IpcMainInvokeEvent, ...args: A) => R) =>
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('Not allowed')
    return fn(e, ...(args as A))
  })
const on = (channel: string, fn: (e: IpcMainEvent) => void) =>
  ipcMain.on(channel, (e) => {
    if (trusted(e)) fn(e)
  })

process.on('unhandledRejection', (reason) => console.error('[main] unhandled rejection:', reason))
process.on('uncaughtException', (err) => console.error('[main] uncaught exception:', err))

// Defaults for every window/webview: no <webview>, no new windows, no navigation away.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (ev) => ev.preventDefault())
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (ev, url) => {
    if (!isApp(url) && contents !== browseWin?.webContents) ev.preventDefault()
  })
})

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
let libraries: LibraryStore
let browseWin: BrowserWindow | null = null
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
  // A NativeImage (not a path): Windows can't read icon files from inside the app archive.
  const n = new Notification({ title, body, icon: nativeImage.createFromPath(trayIconPath()), silent: false })
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

/**
 * Opens libraries.excalidraw.com in a sandboxed window. Its "Add to Excalidraw" button
 * navigates to …#addLibrary=<url>; we intercept that, download the library and save it.
 */
function openLibraryBrowser() {
  if (browseWin && !browseWin.isDestroyed()) {
    browseWin.focus()
    return
  }
  const site =
    (isDev && process.env.NOTION_CLONE_LIBRARIES_URL) ||
    'https://libraries.excalidraw.com/?theme=light&sort=default&target=_self&useHash=true&referrer=' +
      encodeURIComponent('https://excalidraw.com/')
  // A separate, in-memory session: the website can't see the app's storage or the
  // notion-asset:// protocol, can't ask for permissions and can't download files.
  const browseSession = session.fromPartition('libraries-browse')
  browseSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false))
  browseSession.setPermissionCheckHandler(() => false)
  browseSession.on('will-download', (ev) => ev.preventDefault())
  browseWin = new BrowserWindow({
    width: 1180,
    height: 820,
    title: 'Browse libraries',
    parent: win ?? undefined,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, session: browseSession, devTools: isDev },
  })
  const siteHost = new URL(site).host
  const handleAdd = (url: string) => {
    const lib = addLibraryUrlFrom(url, { allowLocalHttp: isDev })
    if (!lib) return false
    // The website asks to install; the user confirms (a page can't install things on its own).
    void dialog
      .showMessageBox(browseWin ?? win!, {
        type: 'question',
        buttons: ['Install', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        message: `Install the library “${libraryNameFrom(lib)}”?`,
        detail: `It will be downloaded from ${new URL(lib).host} and saved in your libraries.`,
      })
      .then(({ response }) => (response === 0 ? libraries.installFromUrl(lib, { allowLocalHttp: isDev }) : null))
      .then((r) => {
        if (!r) return
        const name = r.data.categories.find((c) => c.id === r.categoryId)?.name ?? libraryNameFrom(lib)
        for (const w of BrowserWindow.getAllWindows()) if (w !== browseWin) w.webContents.send('libraries:installed', { ...r, name })
        notify('Library installed', `“${name}” was added to your libraries.`)
      })
      .catch((err: Error) => {
        void dialog.showMessageBox(browseWin ?? win!, { type: 'error', message: 'Could not install the library', detail: err.message })
      })
    return true
  }
  const contents = browseWin.webContents
  contents.on('will-navigate', (e, url) => {
    if (handleAdd(url)) return e.preventDefault()
    // Stay on the libraries site; anything else opens in the normal browser.
    let host = ''
    try {
      host = new URL(url).host
    } catch {
      // invalid URL: blocked below
    }
    if (host !== siteHost) {
      e.preventDefault()
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
    }
  })
  contents.on('will-redirect', (e, url) => {
    if (handleAdd(url)) e.preventDefault()
  })
  contents.setWindowOpenHandler(({ url }) => {
    if (!handleAdd(url) && isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  browseWin.on('closed', () => (browseWin = null))
  void browseWin.loadURL(site)
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
      webSecurity: true,
      spellcheck: true,
      devTools: isDev,
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

      if (!target.isDestroyed()) target.close()
    }
    hideDecided = false
    // Only the window's own page may confirm that it saved everything.
    const onDone = (e: IpcMainEvent) => {
      if (e.sender === target.webContents && trusted(e)) finish()
    }
    ipcMain.on('app:flush-done', onDone)
    target.once('closed', () => ipcMain.removeListener('app:flush-done', onDone))
    setTimeout(finish, 3000) // never block closing forever
    target.webContents.send('app:flush-request')
  })

  // Open external links in the default browser; never navigate the app window away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (VITE_DEV_SERVER_URL && isApp(url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function registerIpc() {
  // ---- Page CRUD -------------------------------------------------------
  handle('get-page-tree', () => storage.getTree())
  handle('read-page', (_e, id: string) => storage.read(id))
  handle('save-page', (_e, update: PageUpdate) => storage.save(update))
  handle('delete-page', (_e, id: string) => storage.delete(id))
  handle('get-links', () => storage.getLinks())
  handle('search-pages', (_e, query: string) => storage.search(query))
  // ---- Drawing libraries ------------------------------------------------
  handle('libraries:get', () => libraries.get())
  handle('libraries:save', (_e, data: unknown) => libraries.save(data))
  handle('libraries:install-url', (_e, url: string) => libraries.installFromUrl(String(url), { allowLocalHttp: isDev }))
  handle('libraries:import-file', async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const r = await dialog.showOpenDialog(parent!, {
      title: 'Import library',
      filters: [{ name: 'Excalidraw library', extensions: ['excalidrawlib', 'json'] }],
      properties: ['openFile'],
    })
    if (r.canceled || !r.filePaths[0]) return null
    return libraries.importFile(r.filePaths[0])
  })
  handle('libraries:browse', () => openLibraryBrowser())

  // ---- Tasks & reminders ------------------------------------------------
  handle('tasks:list', () => tasks.list())
  handle('tasks:save', async (_e, update: TaskUpdate) => {
    const t = await tasks.save(update)
    void checkReminders()
    return t
  })
  handle('tasks:remove', (_e, id: string) => tasks.remove(id))
  handle('tasks:get-settings', () => tasks.getSettings())
  handle('tasks:set-settings', async (_e, patch: Partial<TaskSettings>) => {
    const next = await tasks.setSettings(patch)
    if (!isMac && !next.runInBackground) destroyTray()
    return next
  })
  handle('tasks:test-notification', () =>
    notify('🔔 Notifications are working', 'You will be reminded about tasks like this.', () => showWindow()),
  )

  handle('save-asset', (_e, data: Uint8Array, mime: string) => assets.save(data, mime))

  // ---- Window controls (custom title bar on Windows/Linux) ---------------
  const fromEvent = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(e.sender)
  on('window:minimize', (e) => fromEvent(e)?.minimize())
  on('window:toggle-maximize', (e) => {
    const w = fromEvent(e)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  on('window:close', (e) => fromEvent(e)?.close())
  handle('window:is-maximized', (e) => fromEvent(e)?.isMaximized() ?? false)
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

function buildMenu() {
  // Edit commands (copy/paste/undo shortcuts on macOS) and zoom; no reload or dev tools in releases.
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

void app.whenReady().then(() => {
  buildMenu()
  // Electron grants every permission by default; only allow what the app needs, only to the app.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) =>
    cb(isPermissionAllowed(permission, details.requestingUrl || wc.getURL(), isApp)),
  )
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) =>
    isPermissionAllowed(permission, details.requestingUrl || requestingOrigin, isApp),
  )
  storage = new PageStorage(app.getPath('userData'))
  assets = new AssetStorage(app.getPath('userData'))

  // Serve stored images. Only files inside the assets folder with names we generated are reachable.
  protocol.handle(ASSET_SCHEME, async (request) => {
    const hit = assets.resolve(request.url)
    if (!hit) return new Response('Not found', { status: 404 })
    try {
      const res = await net.fetch(pathToFileURL(hit.file).toString())
      return new Response(res.body, { status: res.status, headers: assetResponseHeaders(hit.mime) })
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
  libraries = new LibraryStore(app.getPath('userData'))

  registerIpc()
  createWindow()

  // Reminder scheduler: runs in the main process so it works while the window is hidden/closed.
  void checkReminders()
  setInterval(() => void checkReminders(), REMINDER_CHECK_MS)
})
