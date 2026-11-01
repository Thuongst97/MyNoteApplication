import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, Notification, protocol, screen, session, shell, Tray, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { PageStorage } from './storage'
import { ASSET_SCHEME, AssetStorage } from './assets'
import type { PageUpdate, TaskSettings, TaskUpdate } from '../src/types'
import { TaskStore } from './tasks'
import { LibraryStore } from './libraries'
import { addLibraryUrlFrom, libraryFileUrlFrom, libraryNameFrom } from '../src/lib/libraries'
import { notificationText } from '../src/lib/reminders'
import { assetResponseHeaders, FONT_SCHEME, isAppUrl, isPermissionAllowed, isSafeExternalUrl, resolveBundledFont } from './security'
import { defaultRestoreBounds, fillsWorkArea } from './windowState'
import { exportPages, fileNameFor, importPages, MAX_IMPORT_BYTES, PAGE_FILE_EXT, parseBundle } from './pageTransfer'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

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
const dataDirOverride = process.env.PREMIUMNOTE_DATA_DIR || process.env.NOTION_CLONE_DATA_DIR
if (dataDirOverride) app.setPath('userData', dataDirOverride)
else {
  // The app was renamed (NotionClone → PremiumNote, package name Premium-Note), which changes
  // Electron's default data folder. Keep using the existing notes folder so nothing is lost
  // or duplicated.
  const current = app.getPath('userData')
  if (!existsSync(path.join(current, 'pages'))) {
    for (const old of ['PremiumNote', 'Premium-Note', 'NotionClone', 'notion-clone']) {
      const dir = path.join(app.getPath('appData'), old)
      if (existsSync(path.join(dir, 'pages'))) {
        app.setPath('userData', dir)
        break
      }
    }
  }
}

// Must happen before the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  // Excalidraw fetch()es its fonts, which doesn't work for file:// URLs; the bundled fonts are
  // served read-only from here instead (otherwise it falls back to a CDN the CSP blocks).
  { scheme: FONT_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

// Kept from the app's former name so installs upgrade in place and notifications keep working.
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
  tray.setToolTip('PremiumNote')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open PremiumNote', click: () => showWindow() },
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
  // Files are never saved to disk from this window. The site's "Download" button fetches an
  // .excalidrawlib file: that is offered for installation instead (same checks as "Add to Excalidraw").
  /**
   * Dialogs for this window. On macOS a dialog with a parent is a *sheet*; when the app is in
   * full screen the libraries window lands in a full-screen space where that sheet can stay
   * invisible, so clicks seemed to do nothing. There, use app-modal dialogs (always visible).
   */
  const ask = (opts: Electron.MessageBoxOptions) => {
    const parent = browseWin && !browseWin.isDestroyed() ? browseWin : win
    return isMac || !parent ? dialog.showMessageBox(opts) : dialog.showMessageBox(parent, opts)
  }
  browseSession.removeAllListeners('will-download')
  browseSession.on('will-download', (ev, item) => {
    ev.preventDefault()
    const url = item.getURL()
    if (libraryFileUrlFrom(url, { allowLocalHttp: isDev })) confirmAndInstall(url)
    else
      void ask({
        type: 'info',
        message: 'Use “Add to Excalidraw” to install this library',
        detail: 'Downloads are turned off in this window. “Add to Excalidraw” saves the library straight into your libraries.',
      })
  })
  browseWin = new BrowserWindow({
    width: 1180,
    height: 820,
    title: 'Excalidraw Libraries',
    // On macOS a child of a full-screen window is pushed into full screen too (and its dialogs
    // misbehave), so there it's a normal standalone window that can't go full screen.
    ...(isMac ? { fullscreenable: false, center: true } : { parent: win ?? undefined }),
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, session: browseSession, devTools: isDev },
  })
  const siteHost = new URL(site).host
  /**
   * "Add to Excalidraw" (…#addLibrary=<url>) and "Download" (a plain link to the .excalidrawlib
   * file) both install the library. The download link is caught when the window navigates to it,
   * before any response: whether the response would become a download depends on the server's
   * content type and the platform, which made "Download" work on Windows but not on macOS.
   */
  const handleAdd = (url: string) => {
    const lib = addLibraryUrlFrom(url, { allowLocalHttp: isDev }) ?? libraryFileUrlFrom(url, { allowLocalHttp: isDev })
    if (!lib) return false
    confirmAndInstall(lib)
    return true
  }
  function confirmAndInstall(lib: string) {
    // The website asks to install; the user confirms (a page can't install things on its own).
    void ask({
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
        void ask({ type: 'error', message: 'Could not install the library', detail: err.message })
      })
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

/** Last non-maximized bounds per window, for Restore. */
const normalBounds = new Map<number, Electron.Rectangle>()

function isWindowMaximized(w: BrowserWindow) {
  if (w.isMaximized()) return true
  if (w.isMinimized() || w.isFullScreen()) return false
  const b = w.getBounds()
  return fillsWorkArea(b, screen.getDisplayMatching(b).workArea)
}

/**
 * Windows: the multi-size .ico shipped next to the app (sharp at 16/24/32/48 px in the
 * title bar and taskbar). Elsewhere, and in development, the 256 px PNG.
 */
function windowIcon() {
  if (process.platform === 'win32' && app.isPackaged) {
    const ico = path.join(process.resourcesPath, 'icon.ico')
    if (existsSync(ico)) return ico
  }
  return nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'app-icon.png'))
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
    // Window/taskbar icon on Windows & Linux (macOS uses the app bundle's icon).
    ...(!isMac && { icon: windowIcon() }),
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

  if (process.platform === 'win32' && app.isPackaged) {
    // Tell the taskbar explicitly which app this window is and which icon to use, so it
    // never shows a stale icon Windows cached for this app id (e.g. Electron's default).
    win.setAppDetails({
      appId: APP_ID,
      appIconPath: process.execPath,
      appIconIndex: 0,
      relaunchCommand: `"${process.execPath}"`,
      relaunchDisplayName: 'PremiumNote',
    })
  }
  win.once('ready-to-show', () => win?.show())

  // Keep the title-bar button in sync, including OS snapping that fires no maximize events.
  let lastMaximized: boolean | null = null
  const sendMaximized = () => {
    if (!win || win.isDestroyed()) return
    const maximized = isWindowMaximized(win)
    if (!maximized && !win.isMinimized() && !win.isFullScreen()) normalBounds.set(win.id, win.getBounds())
    if (maximized === lastMaximized) return
    lastMaximized = maximized
    win.webContents.send('window:maximized-changed', maximized)
  }
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)
  win.on('restore', sendMaximized)
  win.on('resize', sendMaximized)
  win.on('move', sendMaximized)
  win.on('enter-full-screen', sendMaximized)
  win.on('leave-full-screen', sendMaximized)

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
            notify('PremiumNote is still running', 'Task reminders will keep arriving. Quit from the tray icon.')
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

  // ---- Page files (export / import) ---------------------------------------
  handle('pages:export', async (e, id: string, includeChildren: boolean) => {
    const page = await storage.read(id)
    if (!page) throw new Error('Page not found')
    const parent = BrowserWindow.fromWebContents(e.sender) ?? win!
    const r = await dialog.showSaveDialog(parent, {
      title: 'Export page',
      defaultPath: path.join(app.getPath('documents'), fileNameFor(page.title, PAGE_FILE_EXT)),
      filters: [{ name: 'PremiumNote page', extensions: [PAGE_FILE_EXT] }],
    })
    if (r.canceled || !r.filePath) return { ok: false as const }
    const bundle = await exportPages(storage, assets, id, includeChildren === true)
    await fs.writeFile(r.filePath, JSON.stringify(bundle), 'utf8')
    return { ok: true as const, path: r.filePath, pages: bundle.pages.length, images: Object.keys(bundle.assets).length }
  })
  handle('pages:import', async (e, parentId: string | null) => {
    if (parentId !== null && !(await storage.read(parentId))) throw new Error('Page not found')
    const parent = BrowserWindow.fromWebContents(e.sender) ?? win!
    const r = await dialog.showOpenDialog(parent, {
      title: 'Import page',
      properties: ['openFile'],
      filters: [
        { name: 'Pages (PremiumNote, Markdown)', extensions: [PAGE_FILE_EXT, 'md', 'markdown', 'txt'] },
        { name: 'PremiumNote page', extensions: [PAGE_FILE_EXT] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      ],
    })
    const file = r.filePaths[0]
    if (r.canceled || !file) return null
    const { size } = await fs.stat(file)
    const ext = path.extname(file).slice(1).toLowerCase()
    const name = path.basename(file, path.extname(file))
    if (ext !== PAGE_FILE_EXT) {
      // Markdown is converted in the renderer (it needs the editor schema).
      if (size > 10 * 1024 * 1024) throw new Error('This Markdown file is too large (over 10 MB).')
      return { kind: 'markdown' as const, name, text: await fs.readFile(file, 'utf8') }
    }
    if (size > MAX_IMPORT_BYTES) throw new Error('This page file is too large (over 300 MB).')
    const bundle = parseBundle(await fs.readFile(file, 'utf8'))
    return { kind: 'pages' as const, ...(await importPages(storage, assets, bundle, parentId)) }
  })

  // ---- Window controls (custom title bar on Windows/Linux) ---------------
  const fromEvent = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(e.sender)
  on('window:minimize', (e) => fromEvent(e)?.minimize())
  on('window:toggle-maximize', (e) => {
    const w = fromEvent(e)
    if (!w) return
    if (w.isFullScreen()) {
      w.setFullScreen(false)
      return
    }
    if (!isWindowMaximized(w)) {
      w.maximize()
      return
    }
    w.unmaximize()
    // Snapped/OS-maximized frameless windows may ignore unmaximize(): restore the size ourselves.
    setTimeout(() => {
      if (w.isDestroyed() || !isWindowMaximized(w)) return
      const area = screen.getDisplayMatching(w.getBounds()).workArea
      const saved = normalBounds.get(w.id)
      w.setBounds(saved && !fillsWorkArea(saved, area) ? saved : defaultRestoreBounds(area))
    }, 50)
  })
  on('window:close', (e) => fromEvent(e)?.close())
  handle('window:is-maximized', (e) => {
    const w = fromEvent(e)
    return w ? isWindowMaximized(w) : false
  })
}

app.on('before-quit', () => {
  isQuitting = true
  // Best effort: a missing/stale cache only means changed pages are re-read next start.
  void storage?.flushIndex()
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

  // Serve Excalidraw's bundled fonts (only .woff2 files under excalidraw-assets/fonts/).
  protocol.handle(FONT_SCHEME, async (request) => {
    const file = resolveBundledFont(request.url, path.join(RENDERER_DIST, 'excalidraw-assets'))
    if (!file) return new Response('Not found', { status: 404 })
    try {
      const res = await net.fetch(pathToFileURL(file).toString())
      if (!res.ok) return new Response('Not found', { status: 404 })
      return new Response(res.body, {
        status: 200,
        headers: { 'Content-Type': 'font/woff2', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'max-age=31536000, immutable' },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  // Serve stored images. Only files inside the assets folder with names we generated are reachable.
  protocol.handle(ASSET_SCHEME, async (request) => {
    const hit = assets.resolve(request.url)
    if (!hit) return new Response('Not found', { status: 404 })
    try {
      const res = await net.fetch(pathToFileURL(hit.file).toString())
      return new Response(res.body, { status: res.status, headers: assetResponseHeaders(hit.mime, request.headers.get('origin')) })
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
